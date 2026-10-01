// Annulation d'une distribution d'équipe faite par erreur (voir
// distributionEquipe.js) : chaque fiche distribuée garde un commentaire
// "Système" du type
//   « Fiche attribuée à Arnauld (distribution par Philippe) : NRP 1 (…) chez
//     Frankie, remise en Nouveau. »
// (ou « … (distribution à toute l'équipe par …). » pour les fiches qui
// n'avaient pas d'agent). Ces commentaires suffisent à retrouver chaque
// distribution (même date à la milliseconde pour toutes ses fiches) et, pour
// chaque fiche, son agent et son statut d'avant — y compris pour les
// distributions faites avant l'ajout de cette fonction.
//
// Une fiche n'est rendue que si personne n'y a touché depuis : toujours chez
// l'agent qui l'a reçue, toujours en « Nouveau », et sans attribution plus
// récente. Les autres sont laissées telles quelles et listées.
import { nanoid } from "nanoid";
import db from "./db.js";

const ENTETE = /^Fiche attribuée à (.+?) \(distribution (?:à toute l'équipe )?par (.+?)\)(.*)$/s;
const SUFFIXE = ", remise en Nouveau.";
const STATUTS_POSSIBLES = ["nouveau", "nrp", "nrp2", "a_relancer", "mail", "autre", "me_rappelle", "a_rappeler", "rdv", "numero_invalide"];

function lireCommentaire(texte, libelleStatut) {
  const m = ENTETE.exec(texte || "");
  if (!m) return null;
  const [, versAgent, par, reste] = m;
  let ancienStatut = "nouveau";
  let ancienAgent = null;
  if (reste.startsWith(" : ") && reste.endsWith(SUFFIXE)) {
    const milieu = reste.slice(3, -SUFFIXE.length);
    // Libellé le plus long d'abord : certains contiennent une virgule ou
    // sont le début d'un autre.
    const candidats = STATUTS_POSSIBLES.map((s) => [s, libelleStatut(s)]).sort((a, b) => b[1].length - a[1].length);
    const trouve = candidats.find(([, l]) => milieu === l || milieu.startsWith(`${l} chez `));
    if (!trouve) return null;
    ancienStatut = trouve[0];
    if (milieu !== trouve[1]) ancienAgent = milieu.slice(trouve[1].length + " chez ".length);
  } else if (reste !== ".") {
    return null;
  }
  return { versAgent, par, ancienStatut, ancienAgent };
}

// Utilisateurs désignés dans les commentaires par leur prénom (ou leur
// e-mail s'ils n'en ont pas).
function trouverUtilisateurParNom(nom) {
  const correspondants = db.data.utilisateurs.filter((u) => (u.prenom || u.email) === nom || u.email === nom);
  return correspondants.length === 1 ? correspondants[0] : null;
}

function lotsDeDistribution(libelleStatut) {
  const lots = new Map();
  for (const fiche of db.data.entreprises) {
    const commentaires = Array.isArray(fiche.commentaires) ? fiche.commentaires : [];
    // Dernière attribution par distribution connue sur la fiche (les
    // commentaires sont du plus récent au plus ancien).
    const indexDerniere = commentaires.findIndex((c) => c.auteur === "Système" && ENTETE.test(c.texte || ""));
    commentaires.forEach((c, index) => {
      if (c.auteur !== "Système") return;
      const info = lireCommentaire(c.texte, libelleStatut);
      if (!info) return;
      const cle = `${c.date}|${info.par}`;
      if (!lots.has(cle)) lots.set(cle, { cle, date: c.date, par: info.par, fiches: [] });
      lots.get(cle).fiches.push({ fiche, info, plusRecente: index === indexDerniere });
    });
  }
  return [...lots.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function etatFiche({ fiche, info, plusRecente }) {
  const agent = trouverUtilisateurParNom(info.versAgent);
  if (!agent) return { annulable: false, raison: `agent « ${info.versAgent} » introuvable ou ambigu` };
  if (!plusRecente) return { annulable: false, raison: "réattribuée depuis" };
  if (fiche.assigneA !== agent.id) return { annulable: false, raison: "n'est plus chez cet agent" };
  if (fiche.statut !== "nouveau") return { annulable: false, raison: "déjà traitée (statut changé)" };
  if (info.ancienAgent && !trouverUtilisateurParNom(info.ancienAgent)) {
    return { annulable: false, raison: `ancien agent « ${info.ancienAgent} » introuvable ou ambigu` };
  }
  return { annulable: true };
}

export function enregistrerRoutesAnnulationDistribution(app, { exigerAdmin, libelleStatut }) {
  // Les 10 dernières distributions, avec ce qui peut encore être annulé.
  app.get("/api/equipe/distributions", exigerAdmin, (req, res) => {
    const lots = lotsDeDistribution(libelleStatut)
      .slice(0, 10)
      .map((lot) => {
        const parAgent = {};
        const provenances = {};
        let annulables = 0;
        for (const element of lot.fiches) {
          parAgent[element.info.versAgent] = (parAgent[element.info.versAgent] || 0) + 1;
          const provenance = element.info.ancienAgent
            ? `${libelleStatut(element.info.ancienStatut)} chez ${element.info.ancienAgent}`
            : element.info.ancienStatut === "nouveau"
              ? "Nouveau, sans agent"
              : `${libelleStatut(element.info.ancienStatut)}, sans agent`;
          provenances[provenance] = (provenances[provenance] || 0) + 1;
          if (etatFiche(element).annulable) annulables += 1;
        }
        return {
          cle: lot.cle,
          date: lot.date,
          par: lot.par,
          total: lot.fiches.length,
          annulables,
          agents: Object.entries(parAgent).map(([nom, nb]) => ({ nom, nb })),
          provenances: Object.entries(provenances).map(([libelle, nb]) => ({ libelle, nb })),
        };
      });
    res.json(lots);
  });

  // Rend chaque fiche encore intacte d'une distribution à son agent et à son
  // statut d'avant.
  app.post("/api/equipe/distributions/annuler", exigerAdmin, async (req, res) => {
    const lot = lotsDeDistribution(libelleStatut).find((l) => l.cle === req.body.cle);
    if (!lot) return res.status(404).json({ error: "Distribution introuvable." });

    const maintenant = new Date().toISOString();
    const auteur = req.utilisateur.prenom || req.utilisateur.email;
    const dateLot = new Date(lot.date).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
    const rendues = [];
    const ignorees = [];
    for (const element of lot.fiches) {
      const { fiche, info } = element;
      const etat = etatFiche(element);
      if (!etat.annulable) {
        ignorees.push({ nom: fiche.nom, raison: etat.raison });
        continue;
      }
      const ancien = info.ancienAgent ? trouverUtilisateurParNom(info.ancienAgent) : null;
      fiche.assigneA = ancien ? ancien.id : null;
      fiche.statut = info.ancienStatut;
      fiche.assignationVue = true;
      fiche.dateAssignation = ancien ? maintenant : null;
      fiche.commentaires.unshift({
        id: nanoid(),
        date: maintenant,
        auteur: "Système",
        texte:
          `Distribution du ${dateLot} annulée par ${auteur} : fiche rendue ` +
          `${ancien ? `à ${ancien.prenom || ancien.email}` : "à la liste des fiches non assignées"} ` +
          `(${libelleStatut(info.ancienStatut)}).`,
      });
      rendues.push({ nom: fiche.nom, a: ancien ? ancien.prenom || ancien.email : null, statut: libelleStatut(info.ancienStatut) });
    }
    await db.write();
    res.json({ rendues, ignorees });
  });
}
