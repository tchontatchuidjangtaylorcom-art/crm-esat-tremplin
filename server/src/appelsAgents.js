// Comptage des appels de chaque agent : un appel = un clic sur un numéro de
// la fiche (lien tel:) ou sur le bouton "copier" (pour Aircall ou une autre
// application). Anti-doublon : un même numéro ne compte qu'UNE fois par agent
// et par jour, quel que soit le nombre de clics ou de copies — on ne peut pas
// gonfler son compteur en cliquant plusieurs fois.
//
// Ajouté aux KPI de présence (/api/presence/moi et /equipe, voir index.js) :
// appels et entreprises distinctes appelées, par jour et sur la semaine.
import { nanoid } from "nanoid";
import db from "./db.js";
import { jourLocal } from "./presence.js";

const chiffres = (n) => String(n || "").replace(/\D/g, "");

function journal() {
  if (!Array.isArray(db.data.appelsAgents)) db.data.appelsAgents = [];
  return db.data.appelsAgents;
}

// Appels d'un agent sur une liste de jours ("AAAA-MM-JJ").
export function statsAppels(utilisateurId, jours) {
  const ensemble = new Set(jours);
  const lignes = journal().filter((a) => a.utilisateurId === utilisateurId && ensemble.has(a.jour));
  const parJour = Object.fromEntries(jours.map((j) => [j, { appels: 0, entreprises: new Set() }]));
  for (const a of lignes) {
    parJour[a.jour].appels += 1;
    parJour[a.jour].entreprises.add(a.entrepriseId);
  }
  return {
    appels: lignes.length,
    entreprises: new Set(lignes.map((a) => a.entrepriseId)).size,
    parJour: Object.fromEntries(
      Object.entries(parJour).map(([j, v]) => [j, { appels: v.appels, entreprises: v.entreprises.size }])
    ),
  };
}

// Complète un résultat de calculerKpiAgent avec les appels (semaine affichée
// et aujourd'hui).
export function ajouterAppelsAuxKpi(kpi, utilisateurId) {
  const jours = kpi.semaine.jours.map((j) => j.jour);
  const semaine = statsAppels(utilisateurId, jours);
  const aujourdHui = statsAppels(utilisateurId, [kpi.aujourdHui.jour]);
  return {
    ...kpi,
    aujourdHui: { ...kpi.aujourdHui, appels: aujourdHui.appels, entreprisesAppelees: aujourdHui.entreprises },
    semaine: {
      ...kpi.semaine,
      appels: semaine.appels,
      entreprisesAppelees: semaine.entreprises,
      jours: kpi.semaine.jours.map((j) => ({ ...j, ...semaine.parJour[j.jour] })),
    },
  };
}

export function enregistrerRoutesAppelsAgents(app, { exigerAuth, chargerEntrepriseAutorisee }) {
  app.post("/api/entreprises/:id/appel-compte", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
    const numero = chiffres(req.body.numero);
    if (numero.length < 9) return res.status(400).json({ error: "Numéro invalide." });
    // Le numéro doit appartenir à la fiche (principal ou supplémentaire).
    const contact = req.entreprise.contact || {};
    const numerosFiche = [contact.telephone, ...(contact.telephonesAlternatifs || []).map((t) => t.numero)].map(chiffres);
    if (!numerosFiche.includes(numero)) return res.status(400).json({ error: "Numéro inconnu pour cette fiche." });

    const jour = jourLocal();
    const utilisateurId = req.utilisateur.id;
    const dejaCompte = journal().some((a) => a.utilisateurId === utilisateurId && a.numero === numero && a.jour === jour);
    if (!dejaCompte) {
      journal().push({
        id: nanoid(),
        utilisateurId,
        entrepriseId: req.entreprise.id,
        numero,
        jour,
        date: new Date().toISOString(),
        moyen: req.body.moyen === "copie" ? "copie" : "lien",
      });
      await db.write();
    }
    res.json({ compte: !dejaCompte, appelsAujourdHui: statsAppels(utilisateurId, [jour]).appels });
  });
}
