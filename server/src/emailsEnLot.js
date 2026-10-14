// Recherche d'e-mails en lot (super-administrateur, page Campagnes) : pour
// les fiches d'une cible qui n'ont pas d'adresse, l'IA cherche sur le web
// (site officiel, annuaires, LinkedIn…) une adresse RÉELLEMENT PUBLIÉE —
// jamais une adresse devinée (rh@…, contact@…), qui reviendrait en erreur et
// ferait classer les envois en spam.
//
// Recherche PAYANTE (API Anthropic + recherche web) : uniquement lancée à la
// main, sur un nombre de fiches choisi (500 au plus par lot), avec le coût
// estimé affiché avant. Une fiche n'est jamais cherchée deux fois. Arrêt
// automatique après 3 erreurs de suite (crédit épuisé, clé invalide…).
import { nanoid } from "nanoid";
import db from "./db.js";
import { poserQuestionContact, nettoieEmail, estRechercheIaConfiguree } from "./rechercheContact.js";
import { fichesSelon, domaineRecoitMail, estDesinscrit } from "./campagnes.js";

const MAX_PAR_LOT = 500;
const PAUSE_MS = 1500;
// Estimation prudente (modèle + 1 à 4 recherches web par fiche).
export const COUT_ESTIME_PAR_FICHE = { min: 0.05, max: 0.15 };
const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const QUESTION =
  "Trouve l'adresse e-mail la plus utile pour écrire à cette entreprise au sujet de son obligation d'emploi de " +
  "travailleurs handicapés : idéalement celle du ou de la DRH / responsable RH / recrutement / référent handicap, " +
  "sinon l'adresse RH ou recrutement générique, sinon l'adresse de contact générale. UNIQUEMENT une adresse " +
  "réellement publiée (site officiel, mentions légales, annuaire, offre d'emploi) — jamais une adresse déduite ou " +
  "construite sur un modèle (prenom.nom@…) : si aucune n'est publiée, réponds null.";

let etat = { enCours: false };

// Fiches de la cible sans e-mail, jamais cherchées (ni ici, ni par la
// recherche automatique PDN / Anglais).
function aChercher(filtres) {
  return fichesSelon(filtres).filter((e) => {
    if (EMAIL_VALIDE.test(String(e.contact?.email || "").trim())) return false;
    const r = e.rechercheEmailAuto;
    return !r || r.resultat === "erreur";
  });
}

function noter(e, texte) {
  e.commentaires = Array.isArray(e.commentaires) ? e.commentaires : [];
  e.commentaires.unshift({ id: nanoid(), date: new Date().toISOString(), auteur: "Assistant IA", texte });
}

async function traiter(fiches, { ajouterEmailFiche, appliquerContactRhIa }) {
  let erreursDeSuite = 0;
  for (const fiche of fiches) {
    if (etat.arretDemande) {
      etat.fin = "Arrêtée à votre demande.";
      break;
    }
    const e = db.data.entreprises.find((x) => x.id === fiche.id);
    if (!e || EMAIL_VALIDE.test(String(e.contact?.email || "").trim())) {
      etat.faites++;
      continue;
    }
    etat.enTrain = e.nom;
    try {
      const reponse = await poserQuestionContact(e, QUESTION);
      erreursDeSuite = 0;
      const email = nettoieEmail(reponse.contact?.email);
      e.contact = e.contact || {};
      if (email && !estDesinscrit(email) && (await domaineRecoitMail(email))) {
        if (reponse.contact?.nom) appliquerContactRhIa(e, reponse);
        ajouterEmailFiche(e.contact, email, `Trouvé sur le web par l'IA (recherche en lot${reponse.source ? ` — ${reponse.source}` : ""})`);
        e.rechercheEmailAuto = { date: new Date().toISOString(), resultat: "trouve", source: "lot" };
        etat.trouves++;
        etat.derniers.unshift({ nom: e.nom, email });
        etat.derniers = etat.derniers.slice(0, 10);
      } else {
        e.rechercheEmailAuto = { date: new Date().toISOString(), resultat: "introuvable", source: "lot" };
        noter(e, "Recherche d'e-mail en lot : aucune adresse publiée et valide trouvée — à obtenir par téléphone.");
        etat.introuvables++;
      }
    } catch (err) {
      erreursDeSuite++;
      etat.erreurs++;
      etat.derniereErreur = String(err.message || err).slice(0, 200);
      if (erreursDeSuite >= 3) {
        etat.fin = `Arrêt automatique après 3 erreurs de suite : ${etat.derniereErreur}`;
        break;
      }
    }
    etat.faites++;
    // Enregistré au fil de l'eau : rien n'est perdu si le serveur redémarre.
    await db.write().catch(() => {});
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  etat.enCours = false;
  etat.enTrain = null;
  etat.dateFin = new Date().toISOString();
  etat.fin = etat.fin || "Terminée.";
  await db.write().catch(() => {});
}

export function enregistrerRoutesEmailsEnLot(app, { exigerSuperAdmin, ajouterEmailFiche, appliquerContactRhIa }) {
  app.get("/api/campagnes-emails/statut", exigerSuperAdmin, (req, res) => res.json(etat));

  app.post("/api/campagnes-emails/apercu", exigerSuperAdmin, (req, res) => {
    const n = aChercher(req.body.filtres || {}).length;
    res.json({ aChercher: n, maxParLot: MAX_PAR_LOT, coutParFiche: COUT_ESTIME_PAR_FICHE, iaConfiguree: estRechercheIaConfiguree() });
  });

  app.post("/api/campagnes-emails/lancer", exigerSuperAdmin, (req, res) => {
    if (etat.enCours) return res.status(409).json({ error: "Une recherche est déjà en cours.", ...etat });
    if (!estRechercheIaConfiguree()) return res.status(503).json({ error: "Recherche IA non configurée (ANTHROPIC_API_KEY)." });
    const nombre = Math.min(Math.max(1, Math.round(Number(req.body.nombre) || 0)), MAX_PAR_LOT);
    // Les plus grosses entreprises d'abord (contribution la plus élevée).
    const fiches = aChercher(req.body.filtres || {})
      .sort((a, b) => (Number(b.effectif) || 0) - (Number(a.effectif) || 0))
      .slice(0, nombre);
    if (!fiches.length) return res.status(400).json({ error: "Aucune fiche sans e-mail à chercher pour ces critères." });
    etat = {
      enCours: true,
      lancePar: req.utilisateur.id,
      dateDebut: new Date().toISOString(),
      total: fiches.length,
      faites: 0,
      trouves: 0,
      introuvables: 0,
      erreurs: 0,
      derniers: [],
      enTrain: null,
      arretDemande: false,
      coutMaxEstime: Math.round(fiches.length * COUT_ESTIME_PAR_FICHE.max * 100) / 100,
    };
    traiter(fiches, { ajouterEmailFiche, appliquerContactRhIa }).catch((e) => {
      etat.enCours = false;
      etat.fin = `Erreur : ${e.message}`;
    });
    res.json(etat);
  });

  app.post("/api/campagnes-emails/arreter", exigerSuperAdmin, (req, res) => {
    if (etat.enCours) etat.arretDemande = true;
    res.json(etat);
  });
}
