// Comptage des appels de chaque agent. Un appel est compté :
//  - quand l'agent clique sur un numéro de la fiche (lien tel:) ou sur le
//    bouton "copier" (pour Aircall ou une autre application) ;
//  - quand il enregistre le résultat de l'appel (NRP 1, NRP 2, Me rappelle,
//    À rappeler, RDV, Mail, Client Potentiel, Refus…) : changer le statut
//    d'une fiche veut dire qu'il a appelé — y compris s'il a composé le
//    numéro à la main ou trouvé le numéro sur Google. Si un numéro de la
//    fiche a déjà été cliqué / copié dans l'heure, c'est le même appel : le
//    résultat le confirme, sans en compter un deuxième. Un même statut
//    re-confirmé (ex. NRP 1 de nouveau) est une nouvelle tentative.
// Deux compteurs :
//  - appels UNIQUES : un même numéro (ou une même fiche sans numéro) compte
//    une fois par agent et par jour ;
//  - appels EN DOUBLON : les nouvelles tentatives sur un numéro déjà appelé
//    le même jour (l'agent insiste pour joindre l'entreprise).
// Total = uniques + doublons. Garde-fou : plusieurs clics / copies du même
// numéro (ou plusieurs clics sur un statut) à moins d'une minute
// d'intervalle ne comptent qu'une fois — on ne peut pas gonfler son
// compteur en tapant plusieurs fois sur « copier ».
//
// Ajouté aux KPI de présence (/api/presence/moi et /equipe, voir index.js) :
// appels et entreprises distinctes appelées, par jour et sur la semaine.
import { nanoid } from "nanoid";
import db from "./db.js";
import { jourLocal } from "./presence.js";

const chiffres = (n) => String(n || "").replace(/\D/g, "");
const INTERVALLE_MIN_MS = 60 * 1000;
// Un clic sur le numéro suivi du résultat dans l'heure = un seul appel.
const FENETRE_CONFIRMATION_MS = 60 * 60 * 1000;
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
  const parJour = Object.fromEntries(jours.map((j) => [j, { appels: 0, total: 0, statut: 0, entreprises: new Set() }]));
  for (const a of lignes) {
    parJour[a.jour].total += 1;
    if (estUnique(a)) parJour[a.jour].appels += 1;
    if (a.moyen === "statut") parJour[a.jour].statut += 1;
    parJour[a.jour].entreprises.add(a.entrepriseId);
  }
  const uniques = lignes.filter(estUnique).length;
  return {
    // `appels` = appels uniques (nom conservé pour les écrans existants).
    appels: uniques,
    appelsTotal: lignes.length,
    appelsDoublons: lignes.length - uniques,
    // Appels comptés par le seul résultat enregistré (sans clic sur le numéro).
    appelsParStatut: lignes.filter((a) => a.moyen === "statut").length,
    entreprises: new Set(lignes.map((a) => a.entrepriseId)).size,
    parJour: Object.fromEntries(
      Object.entries(parJour).map(([j, v]) => [
        j,
        {
          appels: v.appels,
          appelsTotal: v.total,
          appelsDoublons: v.total - v.appels,
          appelsParStatut: v.statut,
          entreprises: v.entreprises.size,
        },
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
      appelsParStatut: aujourdHui.appelsParStatut,
      entreprisesAppelees: aujourdHui.entreprises,
    },
    semaine: {
      ...kpi.semaine,
      appels: semaine.appels,
      appelsTotal: semaine.appelsTotal,
      appelsDoublons: semaine.appelsDoublons,
      appelsParStatut: semaine.appelsParStatut,
      entreprisesAppelees: semaine.entreprises,
      jours: kpi.semaine.jours.map((j) => ({ ...j, ...semaine.parJour[j.jour] })),
    },
  };
}

// Statuts qui sont le résultat d'un appel (voir ISSUES_APPEL et
// SORTIES_DOSSIER dans index.js) — pas "Doublon" (rangement de fiche), ni
// "Nouveau" / "À relancer" (remise en file).
const RESULTATS_APPEL = new Set([
  "nrp",
  "nrp2",
  "me_rappelle",
  "a_rappeler",
  "rdv",
  "mail",
  "autre",
  "fiche",
  "fiche_one_shot",
  "conforme",
  "refus",
  "mort",
]);

export function estResultatAppel(statut) {
  return RESULTATS_APPEL.has(statut);
}

// Résultat d'appel enregistré par `utilisateurId` sur `entreprise` : compte
// un appel, ou confirme le clic sur le numéro fait juste avant (voir en-tête).
// N'écrit pas la base : l'appelant enregistre (db.write) avec le reste.
export function compterAppelStatut(utilisateurId, entreprise, issue, maintenant = new Date()) {
  if (!utilisateurId || !entreprise?.id || !estResultatAppel(issue)) return { compte: false };
  const jour = jourLocal(maintenant);
  const instant = maintenant.getTime();
  const numero = chiffres(entreprise.contact?.telephone);
  const duJour = journal().filter(
    (a) =>
      a.utilisateurId === utilisateurId &&
      a.jour === jour &&
      new Date(a.date).getTime() <= instant &&
      (a.entrepriseId === entreprise.id || (numero.length >= 9 && a.numero === numero))
  );
  const surFiche = duJour.filter((a) => a.entrepriseId === entreprise.id);
  const dernier = surFiche.reduce((m, a) => (!m || a.date > m.date ? a : m), null);
  const ecart = dernier ? instant - new Date(dernier.date).getTime() : Infinity;

  // Clic / copie du numéro juste avant, pas encore rattaché à un résultat.
  if (dernier && !dernier.issue && ecart <= FENETRE_CONFIRMATION_MS) {
    dernier.issue = issue;
    dernier.confirmeLe = maintenant.toISOString();
    return { compte: false, confirme: true };
  }
  // Double clic sur un statut.
  if (dernier && dernier.issue && ecart < INTERVALLE_MIN_MS) return { compte: false };

  journal().push({
    id: nanoid(),
    utilisateurId,
    entrepriseId: entreprise.id,
    numero,
    jour,
    date: maintenant.toISOString(),
    moyen: "statut",
    issue,
    unique: duJour.length === 0,
  });
  return { compte: true };
}

// Rattrapage (une seule fois) : les résultats d'appel enregistrés avant que
// le statut ne compte comme un appel. L'auteur de chaque résultat est lu dans
// le journal d'activité (journalAudit.js, en place depuis le 1er octobre
// 2026) ; sans auteur connu, rien n'est compté. Les reports de RDV / rappel
// ("déplacé au", "Reporté") et les changements groupés de plusieurs fiches
// ne sont pas des appels.
const VERSION_RATTRAPAGE = 1;

// Renvoie le nombre d'appels ajoutés, ou null si le rattrapage était déjà fait.
export function rattraperAppelsParStatut() {
  if ((db.data.rattrapageAppelsStatut || 0) >= VERSION_RATTRAPAGE) return null;
  const audit = (db.data.journalAudit || []).filter((e) =>
    ["Issue d'appel", "Sortie de dossier", "Changement de statut groupé"].includes(e.action)
  );
  const candidats = [];
  if (audit.length) {
    const PROCHE_MS = 15 * 1000;
    // Mise en service du journal (première ligne, toutes actions confondues) :
    // avant, aucun auteur n'est connu.
    const premiere = (db.data.journalAudit || []).reduce((m, e) => (e.date && e.date < m ? e.date : m), audit[0].date);
    const debutAudit = new Date(new Date(premiere).getTime() - PROCHE_MS).toISOString();
    for (const fiche of [...db.data.entreprises, ...db.data.archives]) {
      for (const h of fiche.historiqueAppels || []) {
        if (!h?.date || h.date < debutAudit || !estResultatAppel(h.issue)) continue;
        if (!["appel", "sortie"].includes(h.type)) continue;
        if (/déplacé au|^Reporté/i.test(h.details || "")) continue;
        const groupe = /changement groupé/.test(h.issueLabel || "");
        const t = new Date(h.date).getTime();
        const auteur = audit.find((e) => {
          if (Math.abs(new Date(e.date).getTime() - t) > PROCHE_MS) return false;
          if (groupe) return e.action === "Changement de statut groupé" && /(^|· )1 fiche\(s\)/.test(e.details || "");
          return e.action !== "Changement de statut groupé" && e.entrepriseId === fiche.id;
        });
        if (auteur) candidats.push({ utilisateurId: auteur.utilisateurId, fiche, issue: h.issue, date: new Date(h.date) });
      }
    }
  }
  candidats.sort((a, b) => a.date - b.date);
  let ajoutes = 0;
  for (const c of candidats) {
    if (compterAppelStatut(c.utilisateurId, c.fiche, c.issue, c.date).compte) ajoutes += 1;
  }
  db.data.rattrapageAppelsStatut = VERSION_RATTRAPAGE;
  if (ajoutes) console.log(`[appels] Rattrapage : ${ajoutes} appel(s) compté(s) d'après les statuts enregistrés.`);
  return ajoutes;
}

export function enregistrerRoutesAppelsAgents(app, { exigerAuth, chargerEntrepriseAutorisee }) {
  if (rattraperAppelsParStatut() !== null) db.write().catch(() => {});

  app.post("/api/entreprises/:id/appel-compte", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
    const recu = chiffres(req.body.numero);
    if (recu.length < 9) return res.status(400).json({ error: "Numéro invalide." });
    // Le numéro doit appartenir à la fiche (principal ou supplémentaire).
    // Comparé sur ses 9 derniers chiffres : "01 02…", "+33 1 02…" et
    // "0033 1 02…" sont le même numéro. Enregistré tel qu'il figure sur la
    // fiche, pour que uniques / doublons ne dépendent pas du format.
    const contact = req.entreprise.contact || {};
    const numerosFiche = [contact.telephone, ...(contact.telephonesAlternatifs || []).map((t) => t.numero)].map(chiffres);
    const numero = numerosFiche.find((n) => n.length >= 9 && n.slice(-9) === recu.slice(-9));
    if (!numero) return res.status(400).json({ error: "Numéro inconnu pour cette fiche." });

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
