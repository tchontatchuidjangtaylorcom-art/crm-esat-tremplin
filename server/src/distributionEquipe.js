// Distribution en un clic : donne N fiches non assignées à CHAQUE membre de
// l'équipe (agents et, au choix, administrateurs), pour lancer une session de
// travail sans assigner les fiches une par une.
//
// Fiches distribuées : pipeline actif, statut "nouveau", sans agent, en
// priorité les entreprises assujetties (20 salariés et plus) qui ont déjà un
// numéro de téléphone. Distribution en tourniquet : tout le monde reçoit une
// fiche avant que quiconque n'en reçoive une deuxième — si les fiches
// manquent, la pénurie est répartie équitablement.
import { nanoid } from "nanoid";
import db from "./db.js";

const MAX_PAR_PERSONNE = 50;

export function enregistrerRoutesDistributionEquipe(app, { exigerAdmin, estAdmin, ordreFiches, apresAttribution }) {
  app.post("/api/equipe/distribuer", exigerAdmin, async (req, res) => {
    const parPersonne = Math.min(Math.max(1, Number(req.body.parPersonne) || 1), MAX_PAR_PERSONNE);
    const inclureAdmins = req.body.inclureAdmins !== false;

    const equipe = db.data.utilisateurs.filter((u) => u.statut === "valide" && (inclureAdmins || !estAdmin(u)));
    if (equipe.length === 0) return res.status(400).json({ error: "Aucun compte validé à qui distribuer des fiches." });

    const disponibles = db.data.entreprises
      .filter((e) => !e.assigneA && e.statut === "nouveau")
      .sort(ordreFiches);

    const maintenant = new Date().toISOString();
    const parMembre = new Map(equipe.map((u) => [u.id, []]));
    const fichesParMembre = new Map(equipe.map((u) => [u.id, []]));
    let i = 0;
    for (let tour = 0; tour < parPersonne; tour++) {
      for (const membre of equipe) {
        const fiche = disponibles[i++];
        if (!fiche) break;
        fiche.assigneA = membre.id;
        fiche.assignationVue = membre.id === req.utilisateur.id;
        fiche.dateAssignation = maintenant;
        fiche.commentaires = Array.isArray(fiche.commentaires) ? fiche.commentaires : [];
        fiche.commentaires.unshift({
          id: nanoid(),
          date: maintenant,
          auteur: "Système",
          texte: `Fiche attribuée à ${membre.prenom || membre.email} (distribution à toute l'équipe par ${
            req.utilisateur.prenom || req.utilisateur.email
          }).`,
        });
        parMembre.get(membre.id).push(fiche.nom);
        fichesParMembre.get(membre.id).push(fiche);
      }
      if (i >= disponibles.length) break;
    }
    await db.write();
    // Fiches distribuées sans numéro : Claude les cherche tout de suite, les
    // numéros apparaissent chez chaque agent au fur et à mesure.
    for (const [membreId, fiches] of fichesParMembre) apresAttribution?.(membreId, fiches);

    const repartition = equipe.map((u) => ({
      id: u.id,
      nom: [u.prenom, u.nom].filter(Boolean).join(" ") || u.email,
      role: u.role,
      fiches: parMembre.get(u.id),
    }));
    const total = repartition.reduce((t, r) => t + r.fiches.length, 0);
    res.json({
      parPersonne,
      total,
      fichesDisponiblesAvant: disponibles.length,
      manque: Math.max(0, parPersonne * equipe.length - disponibles.length),
      repartition,
    });
  });
}
