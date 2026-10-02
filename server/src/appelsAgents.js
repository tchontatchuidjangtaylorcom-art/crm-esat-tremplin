// Comptage des appels de chaque agent : un appel = un clic sur un numéro de
// la fiche (lien tel:) ou sur le bouton "copier" (pour Aircall ou une autre
// application). Deux compteurs :
//  - appels UNIQUES : un même numéro compte une fois par agent et par jour ;
//  - appels EN DOUBLON : les nouvelles tentatives sur un numéro déjà appelé
//    le même jour (l'agent insiste pour joindre l'entreprise).
// Total = uniques + doublons. Garde-fou : plusieurs clics / copies du même
// numéro à moins d'une minute d'intervalle ne comptent qu'une fois — on ne
// peut pas gonfler son compteur en tapant plusieurs fois sur « copier ».
//
// Ajouté aux KPI de présence (/api/presence/moi et /equipe, voir index.js) :
// appels et entreprises distinctes appelées, par jour et sur la semaine.
import { nanoid } from "nanoid";
import db from "./db.js";
import { jourLocal } from "./presence.js";

const chiffres = (n) => String(n || "").replace(/\D/g, "");
const INTERVALLE_MIN_MS = 60 * 1000;
// Lignes enregistrées avant l'ajout des doublons : toutes uniques.
const estUnique = (a) => a.unique !== false;

function journal() {
  if (!Array.isArray(db.data.appelsAgents)) db.data.appelsAgents = [];
  return db.data.appelsAgents;
}

// Appels d'un agent sur une liste de jours ("AAAA-MM-JJ").
export function statsAppels(utilisateurId, jours) {
  const ensemble = new Set(jours);
  const lignes = journal().filter((a) => a.utilisateurId === utilisateurId && ensemble.has(a.jour));
  const parJour = Object.fromEntries(jours.map((j) => [j, { appels: 0, total: 0, entreprises: new Set() }]));
  for (const a of lignes) {
    parJour[a.jour].total += 1;
    if (estUnique(a)) parJour[a.jour].appels += 1;
    parJour[a.jour].entreprises.add(a.entrepriseId);
  }
  const uniques = lignes.filter(estUnique).length;
  return {
    // `appels` = appels uniques (nom conservé pour les écrans existants).
    appels: uniques,
    appelsTotal: lignes.length,
    appelsDoublons: lignes.length - uniques,
    entreprises: new Set(lignes.map((a) => a.entrepriseId)).size,
    parJour: Object.fromEntries(
      Object.entries(parJour).map(([j, v]) => [
        j,
        { appels: v.appels, appelsTotal: v.total, appelsDoublons: v.total - v.appels, entreprises: v.entreprises.size },
      ])
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
    aujourdHui: {
      ...kpi.aujourdHui,
      appels: aujourdHui.appels,
      appelsTotal: aujourdHui.appelsTotal,
      appelsDoublons: aujourdHui.appelsDoublons,
      entreprisesAppelees: aujourdHui.entreprises,
    },
    semaine: {
      ...kpi.semaine,
      appels: semaine.appels,
      appelsTotal: semaine.appelsTotal,
      appelsDoublons: semaine.appelsDoublons,
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
    const duJour = journal().filter((a) => a.utilisateurId === utilisateurId && a.numero === numero && a.jour === jour);
    const dernier = duJour.reduce((m, a) => (!m || a.date > m.date ? a : m), null);
    const tropRapproche = dernier && Date.now() - new Date(dernier.date).getTime() < INTERVALLE_MIN_MS;
    if (!tropRapproche) {
      journal().push({
        id: nanoid(),
        utilisateurId,
        entrepriseId: req.entreprise.id,
        numero,
        jour,
        date: new Date().toISOString(),
        moyen: req.body.moyen === "copie" ? "copie" : "lien",
        unique: duJour.length === 0,
      });
      await db.write();
    }
    const stats = statsAppels(utilisateurId, [jour]);
    res.json({
      compte: !tropRapproche,
      doublon: !tropRapproche && duJour.length > 0,
      appelsAujourdHui: stats.appels,
      appelsTotalAujourdHui: stats.appelsTotal,
    });
  });
}
