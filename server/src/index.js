import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import db, { initDb, CANAL_GENERAL_ID } from "./db.js";
import { calculerObligationOeth } from "./oeth.js";
import { classifierSecteur, listerCategories, determinerCollecteur, CATEGORIES } from "./secteurs.js";
import { estSirenValide, rechercherEntrepriseParSiren, rechercherEntreprisesParSecteur } from "./insee.js";
import { getArgumentaireAgefiph, trouverLigneBareme } from "./argumentaire.js";
import { getScriptVente } from "./scriptVente.js";
import { getModelesMails } from "./modelesMails.js";
import {
  estSmtpConfigure,
  estBrevoConfigure,
  estEnvoiConfigure,
  estImapConfigure,
  relaverBoiteMail,
  envoyerMail,
  signatureMail,
  adresseMailPole,
  adressePostalePole,
  telephonePole,
  verifierConnexionSMTP,
} from "./mail.js";
import { genererSynthesePdf } from "./pdfSynthese.js";
import { genererRapportPdf } from "./pdfRapport.js";
import {
  estRechercheIaConfiguree,
  rechercherContactAlternatif,
  listerModelesDisponibles,
  detailErreur as detailErreurIa,
} from "./rechercheContact.js";
import {
  trouverOuCreerUtilisateur,
  trouverUtilisateurParId,
  creerUtilisateurParAdmin,
  definirMotDePasse,
  verifierMotDePasse,
  envoyerLienMagique,
  verifierLienMagique,
  creerCookieSession,
  optionsCookie,
  NOM_COOKIE,
  exigerAuth,
  exigerAdmin,
} from "./auth.js";
import { googleConfigure, verifierIdTokenGoogle } from "./googleAuth.js";

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
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

await initDb();

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
  fiche: "Fiche Potentielle",
  fiche_one_shot: "Fiche one-shot → atelier",
  conforme: "Conforme — dossier réglé",
  refus: "Refus (dossier clos)",
  mort: "Mort (dossier clos)",
};

// Sorties qui font quitter le pipeline actif : le dossier est archivé
// automatiquement (voir `archiver()`) — que ce soit un succès (déjà en
// conformité, plus rien à prospecter), un refus explicite du prospect, ou
// une entreprise injoignable/radiée. On distingue volontairement "conforme"
// de "mort"/"refus" pour ne pas mélanger un dossier réglé avec un échec de
// prospection dans les statistiques.
const SORTIES_ARCHIVANTES = new Set(["conforme", "refus", "mort"]);

// Cherche dans les dossiers actifs puis dans les archives, pour que les
// fiches archivées (dossiers "mort") restent consultables via les mêmes
// routes GET/PATCH sans dupliquer d'endpoints.
function findEntreprise(id) {
  return db.data.entreprises.find((e) => e.id === id) || db.data.archives.find((e) => e.id === id);
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
  return utilisateur.role === "admin" || entreprise.assigneA === utilisateur.id;
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

  const utilisateur = await trouverOuCreerUtilisateur(email);

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

// Création directe d'un accès agent par l'admin (voir creerUtilisateurParAdmin
// dans auth.js) : contrairement à /valider ci-dessous qui traite une demande
// déjà déposée par l'agent, ici il n'y a pas encore de demande — l'admin
// crée le compte à l'avance, déjà validé, à partir du seul email. Un mot de
// passe optionnel peut être défini dès la création (motDePasse) — sinon le
// compte reste accessible uniquement par lien magique, comme avant.
app.post("/api/utilisateurs", exigerAdmin, async (req, res) => {
  try {
    const { utilisateur, mailEnvoye } = await creerUtilisateurParAdmin(req.body.email, {
      prenom: String(req.body.prenom || "").trim(),
      nom: String(req.body.nom || "").trim(),
      role: req.body.role === "admin" ? "admin" : "agent",
      appUrl: APP_URL,
      motDePasse: req.body.motDePasse ? String(req.body.motDePasse) : null,
    });
    res.status(201).json({ utilisateur: sansMotDePasse(utilisateur), mailEnvoye });
  } catch (e) {
    const statutHttp =
      e.code === "EMAIL_INVALIDE" || e.code === "MOT_DE_PASSE_TROP_COURT" ? 400 : e.code === "COMPTE_EXISTANT" ? 409 : 500;
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

app.post("/api/utilisateurs/:id/valider", exigerAdmin, async (req, res) => {
  const utilisateur = trouverUtilisateurParId(req.params.id);
  if (!utilisateur) return res.status(404).json({ error: "Utilisateur introuvable." });
  utilisateur.statut = "valide";
  utilisateur.role = req.body.role === "admin" ? "admin" : "agent";
  utilisateur.dateValidation = new Date().toISOString();
  await db.write();
  res.json(sansMotDePasse(utilisateur));
});

app.post("/api/utilisateurs/:id/refuser", exigerAdmin, async (req, res) => {
  const utilisateur = trouverUtilisateurParId(req.params.id);
  if (!utilisateur) return res.status(404).json({ error: "Utilisateur introuvable." });
  utilisateur.statut = "refuse";
  await db.write();
  res.json(sansMotDePasse(utilisateur));
});

// ---- Routes ----

app.get("/api/categories", (req, res) => {
  res.json(listerCategories());
});

// Indique si la recherche IA (Gemini) est configurée, pour afficher/masquer
// côté frontend l'option d'enrichissement automatique du téléphone à
// l'import par secteur (voir plus bas) et l'espace IA de la fiche entreprise.
app.get("/api/ia/statut", (req, res) => {
  res.json({ configuree: estRechercheIaConfiguree() });
});

// Aide-mémoire agent (affiche officielle du pôle AGEFIPH) : argumentaire,
// dates clés et barème des unités bénéficiaires — contenu statique partagé
// par le tiroir d'aide et la fiche entreprise.
app.get("/api/argumentaire-agefiph", (req, res) => {
  res.json(getArgumentaireAgefiph());
});

// Script de vente et modèles de mails : mêmes principes que l'argumentaire
// AGEFIPH ci-dessus — contenu statique, source unique côté serveur.
app.get("/api/script-vente", (req, res) => {
  res.json(getScriptVente());
});

app.get("/api/modeles-mails", (req, res) => {
  res.json(getModelesMails());
});

// Résout le filtre d'agent effectif pour une requête : normalement
// l'utilisateur connecté (estVisiblePar), sauf si un admin consulte le
// pipeline "comme si" il était un agent donné (Mode Manager — voir
// commeAgentId, réservé à req.utilisateur.role === "admin" pour qu'un agent
// ne puisse jamais usurper la vue d'un autre en devinant l'ID).
function resoudreCibleSupervision(req) {
  if (req.utilisateur.role !== "admin" || !req.query.commeAgentId) return null;
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
  if (!estSirenValide(siren)) {
    const erreur = new Error("SIREN invalide (9 chiffres attendus, clé de contrôle incorrecte).");
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
    const siren = String(brut || "").replace(/\s/g, "");
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

// Enrichissement automatique du téléphone via Gemini (recherche web), pour
// les fiches fraîchement créées par un import par secteur : l'API Sirene ne
// fournit aucun contact, ce qui laisse jusqu'ici les fiches inexploitables au
// Power Dialer tant qu'un agent ne les complète pas à la main. Lancé APRÈS
// l'envoi de la réponse HTTP (voir /api/leads/secteur/importer), sans
// attendre sa fin : un lot de 100 SIREN à raison de plusieurs secondes par
// appel Gemini dépasserait largement les délais des proxys si on bloquait la
// requête d'import dessus. Meilleur effort volontairement silencieux côté
// résultat d'import : une fiche non enrichie (échec IA, rien trouvé) reste
// simplement à compléter manuellement comme avant cette fonctionnalité — pas
// d'écriture de numéro halluciné, rechercherContactAlternatif renvoie déjà
// null plutôt qu'inventer une valeur.
//
// Espacement des appels : le plan gratuit Gemini limite le débit à quelques
// requêtes/minute (bien en dessous de l'API Sirene) — 300ms suffisait pour
// enchaîner les appels mais faisait cogner le quota dès la dizaine de fiches
// suivante, chaque appel échouant alors en 429 (voir le retry/backoff dédié
// dans rechercheContact.js, qui absorbe les 429 isolés ; ce délai réduit
// simplement la fréquence à laquelle on les déclenche).
const DELAI_ENTRE_APPELS_IA_MS = Number(process.env.GEMINI_ENRICHISSEMENT_DELAI_MS) || 4000;
// Au-delà de ce nombre d'échecs consécutifs, on arrête le lot plutôt que de
// continuer à égrener silencieusement des échecs : ça sent l'erreur de
// configuration (clé/modèle Gemini invalide, quota journalier épuisé) plutôt
// qu'un raté ponctuel sur une fiche — mieux vaut le signaler clairement que
// de laisser tourner un lot de 100 fiches pour zéro résultat.
const ECHECS_CONSECUTIFS_MAX = 5;

async function enrichirTelephonesViaIA(entreprises, { onProgres } = {}) {
  let echecsConsecutifs = 0;
  let interrompu = null;
  for (const entreprise of entreprises) {
    let trouve = false;
    let erreurMessage = null;
    try {
      const resultat = await rechercherContactAlternatif(entreprise);
      if (resultat.telephone) {
        entreprise.contact.telephone = resultat.telephone;
        entreprise.commentaires.unshift({
          id: nanoid(),
          date: new Date().toISOString(),
          auteur: "Assistant IA",
          texte:
            `Numéro de téléphone trouvé automatiquement via recherche IA (confiance ${resultat.confiance}` +
            `${resultat.source ? `, source : ${resultat.source}` : ""})` +
            `${resultat.contact ? ` — contact suggéré : ${resultat.contact}` : ""}. À vérifier au premier appel.`,
        });
        await db.write();
        trouve = true;
      }
      echecsConsecutifs = 0;
    } catch (e) {
      erreurMessage = e.message;
      echecsConsecutifs += 1;
      console.error(
        `[ia] Échec de recherche automatique de téléphone pour ${entreprise.nom} :`,
        JSON.stringify(detailErreurIa(e))
      );
    }
    onProgres?.({ trouve, erreur: erreurMessage });

    if (echecsConsecutifs >= ECHECS_CONSECUTIFS_MAX) {
      interrompu = `Interrompu après ${echecsConsecutifs} échecs consécutifs (dernière erreur : ${erreurMessage}) — vérifiez la configuration Gemini (GEMINI_API_KEY / GEMINI_MODEL) ou le quota.`;
      console.error(`[ia] Enrichissement en lot interrompu : ${interrompu}`);
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, DELAI_ENTRE_APPELS_IA_MS));
  }
  return { interrompu };
}

// État du dernier/actuel enrichissement téléphone en lot déclenché depuis le
// bouton admin (voir /api/leads/enrichir-telephones ci-dessous) — mémoire
// process uniquement, pas persisté en base : sert seulement à bloquer un
// double lancement concurrent et à exposer une progression au frontend
// (polling de /statut), pas à survivre à un redémarrage du serveur.
let etatEnrichissementLot = {
  enCours: false,
  total: 0,
  traites: 0,
  trouves: 0,
  erreurs: 0,
  derniereErreur: null,
  interrompu: null,
  demarre: null,
  termine: null,
};

// Enrichit en lot les fiches déjà présentes dans le CRM (actives, hors
// archives) qui n'ont toujours aucun numéro de téléphone — typiquement des
// leads importés par secteur avant l'ajout de la recherche automatique à
// l'import (voir /api/leads/secteur/importer), ou dont la recherche
// automatique n'a rien trouvé à l'époque. Action admin explicite (bouton
// dédié côté frontend) plutôt qu'automatique : elle peut déclencher des
// dizaines/centaines d'appels Gemini sur tout le pipeline existant, à ne pas
// lancer sans le vouloir. Tourne en arrière-plan comme l'enrichissement à
// l'import (même raison : trop long pour bloquer une requête HTTP).
app.post("/api/leads/enrichir-telephones", exigerAdmin, async (req, res) => {
  if (!estRechercheIaConfiguree()) {
    return res.status(503).json({ error: "Recherche IA non configurée (renseignez GEMINI_API_KEY)." });
  }
  if (etatEnrichissementLot.enCours) {
    return res.status(409).json({ error: "Un enrichissement est déjà en cours.", ...etatEnrichissementLot });
  }

  const cibles = db.data.entreprises.filter((e) => !e.contact?.telephone);
  if (cibles.length === 0) {
    return res.json({ total: 0, enCours: false, message: "Aucune fiche sans téléphone à enrichir." });
  }

  etatEnrichissementLot = {
    enCours: true,
    total: cibles.length,
    traites: 0,
    trouves: 0,
    erreurs: 0,
    derniereErreur: null,
    interrompu: null,
    demarre: new Date().toISOString(),
    termine: null,
  };
  res.status(202).json(etatEnrichissementLot);

  enrichirTelephonesViaIA(cibles, {
    onProgres: ({ trouve, erreur }) => {
      etatEnrichissementLot.traites += 1;
      if (trouve) etatEnrichissementLot.trouves += 1;
      if (erreur) {
        etatEnrichissementLot.erreurs += 1;
        etatEnrichissementLot.derniereErreur = erreur;
      }
    },
  })
    .then((resultat) => {
      if (resultat?.interrompu) etatEnrichissementLot.interrompu = resultat.interrompu;
    })
    .catch((e) => console.error("[ia] Échec de l'enrichissement en lot :", e.message))
    .finally(() => {
      etatEnrichissementLot.enCours = false;
      etatEnrichissementLot.termine = new Date().toISOString();
    });
});

// Suivi de progression de l'enrichissement en lot ci-dessus — le frontend
// interroge cette route toutes les quelques secondes pendant qu'un
// enrichissement tourne, pour afficher une barre de progression.
app.get("/api/leads/enrichir-telephones/statut", exigerAdmin, (req, res) => {
  res.json(etatEnrichissementLot);
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

  const departement = req.body.departement ? String(req.body.departement).trim() : null;
  const limite = Math.min(Number(req.body.limite) || 100, 300);

  try {
    const candidats = await rechercherEntreprisesParSecteur(
      { nafCodes: categorie.nafCodes, estAdministration: categorie.estAdministration },
      { departement, limite }
    );
    const connus = new Set([...db.data.entreprises, ...db.data.archives].map((e) => e.siren));
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
    const siren = String(brut || "").replace(/\s/g, "");
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
  if (enrichissementTelephoneIA) {
    enrichirTelephonesViaIA(creeesPourIa).catch((e) =>
      console.error("[ia] Échec de l'enrichissement téléphone en lot :", e.message)
    );
  }
});

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
  ];
  for (const champ of champsAutorises) {
    if (champ in req.body) entreprise[champ] = req.body[champ];
  }

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
    entreprise.assignationVue = false;
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
      e.assignationVue = false;
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

  // Purge automatique du pipeline actif : un dossier "mort" est déplacé vers
  // les archives plutôt que laissé dans la liste active des entreprises.
  const archive = SORTIES_ARCHIVANTES.has(sortie);
  if (archive) archiver(entreprise);

  await db.write();
  res.json({ archive, entreprise: enrichir(entreprise) });
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
      `Fiche Potentielle soumise par ${fiche.agentNom}` +
      (fiche.numeroDossier ? ` (dossier n°${fiche.numeroDossier})` : "") +
      ` — ${fiche.nombreTravailleursHandicapes} travailleur(s) handicapé(s), ${fiche.montantTaxesAnnonce} € annoncés.` +
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
// configurée, l'assistant ne devine pas un numéro : il flague le contact et
// journalise l'anomalie, pendant que le frontend propose des pistes de
// recherche externes prêtes à cliquer.
app.post("/api/entreprises/:id/telephone-invalide", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

  const ancienNumero = entreprise.contact?.telephone || "(aucun)";
  entreprise.contact = { ...entreprise.contact, telephoneInvalide: true };
  entreprise.commentaires.unshift({
    id: nanoid(),
    date: new Date().toISOString(),
    auteur: "Assistant IA",
    texte: `Numéro signalé non attribué/invalide (${ancienNumero}). Recherche d'un contact alternatif recommandée — voir les pistes proposées dans la fiche.`,
  });

  await db.write();
  res.json(enrichir(entreprise));
});

// Recherche IA (Gemini + recherche Google) d'un numéro/contact alternatif ET
// d'une catégorie de secteur suggérée, quand le numéro enregistré a été
// signalé invalide. Optionnelle (GEMINI_API_KEY/GOOGLE_API_KEY) et protégée
// par une session valide même si les autres routes /api/entreprises ne le
// sont pas ici : chaque appel déclenche un appel (potentiellement facturé) à
// l'API Gemini, à ne pas laisser accessible sans authentification.
// Renvoie une PROPOSITION seulement — voir rechercheContact.js : rien n'est
// écrit en base ici, l'agent doit valider via le formulaire existant
// (numéro : POST .../telephone-invalide puis PATCH ; catégorie : PATCH
// categorieForcee) avant que ça n'affecte la fiche.
app.post("/api/entreprises/:id/rechercher-contact", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

  if (!estRechercheIaConfiguree()) {
    return res.status(503).json({ error: "Recherche IA non configurée (renseignez GEMINI_API_KEY)." });
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
    res.status(statutHttp).json({ error: e.message });
  }
});

// Diagnostic admin : la liste des modèles Gemini réellement disponibles pour
// GEMINI_API_KEY et supportant generateContent. À utiliser quand
// GEMINI_MODEL tombe en erreur "not found"/"not supported" (Google retire
// des modèles sans préavis pour ce projet — déjà arrivé deux fois) : plutôt
// que deviner un nouveau nom, on demande directement à l'API la valeur
// exacte à mettre dans GEMINI_MODEL sur Render.
app.get("/api/ia/modeles-disponibles", exigerAdmin, async (req, res) => {
  try {
    const modeles = await listerModelesDisponibles();
    res.json({ modeles });
  } catch (e) {
    const statutHttp = e.code === "IA_NON_CONFIGUREE" ? 503 : 502;
    res.status(statutHttp).json({ error: e.message });
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
      poleInfo: { email: adresseMailPole(), telephone: telephonePole(), adressePostale: adressePostalePole() },
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
    adressePostale: adressePostalePole(),
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

  const { objet, corps, joindrePdf = true } = req.body;
  if (!objet?.trim() || !corps?.trim()) {
    return res.status(400).json({ error: "Objet et corps du mail requis." });
  }
  if (!entreprise.contact?.email) {
    return res.status(400).json({ error: "Aucune adresse mail connue pour ce contact." });
  }

  // Nom d'expéditeur : coordonnées uniques du pôle (adresse d'envoi
  // contact@oeth-fiph.fr, inchangée), mais nom affiché personnalisé avec
  // l'agent connecté + le collecteur réel de l'entreprise (privé → AGEFIPH,
  // public → FIPHFP) — l'agent est identifiable sans multiplier les boîtes mail.
  const agentNom = req.utilisateur.prenom || req.utilisateur.nom || req.utilisateur.email;
  const libellePole = determinerCollecteur(entreprise) === "FIPHFP" ? "Pôle FIPHFP" : "Pôle OETH / AGEFIPH";
  const nomExpediteur = `${agentNom} — ${libellePole}`;

  // PDF de synthèse OETH personnalisé, joint automatiquement (voir
  // pdfSynthese.js) — désactivable ponctuellement par l'agent (ex: mail de
  // confirmation de RDV où la synthèse chiffrée n'a pas sa place).
  let piecesJointes = [];
  let attachmentsBrevo;
  if (joindrePdf) {
    const pdf = await genererSynthesePdf({
      entreprise,
      oeth: calculerObligationOeth(entreprise),
      agentNom,
      poleInfo: { email: adresseMailPole(), telephone: telephonePole(), adressePostale: adressePostalePole() },
    });
    const nomFichier = `synthese-oeth-${(entreprise.nom || "entreprise").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
    attachmentsBrevo = [{ filename: nomFichier, content: pdf, contentType: "application/pdf" }];
    piecesJointes = [{ nom: nomFichier, taille: pdf.length }];
  }

  try {
    await envoyerMail({
      to: entreprise.contact.email,
      subject: objet,
      text: corps,
      fromName: nomExpediteur,
      attachments: attachmentsBrevo,
      // Mail de prospection vers une entreprise externe (pas un mail
      // transactionnel de compte) : ajoute l'en-tête List-Unsubscribe
      // attendu par Gmail/Yahoo pour ce type d'envoi (voir mail.js).
      listeDiffusion: true,
    });
  } catch (e) {
    const statutHttp = e.code === "MAIL_NON_CONFIGURE" ? 503 : 502;
    return res.status(statutHttp).json({ error: e.message });
  }

  entreprise.emails = entreprise.emails || [];
  entreprise.emails.unshift({
    id: nanoid(),
    direction: "envoye",
    de: adresseMailPole(),
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
    utilisateur.role === "admin"
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

  return { messagesNonLus, nouveauxLeads, rdvAVenir, fichesPotentielles };
}

// `commeAgentId` (admin uniquement) : calcule les notifications d'un AUTRE
// agent pour le Mode Manager — uniquement des compteurs/listes de leads et
// RDV, jamais le contenu d'un message privé (voir plus haut).
app.get("/api/notifications", exigerAuth, (req, res) => {
  let cible = req.utilisateur;
  if (req.utilisateur.role === "admin" && req.query.commeAgentId) {
    const agent = trouverUtilisateurParId(req.query.commeAgentId);
    if (!agent) return res.status(404).json({ error: "Agent introuvable." });
    cible = agent;
  }
  res.json(calculerNotifications(cible));
});

// Relève périodique de la boîte mail du pôle (aucun effet si MAIL_* non
// configuré dans server/.env — voir mail.js). Chaque mail reçu est rattaché
// à l'entreprise dont l'adresse de contact correspond à l'expéditeur ; les
// autres sont journalisés côté serveur mais ignorés (pas de boîte "non
// triée" pour cette première version).
async function relevePeriodiqueBoiteMail() {
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
  }
}

// Envoi et réception (IMAP) sont vérifiés et activés indépendamment — voir
// mail.js pour le détail des noms de variables acceptés. L'envoi via l'API
// Brevo est prioritaire sur le SMTP direct : Render (et la plupart des PaaS)
// bloque le trafic SMTP sortant au niveau réseau, quel que soit le plan.
if (estBrevoConfigure()) {
  console.log(`[mail] Envoi via l'API Brevo activé pour ${adresseMailPole()}.`);
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
          "(cas fréquent sur Render, même en payant) — configurez BREVO_API_KEY pour envoyer via API HTTP à la place."
      );
    }
  });
} else {
  console.log(
    "[mail] Envoi non configuré (renseignez BREVO_API_KEY, ou à défaut MAIL_SMTP_HOST/MAIL_HOST + MAIL_USER + MAIL_PASSWORD) — lien magique et mails agents désactivés."
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
if (fs.existsSync(distClient)) {
  app.use(express.static(distClient));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(distClient, "index.html"));
  });
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
