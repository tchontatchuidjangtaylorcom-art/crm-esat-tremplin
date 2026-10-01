import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import db, { initDb, CANAL_GENERAL_ID } from "./db.js";
import {
  calculerObligationOeth,
  simulerContributionOeth,
  exercicesDisponibles,
  exerciceParDefaut,
  smicPourExercice,
  baremeParUnite,
} from "./oeth.js";
import { classifierSecteur, listerCategories, determinerCollecteur, CATEGORIES } from "./secteurs.js";
import {
  estSirenValide,
  normaliserSiren,
  rechercherEntrepriseParSiren,
  rechercherEntreprisesParSecteur,
  rechercherEntreprises,
} from "./insee.js";
import { getArgumentaireAgefiph, trouverLigneBareme } from "./argumentaire.js";
import { getScriptVente } from "./scriptVente.js";
import { getModelesMails } from "./modelesMails.js";
import {
  estSmtpConfigure,
  estResendConfigure,
  estEnvoiConfigure,
  estImapConfigure,
  relaverBoiteMail,
  envoyerMail,
  signatureMail,
  adresseMailPole,
  telephonePole,
  verifierConnexionSMTP,
} from "./mail.js";
import { genererSynthesePdf, genererSimulationPdf } from "./pdfSynthese.js";
import { genererEmailOfficielHtml } from "./emailOfficiel.js";
import { enregistrerRoutesVitrineRdv } from "./vitrineRdv.js";
import { enregistrerRoutesRechercheNumeros } from "./rechercheNumerosFiche.js";
import { enregistrerRoutesImportFichier } from "./importFichier.js";
import { enregistrerRoutesDistributionEquipe } from "./distributionEquipe.js";
import { enregistrerRoutesAppelsAgents, ajouterAppelsAuxKpi } from "./appelsAgents.js";
import { servirFrontend } from "./seo.js";
import compression from "compression";
import { enregistrerDemandeSiteSansEchec } from "./leadsSite.js";
import { genererRapportPdf } from "./pdfRapport.js";
import {
  estRechercheIaConfiguree,
  rechercherContactAlternatif,
  poserQuestionContact,
  analyserDictee,
  genererEmailProspection,
  repondreQuestionDomaine,
  listerModelesDisponibles,
  detailErreur as detailErreurIa,
  nettoieEmail,
} from "./rechercheContact.js";
import {
  trouverOuCreerUtilisateur,
  trouverUtilisateurParId,
  creerUtilisateurParAdmin,
  definirMotDePasse,
  verifierMotDePasse,
  envoyerLienMagique,
  envoyerConfirmationAcces,
  verifierLienMagique,
  creerCookieSession,
  optionsCookie,
  NOM_COOKIE,
  exigerAuth,
  exigerAdmin,
  exigerSuperAdmin,
  estAdmin,
} from "./auth.js";
import { googleConfigure, verifierIdTokenGoogle } from "./googleAuth.js";
import { enregistrerBattement, calculerKpiAgent, calculerKpiEquipe, alertesAbsenceEquipe } from "./presence.js";
import { reparerChampsContact, estNumeroTelephone } from "./telephone.js";
import { territoireDe, territoireValide, nomTerritoire } from "./territoires.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Build de production du frontend React (généré par `npm run build` côté
// client). N'existe pas en développement local (Vite sert le frontend
// séparément sur le port 5173) — uniquement en production (Render).
const distClient = path.join(__dirname, "..", "..", "client", "dist");
// URL publique du CRM telle qu'accédée par un navigateur — sert à construire
// les liens de connexion envoyés par mail. Doit pointer vers le service
// Render en production (voir server/.env.example).
const APP_URL = process.env.APP_URL || "http://localhost:5173";

const app = express();
// Compression gzip de toutes les réponses texte (HTML, JS, CSS, JSON) :
// divise par ~3 à 4 le poids transféré (Core Web Vitals).
app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

await initDb();

// Répare une fois au démarrage les fiches dont les champs de contact sont
// mélangés (e-mail saisi comme numéro, numéro saisi comme nom — voir
// telephone.js) ; les nouvelles saisies sont corrigées à chaque PATCH.
{
  const reparees = [...db.data.entreprises, ...db.data.archives].filter((e) => reparerChampsContact(e.contact));
  if (reparees.length) {
    await db.write();
    console.log(`[contacts] ${reparees.length} fiche(s) réparée(s) (e-mail/numéro/nom remis à leur place).`);
  }
}

// ---- Libellés des issues d'appel / sorties de dossier (source de vérité) ----
const ISSUES_APPEL = {
  nrp: "NRP (Non Répondant)",
  me_rappelle: "Me rappelle",
  a_rappeler: "À rappeler",
  rdv: "RDV",
  mail: "Mail",
  autre: "Autre",
};

const SORTIES_DOSSIER = {
  fiche: "Client Potentiel (CP)",
  fiche_one_shot: "Fiche one-shot → atelier",
  conforme: "Conforme — dossier réglé",
  refus: "Refus (dossier clos)",
  mort: "Mort (dossier clos)",
  doublon: "Doublon (même entreprise qu'une autre fiche)",
};

// Sorties qui font quitter le pipeline actif : le dossier est archivé
// automatiquement (voir `archiver()`) — que ce soit un succès (déjà en
// conformité, plus rien à prospecter), un refus explicite du prospect, ou
// une entreprise injoignable/radiée. On distingue volontairement "conforme"
// de "mort"/"refus" pour ne pas mélanger un dossier réglé avec un échec de
// prospection dans les statistiques.
// "doublon" : même entreprise qu'une autre fiche (même standard, même
// numéro) — retirée du pipeline mais conservée dans les archives, avec le
// lien vers la fiche d'origine (doublonDe).
const SORTIES_ARCHIVANTES = new Set(["conforme", "refus", "mort", "doublon"]);

// Cherche dans les dossiers actifs puis dans les archives, pour que les
// fiches archivées (dossiers "mort") restent consultables via les mêmes
// routes GET/PATCH sans dupliquer d'endpoints.
function findEntreprise(id) {
  return db.data.entreprises.find((e) => e.id === id) || db.data.archives.find((e) => e.id === id);
}

// Les fiches ne stockent que le SIRET : le SIREN en est les 9 premiers chiffres.
function sirenDe(entreprise) {
  return entreprise.siren || (entreprise.siret ? entreprise.siret.slice(0, 9) : null);
}

function estDejaConnu(siren) {
  return (
    db.data.entreprises.find((e) => e.siret && e.siret.slice(0, 9) === siren) ||
    db.data.archives.find((e) => e.siret && e.siret.slice(0, 9) === siren)
  );
}

// Purge automatique du pipeline actif : dès qu'un dossier passe "mort", il
// est déplacé vers `archives` plutôt que supprimé, pour alléger le tableau de
// bord sans perdre l'historique.
function archiver(entreprise) {
  const idx = db.data.entreprises.findIndex((e) => e.id === entreprise.id);
  if (idx !== -1) db.data.entreprises.splice(idx, 1);
  if (!db.data.archives.some((e) => e.id === entreprise.id)) db.data.archives.push(entreprise);
}

// Ajoute les champs calculés (obligation OETH, catégorie de secteur) sans les
// persister : ils sont toujours recalculés à partir des données brutes.
function enrichir(entreprise) {
  const assigne = entreprise.assigneA ? trouverUtilisateurParId(entreprise.assigneA) : null;
  return {
    ...entreprise,
    emails: entreprise.emails || [],
    oeth: calculerObligationOeth(entreprise),
    categorie: classifierSecteur(entreprise.secteurActivite, {
      secteurPublic: entreprise.secteurPublic,
      categorieForcee: entreprise.categorieForcee,
    }),
    collecteur: determinerCollecteur(entreprise),
    ligneBareme: trouverLigneBareme(entreprise.effectif),
    assigneANom: assigne ? assigne.prenom || assigne.email : null,
  };
}

// Un agent ne voit/traite que les dossiers qui lui sont assignés ;
// l'administrateur garde une vue et un accès globaux sur tout le pipeline.
function estVisiblePar(entreprise, utilisateur) {
  return estAdmin(utilisateur) || entreprise.assigneA === utilisateur.id;
}

// Attache req.entreprise si elle existe ET est visible par l'utilisateur
// connecté, sinon répond 404 (dossier introuvable) ou 403 (existe mais pas
// assigné à cet agent) — utilisé par toutes les routes /api/entreprises/:id/*.
function chargerEntrepriseAutorisee(req, res, next) {
  const entreprise = findEntreprise(req.params.id);
  if (!entreprise) return res.status(404).json({ error: "Entreprise introuvable" });
  if (!estVisiblePar(entreprise, req.utilisateur)) {
    return res.status(403).json({ error: "Ce dossier est assigné à un autre agent." });
  }
  req.entreprise = entreprise;
  next();
}

// Retrouve l'entreprise (active ou archivée) dont l'adresse mail de contact
// correspond à l'expéditeur d'un message reçu.
function trouverEntrepriseParEmail(adresse) {
  const cherche = (adresse || "").toLowerCase();
  if (!cherche) return null;
  return (
    db.data.entreprises.find((e) => (e.contact?.email || "").toLowerCase() === cherche) ||
    db.data.archives.find((e) => (e.contact?.email || "").toLowerCase() === cherche) ||
    null
  );
}

// ---- Authentification (lien magique + Google, validation admin) ----
//
// Toutes les routes /api/entreprises, /api/leads, /api/lots et /api/emails
// exigent désormais une session valide (exigerAuth) — nécessaire pour
// l'assignation des dossiers aux agents (voir estVisiblePar/
// chargerEntrepriseAutorisee ci-dessus) : sans authentification, impossible
// de savoir qui demande quoi, donc impossible de filtrer par agent.

app.get("/api/auth/config", (req, res) => {
  res.json({ mailConfigure: estEnvoiConfigure(), googleConfigure: googleConfigure(), googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

app.post("/api/auth/demander-lien", async (req, res) => {
  const email = String(req.body.email || "").trim();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Adresse mail invalide." });
  }

  // prenom/nom : renseignés par le formulaire "Créer un compte" de la page
  // de connexion (voir Connexion.jsx) — ignorés sans effet si le compte
  // existe déjà (voir trouverOuCreerUtilisateur), donc sans risque à
  // toujours les transmettre même sur une simple reconnexion.
  const prenom = String(req.body.prenom || "").trim();
  const nom = String(req.body.nom || "").trim();
  const utilisateur = await trouverOuCreerUtilisateur(email, { prenom, nom });

  if (utilisateur.statut === "refuse") {
    return res.status(403).json({ error: "Accès non autorisé pour cette adresse. Contactez l'administrateur." });
  }
  if (utilisateur.statut === "en_attente") {
    return res.json({
      statut: "en_attente",
      message: "Votre demande d'accès a été transmise à l'administrateur. Vous recevrez un lien dès validation.",
    });
  }

  try {
    await envoyerLienMagique(utilisateur, APP_URL);
  } catch (e) {
    const statutHttp = e.code === "MAIL_NON_CONFIGURE" ? 503 : 502;
    return res.status(statutHttp).json({ error: e.message });
  }
  res.json({ statut: "lien_envoye", message: "Un lien de connexion vient de vous être envoyé par mail." });
});

// Connexion directe par e-mail + mot de passe — uniquement pour les comptes
// où un administrateur en a défini un (voir /api/utilisateurs/:id/mot-de-passe
// ci-dessous) ; les autres restent sur le lien magique.
app.post("/api/auth/connexion-mot-de-passe", async (req, res) => {
  const email = String(req.body.email || "").trim();
  const motDePasse = String(req.body.motDePasse || "");
  if (!email || !motDePasse) {
    return res.status(400).json({ error: "Adresse mail et mot de passe requis." });
  }

  try {
    const utilisateur = await verifierMotDePasse(email, motDePasse);
    creerCookieSession(res, utilisateur);
    res.json({
      statut: "connecte",
      utilisateur: { email: utilisateur.email, prenom: utilisateur.prenom, nom: utilisateur.nom, role: utilisateur.role },
    });
  } catch (e) {
    const statutHttp = e.code === "MOT_DE_PASSE_NON_DEFINI" ? 400 : 401;
    res.status(statutHttp).json({ error: e.message, code: e.code });
  }
});

// Lien cliqué depuis le mail : vérifie le jeton, ouvre la session, puis
// redirige vers l'application (jamais une réponse JSON, c'est une navigation
// de navigateur).
app.get("/api/auth/verifier", (req, res) => {
  try {
    const utilisateur = verifierLienMagique(String(req.query.token || ""));
    creerCookieSession(res, utilisateur);
    res.redirect(`${APP_URL}/`);
  } catch {
    res.redirect(`${APP_URL}/connexion?erreur=lien_invalide`);
  }
});

app.post("/api/auth/google", async (req, res) => {
  try {
    const { email, prenom, nom } = await verifierIdTokenGoogle(req.body.idToken);
    const utilisateur = await trouverOuCreerUtilisateur(email, { prenom, nom });

    if (utilisateur.statut === "refuse") {
      return res.status(403).json({ error: "Accès non autorisé pour cette adresse." });
    }
    if (utilisateur.statut === "en_attente") {
      return res.json({ statut: "en_attente", message: "Votre demande d'accès a été transmise à l'administrateur." });
    }

    creerCookieSession(res, utilisateur);
    res.json({ statut: "connecte", utilisateur: { email: utilisateur.email, prenom: utilisateur.prenom, nom: utilisateur.nom, role: utilisateur.role } });
  } catch (e) {
    const statutHttp = e.code === "GOOGLE_NON_CONFIGURE" ? 503 : 400;
    res.status(statutHttp).json({ error: e.message });
  }
});

app.get("/api/auth/moi", exigerAuth, (req, res) => {
  const { id, email, prenom, nom, role } = req.utilisateur;
  res.json({ id, email, prenom, nom, role });
});

app.post("/api/auth/deconnexion", (req, res) => {
  res.clearCookie(NOM_COOKIE, optionsCookie());
  res.json({ ok: true });
});

// Ne renvoie jamais motDePasseHash au frontend — seul son existence (booléen)
// est utile côté UI pour savoir si un mot de passe est déjà défini.
function sansMotDePasse(utilisateur) {
  const { motDePasseHash, ...reste } = utilisateur;
  return { ...reste, aUnMotDePasse: Boolean(motDePasseHash) };
}

// Administration des accès (réservé aux comptes "admin")
app.get("/api/utilisateurs", exigerAdmin, (req, res) => {
  res.json(db.data.utilisateurs.map(sansMotDePasse));
});

// Retrouve l'entreprise déjà suivie dans le CRM (active ou archivée) dont le
// SIRET correspond — utilisé pour lier un nouveau compte à son "entreprise
// partenaire OETH" à la création (voir /api/utilisateurs ci-dessous). Repli
// sur le SIREN (les 9 premiers chiffres) si le SIRET exact ne matche pas
// (l'admin a pu saisir un autre établissement de la même entreprise, ou le
// SIREN seul) : mieux vaut une entreprise correctement identifiée qu'aucune.
function trouverEntrepriseParSiret(siretBrut) {
  const chiffres = String(siretBrut || "").replace(/\D/g, "");
  if (!chiffres) return null;
  const toutes = [...db.data.entreprises, ...db.data.archives];
  return (
    toutes.find((e) => e.siret === chiffres) ||
    toutes.find((e) => e.siret && e.siret.slice(0, 9) === chiffres.slice(0, 9)) ||
    null
  );
}

// Création directe d'un accès agent par l'admin (voir creerUtilisateurParAdmin
// dans auth.js) : contrairement à /valider ci-dessous qui traite une demande
// déjà déposée par l'agent, ici il n'y a pas encore de demande — l'admin
// crée le compte à l'avance, déjà validé, à partir des champs du formulaire
// "Gestion des accès" (nom/prénom/email obligatoires, téléphone/SIRET
// optionnels). Un mot de passe optionnel peut être défini dès la création
// (motDePasse) — sinon le compte reste accessible uniquement par lien
// magique, comme avant.
app.post("/api/utilisateurs", exigerAdmin, async (req, res) => {
  try {
    const siretSaisi = String(req.body.siret || "").trim();
    const entrepriseLiee = siretSaisi ? trouverEntrepriseParSiret(siretSaisi) : null;

    const { utilisateur, mailEnvoye } = await creerUtilisateurParAdmin(req.body.email, {
      prenom: String(req.body.prenom || "").trim(),
      nom: String(req.body.nom || "").trim(),
      telephone: String(req.body.telephone || "").trim(),
      siret: siretSaisi,
      entrepriseLieeId: entrepriseLiee?.id || null,
      role: ["admin", "super_admin"].includes(req.body.role) ? req.body.role : "agent",
      appUrl: APP_URL,
      motDePasse: req.body.motDePasse ? String(req.body.motDePasse) : null,
    });
    res.status(201).json({
      utilisateur: sansMotDePasse(utilisateur),
      mailEnvoye,
      entrepriseLieeNom: entrepriseLiee?.nom || null,
      siretSansCorrespondance: Boolean(siretSaisi && !entrepriseLiee),
    });
  } catch (e) {
    const statutHttp =
      e.code === "EMAIL_INVALIDE" ||
      e.code === "PRENOM_REQUIS" ||
      e.code === "NOM_REQUIS" ||
      e.code === "MOT_DE_PASSE_TROP_COURT"
        ? 400
        : e.code === "COMPTE_EXISTANT"
        ? 409
        : 500;
    res.status(statutHttp).json({ error: e.message });
  }
});

// Définit, change ou retire (motDePasse vide) le mot de passe d'un compte
// existant, admin ou agent — même règle de longueur qu'à la création (voir
// auth.js). Une chaîne vide/absente retire le mot de passe : le compte
// retombe alors sur le lien magique uniquement.
app.post("/api/utilisateurs/:id/mot-de-passe", exigerAdmin, async (req, res) => {
  try {
    const utilisateur = await definirMotDePasse(req.params.id, req.body.motDePasse ? String(req.body.motDePasse) : "");
    res.json(sansMotDePasse(utilisateur));
  } catch (e) {
    const statutHttp =
      e.code === "UTILISATEUR_INTROUVABLE" ? 404 : e.code === "MOT_DE_PASSE_TROP_COURT" ? 400 : 500;
    res.status(statutHttp).json({ error: e.message });
  }
});

// Renvoie manuellement le lien de connexion (mail) à un compte déjà validé —
// utile quand l'agent l'a perdu/pas reçu, sans attendre qu'il le redemande
// lui-même depuis /connexion. Si l'envoi échoue (Resend suspendu, quota...),
// l'admin le voit ici et peut basculer sur le mot de passe temporaire
// (POST /api/utilisateurs/:id/mot-de-passe) comme filet de secours.
app.post("/api/utilisateurs/:id/renvoyer-lien", exigerAdmin, async (req, res) => {
  const utilisateur = trouverUtilisateurParId(req.params.id);
  if (!utilisateur) return res.status(404).json({ error: "Utilisateur introuvable." });
  if (utilisateur.statut !== "valide") {
    return res.status(400).json({ error: "Ce compte n'est pas encore validé — validez-le d'abord." });
  }
  try {
    await envoyerLienMagique(utilisateur, APP_URL);
    res.json({ ok: true });
  } catch (e) {
    const statutHttp = e.code === "MAIL_NON_CONFIGURE" ? 503 : 502;
    res.status(statutHttp).json({ error: e.message });
  }
});

app.post("/api/utilisateurs/:id/valider", exigerAdmin, async (req, res) => {
  const utilisateur = trouverUtilisateurParId(req.params.id);
  if (!utilisateur) return res.status(404).json({ error: "Utilisateur introuvable." });
  const etaitEnAttente = utilisateur.statut === "en_attente";
  utilisateur.statut = "valide";
  utilisateur.role = ["admin", "super_admin"].includes(req.body.role) ? req.body.role : "agent";
  utilisateur.dateValidation = new Date().toISOString();
  await db.write();

  // Confirmation best-effort : seulement pour une demande qui attendait
  // réellement une validation (pas quand l'admin repasse un compte déjà
  // valide sur un autre rôle) — un échec d'envoi ne doit jamais faire
  // échouer la validation, qui a déjà réussi côté base à ce stade.
  let mailEnvoye = false;
  if (etaitEnAttente && estEnvoiConfigure()) {
    try {
      await envoyerConfirmationAcces(utilisateur, APP_URL);
      mailEnvoye = true;
    } catch (e) {
      console.error(`[auth] Échec d'envoi de la confirmation d'accès à ${utilisateur.email} : ${e.message}`);
    }
  }

  res.json({ ...sansMotDePasse(utilisateur), mailEnvoye });
});

app.post("/api/utilisateurs/:id/refuser", exigerAdmin, async (req, res) => {
  const utilisateur = trouverUtilisateurParId(req.params.id);
  if (!utilisateur) return res.status(404).json({ error: "Utilisateur introuvable." });
  utilisateur.statut = "refuse";
  await db.write();
  res.json(sansMotDePasse(utilisateur));
});

// Suppression définitive d'un compte — distincte de "Refuser" (qui bloque
// l'accès mais garde une trace). Un admin ne peut pas se supprimer
// lui-même : ça évite un verrouillage accidentel du seul compte connecté
// capable d'administrer les accès (déjà vécu par le passé avec le bootstrap
// "premier compte = admin", voir ADMIN_EMAILS dans auth.js). Les dossiers
// encore assignés à ce compte sont libérés plutôt que laissés orphelins.
app.delete("/api/utilisateurs/:id", exigerAdmin, async (req, res) => {
  if (req.params.id === req.utilisateur.id) {
    return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
  }
  const index = db.data.utilisateurs.findIndex((u) => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Utilisateur introuvable." });

  db.data.utilisateurs.splice(index, 1);
  for (const entreprise of db.data.entreprises) {
    if (entreprise.assigneA === req.params.id) entreprise.assigneA = null;
  }
  await db.write();
  res.json({ ok: true });
});

// ---- Routes ----

app.get("/api/categories", (req, res) => {
  res.json(listerCategories());
});

// Indique si la recherche IA (Claude / Anthropic) est configurée, pour
// afficher/masquer côté frontend l'option d'enrichissement automatique du
// téléphone à l'import par secteur (voir plus bas) et l'espace IA de la
// fiche entreprise.
app.get("/api/ia/statut", (req, res) => {
  res.json({ configuree: estRechercheIaConfiguree() });
});

// Aide-mémoire agent (affiche officielle du pôle AGEFIPH) : argumentaire,
// dates clés et barème des unités bénéficiaires. Contenu par défaut codé en
// dur, sauf s'il a été personnalisé par un super-administrateur (voir les
// routes PUT plus bas, réservées à exigerSuperAdmin) — auquel cas la version
// de db.data.contenusEditables prévaut.
app.get("/api/argumentaire-agefiph", (req, res) => {
  res.json(getArgumentaireAgefiph(db.data.contenusEditables?.argumentaire));
});

// Script de vente et modèles de mails : même principe que l'argumentaire
// AGEFIPH ci-dessus.
app.get("/api/script-vente", (req, res) => {
  res.json(getScriptVente(db.data.contenusEditables?.scriptVente));
});

app.get("/api/modeles-mails", (req, res) => {
  res.json(getModelesMails(db.data.contenusEditables?.modelesMails));
});

// Édition des 3 contenus ci-dessus — réservée aux super-administrateurs (voir
// exigerSuperAdmin dans auth.js) : ce contenu est vu par TOUS les agents,
// une erreur de frappe ou une suppression malheureuse les impacterait tous.
// Chaque route valide juste la FORME générale (tableaux/champs attendus),
// jamais le contenu métier lui-même — un super-admin reste responsable de ce
// qu'il écrit, exactement comme pour n'importe quel contenu éditorial.
app.put("/api/argumentaire-agefiph", exigerSuperAdmin, async (req, res) => {
  const { quiSommesNous, objectif, pourquoiObligation, chronologie, devise } = req.body;
  if (!objectif || !devise || !Array.isArray(pourquoiObligation) || !Array.isArray(chronologie)) {
    return res.status(400).json({ error: "Champs manquants ou invalides (objectif, devise, pourquoiObligation[], chronologie[])." });
  }
  db.data.contenusEditables.argumentaire = { quiSommesNous, objectif, pourquoiObligation, chronologie, devise };
  await db.write();
  res.json(getArgumentaireAgefiph(db.data.contenusEditables.argumentaire));
});

app.post("/api/argumentaire-agefiph/reinitialiser", exigerSuperAdmin, async (req, res) => {
  db.data.contenusEditables.argumentaire = null;
  await db.write();
  res.json(getArgumentaireAgefiph(null));
});

app.put("/api/script-vente", exigerSuperAdmin, async (req, res) => {
  const { sections } = req.body;
  if (!Array.isArray(sections) || sections.some((s) => !s.titre || !Array.isArray(s.lignes))) {
    return res.status(400).json({ error: "sections doit être un tableau de { titre, lignes[] }." });
  }
  db.data.contenusEditables.scriptVente = sections;
  await db.write();
  res.json(getScriptVente(db.data.contenusEditables.scriptVente));
});

app.post("/api/script-vente/reinitialiser", exigerSuperAdmin, async (req, res) => {
  db.data.contenusEditables.scriptVente = null;
  await db.write();
  res.json(getScriptVente(null));
});

app.put("/api/modeles-mails", exigerSuperAdmin, async (req, res) => {
  const { modeles } = req.body;
  if (!Array.isArray(modeles) || modeles.some((m) => !m.titre || !m.objet || !m.corps)) {
    return res.status(400).json({ error: "modeles doit être un tableau de { titre, objet, corps }." });
  }
  const avecCles = modeles.map((m, i) => ({ cle: m.cle || `modele_${i}_${nanoid(6)}`, titre: m.titre, objet: m.objet, corps: m.corps }));
  db.data.contenusEditables.modelesMails = avecCles;
  await db.write();
  res.json(getModelesMails(db.data.contenusEditables.modelesMails));
});

app.post("/api/modeles-mails/reinitialiser", exigerSuperAdmin, async (req, res) => {
  db.data.contenusEditables.modelesMails = null;
  await db.write();
  res.json(getModelesMails(null));
});

// Résout le filtre d'agent effectif pour une requête : normalement
// l'utilisateur connecté (estVisiblePar), sauf si un admin consulte le
// pipeline "comme si" il était un agent donné (Mode Manager — voir
// commeAgentId, réservé à req.utilisateur.role === "admin" pour qu'un agent
// ne puisse jamais usurper la vue d'un autre en devinant l'ID).
function resoudreCibleSupervision(req) {
  if (!estAdmin(req.utilisateur) || !req.query.commeAgentId) return null;
  return trouverUtilisateurParId(req.query.commeAgentId);
}

// ---- Site vitrine public (aucune authentification) ----
//
// Alimente la landing page publique (/vitrine côté frontend) : des
// statistiques agrégées calculées depuis les VRAIES données du portefeuille,
// et une liste d'entreprises nommément citées. Deux garde-fous volontaires :
//  1. Une entreprise n'apparaît NOMMÉE que si `consentementAffichagePublic`
//     a été explicitement activé sur son dossier (jamais par défaut) — on ne
//     divulgue pas publiquement le statut de conformité OETH d'un tiers sans
//     son accord, même si le calcul sous-jacent est exact.
//  2. Le mapping ci-dessous est une liste blanche stricte : aucun champ
//     interne (contact, commentaires, historique, agent assigné...) n'est
//     jamais exposé, même par erreur d'un futur enrichissement de `entreprise`.
function toutesEntreprises() {
  return [...db.data.entreprises, ...db.data.archives];
}

app.get("/api/vitrine", (req, res) => {
  const toutes = toutesEntreprises().map((e) => ({ ...e, oeth: calculerObligationOeth(e) }));
  const assujetties = toutes.filter((e) => e.oeth.assujetti);
  const conformes = assujetties.filter((e) => e.oeth.conforme);

  const nbBeneficiairesInseres = conformes.reduce((somme, e) => somme + (e.oeth.beneficiairesRecrutes || 0), 0);
  const tauxConformite = assujetties.length ? Math.round((conformes.length / assujetties.length) * 100) : 0;
  // "Économies réalisées" : estimation de la contribution qui serait due par
  // les entreprises conformes si elles n'avaient recruté personne (calcul
  // hypothétique à effectifBeneficiaire=0), c'est-à-dire le montant que leur
  // démarche de recrutement direct leur évite réellement.
  const economiesRealisees = conformes.reduce((somme, e) => {
    const hypothetique = calculerObligationOeth({ effectif: e.effectif, effectifBeneficiaire: 0, dateCreation: e.dateCreation });
    return somme + (hypothetique.montantEstime || 0);
  }, 0);

  const vues = new Set();
  const entreprisesPubliques = [];
  for (const e of conformes) {
    if (!e.consentementAffichagePublic) continue;
    const siren = e.siret ? e.siret.slice(0, 9) : e.id;
    if (vues.has(siren)) continue;
    vues.add(siren);
    entreprisesPubliques.push({
      id: e.id,
      nom: e.nom,
      ville: e.ville || null,
      secteur: classifierSecteur(e.secteurActivite, { secteurPublic: e.secteurPublic, categorieForcee: e.categorieForcee })?.label || null,
      siteWeb: e.siteWeb || null,
      beneficiairesRecrutes: e.oeth.beneficiairesRecrutes,
      unitesRequises: e.oeth.unitesRequises,
    });
  }

  res.json({
    statistiques: {
      nbEntreprisesConformes: conformes.length,
      nbBeneficiairesInseres,
      tauxConformite,
      economiesRealisees,
    },
    entreprises: entreprisesPubliques,
  });
});

// Simulateur public d'obligations OETH (module "Estimer vos obligations" de
// la landing page) : un visiteur tape un nom d'entreprise ou un SIREN, on
// interroge le répertoire Sirene (public, gratuit) et on calcule l'obligation
// pour chaque résultat avec le même moteur que le CRM (calculerObligationOeth)
// — mais en lecture seule : rien n'est créé/stocké, aucune donnée du CRM
// n'est exposée ni consultée. Faute de connaître le nombre réel de
// travailleurs handicapés déjà employés, le calcul suppose 0 (scénario
// indicatif le plus défavorable, clairement annoncé côté client) : un agent
// affine ensuite le vrai chiffre au téléphone.
app.get("/api/vitrine/simulation", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q || q.length < 2) {
    return res.status(400).json({ error: "Indiquez un nom d'entreprise ou un SIREN (2 caractères minimum)." });
  }

  try {
    const resultats = await rechercherEntreprises(q, { limite: 5 });
    res.json({
      resultats: resultats.map((r) => {
        const oeth = calculerObligationOeth({
          effectif: r.effectifEstime,
          effectifBeneficiaire: 0,
          dateCreation: r.dateCreation,
        });
        return {
          siren: r.siren,
          nom: r.nom,
          ville: r.ville,
          codePostal: r.codePostal,
          secteurActivite: r.secteurActivite,
          trancheEffectifLabel: r.trancheEffectifLabel,
          // Bruts, pour pré-remplir les champs éditables du simulateur
          // manuel (voir SimulateurOeth.jsx) — `oeth` ci-dessous reste
          // fourni tel quel (bénéficiaires=0) comme aperçu immédiat dans la
          // liste de résultats, avant que le visiteur n'affine ses propres
          // chiffres dans les champs.
          effectifEstime: r.effectifEstime,
          anneeTrancheEffectif: r.anneeTrancheEffectif || null,
          dateCreation: r.dateCreation,
          actif: r.actif,
          // Employeur public (INSEE : administration ou catégorie juridique
          // 7xxx) : relève du FIPHFP, pas de la DSN / URSSAF.
          secteurPublic: Boolean(r.secteurPublic),
          formeJuridique: r.formeJuridique || null,
          oeth,
        };
      }),
    });
  } catch (e) {
    res.status(e.code === "INSEE_INDISPONIBLE" ? 502 : 500).json({ error: e.message });
  }
});

// Calcul direct (module "Simulateur Gratuit OETH / DOETH" — saisie manuelle
// de l'effectif et des bénéficiaires, voir SimulateurOeth.jsx) : même moteur
// que /api/vitrine/simulation et que le CRM (calculerObligationOeth), lecture
// seule, rien n'est stocké. Séparé de /simulation ci-dessus parce qu'ici
// l'effectif ET les bénéficiaires viennent du visiteur lui-même (donc plus
// fiables que l'estimation par tranche INSEE) et doivent rester éditables en
// direct sans repasser par une recherche d'entreprise.
// Le simulateur complet (déductions sous-traitance, ECAP, dépenses, règle des
// 4 ans) utilise simulerContributionOeth — mêmes constantes que le CRM.
function lireSaisieSimulation(body = {}) {
  const nombre = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v));
  const ouiNon = (v) => (v === true ? true : v === false ? false : null);
  const saisie = {
    effectif: nombre(body.effectif),
    boeth: nombre(body.boeth),
    coutMainOeuvreSousTraitance: nombre(body.coutMainOeuvreSousTraitance),
    nbEcap: nombre(body.nbEcap),
    // Dépenses déductibles ventilées par code DSN (062, 063, 064, 072) ; leur
    // somme est plafonnée globalement à 10 % de la contribution brute.
    depAccessibilite: nombre(body.depAccessibilite),
    depMaintien: nombre(body.depMaintien),
    depAccompagnement: nombre(body.depAccompagnement),
    depPartenariats: nombre(body.depPartenariats),
    aEmployeBoeth4Ans: ouiNon(body.aEmployeBoeth4Ans),
    sousTraitance4Ans: ouiNon(body.sousTraitance4Ans),
    montantSousTraitance4Ans: nombre(body.montantSousTraitance4Ans),
    accordAgree: ouiNon(body.accordAgree),
    surcontributionDeclaree: ouiNon(body.surcontributionDeclaree),
    // Exercice choisi par le visiteur : le SMIC retenu en découle, toujours
    // côté serveur (liste fermée, jamais un montant fourni par le client).
    annee: exercicesDisponibles().some((e) => e.annee === Number(body.annee)) ? Number(body.annee) : exerciceParDefaut(),
    // Étape obligatoire "Votre situation" : assujettissement (5 ans au-dessus
    // du seuil de 20 salariés) — année entre 1987 et l'année en cours.
    anneeSeuil20:
      Number.isInteger(Number(body.anneeSeuil20)) && Number(body.anneeSeuil20) >= 1987 && Number(body.anneeSeuil20) <= new Date().getFullYear()
        ? Number(body.anneeSeuil20)
        : null,
    moinsDe20: body.moinsDe20 === true,
  };
  saisie.smicHoraire = smicPourExercice(saisie.annee);
  saisie.depensesDeductibles =
    saisie.depAccessibilite + saisie.depMaintien + saisie.depAccompagnement + saisie.depPartenariats ||
    nombre(body.depensesDeductibles);
  const invalide = [
    "effectif",
    "boeth",
    "coutMainOeuvreSousTraitance",
    "nbEcap",
    "depensesDeductibles",
    "depAccessibilite",
    "depMaintien",
    "depAccompagnement",
    "depPartenariats",
    "montantSousTraitance4Ans",
  ].some(
    (k) => !Number.isFinite(saisie[k]) || saisie[k] < 0
  );
  return invalide ? null : saisie;
}

// Exercices proposés au simulateur et SMIC retenu pour chacun (calculés
// d'après la date du jour et l'historique REVALORISATIONS_SMIC).
app.get("/api/vitrine/referentiel", (req, res) => {
  res.json({ exercices: exercicesDisponibles(), parDefaut: exerciceParDefaut() });
});

app.post("/api/vitrine/calculer", (req, res) => {
  const saisie = lireSaisieSimulation(req.body);
  if (!saisie) return res.status(400).json({ error: "Valeurs invalides." });
  res.json({ simulation: simulerContributionOeth(saisie) });
});

// Synthèse PDF de la simulation, générée à la volée (rien n'est stocké).
app.post("/api/vitrine/synthese-pdf", async (req, res) => {
  const saisie = lireSaisieSimulation(req.body);
  if (!saisie) return res.status(400).json({ error: "Valeurs invalides." });
  try {
    const nomEntreprise = String(req.body.nomEntreprise || "").trim().slice(0, 120);
    const pdf = await genererSimulationPdf({
      saisie,
      simulation: simulerContributionOeth(saisie),
      nomEntreprise,
      poleInfo: { email: adresseMailPole(), telephone: telephonePole() },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="simulation-oeth-${saisie.annee}.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Envoi de la synthèse PDF par e-mail au visiteur (étape "résultats" du
// simulateur). L'adresse ne sert qu'à cet envoi : rien n'est enregistré.
// Limite simple par IP (5 envois / heure) pour éviter tout usage du
// formulaire comme relais d'envoi vers des adresses tierces.
const envoisSyntheseParIp = new Map();
app.post("/api/vitrine/synthese-email", async (req, res) => {
  const email = String(req.body.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return res.status(400).json({ error: "Adresse e-mail invalide." });
  }
  const saisie = lireSaisieSimulation(req.body);
  if (!saisie) return res.status(400).json({ error: "Valeurs invalides." });
  if (!estEnvoiConfigure()) {
    return res.status(503).json({ error: "L'envoi par e-mail est momentanément indisponible : téléchargez le PDF." });
  }
  // Derrière Cloudflare puis Render : l'IP réelle est dans les en-têtes.
  const ip =
    String(req.headers["cf-connecting-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0]).trim() ||
    req.ip ||
    "inconnue";
  const maintenant = Date.now();
  const recents = (envoisSyntheseParIp.get(ip) || []).filter((t) => maintenant - t < 3600_000);
  if (recents.length >= 5) {
    return res.status(429).json({ error: "Trop d'envois depuis cette connexion. Réessayez plus tard ou téléchargez le PDF." });
  }
  envoisSyntheseParIp.set(ip, [...recents, maintenant]);
  try {
    const nomEntreprise = String(req.body.nomEntreprise || "").trim().slice(0, 120);
    const simulation = simulerContributionOeth(saisie);
    const pdf = await genererSimulationPdf({
      saisie,
      simulation,
      nomEntreprise,
      poleInfo: { email: adresseMailPole(), telephone: telephonePole() },
    });
    await envoyerMail({
      to: email,
      subject: `Votre simulation OETH ${saisie.annee}${nomEntreprise ? ` — ${nomEntreprise}` : ""}`,
      text:
        `Bonjour,\n\n` +
        `Vous trouverez en pièce jointe la synthèse de votre simulation de contribution OETH pour l'exercice ${saisie.annee} ` +
        `(résultats, détail du calcul et récapitulatif DSN).\n\n` +
        `Il s'agit d'une estimation indicative : seule l'URSSAF (ou la MSA) calcule et recouvre la contribution.\n\n` +
        `Pour en parler avec un expert : ${adresseMailPole()} — ${telephonePole()}.\n\n` +
        `Pôle OETH / AGEFIPH / FIPHFP`,
      replyTo: adresseMailPole(),
      attachments: [{ filename: `simulation-oeth-${saisie.annee}.pdf`, content: pdf, contentType: "application/pdf" }],
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: "L'envoi a échoué. Téléchargez le PDF ou réessayez plus tard." });
  }
});

// Prise de contact publique depuis la landing page (bouton "Contacter un
// conseiller" du simulateur, ou tout autre formulaire de contact vitrine) :
// envoie simplement un mail à la boîte du pôle déjà configurée (aucune
// écriture en base, aucune création de lead automatique — un conseiller
// qualifie ensuite manuellement, comme n'importe quelle demande entrante).
// Page "Pilotage handicap" : rendez-vous expert et demandes de démo.
enregistrerRoutesVitrineRdv(app);
enregistrerRoutesRechercheNumeros(app, { exigerAuth, chargerEntrepriseAutorisee, findEntreprise });
enregistrerRoutesDistributionEquipe(app, { exigerAdmin, estAdmin });
enregistrerRoutesAppelsAgents(app, { exigerAuth, chargerEntrepriseAutorisee });
// Import de fichier (Excel, CSV, Word…) : fiches filtrées puis recherche IA
// des numéros et du contact RH, dans la même file que les autres imports.
enregistrerRoutesImportFichier(app, {
  exigerAdmin,
  creerLeadDepuisSiren,
  estDejaConnu,
  findEntreprise,
  mettreEnFileRechercheIA: (fiches) => {
    if (!estRechercheIaConfiguree()) return false;
    fileEnrichissementImport = fileEnrichissementImport
      .then(() => enrichirTelephonesViaIA(fiches))
      .catch((e) => console.error("[ia] Échec de l'enrichissement (import de fichier) :", e.message));
    return true;
  },
});

app.post("/api/vitrine/contact", async (req, res) => {
  const nom = String(req.body.nom || "").trim();
  const email = String(req.body.email || "").trim();
  const telephone = String(req.body.telephone || "").trim();
  const entreprise = String(req.body.entreprise || "").trim();
  const message = String(req.body.message || "").trim();

  if (!nom || !email || !email.includes("@")) {
    return res.status(400).json({ error: "Nom et adresse mail valide requis." });
  }

  // La demande arrive d'abord dans le CRM (fiche entreprise, lot "Demandes
  // site web", notification admin) : elle n'est donc jamais perdue, même si
  // l'envoi d'e-mails n'est pas configuré.
  await enregistrerDemandeSiteSansEchec({ type: "contact", nom, email, telephone, entreprise, message });
  if (!estEnvoiConfigure()) {
    return res.json({ ok: true });
  }

  try {
    await envoyerMail({
      to: adresseMailPole(),
      subject: `Nouvelle demande de contact — simulateur OETH (${entreprise || nom})`,
      text:
        `Nouvelle demande de contact via le simulateur OETH de la landing page publique.\n\n` +
        `Nom : ${nom}\n` +
        `Entreprise : ${entreprise || "-"}\n` +
        `E-mail : ${email}\n` +
        `Téléphone : ${telephone || "-"}\n\n` +
        `Message :\n${message || "(aucun message)"}`,
      replyTo: email,
      fromName: "Simulateur OETH — landing page",
    });
    // Accusé de réception au visiteur, envoyé depuis la boîte du pôle
    // (contact@oeth-fiph.fr) ; un échec ici n'annule pas la demande, déjà
    // transmise au pôle.
    try {
      await envoyerMail({
        to: email,
        subject: "Nous avons bien reçu votre demande — Pôle OETH / AGEFIPH",
        text:
          `Bonjour ${nom},\n\n` +
          `Merci pour votre message${entreprise ? ` concernant ${entreprise}` : ""}. Un conseiller du pôle vous répond rapidement.\n\n` +
          `Pour toute précision, répondez simplement à cet e-mail${telephonePole() ? ` ou appelez-nous au ${telephonePole()}` : ""}.\n\n` +
          `— Pôle OETH / AGEFIPH\n✉️ ${adresseMailPole()}${telephonePole() ? `\n📞 ${telephonePole()}` : ""}`,
        fromName: "Pôle OETH / AGEFIPH",
      });
    } catch (e) {
      console.error("[vitrine] Accusé de réception impossible :", e.message);
    }
    res.json({ ok: true });
  } catch (e) {
    // La demande est déjà enregistrée dans le CRM : on ne la fait pas échouer
    // côté visiteur pour un simple incident d'envoi d'e-mail.
    console.error("[vitrine] Notification e-mail du pôle impossible :", e.message);
    res.json({ ok: true });
  }
});

// Vue filtrée par rôle : un agent ne reçoit que ses dossiers assignés,
// l'administrateur reçoit tout le pipeline (voir estVisiblePar ci-dessus).
app.get("/api/entreprises", exigerAuth, (req, res) => {
  const cible = resoudreCibleSupervision(req);
  const visibles = cible
    ? db.data.entreprises.filter((e) => e.assigneA === cible.id)
    : db.data.entreprises.filter((e) => estVisiblePar(e, req.utilisateur));
  res.json(visibles.map(enrichir));
});

app.get("/api/entreprises/:id", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  // L'agent assigné "prend connaissance" du dossier en l'ouvrant — éteint
  // l'alerte "nouveau lead assigné" du centre de notifications.
  if (req.entreprise.assigneA === req.utilisateur.id && req.entreprise.assignationVue === false) {
    req.entreprise.assignationVue = true;
    await db.write();
  }
  // Demande reçue du site web : éteinte dès qu'un administrateur ou l'agent
  // assigné ouvre la fiche.
  if (req.entreprise.demandeSiteNonVue && (estAdmin(req.utilisateur) || req.entreprise.assigneA === req.utilisateur.id)) {
    req.entreprise.demandeSiteNonVue = false;
    await db.write();
  }
  res.json(enrichir(req.entreprise));
});

// Dossiers "mort" archivés automatiquement (consultation seule, hors pipeline actif).
app.get("/api/archives", exigerAuth, (req, res) => {
  const cible = resoudreCibleSupervision(req);
  const visibles = cible
    ? db.data.archives.filter((e) => e.assigneA === cible.id)
    : db.data.archives.filter((e) => estVisiblePar(e, req.utilisateur));
  res.json(visibles.map(enrichir));
});

// Vagues de prospection (lots) déjà utilisées, pour alimenter le filtre du
// tableau de bord — limité aux dossiers visibles par l'utilisateur connecté.
app.get("/api/lots", exigerAuth, (req, res) => {
  const visibles = db.data.entreprises.filter((e) => estVisiblePar(e, req.utilisateur));
  const lots = new Set(visibles.map((e) => e.lot).filter(Boolean));
  res.json([...lots].sort());
});

// Crée un lead qualifié à partir d'un SIREN : déduplication (actifs + archivés),
// enrichissement INSEE, classification public/privé, et purge immédiate en
// archives si l'entreprise est déjà radiée. Réutilisée par la recherche unitaire
// et par l'import par lot.
async function creerLeadDepuisSiren(siren, { lot = null, categorieForcee = null, assigneA = null, utilisateur } = {}) {
  // Tolère un SIRET (14 chiffres) collé à la place d'un SIREN : n'en garde
  // que les 9 premiers chiffres plutôt que de rejeter l'entreprise (voir
  // normaliserSiren dans insee.js).
  siren = normaliserSiren(siren);
  if (!estSirenValide(siren)) {
    const erreur = new Error("SIREN invalide (9 chiffres, ou 14 pour un SIRET, attendus).");
    erreur.code = "SIREN_INVALIDE";
    throw erreur;
  }

  const existante = estDejaConnu(siren);
  if (existante) {
    // Le SIREN existe déjà dans le CRM mais est assigné à un autre agent :
    // on confirme juste la duplication, sans exposer ses données (contact,
    // historique...) à quelqu'un qui n'y a pas accès.
    if (utilisateur && !estVisiblePar(existante, utilisateur)) {
      return { existant: true, archive: !db.data.entreprises.includes(existante), entreprise: null };
    }
    return { existant: true, archive: !db.data.entreprises.includes(existante), entreprise: enrichir(existante) };
  }

  const donnees = await rechercherEntrepriseParSiren(siren);

  const nouvelle = {
    id: nanoid(),
    nom: donnees.nom,
    siret: donnees.siret,
    formeJuridique: donnees.formeJuridique,
    adresse: donnees.adresse,
    codePostal: donnees.codePostal,
    ville: donnees.ville,
    secteurActivite: donnees.secteurActivite,
    secteurPublic: donnees.secteurPublic,
    categorieForcee,
    assigneA,
    // Vu d'office si l'agent se l'assigne lui-même en le créant (recherche
    // ponctuelle) — sinon (import en lot affecté par un admin à un autre
    // agent) déclenche l'alerte "nouveau lead assigné" côté notifications.
    assignationVue: !assigneA || assigneA === utilisateur?.id,
    dateAssignation: assigneA ? new Date().toISOString() : null,
    dateCreation: null,
    effectif: donnees.effectifEstime,
    effectifBeneficiaire: 0,
    typeContrat: "-",
    esatAssocie: "-",
    statut: donnees.actif ? "nouveau" : "mort",
    lot,
    partManquant: null,
    partDebutOp: null,
    partFinOp: null,
    contact: { nom: "-", fonction: "-", telephone: "", email: "", telephoneInvalide: false },
    dateRappel: null,
    dateRdv: null,
    commentaires: [
      {
        id: nanoid(),
        date: new Date().toISOString(),
        auteur: "Système",
        texte: donnees.actif
          ? `Lead créé automatiquement par SIREN (source : répertoire Sirene INSEE)${
              lot ? ` — ${lot}` : ""
            }${categorieForcee && CATEGORIES[categorieForcee] ? `, catégorie assignée : ${CATEGORIES[categorieForcee].label}` : ""}. Effectif indicatif : ${donnees.trancheEffectifLabel} — à confirmer avec le client. Coordonnées de contact non fournies par l'INSEE : à compléter manuellement.`
          : `Entreprise radiée d'après le répertoire Sirene (fermeture le ${donnees.dateFermeture || "date inconnue"}) — dossier archivé automatiquement, aucune action requise.`,
      },
    ],
    historiqueAppels: [],
    emails: [],
  };

  if (donnees.actif) {
    db.data.entreprises.push(nouvelle);
  } else {
    db.data.archives.push(nouvelle);
  }
  await db.write();
  return { existant: false, archive: !donnees.actif, entreprise: enrichir(nouvelle) };
}

// Module d'automatisation des leads par SIREN : déduplication, puis
// enrichissement + qualification automatique via le répertoire Sirene (INSEE).
// Recherche ponctuelle et personnelle (l'agent est en train de qualifier ce
// prospect) : assignée directement à qui la déclenche, admin ou agent.
app.post("/api/leads/siren", exigerAuth, async (req, res) => {
  const siren = String(req.body.siren || "").replace(/\s/g, "");
  try {
    const resultat = await creerLeadDepuisSiren(siren, {
      lot: req.body.lot || null,
      assigneA: req.utilisateur.id,
      utilisateur: req.utilisateur,
    });
    res.status(resultat.existant ? 200 : 201).json(resultat);
  } catch (e) {
    const statutHttp = e.code === "SIREN_INVALIDE" ? 400 : e.code === "SIREN_INTROUVABLE" ? 404 : 502;
    res.status(statutHttp).json({ error: e.message });
  }
});

// Import d'une vague (lot) de SIREN en une fois, pour alimenter la
// prospection en continu sans surcharger le tableau de bord. Réservé aux
// administrateurs : c'est une action de constitution de pipeline, pas une
// qualification individuelle — les fiches restent non assignées (visibles
// seulement des admins) jusqu'à distribution explicite à un agent, sauf si
// `assigneA` est fourni pour assigner la vague dès l'import.
app.post("/api/leads/siren/lot", exigerAdmin, async (req, res) => {
  const sirens = Array.isArray(req.body.sirens) ? req.body.sirens : [];
  const lot = String(req.body.lot || "").trim();
  const assigneA = req.body.assigneA || null;
  if (!lot) return res.status(400).json({ error: "Le nom du lot est requis." });
  if (sirens.length === 0) return res.status(400).json({ error: "Aucun SIREN fourni." });
  if (sirens.length > 100) return res.status(400).json({ error: "100 SIREN maximum par lot (limite anti-abus de l'API publique)." });

  const resultats = [];
  for (const brut of sirens) {
    const siren = normaliserSiren(brut);
    if (!siren) continue;
    try {
      const { existant, archive, entreprise } = await creerLeadDepuisSiren(siren, { lot, assigneA, utilisateur: req.utilisateur });
      resultats.push({ siren, statut: existant ? "existant" : archive ? "radiee" : "cree", nom: entreprise?.nom || "(déjà assigné à un autre agent)" });
    } catch (e) {
      resultats.push({ siren, statut: "erreur", erreur: e.message });
    }
    // Petite pause polie entre deux appels à l'API publique Sirene.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  res.status(201).json({ lot, resultats });
});

// Enrichissement automatique du téléphone via Claude/Anthropic (recherche
// web), pour les fiches fraîchement créées par un import par secteur : l'API
// Sirene ne fournit aucun contact, ce qui laisse jusqu'ici les fiches
// inexploitables au Power Dialer tant qu'un agent ne les complète pas à la
// main. Lancé APRÈS l'envoi de la réponse HTTP (voir
// /api/leads/secteur/importer), sans attendre sa fin : un lot de 100 SIREN à
// raison de plusieurs secondes par appel IA dépasserait largement les délais
// des proxys si on bloquait la requête d'import dessus. Meilleur effort
// volontairement silencieux côté résultat d'import : une fiche non enrichie
// (échec IA, rien trouvé) reste simplement à compléter manuellement comme
// avant cette fonctionnalité — pas d'écriture de numéro halluciné,
// rechercherContactAlternatif renvoie déjà null plutôt qu'inventer une valeur.
//
// Espacement des appels : Anthropic applique des limites de débit selon le
// palier de compte — ce délai réduit la fréquence des appels pour rester
// large en dessous, le retry/backoff dédié dans rechercheContact.js absorbant
// déjà les 429 isolés.
const DELAI_ENTRE_APPELS_IA_MS = Number(process.env.ANTHROPIC_ENRICHISSEMENT_DELAI_MS) || 1000;
// Au-delà de ce nombre d'échecs consécutifs, on arrête le lot plutôt que de
// continuer à égrener silencieusement des échecs : ça sent l'erreur de
// configuration (clé/modèle Anthropic invalide, crédit épuisé) plutôt qu'un
// raté ponctuel sur une fiche — mieux vaut le signaler clairement que de
// laisser tourner un lot de 100 fiches pour zéro résultat.
const ECHECS_CONSECUTIFS_MAX = 5;

// Corps JSON d'une erreur IA renvoyée au frontend : `lienRecharge` (crédit
// Anthropic épuisé, voir rechercheContact.js) déclenche côté client le
// bandeau "Recharger les crédits".
function corpsErreurIa(e) {
  return { error: e.message, code: e.code, ...(e.lienRecharge ? { lienRecharge: e.lienRecharge } : {}) };
}

// File des enrichissements déclenchés par /api/leads/secteur/importer : un
// seul tourne à la fois (voir la note à l'appel).
let fileEnrichissementImport = Promise.resolve();

// Trace, sur la fiche, la dernière recherche IA de téléphone — pour que
// l'enrichissement en lot ne repasse pas indéfiniment sur les mêmes fiches
// introuvables (voir estDejaTenteeSansSucces) et se concentre sur les
// nouvelles.
// Incrémenté quand la méthode de recherche change nettement : les fiches
// marquées "introuvables" par une version précédente sont alors retentées.
const VERSION_RECHERCHE_TELEPHONE = 2;

function marquerRechercheTelephone(entreprise, resultat, erreur = null) {
  const precedente = entreprise.rechercheTelephoneIA || {};
  entreprise.rechercheTelephoneIA = {
    date: new Date().toISOString(),
    resultat,
    version: VERSION_RECHERCHE_TELEPHONE,
    erreurs: resultat === "erreur" ? (precedente.erreurs || 0) + 1 : 0,
    ...(erreur ? { derniereErreur: erreur } : {}),
  };
}

// Une fiche est ignorée par le lot si Claude n'a rien trouvé, ou si la
// recherche a échoué au moins ERREURS_AVANT_ABANDON fois (une seule erreur
// peut être passagère : panne, limite de débit, clé mal configurée).
const ERREURS_AVANT_ABANDON = 2;
function estDejaTenteeSansSucces(entreprise) {
  const r = entreprise.rechercheTelephoneIA;
  if (!r || (r.version || 1) < VERSION_RECHERCHE_TELEPHONE) return false;
  return r.resultat === "introuvable" || (r.resultat === "erreur" && r.erreurs >= ERREURS_AVANT_ABANDON);
}

// Écrit sur la fiche ce que la recherche IA a trouvé : le 1er numéro devient
// le numéro principal, les suivants vont dans les numéros alternatifs (même
// format que GestionTelephones.jsx), et le contact RH devient le contact
// principal s'il n'y en a pas encore, sinon un contact alternatif.
// Ajoute une adresse e-mail à la fiche si elle n'y est pas déjà : adresse
// principale s'il n'y en a pas, sinon adresse secondaire avec une note.
function ajouterEmailFiche(contact, email, note) {
  if (!email) return false;
  const connues = [contact.email, ...(contact.emailsAlternatifs || []).map((e) => e.email)]
    .filter(Boolean)
    .map((e) => e.toLowerCase());
  if (connues.includes(email.toLowerCase())) return false;
  if (!contact.email) contact.email = email;
  else {
    contact.emailsAlternatifs = [
      ...(contact.emailsAlternatifs || []),
      { id: nanoid(), email, note, dateAjout: new Date().toISOString() },
    ];
  }
  return true;
}

function appliquerResultatRechercheIA(entreprise, resultat) {
  const contact = entreprise.contact;
  const maintenant = new Date().toISOString();
  const [principal, ...autres] = resultat.telephones;
  contact.telephone = principal.numero;
  contact.telephoneInvalide = false;

  const connus = new Set(
    [contact.telephone, ...(contact.telephonesAlternatifs || []).map((t) => t.numero)].map((n) => String(n).replace(/\D/g, ""))
  );
  const nouveaux = autres
    .filter((t) => !connus.has(t.numero.replace(/\D/g, "")))
    .map((t) => ({ id: nanoid(), numero: t.numero, note: `Trouvé par l'IA${t.libelle ? ` — ${t.libelle}` : ""}`, dateAjout: maintenant }));
  if (nouveaux.length) contact.telephonesAlternatifs = [...(contact.telephonesAlternatifs || []), ...nouveaux];

  const rh = resultat.contactRH;
  if (rh) {
    const sansNom = !contact.nom || contact.nom === "-";
    const dejaConnu = [contact.nom, ...(contact.contactsAlternatifs || []).map((c) => c.nom)].some(
      (n) => n && n.toLowerCase() === rh.nom.toLowerCase()
    );
    if (sansNom) {
      contact.nom = rh.nom;
      contact.fonction = rh.fonction || "-";
    } else if (!dejaConnu) {
      contact.contactsAlternatifs = [
        ...(contact.contactsAlternatifs || []),
        { id: nanoid(), nom: rh.nom, fonction: rh.fonction || "", dateAjout: maintenant },
      ];
    }
    // Contact RH déjà trouvé : pas besoin de la recherche RH à l'ouverture.
    entreprise.rechercheContactRH = { date: maintenant, resultat: "trouve" };
  }
  // E-mails RH publiés : celui de la personne, ou l'adresse RH/recrutement.
  if (rh?.email) ajouterEmailFiche(contact, rh.email, `RH — ${rh.nom} (trouvé par l'IA)`);
  if (resultat.emailRH) ajouterEmailFiche(contact, resultat.emailRH, "Adresse RH / recrutement (trouvée par l'IA)");

  const lignes = resultat.telephones.map(
    (t, i) => `n°${i + 1} ${t.numero}${t.libelle ? ` (${t.libelle})` : ""}${t.source ? ` — ${t.source}` : ""}`
  );
  if (rh) lignes.push(`contact : ${rh.nom}${rh.fonction ? `, ${rh.fonction}` : ""}${rh.email ? ` (${rh.email})` : ""}${rh.source ? ` — ${rh.source}` : ""}`);
  if (resultat.emailRH && resultat.emailRH !== rh?.email) lignes.push(`e-mail RH : ${resultat.emailRH}`);
  entreprise.commentaires.unshift({
    id: nanoid(),
    date: maintenant,
    auteur: "Assistant IA",
    texte: `Trouvé automatiquement par recherche IA (confiance ${resultat.confiance}) : ${lignes.join(" ; ")}. À vérifier au premier appel.`,
  });
}

// Recherche automatique du contact RH à l'ouverture d'une fiche qui n'a pas
// encore de nom de contact (voir EntrepriseDetail.jsx) : même assistant que
// "Qui contacter pour les RH ?", résultat enregistré directement sur la fiche
// (nom + fonction en contact principal, e-mail et ligne directe s'ils sont
// publiés). Une seule tentative par fiche (rechercheContactRH), jamais deux
// recherches simultanées sur la même fiche.
const QUESTION_CONTACT_RH =
  "Qui est le ou la DRH, responsable des ressources humaines, chargé(e) de recrutement ou référent handicap de " +
  "cette entreprise (idéalement pour cet établissement) ? Donne son nom, sa fonction, et son e-mail professionnel " +
  "et sa ligne directe uniquement s'ils sont publiés.";
const recherchesContactRhEnCours = new Set();

function appliquerContactRhIa(entreprise, resultat) {
  const c = resultat.contact;
  if (!c?.nom) return false;
  const contact = entreprise.contact || (entreprise.contact = {});
  const maintenant = new Date().toISOString();
  const sansNom = !contact.nom || contact.nom === "-";
  const dejaConnu = [contact.nom, ...(contact.contactsAlternatifs || []).map((x) => x.nom)].some(
    (n) => n && n.toLowerCase() === c.nom.toLowerCase()
  );
  if (sansNom) {
    contact.nom = c.nom;
    contact.fonction = c.role || "-";
  } else if (!dejaConnu) {
    contact.contactsAlternatifs = [
      ...(contact.contactsAlternatifs || []),
      { id: nanoid(), nom: c.nom, fonction: c.role || "", dateAjout: maintenant },
    ];
  }
  const email = nettoieEmail(c.email);
  if (email) ajouterEmailFiche(contact, email, `RH — ${c.nom} (trouvé par l'IA)`);
  const direct = c.telephone && estNumeroTelephone(String(c.telephone).trim()) ? String(c.telephone).trim() : null;
  if (direct) {
    const chiffres = direct.replace(/\D/g, "");
    const connus = [contact.telephone, ...(contact.telephonesAlternatifs || []).map((t) => t.numero)]
      .filter(Boolean)
      .map((n) => String(n).replace(/\D/g, ""));
    if (!connus.includes(chiffres)) {
      contact.telephonesAlternatifs = [
        ...(contact.telephonesAlternatifs || []),
        { id: nanoid(), numero: direct, note: `Ligne directe RH — ${c.nom} (IA)`, dateAjout: maintenant },
      ];
    }
  }
  entreprise.commentaires = Array.isArray(entreprise.commentaires) ? entreprise.commentaires : [];
  entreprise.commentaires.unshift({
    id: nanoid(),
    date: maintenant,
    auteur: "Assistant IA",
    texte:
      `Contact RH trouvé automatiquement (confiance ${resultat.confiance}) : ${c.nom}${c.role ? `, ${c.role}` : ""}` +
      `${email ? ` — ${email}` : ""}${direct ? ` — ligne directe ${direct}` : ""}` +
      `${resultat.source ? ` — source : ${resultat.source}` : ""}. À vérifier au premier appel.`,
  });
  return true;
}

app.post("/api/entreprises/:id/contact-rh-auto", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;
  const aDejaUnNom = entreprise.contact?.nom && entreprise.contact.nom !== "-";
  if (aDejaUnNom || entreprise.rechercheContactRH || recherchesContactRhEnCours.has(entreprise.id) || !estRechercheIaConfiguree()) {
    return res.json({ lance: false, entreprise: enrichir(entreprise) });
  }
  recherchesContactRhEnCours.add(entreprise.id);
  try {
    const resultat = await poserQuestionContact(entreprise, QUESTION_CONTACT_RH);
    const trouve = appliquerContactRhIa(entreprise, resultat);
    entreprise.rechercheContactRH = { date: new Date().toISOString(), resultat: trouve ? "trouve" : "introuvable" };
    await db.write();
    res.json({ lance: true, trouve, contact: resultat.contact, entreprise: enrichir(entreprise) });
  } catch (e) {
    // Échec passager (surcharge, crédit…) : pas de marque, nouvel essai à la
    // prochaine ouverture de la fiche.
    console.error(`[ia] Échec de la recherche du contact RH pour ${entreprise.nom} :`, JSON.stringify(detailErreurIa(e)));
    const statutHttp = e.code === "IA_NON_CONFIGUREE" ? 503 : e.code === "TIMEOUT_MANUEL" ? 504 : 502;
    res.status(statutHttp).json(corpsErreurIa(e));
  } finally {
    recherchesContactRhEnCours.delete(entreprise.id);
  }
});

async function enrichirTelephonesViaIA(entreprises, { onProgres } = {}) {
  let echecsConsecutifs = 0;
  let interrompu = null;
  let lienRecharge = null;
  for (const entreprise of entreprises) {
    let trouve = false;
    let erreurMessage = null;
    let erreurCredits = null;
    try {
      const resultat = await rechercherContactAlternatif(entreprise);
      marquerRechercheTelephone(entreprise, resultat.telephone ? "trouve" : "introuvable");
      if (resultat.telephone) {
        appliquerResultatRechercheIA(entreprise, resultat);
        trouve = true;
      }
      await db.write();
      echecsConsecutifs = 0;
    } catch (e) {
      erreurMessage = e.message;
      echecsConsecutifs += 1;
      if (e.code === "CREDITS_IA_EPUISES") erreurCredits = e;
      // Pas de trace si l'IA n'est pas configurée ou le crédit épuisé : ce
      // n'est pas la fiche qui pose problème (elle sera retentée ensuite).
      if (e.code !== "IA_NON_CONFIGUREE" && e.code !== "CREDITS_IA_EPUISES") {
        marquerRechercheTelephone(entreprise, "erreur", e.message);
        await db.write().catch(() => {});
      }
      console.error(
        `[ia] Échec de recherche automatique de téléphone pour ${entreprise.nom} :`,
        JSON.stringify(detailErreurIa(e))
      );
    }
    onProgres?.({ trouve, erreur: erreurMessage });

    // Crédit épuisé : inutile de continuer, chaque fiche suivante
    // échouerait de la même façon.
    if (erreurCredits) {
      interrompu = `${erreurCredits.message} Rechargez le compte puis relancez l'enrichissement.`;
      lienRecharge = erreurCredits.lienRecharge;
      console.error(`[ia] Enrichissement en lot interrompu : ${interrompu}`);
      break;
    }

    if (echecsConsecutifs >= ECHECS_CONSECUTIFS_MAX) {
      interrompu = /Délai de recherche IA dépassé/.test(erreurMessage)
        ? `Interrompu après ${echecsConsecutifs} recherches trop lentes d'affilée (${erreurMessage}) — essayez un modèle plus rapide dans ANTHROPIC_MODEL (claude-sonnet-5 conseillé).`
        : `Interrompu après ${echecsConsecutifs} échecs consécutifs (dernière erreur : ${erreurMessage}) — vérifiez la configuration Anthropic (ANTHROPIC_API_KEY / ANTHROPIC_MODEL) ou le crédit disponible.`;
      console.error(`[ia] Enrichissement en lot interrompu : ${interrompu}`);
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, DELAI_ENTRE_APPELS_IA_MS));
  }
  return { interrompu, lienRecharge };
}

// État du dernier/actuel enrichissement téléphone en lot, par utilisateur
// (voir /api/leads/enrichir-telephones ci-dessous) — mémoire process
// uniquement, pas persisté en base : sert seulement à bloquer un double
// lancement et à exposer une progression au frontend (polling de /statut).
const ETAT_ENRICHISSEMENT_VIDE = {
  enCours: false,
  enAttente: false,
  total: 0,
  traites: 0,
  trouves: 0,
  erreurs: 0,
  derniereErreur: null,
  interrompu: null,
  demarre: null,
  termine: null,
};
const etatsEnrichissement = new Map();
// Fiches déjà programmées dans un lot (en file ou en cours) : un admin et un
// agent qui lancent en même temps ne font jamais chercher deux fois la même.
const fichesEnEnrichissement = new Set();
// Un agent ne lance la recherche que sur ses propres fiches, par paquets
// raisonnables : chaque fiche consomme des crédits Claude.
const MAX_FICHES_ENRICHISSEMENT_AGENT = 30;

function etatEnrichissement(utilisateurId) {
  return etatsEnrichissement.get(utilisateurId) || ETAT_ENRICHISSEMENT_VIDE;
}

// Périmètre de recherche : tout le pipeline pour un admin, ses propres
// fiches pour un agent.
function fichesSansTelephone(utilisateur) {
  return db.data.entreprises.filter(
    (e) => !e.contact?.telephone && (estAdmin(utilisateur) || e.assigneA === utilisateur.id)
  );
}

// Enrichit en lot les fiches déjà présentes dans le CRM (actives, hors
// archives) qui n'ont toujours aucun numéro de téléphone — typiquement des
// leads importés par secteur avant l'ajout de la recherche automatique à
// l'import (voir /api/leads/secteur/importer), ou dont la recherche
// automatique n'a rien trouvé à l'époque. Action explicite (bouton) plutôt
// qu'automatique : chaque fiche déclenche des appels IA facturés. Un admin
// couvre tout le pipeline ; un agent, ses propres fiches (30 au plus par
// lancement). Tous les lots passent par la même file que l'enrichissement à
// l'import : un seul à la fois, jamais de rafale de requêtes vers Anthropic.
app.post("/api/leads/enrichir-telephones", exigerAuth, async (req, res) => {
  const utilisateur = req.utilisateur;
  if (!estRechercheIaConfiguree()) {
    return res.status(503).json({ error: "Recherche IA non configurée (renseignez ANTHROPIC_API_KEY)." });
  }
  const precedent = etatEnrichissement(utilisateur.id);
  if (precedent.enCours) {
    return res.status(409).json({ error: "Un enrichissement est déjà en cours.", ...precedent });
  }

  // Par défaut, seules les fiches jamais cherchées (ou en échec passager)
  // sont traitées, les plus récentes d'abord ; `inclureDejaTentees` relance
  // aussi celles où Claude n'avait rien trouvé.
  const inclureDejaTentees = req.body?.inclureDejaTentees === true;
  let cibles = fichesSansTelephone(utilisateur)
    .filter((e) => !fichesEnEnrichissement.has(e.id) && (inclureDejaTentees || !estDejaTenteeSansSucces(e)))
    .reverse();
  if (!estAdmin(utilisateur)) cibles = cibles.slice(0, MAX_FICHES_ENRICHISSEMENT_AGENT);
  if (cibles.length === 0) {
    return res.json({
      ...precedent,
      total: 0,
      message: "Aucune nouvelle fiche à enrichir : toutes les fiches sans numéro ont déjà été recherchées (ou sont en cours).",
    });
  }

  const etat = { ...ETAT_ENRICHISSEMENT_VIDE, enCours: true, enAttente: true, total: cibles.length, demarre: new Date().toISOString() };
  etatsEnrichissement.set(utilisateur.id, etat);
  for (const e of cibles) fichesEnEnrichissement.add(e.id);
  res.status(202).json(etat);

  fileEnrichissementImport = fileEnrichissementImport
    .then(() => {
      etat.enAttente = false;
      return enrichirTelephonesViaIA(cibles, {
        onProgres: ({ trouve, erreur }) => {
          etat.traites += 1;
          if (trouve) etat.trouves += 1;
          if (erreur) {
            etat.erreurs += 1;
            etat.derniereErreur = erreur;
          }
        },
      });
    })
    .then((resultat) => {
      if (resultat?.interrompu) etat.interrompu = resultat.interrompu;
      if (resultat?.lienRecharge) etat.lienRecharge = resultat.lienRecharge;
    })
    .catch((e) => console.error("[ia] Échec de l'enrichissement en lot :", e.message))
    .finally(() => {
      for (const e of cibles) fichesEnEnrichissement.delete(e.id);
      etat.enCours = false;
      etat.enAttente = false;
      etat.termine = new Date().toISOString();
    });
});

// Suivi de progression de l'enrichissement en lot ci-dessus — le frontend
// interroge cette route toutes les quelques secondes pendant qu'un
// enrichissement tourne, pour afficher une barre de progression. Compteurs
// calculés sur le périmètre de l'utilisateur (tout le pipeline pour un
// admin, ses fiches pour un agent).
app.get("/api/leads/enrichir-telephones/statut", exigerAuth, (req, res) => {
  const sansTelephone = fichesSansTelephone(req.utilisateur);
  const dejaTentees = sansTelephone.filter(estDejaTenteeSansSucces).length;
  res.json({
    ...etatEnrichissement(req.utilisateur.id),
    aTraiter: sansTelephone.length - dejaTentees,
    dejaTentees,
    maxParLancement: estAdmin(req.utilisateur) ? null : MAX_FICHES_ENRICHISSEMENT_AGENT,
  });
});

// Génération d'une vague de prospects par secteur : recherche de candidats
// RÉELS dans le répertoire Sirene (INSEE), filtrés par code NAF (précis —
// voir la note dans insee.js sur pourquoi une recherche par mots-clés a été
// écartée) — délibérément PAS de génération par un modèle de langage ici :
// un LLM invente des identifiants d'entreprise à l'échelle (SIREN,
// adresses...) au lieu de les retrouver, ce qui pollue le CRM de leads
// fictifs utilisés ensuite pour de vrais appels commerciaux. Étape de
// PRÉVISUALISATION seulement : rien n'est créé en base, voir
// /api/leads/secteur/importer.
app.post("/api/leads/secteur/rechercher", exigerAdmin, async (req, res) => {
  const cle = String(req.body.categorie || "");
  const categorie = CATEGORIES[cle];
  if (!categorie) return res.status(400).json({ error: "Catégorie inconnue." });

  // Territoire (métropole, La Réunion, Guadeloupe…) : un département
  // d'outre-mer sert de filtre Sirene ; on ne garde ensuite que les
  // entreprises dont le SIÈGE est dans le territoire (Sirene retient aussi
  // celles qui y ont un simple établissement), d'où une recherche plus large.
  const territoire = territoireValide(req.body.territoire) ? req.body.territoire : null;
  const departement = req.body.departement
    ? String(req.body.departement).trim()
    : territoire && territoire !== "metropole"
      ? territoire
      : null;
  const limite = Math.min(Number(req.body.limite) || 100, 300);

  try {
    const candidats = (
      await rechercherEntreprisesParSecteur(
        { nafCodes: categorie.nafCodes, estAdministration: categorie.estAdministration },
        { departement, limite: territoire ? Math.min(limite * 3, 300) : limite }
      )
    )
      .filter((c) => !territoire || territoireDe(c.codePostal) === territoire)
      .slice(0, limite);
    const connus = new Set([...db.data.entreprises, ...db.data.archives].map(sirenDe));
    const nouveaux = candidats.filter((c) => !connus.has(c.siren));
    res.json({ categorie: cle, categorieLabel: categorie.label, total: nouveaux.length, entreprises: nouveaux });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Importe la vague prévisualisée ci-dessus (liste de SIREN déjà filtrée côté
// frontend) et assigne directement la catégorie choisie à chaque fiche créée
// (categorieForcee) — même limite anti-abus que l'import manuel par lot.
// Réservé aux administrateurs (constitution de pipeline, pas qualification
// individuelle) ; `assigneA` optionnel pour distribuer la vague dès l'import.
app.post("/api/leads/secteur/importer", exigerAdmin, async (req, res) => {
  const cle = String(req.body.categorie || "");
  const categorie = CATEGORIES[cle];
  if (!categorie) return res.status(400).json({ error: "Catégorie inconnue." });

  const sirens = Array.isArray(req.body.sirens) ? req.body.sirens : [];
  const lot = String(req.body.lot || "").trim();
  const assigneA = req.body.assigneA || null;
  if (!lot) return res.status(400).json({ error: "Le nom du lot est requis." });
  if (sirens.length === 0) return res.status(400).json({ error: "Aucun SIREN fourni." });
  if (sirens.length > 100) {
    return res.status(400).json({ error: "100 SIREN maximum par vague (limite anti-abus de l'API publique)." });
  }

  // rechercheTelephoneIA : option activée par défaut (voir ImportLot.jsx) —
  // l'agent peut la décocher pour un import purement Sirene, plus rapide.
  const rechercheTelephoneIA = req.body.rechercheTelephoneIA !== false;

  const resultats = [];
  const creeesPourIa = [];
  for (const brut of sirens) {
    const siren = normaliserSiren(brut);
    if (!siren) continue;
    try {
      const { existant, archive, entreprise } = await creerLeadDepuisSiren(siren, {
        lot,
        categorieForcee: cle,
        assigneA,
        utilisateur: req.utilisateur,
      });
      resultats.push({ siren, statut: existant ? "existant" : archive ? "radiee" : "cree", nom: entreprise?.nom || "(déjà assigné à un autre agent)" });
      if (!existant && !archive && entreprise) creeesPourIa.push(entreprise);
    } catch (e) {
      resultats.push({ siren, statut: "erreur", erreur: e.message });
    }
    // Petite pause polie entre deux appels à l'API publique Sirene.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const enrichissementTelephoneIA = rechercheTelephoneIA && estRechercheIaConfiguree() && creeesPourIa.length > 0;
  res.status(201).json({ lot, categorie: cle, resultats, enrichissementTelephoneIA });

  // Volontairement après res.json ci-dessus et sans await : voir
  // enrichirTelephonesViaIA pour le détail (ne doit pas bloquer la réponse).
  // Mis en file : le frontend importe une vague en plusieurs petits appels,
  // lancer un enrichissement parallèle par appel multiplierait les requêtes
  // simultanées vers Anthropic (limites de débit).
  if (enrichissementTelephoneIA) {
    fileEnrichissementImport = fileEnrichissementImport
      .then(() => enrichirTelephonesViaIA(creeesPourIa))
      .catch((e) => console.error("[ia] Échec de l'enrichissement téléphone en lot :", e.message));
  }
});

// Demande de leads en libre-service par un agent : évite qu'un agent reste
// sans fiches quand aucun manager n'est disponible pour lui en assigner.
// 1) on lui attribue des fiches existantes non assignées du secteur choisi ;
// 2) s'il en manque, on génère le complément depuis Sirene (mêmes critères
//    que la vague par secteur, entreprises de 20 salariés et plus), en
//    arrière-plan — plusieurs dizaines de secondes, trop long pour bloquer
//    la requête HTTP (voir les 502 rencontrés sur les imports longs).
// Garde-fou : pas de nouvelle demande tant que l'agent a encore
// SEUIL_NOUVEAUX_DEMANDE fiches "nouveau" jamais traitées.
const TAILLE_DEMANDE_LEADS = 20;
const SEUIL_NOUVEAUX_DEMANDE = 10;
// Suivi par agent (mémoire process, comme l'enrichissement en lot).
const demandesLeads = new Map();

function nouveauxNonTraites(utilisateurId) {
  return db.data.entreprises.filter((e) => e.assigneA === utilisateurId && e.statut === "nouveau").length;
}

function etatDemandeLeads(utilisateurId) {
  const nouveaux = nouveauxNonTraites(utilisateurId);
  return {
    taille: TAILLE_DEMANDE_LEADS,
    seuil: SEUIL_NOUVEAUX_DEMANDE,
    nouveauxNonTraites: nouveaux,
    peutDemander: nouveaux < SEUIL_NOUVEAUX_DEMANDE,
    ...(demandesLeads.get(utilisateurId) || { enCours: false }),
  };
}

function correspondDepartement(entreprise, departement) {
  if (!departement) return true;
  const cp = String(entreprise.codePostal || "");
  if (/^2[AB]$/i.test(departement)) return cp.startsWith("20");
  return cp.startsWith(departement);
}

app.get("/api/leads/demande", exigerAuth, (req, res) => {
  res.json(etatDemandeLeads(req.utilisateur.id));
});

// Toute erreur imprévue renvoie un message clair : sans ce filet, une
// exception dans une route async n'était que journalisée, la requête restait
// sans réponse et l'agent voyait "Erreur HTTP 502" (délai du proxy Render).
app.post("/api/leads/demande", exigerAuth, async (req, res) => {
  try {
    await traiterDemandeLeads(req, res);
  } catch (e) {
    console.error("[demande-leads] Échec :", e?.stack || e);
    const suivi = demandesLeads.get(req.utilisateur.id);
    if (suivi?.enCours) {
      suivi.enCours = false;
      suivi.erreur = e.message;
      suivi.termine = new Date().toISOString();
    }
    if (!res.headersSent) {
      res.status(500).json({ error: `La demande de fiches a échoué (${e.message}). Réessayez ; si le problème persiste, prévenez un administrateur.` });
    }
  }
});

async function traiterDemandeLeads(req, res) {
  const utilisateur = req.utilisateur;
  const etat = etatDemandeLeads(utilisateur.id);
  if (etat.enCours) return res.status(409).json({ error: "Une demande est déjà en cours.", ...etat });
  if (!etat.peutDemander) {
    return res.status(409).json({
      error: `Vous avez encore ${etat.nouveauxNonTraites} fiches « Nouveau » à traiter : une nouvelle demande est possible sous ${SEUIL_NOUVEAUX_DEMANDE}.`,
      ...etat,
    });
  }

  const cle = req.body.categorie ? String(req.body.categorie) : null;
  const categorie = cle ? CATEGORIES[cle] : null;
  if (cle && !categorie) return res.status(400).json({ error: "Catégorie inconnue." });
  // Territoire choisi (métropole, La Réunion…) : pour un DOM, vaut filtre de
  // département ; pour la métropole, exclut les fiches d'outre-mer.
  const territoire = territoireValide(req.body.territoire) ? req.body.territoire : null;
  const departement = req.body.departement
    ? String(req.body.departement).trim().toUpperCase()
    : territoire && territoire !== "metropole"
      ? territoire
      : null;
  const dansTerritoire = (e) => !territoire || territoireDe(e.codePostal) === territoire;
  if (departement && !/^(\d{2,3}|2[AB])$/.test(departement)) {
    return res.status(400).json({ error: "Département invalide (ex : 75, 69, 2A, 971)." });
  }

  const maintenant = new Date().toISOString();
  const nomAgent = utilisateur.prenom || utilisateur.email;

  // 1) Fiches existantes non assignées : les entreprises assujetties
  // (20 salariés et plus) et celles qui ont déjà un numéro d'abord.
  const pool = db.data.entreprises
    .filter(
      (e) =>
        !e.assigneA &&
        e.statut === "nouveau" &&
        correspondDepartement(e, departement) &&
        dansTerritoire(e) &&
        (!cle ||
          classifierSecteur(e.secteurActivite, { secteurPublic: e.secteurPublic, categorieForcee: e.categorieForcee }).cle === cle)
    )
    .sort((a, b) => (b.effectif >= 20) - (a.effectif >= 20) || Boolean(b.contact?.telephone) - Boolean(a.contact?.telephone))
    .slice(0, TAILLE_DEMANDE_LEADS);

  for (const e of pool) {
    e.assigneA = utilisateur.id;
    e.assignationVue = true;
    e.dateAssignation = maintenant;
    // Certaines fiches anciennes n'ont pas de liste de commentaires.
    e.commentaires = Array.isArray(e.commentaires) ? e.commentaires : [];
    e.commentaires.unshift({
      id: nanoid(),
      date: maintenant,
      auteur: "Système",
      texte: `Fiche attribuée automatiquement à ${nomAgent}, à sa demande.`,
    });
  }
  if (pool.length) await db.write();

  const manquants = TAILLE_DEMANDE_LEADS - pool.length;
  // Sans secteur choisi, on ne génère pas : on ne sait pas quoi chercher.
  const generer = manquants > 0 && Boolean(categorie);

  demandesLeads.set(utilisateur.id, {
    enCours: generer,
    attribues: pool.length,
    generes: 0,
    aGenerer: generer ? manquants : 0,
    categorieLabel: categorie?.label || null,
    erreur: null,
    message:
      manquants > 0 && !categorie
        ? "Plus assez de fiches disponibles sans secteur précis : choisissez un secteur pour lancer la génération de nouvelles fiches."
        : null,
    demarre: maintenant,
    termine: generer ? null : maintenant,
  });
  res.status(202).json(etatDemandeLeads(utilisateur.id));
  // Fiches existantes attribuées sans numéro : recherche Claude tout de suite.
  rechercherNumerosDemande(demandesLeads.get(utilisateur.id), pool);
  if (!generer) return;

  // 2) Génération du complément, en arrière-plan.
  const suivi = demandesLeads.get(utilisateur.id);
  const lieu = departement && departement !== territoire ? departement : nomTerritoire(territoire);
  const lot = `Demande ${nomAgent} — ${categorie.label}${lieu ? ` (${lieu})` : ""} — ${maintenant.slice(0, 10)}`;
  const creees = [];
  try {
    const connus = new Set([...db.data.entreprises, ...db.data.archives].map(sirenDe));
    // Un peu plus que nécessaire : certaines fiches peuvent être radiées
    // entre la recherche et la création.
    // Le filtre "departement" de Sirene retient les entreprises ayant UN
    // établissement dans le département, alors que la fiche reprend l'adresse
    // du siège : on ne garde que celles dont le siège y est, pour qu'une
    // demande "78" donne bien des fiches dans le 78 (d'où une recherche plus
    // large quand un département est demandé).
    const candidats = (
      await rechercherEntreprisesParSecteur(
        { nafCodes: categorie.nafCodes, estAdministration: categorie.estAdministration },
        {
          departement,
          limite: departement ? manquants * 4 : territoire ? manquants * 2 : manquants + 5,
          effectifMin20: !categorie.estAdministration,
          exclure: connus,
        }
      )
    ).filter((c) => correspondDepartement(c, departement) && dansTerritoire(c));
    for (const candidat of candidats) {
      if (creees.length >= manquants) break;
      try {
        const { existant, archive, entreprise } = await creerLeadDepuisSiren(candidat.siren, {
          lot,
          categorieForcee: cle,
          assigneA: utilisateur.id,
          utilisateur,
        });
        if (!existant && !archive && entreprise) {
          creees.push(db.data.entreprises.find((e) => e.id === entreprise.id));
          suivi.generes = creees.length;
        }
      } catch (e) {
        console.error(`[demande-leads] Échec création ${candidat.siren} :`, e.message);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (creees.length < manquants) {
      suivi.message = `Seulement ${creees.length} nouvelle(s) fiche(s) trouvée(s) pour ${categorie.label}${
        departement ? ` dans le ${departement}` : ""
      } : essayez un autre secteur ou département.`;
    }
  } catch (e) {
    suivi.erreur = e.message;
  } finally {
    suivi.enCours = false;
    suivi.termine = new Date().toISOString();
  }

  // Numéros de téléphone des fiches créées : même recherche Claude.
  rechercherNumerosDemande(suivi, creees);
}

// Recherche Claude des numéros manquants sur les fiches remises à un agent
// par "Demander 20 fiches" (existantes comme nouvellement créées), avec une
// progression visible dans le bloc de demande (suivi.numeros). Passe par la
// même file que les autres recherches (une à la fois) et ignore les fiches
// déjà cherchées sans succès ou déjà programmées ailleurs.
function rechercherNumerosDemande(suivi, fiches) {
  if (!suivi || !estRechercheIaConfiguree()) return;
  const cibles = fiches.filter(
    (e) => e && !e.contact?.telephone && !estDejaTenteeSansSucces(e) && !fichesEnEnrichissement.has(e.id)
  );
  if (cibles.length === 0) return;
  suivi.numeros = suivi.numeros || { total: 0, traites: 0, trouves: 0, lotsEnCours: 0, enCours: false };
  suivi.numeros.total += cibles.length;
  suivi.numeros.lotsEnCours += 1;
  suivi.numeros.enCours = true;
  for (const e of cibles) fichesEnEnrichissement.add(e.id);
  fileEnrichissementImport = fileEnrichissementImport
    .then(() =>
      enrichirTelephonesViaIA(cibles, {
        onProgres: ({ trouve }) => {
          suivi.numeros.traites += 1;
          if (trouve) suivi.numeros.trouves += 1;
        },
      })
    )
    .then((resultat) => {
      if (resultat?.interrompu) suivi.numeros.interrompu = resultat.interrompu;
    })
    .catch((e) => console.error("[ia] Échec de l'enrichissement téléphone (demande de leads) :", e.message))
    .finally(() => {
      for (const e of cibles) fichesEnEnrichissement.delete(e.id);
      suivi.numeros.lotsEnCours -= 1;
      suivi.numeros.enCours = suivi.numeros.lotsEnCours > 0;
    });
}

app.patch("/api/entreprises/:id", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

  const champsAutorises = [
    "statut",
    "dateRappel",
    "dateRdv",
    "nom",
    "adresse",
    "codePostal",
    "ville",
    "contact",
    "siteWeb",
    "consentementAffichagePublic",
    "effectif",
    "effectifBeneficiaire",
    "typeContrat",
    "esatAssocie",
    "dateCreation",
    "secteurPublic",
    "lot",
    "categorieForcee",
    // Fiche en statut "mail" dont le contact doit AUSSI rappeler (ex. RH à
    // qui l'interlocuteur transmet les coordonnées) : comptée aussi dans
    // "Me rappelle" (sans date ni alerte). Sans effet hors statut mail.
    "aussiMeRappelle",
  ];
  for (const champ of champsAutorises) {
    if (champ in req.body) entreprise[champ] = req.body[champ];
  }
  if ("contact" in req.body) reparerChampsContact(entreprise.contact);

  await db.write();
  res.json(enrichir(entreprise));
});

// Assignation d'un dossier à un agent — réservé aux administrateurs (une
// route dédiée plutôt qu'un champ PATCH ouvert : c'est une décision de
// répartition du pipeline, pas une correction de fiche par l'agent qui la
// traite). `utilisateurId: null` retire l'assignation ; le dossier redevient
// alors visible uniquement des admins, en attente de redistribution.
app.post("/api/entreprises/:id/assigner", exigerAdmin, async (req, res) => {
  const entreprise = findEntreprise(req.params.id);
  if (!entreprise) return res.status(404).json({ error: "Entreprise introuvable" });

  const utilisateurId = req.body.utilisateurId || null;
  if (utilisateurId) {
    const cible = trouverUtilisateurParId(utilisateurId);
    if (!cible || cible.statut !== "valide") {
      return res.status(400).json({ error: "Agent introuvable ou compte non validé." });
    }
  }
  // Nouvelle affectation à un agent différent : déclenche l'alerte "nouveau
  // lead assigné" (voir /api/notifications) jusqu'à ce qu'il ouvre la fiche.
  if (utilisateurId && utilisateurId !== entreprise.assigneA) {
    entreprise.assignationVue = utilisateurId === req.utilisateur.id; // s'assigner soi-même : pas d'alerte
    entreprise.dateAssignation = new Date().toISOString();
  }
  entreprise.assigneA = utilisateurId;
  await db.write();
  res.json(enrichir(entreprise));
});

// Assignation en masse de toute une vague (lot) de prospection à un agent —
// réservé aux administrateurs. Le nom du lot arrive encodé dans l'URL (les
// noms de lot contiennent souvent des espaces/tirets).
app.post("/api/lots/:lot/assigner", exigerAdmin, async (req, res) => {
  const lot = req.params.lot; // déjà décodé par Express (routing sur path-to-regexp)
  const utilisateurId = req.body.utilisateurId || null;
  if (utilisateurId) {
    const cible = trouverUtilisateurParId(utilisateurId);
    if (!cible || cible.statut !== "valide") {
      return res.status(400).json({ error: "Agent introuvable ou compte non validé." });
    }
  }
  const cibles = db.data.entreprises.filter((e) => e.lot === lot);
  for (const e of cibles) {
    if (utilisateurId && utilisateurId !== e.assigneA) {
      e.assignationVue = utilisateurId === req.utilisateur.id;
      e.dateAssignation = new Date().toISOString();
    }
    e.assigneA = utilisateurId;
  }
  await db.write();
  res.json({ lot, nbAssignees: cibles.length, entreprises: cibles.map(enrichir) });
});

// Enregistre une nouvelle issue d'appel (module AGIR) et met à jour le statut
app.post("/api/entreprises/:id/appels", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

  const { issue, date, details, dureeSecondes } = req.body;
  if (!ISSUES_APPEL[issue]) {
    return res.status(400).json({ error: "Issue d'appel inconnue" });
  }

  const entree = {
    id: nanoid(),
    date: new Date().toISOString(),
    type: "appel",
    issue,
    issueLabel: ISSUES_APPEL[issue],
    details: details || null,
    dateProgrammee: date || null,
    dureeSecondes: Number.isFinite(dureeSecondes) ? dureeSecondes : null,
  };

  entreprise.historiqueAppels.unshift(entree);
  entreprise.statut = issue;
  if (issue === "a_rappeler" || issue === "me_rappelle") entreprise.dateRappel = date || null;
  if (issue === "rdv") entreprise.dateRdv = date || null;

  await db.write();
  res.json(enrichir(entreprise));
});

// Enregistre une sortie de dossier (Fiche / Fiche one-shot / Mort)
app.post("/api/entreprises/:id/sortie", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

  const { sortie, details, dureeSecondes } = req.body;
  if (!SORTIES_DOSSIER[sortie]) {
    return res.status(400).json({ error: "Sortie de dossier inconnue" });
  }

  const entree = {
    id: nanoid(),
    date: new Date().toISOString(),
    type: "sortie",
    issue: sortie,
    issueLabel: SORTIES_DOSSIER[sortie],
    details: details || null,
    dateProgrammee: null,
    dureeSecondes: Number.isFinite(dureeSecondes) ? dureeSecondes : null,
  };

  entreprise.historiqueAppels.unshift(entree);
  entreprise.statut = sortie;
  if (sortie === "doublon" && req.body.doublonDe && req.body.doublonDe !== entreprise.id && findEntreprise(req.body.doublonDe)) {
    entreprise.doublonDe = req.body.doublonDe;
  }

  // Purge automatique du pipeline actif : un dossier "mort" est déplacé vers
  // les archives plutôt que laissé dans la liste active des entreprises.
  const archive = SORTIES_ARCHIVANTES.has(sortie);
  if (archive) archiver(entreprise);

  await db.write();
  res.json({ archive, entreprise: enrichir(entreprise) });
});

// Numéro comparable quel que soit le format ("+33 1 71 13 39 43",
// "01.71.13.39.43" → "171133943").
function chiffresTelephoneComparables(numero) {
  let d = String(numero || "").replace(/\D/g, "");
  if (d.startsWith("0033")) d = d.slice(4);
  else if (d.startsWith("33") && d.length === 11) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

function numerosDeFiche(e) {
  return [e.contact?.telephone, ...(e.contact?.telephonesAlternatifs || []).map((t) => t.numero)].filter(Boolean);
}

// Doublons probables d'une fiche : autres fiches (actives ou archivées) qui
// partagent un numéro de téléphone (principal ou alternatif — ex. même
// standard pour deux sociétés d'un même groupe) ou le même SIREN.
app.get("/api/entreprises/:id/doublons", exigerAuth, chargerEntrepriseAutorisee, (req, res) => {
  const e = req.entreprise;
  const mesNumeros = new Map();
  for (const n of numerosDeFiche(e)) {
    const d = chiffresTelephoneComparables(n);
    if (d.length >= 8) mesNumeros.set(d, n);
  }
  const siren = sirenDe(e);
  const idsArchives = new Set(db.data.archives.map((a) => a.id));
  const doublons = [];
  for (const autre of [...db.data.entreprises, ...db.data.archives]) {
    if (autre.id === e.id) continue;
    const raisons = [];
    if (siren && sirenDe(autre) === siren) raisons.push("même SIREN");
    const numeroCommun = numerosDeFiche(autre).find((n) => mesNumeros.has(chiffresTelephoneComparables(n)));
    if (numeroCommun) raisons.push(`même numéro ${mesNumeros.get(chiffresTelephoneComparables(numeroCommun))}`);
    if (raisons.length === 0) continue;
    doublons.push({
      id: autre.id,
      nom: autre.nom,
      ville: autre.ville || null,
      codePostal: autre.codePostal || null,
      statut: autre.statut,
      archivee: idsArchives.has(autre.id),
      raisons,
      accessible: estVisiblePar(autre, req.utilisateur),
    });
  }
  res.json(doublons.slice(0, 10));
});

// ---- Actions groupées (sélection multiple dans le tableau de bord) ----

// Assignation en masse d'une sélection LIBRE d'entreprises (contrairement à
// /api/lots/:lot/assigner qui vise toute une vague) — réservée aux
// administrateurs, même règle que l'assignation individuelle ci-dessus.
app.post("/api/entreprises/assigner-groupe", exigerAdmin, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const utilisateurId = req.body.utilisateurId || null;
  if (ids.length === 0) return res.status(400).json({ error: "Aucune entreprise sélectionnée." });
  if (utilisateurId) {
    const cible = trouverUtilisateurParId(utilisateurId);
    if (!cible || cible.statut !== "valide") {
      return res.status(400).json({ error: "Agent introuvable ou compte non validé." });
    }
  }

  const cibles = db.data.entreprises.filter((e) => ids.includes(e.id));
  for (const e of cibles) {
    if (utilisateurId && utilisateurId !== e.assigneA) {
      e.assignationVue = utilisateurId === req.utilisateur.id;
      e.dateAssignation = new Date().toISOString();
    }
    e.assigneA = utilisateurId;
  }
  await db.write();
  res.json({ nbAssignees: cibles.length, entreprises: cibles.map(enrichir) });
});

// Statuts que le changement groupé accepte en plus des issues d'appel et
// sorties de dossier ci-dessus : deux statuts "de repos" sans issue d'appel
// dédiée, utiles pour remettre en masse un lot de dossiers en file d'attente
// (ex. après une réorganisation d'équipe) sans forcer une fausse issue d'appel.
// "numero_invalide" est normalement posé automatiquement par
// /telephone-invalide, mais reste sélectionnable ici (badge de statut
// cliquable, changement groupé) pour qu'un agent puisse aussi le lever/poser
// manuellement sans repasser par le bouton dédié.
const STATUTS_DIRECTS_AUTORISES = new Set(["nouveau", "a_relancer", "numero_invalide"]);

function libelleStatutGroupe(statut) {
  return ISSUES_APPEL[statut] || SORTIES_DOSSIER[statut] || (STATUTS_DIRECTS_AUTORISES.has(statut) ? statut : null);
}

// Changement de statut en masse sur une sélection libre — ouvert à tout agent
// (pas juste l'admin) mais limité à ce qu'il peut déjà voir/traiter un par un
// (estVisiblePar), donc sans élargir ses droits : juste plus rapide sur un
// lot que de rouvrir chaque fiche. Une seule valeur de statut pour toute la
// sélection ; si elle correspond à une sortie archivante (mort/refus/
// conforme), TOUTE la sélection est archivée d'un coup (même logique que la
// sortie individuelle ci-dessus).
app.post("/api/entreprises/statut-groupe", exigerAuth, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const statut = String(req.body.statut || "");
  const libelle = libelleStatutGroupe(statut);
  if (!libelle) return res.status(400).json({ error: "Statut inconnu." });
  if (ids.length === 0) return res.status(400).json({ error: "Aucune entreprise sélectionnée." });

  const estIssueAppel = Boolean(ISSUES_APPEL[statut]);
  const estSortie = Boolean(SORTIES_DOSSIER[statut]);
  const archive = estSortie && SORTIES_ARCHIVANTES.has(statut);

  const entreprisesTouchees = [];
  for (const id of ids) {
    const entreprise = db.data.entreprises.find((e) => e.id === id);
    if (!entreprise || !estVisiblePar(entreprise, req.utilisateur)) continue;

    entreprise.historiqueAppels.unshift({
      id: nanoid(),
      date: new Date().toISOString(),
      type: estIssueAppel ? "appel" : estSortie ? "sortie" : "statut",
      issue: statut,
      issueLabel: `${libelle} (changement groupé)`,
      details: null,
      dateProgrammee: null,
      dureeSecondes: null,
    });
    entreprise.statut = statut;
    if (archive) archiver(entreprise);
    entreprisesTouchees.push(enrichir(entreprise));
  }

  if (entreprisesTouchees.length === 0) {
    return res.status(404).json({ error: "Aucune des entreprises sélectionnées n'est accessible." });
  }

  await db.write();
  res.json({ nbTraitees: entreprisesTouchees.length, archive, entreprises: entreprisesTouchees });
});

// Numérisation de la "Fiche de Suivi Prospect" papier : soumise par l'agent
// une fois le prospect qualifié comme prêt à finaliser. Fait basculer
// automatiquement le dossier sur le statut "fiche" (réétiqueté "Fiche
// Potentielle" — voir constants.js côté client et SORTIES_DOSSIER.fiche
// ci-dessus, qui reprend un statut secondaire déjà existant plutôt que d'en
// ajouter un nouveau). N'archive PAS le dossier (contrairement à "conforme/
// refus/mort") : il doit rester visible dans le pipeline actif pour que
// l'administrateur puisse encore agir dessus. La fiche complète est
// conservée (fichesProspection) pour trace/consultation ultérieure.
app.post("/api/entreprises/:id/fiche-prospection", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;
  const {
    prenom,
    date,
    numeroDossier,
    personneEnChargeNom,
    personneEnChargeFonction,
    nombreTravailleursHandicapes,
    montantTaxesAnnonce,
    montantAFaire,
    remarques,
    unitesManquantes,
    contactEmail,
  } = req.body;

  const fiche = {
    id: nanoid(),
    dateCreation: new Date().toISOString(),
    agentId: req.utilisateur.id,
    agentNom: req.utilisateur.prenom || req.utilisateur.nom || req.utilisateur.email,
    prenom: String(prenom || "").trim(),
    date: date || new Date().toISOString(),
    numeroDossier: String(numeroDossier || "").trim(),
    personneEnChargeNom: String(personneEnChargeNom || "").trim(),
    personneEnChargeFonction: String(personneEnChargeFonction || "").trim(),
    nombreTravailleursHandicapes: Number(nombreTravailleursHandicapes) || 0,
    montantTaxesAnnonce: Number(montantTaxesAnnonce) || 0,
    montantAFaire: Number(montantAFaire) || 0,
    remarques: String(remarques || "").trim(),
    unitesManquantes: Number.isFinite(Number(unitesManquantes)) ? Number(unitesManquantes) : null,
    contactEmail: String(contactEmail || "").trim(),
  };

  entreprise.fichesProspection = entreprise.fichesProspection || [];
  entreprise.fichesProspection.unshift(fiche);
  entreprise.statut = "fiche";

  entreprise.historiqueAppels.unshift({
    id: nanoid(),
    date: new Date().toISOString(),
    type: "sortie",
    issue: "fiche",
    issueLabel: SORTIES_DOSSIER.fiche,
    details:
      `Client Potentiel (CP) qualifié par ${fiche.agentNom}` +
      (fiche.numeroDossier ? ` (dossier n°${fiche.numeroDossier})` : "") +
      ` — ${fiche.nombreTravailleursHandicapes} travailleur(s) handicapé(s)` +
      (fiche.unitesManquantes != null ? `, ${fiche.unitesManquantes} unité(s) manquante(s)` : "") +
      `, contribution estimée ${fiche.montantTaxesAnnonce} €` +
      (fiche.montantAFaire ? `, solution EA/ESAT/TIH ≈ ${fiche.montantAFaire} € HT` : "") +
      (fiche.contactEmail ? `, dossier à envoyer à ${fiche.contactEmail}` : "") +
      "." +
      (fiche.remarques ? ` Remarques : ${fiche.remarques}` : ""),
    dateProgrammee: null,
    dureeSecondes: null,
  });

  await db.write();
  res.status(201).json(enrichir(entreprise));
});

// Ajoute un commentaire libre (messagerie / historique)
app.post("/api/entreprises/:id/commentaires", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

  const { texte, auteur } = req.body;
  if (!texte || !texte.trim()) {
    return res.status(400).json({ error: "Le commentaire ne peut pas être vide" });
  }

  const commentaire = {
    id: nanoid(),
    date: new Date().toISOString(),
    auteur: auteur || "Philippe",
    texte: texte.trim(),
  };

  entreprise.commentaires.unshift(commentaire);
  await db.write();
  res.json(enrichir(entreprise));
});

// Espace IA (assistant de correction de contact) : un agent signale un
// numéro non attribué/invalide. Faute d'API de téléphonie payante (Pappers)
// configurée, l'assistant ne devine pas un numéro : il flague le contact,
// bascule le statut du dossier sur "numero_invalide" (visible immédiatement
// dans le tableau — voir STATUTS côté client) et journalise l'anomalie dans
// l'historique, pendant que le frontend déclenche une recherche IA de
// substitution et propose des pistes de recherche externes prêtes à cliquer.
app.post("/api/entreprises/:id/telephone-invalide", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

  const ancienNumero = entreprise.contact?.telephone || "(aucun)";
  entreprise.contact = { ...entreprise.contact, telephoneInvalide: true };
  entreprise.statut = "numero_invalide";
  entreprise.historiqueAppels.unshift({
    id: nanoid(),
    date: new Date().toISOString(),
    type: "statut",
    issue: "numero_invalide",
    issueLabel: "Numéro invalide",
    details: `Numéro signalé non attribué/invalide (${ancienNumero}).`,
    dateProgrammee: null,
    dureeSecondes: null,
  });
  entreprise.commentaires.unshift({
    id: nanoid(),
    date: new Date().toISOString(),
    auteur: "Assistant IA",
    texte: `Numéro signalé non attribué/invalide (${ancienNumero}). Recherche d'un contact alternatif recommandée — voir les pistes proposées dans la fiche.`,
  });

  await db.write();
  res.json(enrichir(entreprise));
});

// Recherche IA (Claude / Anthropic + recherche web) d'un numéro/contact
// alternatif ET d'une catégorie de secteur suggérée, quand le numéro
// enregistré a été signalé invalide. Optionnelle (ANTHROPIC_API_KEY) et
// protégée par une session valide même si les autres routes
// /api/entreprises ne le sont pas ici : chaque appel déclenche un appel
// facturé à l'API Anthropic, à ne pas laisser accessible sans authentification.
// Renvoie une PROPOSITION seulement — voir rechercheContact.js : rien n'est
// écrit en base ici, l'agent doit valider via le formulaire existant
// (numéro : POST .../telephone-invalide puis PATCH ; catégorie : PATCH
// categorieForcee) avant que ça n'affecte la fiche.
app.post("/api/entreprises/:id/rechercher-contact", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

  if (!estRechercheIaConfiguree()) {
    return res.status(503).json({ error: "Recherche IA non configurée (renseignez ANTHROPIC_API_KEY)." });
  }

  try {
    const resultat = await rechercherContactAlternatif(entreprise);
    const morceaux = [];
    if (resultat.telephone) {
      morceaux.push(
        `numéro proposé ${resultat.telephone}${resultat.contact ? ` (contact : ${resultat.contact})` : ""} — confiance ${resultat.confiance}${resultat.source ? `, source : ${resultat.source}` : ""}`
      );
    }
    if (resultat.secteurCategorieLabel) {
      morceaux.push(`catégorie suggérée : ${resultat.secteurCategorieLabel}`);
    }
    entreprise.commentaires.unshift({
      id: nanoid(),
      date: new Date().toISOString(),
      auteur: "Assistant IA",
      texte: morceaux.length
        ? `Recherche IA : ${morceaux.join(" ; ")}. À valider avant application.`
        : "Recherche IA : aucune information fiable trouvée.",
    });
    await db.write();
    res.json(resultat);
  } catch (e) {
    console.error(`[ia] Échec de recherche de contact pour ${entreprise.nom} :`, JSON.stringify(detailErreurIa(e)));
    const statutHttp = e.code === "IA_NON_CONFIGUREE" ? 503 : e.code === "TIMEOUT_MANUEL" ? 504 : 502;
    res.status(statutHttp).json(corpsErreurIa(e));
  }
});

// Assistant conversationnel "Contact nominatif" (chatbot de l'Espace IA) :
// l'agent pose une question libre ("Qui contacter pour la comptabilité ?")
// et reçoit une réponse nominative si une source fiable en confirme une.
// Ne persiste RIEN ici — voir poserQuestionContact : c'est une simple
// consultation, l'enregistrement (commentaire + association du contact) se
// fait via les routes existantes /commentaires et PATCH une fois l'agent
// satisfait de la réponse, pour ne jamais écrire une identité non validée.
app.post("/api/entreprises/:id/question-contact-ia", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;
  const question = String(req.body.question || "").trim();
  if (!question) return res.status(400).json({ error: "Question vide." });
  if (question.length > 500) return res.status(400).json({ error: "Question trop longue (500 caractères maximum)." });

  if (!estRechercheIaConfiguree()) {
    return res.status(503).json({ error: "Recherche IA non configurée (renseignez ANTHROPIC_API_KEY)." });
  }

  try {
    const resultat = await poserQuestionContact(entreprise, question);
    res.json(resultat);
  } catch (e) {
    console.error(`[ia] Échec de la question contact pour ${entreprise.nom} :`, JSON.stringify(detailErreurIa(e)));
    const statutHttp = e.code === "IA_NON_CONFIGUREE" ? 503 : e.code === "TIMEOUT_MANUEL" ? 504 : 502;
    res.status(statutHttp).json(corpsErreurIa(e));
  }
});

// Barème de contribution "par unité manquante" au SMIC actuel — alimente
// l'outil interne "ESAT Tremplin / TIH" du CRM (voir PanelEsatTremplin.jsx) :
// mêmes tranches et mêmes montants que le simulateur public et les fiches
// (calculerObligationOeth), pour qu'un agent cite toujours le bon chiffre en
// appel sans calculatrice ni risque d'écart avec le reste du CRM.
app.get("/api/oeth/bareme", exigerAuth, (req, res) => {
  res.json(baremeParUnite());
});

// Assistant de questions "domaine" (AssistantDomaineCrm.jsx, bouton flottant
// au-dessus du chat d'équipe) : question libre de connaissance métier OETH /
// contribution / surcontribution / ESAT Tremplin / TIH, sans lien avec une
// entreprise précise — voir repondreQuestionDomaine (tous les chiffres cités
// viennent de oeth.js, jamais inventés par le modèle).
app.post("/api/assistant-domaine", exigerAuth, async (req, res) => {
  const question = String(req.body.question || "").trim();
  if (!question) return res.status(400).json({ error: "Question vide." });
  if (question.length > 500) return res.status(400).json({ error: "Question trop longue (500 caractères maximum)." });

  if (!estRechercheIaConfiguree()) {
    return res.status(503).json({ error: "Recherche IA non configurée (renseignez ANTHROPIC_API_KEY)." });
  }

  try {
    const resultat = await repondreQuestionDomaine(question);
    res.json(resultat);
  } catch (e) {
    console.error(`[ia] Échec de l'assistant domaine :`, JSON.stringify(detailErreurIa(e)));
    const statutHttp = e.code === "IA_NON_CONFIGUREE" ? 503 : e.code === "TIMEOUT_MANUEL" ? 504 : 502;
    res.status(statutHttp).json(corpsErreurIa(e));
  }
});

// Dictaphone IA (compte-rendu d'appel) : la transcription est faite côté
// client (Web Speech API, voir DicteeCommentaire.jsx) — cette route ne fait
// qu'analyser le TEXTE déjà transcrit pour en tirer un compte-rendu propre
// et d'éventuels contacts nominatifs cités pendant l'appel. Aucun outil de
// recherche web (voir analyserDictee) : jamais de recherche internet à
// partir du contenu d'un appel privé. Ne persiste RIEN — l'agent valide et
// enregistre explicitement (commentaire + association du contact) via les
// routes existantes une fois satisfait du résultat.
app.post("/api/entreprises/:id/dictee-ia", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;
  const transcription = String(req.body.transcription || "").trim();
  if (!transcription) return res.status(400).json({ error: "Dictée vide." });
  if (transcription.length > 4000) {
    return res.status(400).json({ error: "Dictée trop longue (4000 caractères maximum)." });
  }

  if (!estRechercheIaConfiguree()) {
    return res.status(503).json({ error: "Recherche IA non configurée (renseignez ANTHROPIC_API_KEY)." });
  }

  try {
    const resultat = await analyserDictee(entreprise, transcription);
    res.json(resultat);
  } catch (e) {
    console.error(`[ia] Échec d'analyse de dictée pour ${entreprise.nom} :`, JSON.stringify(detailErreurIa(e)));
    const statutHttp = e.code === "IA_NON_CONFIGUREE" ? 503 : e.code === "TIMEOUT_MANUEL" ? 504 : 502;
    res.status(statutHttp).json(corpsErreurIa(e));
  }
});

// Génération d'un e-mail de relance/prospection sur demande explicite de
// l'agent (bouton dédié dans MessagerieMail.jsx) — jamais automatique.
// Personnalise le brouillon avec les données déjà connues du CRM (secteur,
// chiffres OETH, interlocuteur, historique d'échange) : pas d'appel à
// l'outil de recherche web ici, voir rechercheContact.js. Renvoie une
// PROPOSITION (objet + corps) qui pré-remplit le formulaire d'envoi
// existant côté client ; rien n'est envoyé ni journalisé par cette route,
// l'agent relit et clique lui-même sur "Envoyer".
app.post("/api/entreprises/:id/generer-email", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = enrichir(req.entreprise);

  if (!estRechercheIaConfiguree()) {
    return res.status(503).json({ error: "Recherche IA non configurée (renseignez ANTHROPIC_API_KEY)." });
  }

  try {
    const resultat = await genererEmailProspection(entreprise);
    res.json(resultat);
  } catch (e) {
    console.error(`[ia] Échec de génération d'e-mail pour ${entreprise.nom} :`, JSON.stringify(detailErreurIa(e)));
    const statutHttp = e.code === "IA_NON_CONFIGUREE" ? 503 : e.code === "TIMEOUT_MANUEL" ? 504 : 502;
    res.status(statutHttp).json(corpsErreurIa(e));
  }
});

// Diagnostic admin : la liste des modèles Anthropic réellement disponibles
// pour ANTHROPIC_API_KEY. À utiliser si ANTHROPIC_MODEL tombe en erreur
// "not found" après une dépréciation de modèle : plutôt que deviner un
// nouveau nom, on demande directement à l'API la valeur exacte à mettre
// dans ANTHROPIC_MODEL sur Render.
app.get("/api/ia/modeles-disponibles", exigerAdmin, async (req, res) => {
  try {
    const modeles = await listerModelesDisponibles();
    res.json({ modeles });
  } catch (e) {
    const statutHttp = e.code === "IA_NON_CONFIGUREE" ? 503 : 502;
    res.status(statutHttp).json(corpsErreurIa(e));
  }
});

// Rapport PDF téléchargeable depuis la fiche entreprise (bouton "Télécharger
// le rapport PDF") — indicateurs OETH + statut/historique de prospection.
// Document DISTINCT du PDF joint aux mails (pdfSynthese.js) : celui-ci
// contient un suivi interne (issues d'appel, notes) à ne jamais envoyer
// automatiquement au prospect lui-même — voir la note en tête de
// pdfRapport.js. Streamé directement, rien n'est stocké côté serveur.
app.get("/api/entreprises/:id/rapport-pdf", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = enrichir(req.entreprise);
  try {
    const pdf = await genererRapportPdf({
      entreprise,
      oeth: entreprise.oeth,
      categorie: entreprise.categorie,
      poleInfo: { email: adresseMailPole(), telephone: telephonePole() },
      genereParNom: req.utilisateur.prenom || req.utilisateur.nom || req.utilisateur.email,
    });
    const nomFichier = `rapport-${(entreprise.nom || "entreprise").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nomFichier}"`);
    res.send(pdf);
  } catch (e) {
    console.error(`[pdf] Échec de génération du rapport pour ${entreprise.nom} :`, e.message);
    res.status(500).json({ error: "Impossible de générer le rapport PDF." });
  }
});

// Boîte mail connectée (IMAP/SMTP) : indique si elle est configurée, et
// l'adresse du pôle pour l'affichage côté frontend.
app.get("/api/emails/statut", (req, res) => {
  res.json({
    configuree: estEnvoiConfigure(),
    adresse: adresseMailPole(),
    signature: signatureMail(),
    telephone: telephonePole(),
  });
});

// Notification globale (nombre de mails non lus par entreprise), pour
// afficher un badge/pop-up dans le CRM sans avoir à ouvrir chaque fiche —
// limitée aux dossiers visibles par l'utilisateur connecté.
app.get("/api/emails/non-lus", exigerAuth, (req, res) => {
  const parEntreprise = [];
  let total = 0;
  for (const e of db.data.entreprises) {
    if (!estVisiblePar(e, req.utilisateur)) continue;
    const nonLus = (e.emails || []).filter((m) => m.direction === "recu" && !m.lu).length;
    if (nonLus > 0) {
      parEntreprise.push({ id: e.id, nom: e.nom, count: nonLus });
      total += nonLus;
    }
  }
  res.json({ total, parEntreprise });
});

// Marque comme lus tous les mails reçus d'une entreprise (à l'ouverture du fil).
app.post("/api/entreprises/:id/emails/lu", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;
  for (const m of entreprise.emails || []) {
    if (m.direction === "recu") m.lu = true;
  }
  await db.write();
  res.json(enrichir(entreprise));
});

// Envoie un mail réel au contact de l'entreprise depuis l'adresse unique du
// pôle (contact@oeth-fiph.fr), avec une signature qui engage nommément
// l'agent connecté, journalise l'envoi dans le fil de messagerie ET dans
// l'historique du dossier, et bascule son statut sur "Mail".
app.post("/api/entreprises/:id/emails/envoyer", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

  const { objet, corps, joindrePdf = true, destinataire, formatOfficiel = false, testVersMoi = false } = req.body;
  if (!objet?.trim() || !corps?.trim()) {
    return res.status(400).json({ error: "Objet et corps du mail requis." });
  }

  // Le destinataire choisi côté agent (voir le sélecteur dans MessagerieMail.jsx)
  // doit être une adresse réellement connue pour cette entreprise — principale
  // ou parmi les alternatifs gérés dans "Informations structure" (voir
  // GestionEmails.jsx) — jamais une adresse arbitraire non liée au dossier.
  const emailsConnus = [
    entreprise.contact?.email,
    ...(entreprise.contact?.emailsAlternatifs || []).map((a) => a.email),
  ].filter(Boolean);
  // `testVersMoi` : aperçu réel envoyé à l'adresse du compte connecté
  // (jamais une adresse arbitraire), sans rien inscrire sur la fiche.
  // Fiche encore sans adresse valide : la fenêtre d'envoi (GenererEmailModal)
  // permet de saisir celle de l'entreprise, qui devient ensuite son adresse
  // principale — elle est acceptée si son format est correct.
  const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const aucuneAdresseConnue = !emailsConnus.some((e) => EMAIL_VALIDE.test(e));
  const premiereAdresse =
    aucuneAdresseConnue && typeof destinataire === "string" && EMAIL_VALIDE.test(destinataire.trim())
      ? destinataire.trim()
      : null;
  const destinataireFinal = testVersMoi
    ? req.utilisateur.email
    : destinataire && emailsConnus.includes(destinataire)
      ? destinataire
      : premiereAdresse || (EMAIL_VALIDE.test(entreprise.contact?.email || "") ? entreprise.contact.email : null);
  if (!destinataireFinal) {
    return res.status(400).json({ error: "Aucune adresse mail connue pour ce contact." });
  }

  // Nom d'expéditeur normalisé et uniforme sur tous les envois : uniquement
  // l'identité générale du pôle, jamais le nom de l'agent (voir mailSignature.js
  // côté client pour le même bloc dans le corps du mail) — l'adresse d'envoi
  // reste de toute façon la boîte unique du pôle (contact@oeth-fiph.fr).
  const nomExpediteur = "Pôle OETH / AGEFIPH";

  // PDF de synthèse OETH, joint automatiquement (voir pdfSynthese.js) —
  // désactivable ponctuellement par l'agent (ex: mail de confirmation de RDV
  // où la synthèse chiffrée n'a pas sa place).
  let piecesJointes = [];
  let piecesJointesEnvoi;
  if (joindrePdf) {
    const pdf = await genererSynthesePdf({
      entreprise,
      oeth: calculerObligationOeth(entreprise),
      poleInfo: { email: adresseMailPole(), telephone: telephonePole() },
    });
    const nomFichier = `synthese-oeth-${(entreprise.nom || "entreprise").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
    piecesJointesEnvoi = [{ filename: nomFichier, content: pdf, contentType: "application/pdf" }];
    piecesJointes = [{ nom: nomFichier, taille: pdf.length }];
  }

  // Mise en page officielle (voir emailOfficiel.js) : bandeau du pôle,
  // récapitulatif contribution / surcontribution, boutons simulation et
  // conseiller. Le texte brut reste envoyé en version alternative.
  const html = formatOfficiel
    ? genererEmailOfficielHtml({
        entreprise,
        oeth: calculerObligationOeth(entreprise),
        corps,
        poleInfo: { email: adresseMailPole(), telephone: telephonePole() },
      })
    : undefined;

  try {
    await envoyerMail({
      to: destinataireFinal,
      subject: testVersMoi ? `[TEST] ${objet}` : objet,
      text: corps,
      html,
      fromName: nomExpediteur,
      attachments: piecesJointesEnvoi,
      // Mail de prospection vers une entreprise externe (pas un mail
      // transactionnel de compte) : ajoute l'en-tête List-Unsubscribe
      // attendu par Gmail/Yahoo pour ce type d'envoi (voir mail.js).
      listeDiffusion: true,
    });
  } catch (e) {
    const statutHttp = e.code === "MAIL_NON_CONFIGURE" ? 503 : 502;
    return res.status(statutHttp).json({ error: e.message });
  }
  if (testVersMoi) return res.json({ test: true, destinataire: destinataireFinal });

  entreprise.emails = entreprise.emails || [];
  entreprise.emails.unshift({
    id: nanoid(),
    direction: "envoye",
    de: adresseMailPole(),
    a: destinataireFinal,
    objet,
    corps,
    piecesJointes,
    date: new Date().toISOString(),
    lu: true,
  });

  // Suivi des réponses : journalise l'envoi dans l'historique du dossier
  // (même mécanisme que les issues d'appel) et bascule le statut sur "Mail"
  // pour que le dossier ressorte dans les relances à suivre.
  entreprise.historiqueAppels = entreprise.historiqueAppels || [];
  entreprise.historiqueAppels.unshift({
    id: nanoid(),
    date: new Date().toISOString(),
    type: "mail",
    issue: "mail",
    issueLabel: ISSUES_APPEL.mail,
    details: objet,
    dateProgrammee: null,
    dureeSecondes: null,
  });
  entreprise.statut = "mail";

  await db.write();
  res.json(enrichir(entreprise));
});

// ---- Chat interne (Groupes / Privés) + centre de notifications ----
//
// Un canal "général" (voir CANAL_GENERAL_ID, amorcé dans db.js) est visible
// de tous implicitement. Les groupes d'équipe et les conversations privées
// sont des canaux normaux avec une liste `membres` explicite. Par choix de
// confidentialité : un administrateur ne devient PAS automatiquement membre
// des groupes/privés des agents (il ne peut pas lire leurs messages) — le
// "Mode Manager" ne lui donne accès qu'à des COMPTEURS (non-lus, leads,
// RDV), jamais au contenu des conversations d'un agent qu'il superviserait.

function estMembreCanal(canal, utilisateurId) {
  return canal.type === "general" || (canal.membres || []).includes(utilisateurId);
}

function compterNonLus(canal, utilisateur) {
  const dernierLu = utilisateur.lecturesChat?.[canal.id];
  const msgs = db.data.messages.filter((m) => m.canalId === canal.id);
  if (!dernierLu) return msgs.length;
  return msgs.filter((m) => new Date(m.date) > new Date(dernierLu)).length;
}

// Pour un canal privé, affiche le nom de L'AUTRE participant plutôt qu'un
// nom générique — chaque membre voit donc un nom différent pour le même canal.
function nomAfficheCanal(canal, utilisateurId) {
  if (canal.type !== "prive") return canal.nom;
  const autreId = (canal.membres || []).find((id) => id !== utilisateurId);
  const autre = autreId ? trouverUtilisateurParId(autreId) : null;
  return autre ? autre.prenom || autre.email : "Conversation";
}

function enrichirCanal(canal, utilisateur) {
  const msgs = db.data.messages
    .filter((m) => m.canalId === canal.id)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const dernier = msgs[msgs.length - 1] || null;
  return {
    id: canal.id,
    type: canal.type,
    nom: nomAfficheCanal(canal, utilisateur.id),
    membres: canal.membres || null,
    dernierMessage: dernier ? { texte: dernier.texte, date: dernier.date, auteurId: dernier.auteurId } : null,
    nonLus: compterNonLus(canal, utilisateur),
  };
}

app.get("/api/chat/canaux", exigerAuth, (req, res) => {
  const mesCanaux = db.data.canaux.filter((c) => estMembreCanal(c, req.utilisateur.id));
  res.json(mesCanaux.map((c) => enrichirCanal(c, req.utilisateur)));
});

app.get("/api/chat/canaux/:id/messages", exigerAuth, (req, res) => {
  const canal = db.data.canaux.find((c) => c.id === req.params.id);
  if (!canal) return res.status(404).json({ error: "Canal introuvable." });
  if (!estMembreCanal(canal, req.utilisateur.id)) {
    return res.status(403).json({ error: "Vous n'êtes pas membre de ce canal." });
  }
  const msgs = db.data.messages
    .filter((m) => m.canalId === canal.id)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((m) => {
      const auteur = trouverUtilisateurParId(m.auteurId);
      return { ...m, auteurNom: auteur ? auteur.prenom || auteur.email : "?" };
    });
  res.json(msgs);
});

app.post("/api/chat/canaux/:id/messages", exigerAuth, async (req, res) => {
  const canal = db.data.canaux.find((c) => c.id === req.params.id);
  if (!canal) return res.status(404).json({ error: "Canal introuvable." });
  if (!estMembreCanal(canal, req.utilisateur.id)) {
    return res.status(403).json({ error: "Vous n'êtes pas membre de ce canal." });
  }
  const texte = String(req.body.texte || "").trim();
  if (!texte) return res.status(400).json({ error: "Le message ne peut pas être vide." });

  const message = {
    id: nanoid(),
    canalId: canal.id,
    auteurId: req.utilisateur.id,
    texte,
    date: new Date().toISOString(),
  };
  db.data.messages.push(message);
  // L'auteur d'un message vient implicitement de lire son propre canal —
  // évite qu'il se compte lui-même comme "non lu" après son propre envoi.
  req.utilisateur.lecturesChat = req.utilisateur.lecturesChat || {};
  req.utilisateur.lecturesChat[canal.id] = message.date;
  await db.write();
  res.status(201).json({ ...message, auteurNom: req.utilisateur.prenom || req.utilisateur.email });
});

app.post("/api/chat/canaux/:id/lu", exigerAuth, async (req, res) => {
  const canal = db.data.canaux.find((c) => c.id === req.params.id);
  if (!canal || !estMembreCanal(canal, req.utilisateur.id)) {
    return res.status(404).json({ error: "Canal introuvable." });
  }
  req.utilisateur.lecturesChat = req.utilisateur.lecturesChat || {};
  req.utilisateur.lecturesChat[canal.id] = new Date().toISOString();
  await db.write();
  res.json({ ok: true });
});

// Groupe d'équipe : accessible à tout agent (pas seulement un "team leader"
// dédié — aucun rôle de ce type n'existe encore dans le modèle d'accès, voir
// auth.js) ; le créateur choisit librement ses membres.
app.post("/api/chat/groupes", exigerAuth, async (req, res) => {
  const nom = String(req.body.nom || "").trim();
  const membresChoisis = Array.isArray(req.body.membres) ? req.body.membres.filter(Boolean) : [];
  if (!nom) return res.status(400).json({ error: "Le nom du groupe est requis." });

  const membres = [...new Set([req.utilisateur.id, ...membresChoisis])];
  const canal = {
    id: nanoid(),
    type: "groupe",
    nom,
    membres,
    createurId: req.utilisateur.id,
    dateCreation: new Date().toISOString(),
  };
  db.data.canaux.push(canal);
  await db.write();
  res.status(201).json(enrichirCanal(canal, req.utilisateur));
});

// Conversation privée : trouve-ou-crée, id déterministe (paire triée) pour
// que deux agents qui s'écrivent pour la première fois retombent toujours
// sur le même canal sans avoir à le chercher au préalable.
app.post("/api/chat/prive", exigerAuth, async (req, res) => {
  const autre = req.body.utilisateurId ? trouverUtilisateurParId(req.body.utilisateurId) : null;
  if (!autre) return res.status(400).json({ error: "Destinataire introuvable." });
  if (autre.id === req.utilisateur.id) {
    return res.status(400).json({ error: "Impossible de démarrer une conversation avec soi-même." });
  }

  const idCanal = "prive:" + [req.utilisateur.id, autre.id].sort().join("_");
  let canal = db.data.canaux.find((c) => c.id === idCanal);
  if (!canal) {
    canal = {
      id: idCanal,
      type: "prive",
      nom: null,
      membres: [req.utilisateur.id, autre.id],
      createurId: req.utilisateur.id,
      dateCreation: new Date().toISOString(),
    };
    db.data.canaux.push(canal);
    await db.write();
  }
  res.json(enrichirCanal(canal, req.utilisateur));
});

// Annuaire minimal (prénom/nom/email), accessible à tout agent authentifié —
// contrairement à /api/utilisateurs (liste complète + statuts de compte,
// réservée aux admins) : sert juste à choisir un destinataire de message ou
// un membre de groupe.
app.get("/api/utilisateurs/collegues", exigerAuth, (req, res) => {
  const collegues = db.data.utilisateurs
    .filter((u) => u.statut === "valide" && u.id !== req.utilisateur.id)
    .map((u) => ({ id: u.id, prenom: u.prenom, nom: u.nom, email: u.email, role: u.role }));
  res.json(collegues);
});

// Centre de notifications : messages non lus (tous canaux dont je suis
// membre), nouveaux leads qui me sont assignés (voir assignationVue plus
// haut), et rendez-vous planifiés dans les prochaines 48h.
const FENETRE_RDV_HEURES = 48;

function calculerNotifications(utilisateur) {
  const mesCanaux = db.data.canaux.filter((c) => estMembreCanal(c, utilisateur.id));
  const messagesNonLus = mesCanaux.reduce((somme, c) => somme + compterNonLus(c, utilisateur), 0);

  const mesEntreprises =
    estAdmin(utilisateur)
      ? db.data.entreprises
      : db.data.entreprises.filter((e) => e.assigneA === utilisateur.id);

  const nouveauxLeads = mesEntreprises
    .filter((e) => e.assigneA === utilisateur.id && e.assignationVue === false)
    .map((e) => ({ id: e.id, nom: e.nom, dateAssignation: e.dateAssignation }));

  const maintenant = Date.now();
  const limite = maintenant + FENETRE_RDV_HEURES * 3600 * 1000;
  const rdvAVenir = mesEntreprises
    .filter((e) => e.dateRdv && new Date(e.dateRdv).getTime() >= maintenant && new Date(e.dateRdv).getTime() <= limite)
    .map((e) => ({ id: e.id, nom: e.nom, dateRdv: e.dateRdv }))
    .sort((a, b) => new Date(a.dateRdv) - new Date(b.dateRdv));

  // Alerte prioritaire : prospects "chauds" dont la Fiche de Suivi a été
  // soumise par un agent et qui attendent un appel de finalisation. Reste
  // visible tant que le statut n'a pas été changé (pas de flag "vu" séparé :
  // le dossier sort naturellement de cette liste dès qu'il est traité).
  // Pour un admin, mesEntreprises = tout le pipeline, donc cette liste couvre
  // les fiches soumises par n'importe quel agent, pas seulement les siennes.
  const fichesPotentielles = mesEntreprises
    .filter((e) => e.statut === "fiche")
    .map((e) => ({
      id: e.id,
      nom: e.nom,
      dateFiche: e.fichesProspection?.[0]?.dateCreation || null,
      soumisePar: e.fichesProspection?.[0]?.agentNom || null,
    }))
    .sort((a, b) => new Date(b.dateFiche || 0) - new Date(a.dateFiche || 0));

  // Suivi de présence (voir presence.js) : l'agent est prévenu s'il n'a
  // enregistré aucune activité le jour ouvré précédent ; le manager voit
  // la même alerte pour chaque agent de l'équipe concerné.
  const alertePresence = calculerKpiAgent(utilisateur).alerteAbsence;
  const alertesPresenceEquipe =
    estAdmin(utilisateur)
      ? alertesAbsenceEquipe(db.data.utilisateurs.filter((u) => u.statut === "valide" && u.id !== utilisateur.id))
      : [];

  // Demandes reçues du site public (rendez-vous, démo, contact, vigilance) :
  // les admins voient toutes les demandes non traitées, un agent seulement
  // celles des fiches qui lui sont assignées.
  const demandesSite = mesEntreprises
    .filter((e) => e.demandeSiteNonVue)
    .map((e) => ({ id: e.id, nom: e.nom, type: e.demandesSite?.[0]?.libelle || "Demande site web", date: e.demandesSite?.[0]?.date || null }))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return { messagesNonLus, nouveauxLeads, rdvAVenir, fichesPotentielles, alertePresence, alertesPresenceEquipe, demandesSite };
}

// Rappels et rendez-vous à venir (ou manqués) de l'utilisateur, pour l'alerte
// sonore à l'heure prévue (voir client/src/components/RappelsEcheances.jsx) :
// ses propres fiches, plus les fiches non assignées pour un admin (celui qui
// les traite lui-même). Seules comptent les échéances encore d'actualité :
// statut toujours "RDV" / "À rappeler" / "Me rappelle" — dès que l'agent
// enregistre l'issue de l'appel, l'échéance disparaît. Les dates sont
// renvoyées telles que saisies ("AAAA-MM-JJTHH:MM", heure locale de l'agent) :
// c'est le navigateur qui calcule l'instant exact ; la fenêtre large ci-dessous
// absorbe le décalage horaire du serveur (UTC).
app.get("/api/echeances", exigerAuth, (req, res) => {
  const utilisateur = req.utilisateur;
  const maintenant = Date.now();
  const debut = maintenant - 14 * 3600 * 1000;
  const fin = maintenant + 26 * 3600 * 1000;
  const echeances = [];
  for (const e of db.data.entreprises) {
    // Client Potentiel (CP) : rappel transmis au superviseur — prévient aussi
    // les administrateurs, même si la fiche est assignée à un agent.
    const concernee =
      e.assigneA === utilisateur.id || (estAdmin(utilisateur) && (!e.assigneA || e.statut === "fiche"));
    if (!concernee) continue;
    // "Me rappelle" (et Mail + "doit aussi me rappeler") n'a pas de date :
    // l'entreprise rappelle quand elle veut, donc pas d'alerte — une date
    // restée d'un ancien "À rappeler" ne doit pas faire sonner l'alarme.
    const date = e.statut === "rdv" ? e.dateRdv : e.statut === "a_rappeler" || e.statut === "fiche" ? e.dateRappel : null;
    const instant = date ? new Date(date).getTime() : NaN;
    if (!Number.isFinite(instant) || instant < debut || instant > fin) continue;
    echeances.push({
      id: e.id,
      nom: e.nom,
      type: e.statut,
      date,
      telephone: e.contact?.telephone || null,
      contactNom: e.contact?.nom && e.contact.nom !== "-" ? e.contact.nom : null,
      contactFonction: e.contact?.fonction && e.contact.fonction !== "-" ? e.contact.fonction : null,
    });
  }
  echeances.sort((a, b) => new Date(a.date) - new Date(b.date));
  res.json(echeances);
});

// `commeAgentId` (admin uniquement) : calcule les notifications d'un AUTRE
// agent pour le Mode Manager — uniquement des compteurs/listes de leads et
// RDV, jamais le contenu d'un message privé (voir plus haut).
app.get("/api/notifications", exigerAuth, (req, res) => {
  let cible = req.utilisateur;
  if (estAdmin(req.utilisateur) && req.query.commeAgentId) {
    const agent = trouverUtilisateurParId(req.query.commeAgentId);
    if (!agent) return res.status(404).json({ error: "Agent introuvable." });
    cible = agent;
  }

  // Demandes d'accès en attente (voir POST /api/auth/demander-lien et la
  // page "Créer un compte" de Connexion.jsx) : toujours basées sur le rôle
  // RÉEL du compte connecté, pas sur `cible` — un admin en Mode Manager (qui
  // consulte le tableau de bord "comme" un agent) doit continuer à voir ces
  // demandes, une préoccupation d'administration indépendante de l'agent
  // consulté.
  const demandesAcces =
    estAdmin(req.utilisateur)
      ? db.data.utilisateurs
          .filter((u) => u.statut === "en_attente")
          .map((u) => ({ id: u.id, email: u.email, prenom: u.prenom, nom: u.nom, dateCreation: u.dateCreation }))
          .sort((a, b) => new Date(a.dateCreation) - new Date(b.dateCreation))
      : [];

  res.json({ ...calculerNotifications(cible), demandesAcces });
});

// Suivi du temps de travail (voir presence.js et client/src/PresenceContext.jsx).
// Le battement est toujours crédité au compte réellement connecté — y
// compris un admin en Mode Manager : c'est lui qui travaille, pas l'agent
// qu'il consulte.
app.post("/api/presence/battement", exigerAuth, (req, res) => {
  const jour = enregistrerBattement(req.utilisateur.id);
  res.json({ jour: jour.jour, secondesActives: jour.secondesActives });
});

function lireDecalageSemaines(req) {
  const n = Number.parseInt(req.query.semaine, 10);
  return Number.isFinite(n) && n >= 0 && n <= 52 ? n : 0;
}

// `commeAgentId` (admin uniquement) : KPIs d'un agent en Mode Manager.
app.get("/api/presence/moi", exigerAuth, (req, res) => {
  let cible = req.utilisateur;
  if (estAdmin(req.utilisateur) && req.query.commeAgentId) {
    const agent = trouverUtilisateurParId(req.query.commeAgentId);
    if (!agent) return res.status(404).json({ error: "Agent introuvable." });
    cible = agent;
  }
  res.json({
    utilisateur: { id: cible.id, prenom: cible.prenom, nom: cible.nom, role: cible.role },
    ...ajouterAppelsAuxKpi(calculerKpiAgent(cible, { decalageSemaines: lireDecalageSemaines(req) }), cible.id),
  });
});

app.get("/api/presence/equipe", exigerAdmin, (req, res) => {
  const utilisateurs = db.data.utilisateurs.filter((u) => u.statut === "valide");
  const equipe = calculerKpiEquipe(utilisateurs, { decalageSemaines: lireDecalageSemaines(req) });
  // Appels de chaque membre (voir appelsAgents.js).
  equipe.membres = equipe.membres.map((m) => ajouterAppelsAuxKpi(m, m.utilisateur.id));
  res.json(equipe);
});

// Relève périodique de la boîte mail du pôle (aucun effet si MAIL_* non
// configuré dans server/.env — voir mail.js). Chaque mail reçu est rattaché
// à l'entreprise dont l'adresse de contact correspond à l'expéditeur ; les
// autres sont journalisés côté serveur mais ignorés (pas de boîte "non
// triée" pour cette première version).
// Une relève lente (boîte OVH qui répond mal) ne doit jamais en chevaucher
// une autre : sinon les connexions IMAP s'empilent toutes les 60 s jusqu'à
// saturer la mémoire du conteneur Render.
let releveEnCours = false;

async function relevePeriodiqueBoiteMail() {
  if (releveEnCours) return;
  releveEnCours = true;
  try {
    await relaverBoiteMail(async (mail) => {
      const entreprise = trouverEntrepriseParEmail(mail.de);
      if (!entreprise) {
        console.log(`Mail reçu de ${mail.de} — aucune entreprise correspondante dans le CRM, ignoré.`);
        return;
      }
      entreprise.emails = entreprise.emails || [];
      entreprise.emails.unshift({
        id: nanoid(),
        direction: "recu",
        de: mail.de,
        objet: mail.objet,
        corps: mail.texte,
        date: mail.date,
        lu: false,
        messageId: mail.messageId,
      });
      await db.write();
    });
  } catch (e) {
    console.error("Erreur lors de la relève de la boîte mail :", e.message);
  } finally {
    releveEnCours = false;
  }
}

// Filet de sécurité : une promesse rejetée sans catch quelque part (tâche de
// fond, enrichissement IA, relève...) est journalisée au lieu de faire
// tomber tout le serveur — un bug ponctuel dans une tâche annexe ne doit pas
// rendre le CRM et la vitrine injoignables (502 Render).
process.on("unhandledRejection", (raison) => {
  console.error("[process] Promesse rejetée non gérée :", raison?.stack || raison);
});

// Envoi et réception (IMAP) sont vérifiés et activés indépendamment — voir
// mail.js pour le détail des noms de variables acceptés. L'envoi via l'API
// Resend est prioritaire sur le SMTP direct : Render (et la plupart des PaaS)
// bloque le trafic SMTP sortant au niveau réseau, quel que soit le plan.
if (estResendConfigure()) {
  console.log(`[mail] Envoi via l'API Resend activé pour ${adresseMailPole()}.`);
} else if (estSmtpConfigure()) {
  // Vérifie immédiatement l'authentification SMTP au démarrage — le moyen le
  // plus rapide de voir dans les logs Render si le mot de passe OVH est
  // accepté, sans attendre qu'un agent déclenche un envoi.
  verifierConnexionSMTP().then((resultat) => {
    if (resultat.ok) {
      console.log(`[mail] Connexion SMTP vérifiée avec succès pour ${adresseMailPole()}.`);
    } else {
      console.error(
        `[mail] ÉCHEC de connexion SMTP pour ${adresseMailPole()} : ${resultat.raison}` +
          `${resultat.code ? ` [code: ${resultat.code}]` : ""}`
      );
      console.error(
        "[mail] Si l'erreur est un ETIMEDOUT/ECONNREFUSED : l'hébergeur bloque le port SMTP en sortie " +
          "(cas fréquent sur Render, même en payant) — configurez RESEND_API_KEY pour envoyer via API HTTP à la place."
      );
    }
  });
} else {
  console.log(
    "[mail] Envoi non configuré (renseignez RESEND_API_KEY, ou à défaut MAIL_SMTP_HOST/MAIL_HOST + MAIL_USER + MAIL_PASSWORD) — lien magique et mails agents désactivés."
  );
}

if (estImapConfigure()) {
  relevePeriodiqueBoiteMail();
  setInterval(relevePeriodiqueBoiteMail, 60_000);
  console.log("[mail] Boîte de réception connectée : relève automatique toutes les 60 secondes.");
} else {
  console.log("[mail] Réception non configurée (MAIL_IMAP_HOST absent) — pas de relève automatique du courrier entrant.");
}

// Sert le frontend React buildé et gère le routage côté client (React
// Router) : toute route qui n'est pas une route API renvoie index.html,
// pour que /entreprise/:id fonctionne aussi en accès direct ou au rechargement.
// Balises SEO par page, robots.txt, sitemap.xml et cache : voir seo.js.
if (fs.existsSync(distClient)) {
  servirFrontend(app, distClient);
} else {
  console.warn(
    `Build client introuvable (${distClient}) — le frontend n'est pas servi. ` +
      "Lancez `npm run build` à la racine du projet avant `npm start` en production."
  );
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API CRM OETH/AGEFIPH démarrée sur http://localhost:${PORT}`);
});
