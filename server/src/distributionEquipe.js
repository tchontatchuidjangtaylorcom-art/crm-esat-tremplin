// Distribution en un clic : donne N fiches à chaque personne choisie (toute
// l'équipe, ou une sélection d'agents), pour lancer une session de travail
// sans assigner les fiches une par une.
//
// Fiches distribuées, selon le statut choisi :
//  - "Nouveau" : fiches sans agent ;
//  - NRP 1, NRP 2, À relancer, Mail, Autre : fiches de ce statut, qu'elles
//    aient déjà un agent ou non (redistribution : un autre agent retente).
//    Elles repartent en « Nouveau » chez leur nouvel agent, avec une ligne
//    dans l'historique qui garde la trace du statut d'avant.
// Priorité aux entreprises assujetties (20 salariés et plus) qui ont un
// numéro (voir ordreFiches dans index.js). Distribution en tourniquet : tout
// le monde reçoit une fiche avant que quiconque n'en reçoive une deuxième, et
// une fiche n'est jamais redonnée à l'agent qui l'avait déjà.
import { nanoid } from "nanoid";
import db from "./db.js";

const MAX_PAR_PERSONNE = 200;

export const STATUTS_DISTRIBUABLES = {
  nouveau: "Nouveau (non assignées)",
  nrp: "NRP 1",
  nrp2: "NRP 2",
  a_relancer: "À relancer",
  mail: "Mail",
  autre: "Autre",
};

function fichesSource(statut) {
  return db.data.entreprises.filter((e) =>
    statut === "nouveau" ? !e.assigneA && e.statut === "nouveau" : e.statut === statut
  );
}

export function enregistrerRoutesDistributionEquipe(app, { exigerAdmin, estAdmin, ordreFiches, apresAttribution, libelleStatut }) {
  // Nombre de fiches disponibles par statut, pour la liste du panneau.
  app.get("/api/equipe/distribuer/apercu", exigerAdmin, (req, res) => {
    res.json(
      Object.entries(STATUTS_DISTRIBUABLES).map(([statut, label]) => ({ statut, label, disponibles: fichesSource(statut).length }))
    );
  });

  app.post("/api/equipe/distribuer", exigerAdmin, async (req, res) => {
    const parPersonne = Math.min(Math.max(1, Number(req.body.parPersonne) || 1), MAX_PAR_PERSONNE);
    const inclureAdmins = req.body.inclureAdmins !== false;
    const statutSource = STATUTS_DISTRIBUABLES[req.body.statut] ? req.body.statut : "nouveau";
    const choisis = Array.isArray(req.body.membres) && req.body.membres.length ? new Set(req.body.membres) : null;

    const equipe = db.data.utilisateurs.filter(
      (u) => u.statut === "valide" && (choisis ? choisis.has(u.id) : inclureAdmins || !estAdmin(u))
    );
    if (equipe.length === 0) return res.status(400).json({ error: "Aucune personne choisie (ou compte non validé)." });

    const disponibles = fichesSource(statutSource).sort(ordreFiches);
    const prises = new Set();

    const maintenant = new Date().toISOString();
    const auteur = req.utilisateur.prenom || req.utilisateur.email;
    const parMembre = new Map(equipe.map((u) => [u.id, []]));
    const fichesParMembre = new Map(equipe.map((u) => [u.id, []]));
    for (let tour = 0; tour < parPersonne; tour++) {
      let donneesCeTour = 0;
      for (const membre of equipe) {
        const fiche = disponibles.find((e) => !prises.has(e.id) && e.assigneA !== membre.id);
        if (!fiche) continue;
        prises.add(fiche.id);
        donneesCeTour += 1;

        const ancienStatut = fiche.statut;
        const ancienAgent = fiche.assigneA && db.data.utilisateurs.find((u) => u.id === fiche.assigneA);
        fiche.assigneA = membre.id;
        fiche.assignationVue = membre.id === req.utilisateur.id;
        fiche.dateAssignation = maintenant;
        if (ancienStatut !== "nouveau") {
          fiche.statut = "nouveau";
          fiche.dateRappel = null;
          fiche.dateRdv = null;
        }
        fiche.commentaires = Array.isArray(fiche.commentaires) ? fiche.commentaires : [];
        fiche.commentaires.unshift({
          id: nanoid(),
          date: maintenant,
          auteur: "Système",
          texte:
            `Fiche attribuée à ${membre.prenom || membre.email} (distribution par ${auteur})` +
            (ancienStatut !== "nouveau"
              ? ` : ${libelleStatut?.(ancienStatut) || ancienStatut}${
                  ancienAgent ? ` chez ${ancienAgent.prenom || ancienAgent.email}` : ""
                }, remise en Nouveau.`
              : "."),
        });
        parMembre.get(membre.id).push(fiche.nom);
        fichesParMembre.get(membre.id).push(fiche);
      }
      if (donneesCeTour === 0) break;
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
      statut: statutSource,
      statutLabel: STATUTS_DISTRIBUABLES[statutSource],
      total,
      fichesDisponiblesAvant: disponibles.length,
      manque: Math.max(0, parPersonne * equipe.length - total),
      repartition,
    });
  });
}
