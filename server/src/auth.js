// Authentification principalement sans mot de passe (lien magique par mail +
// Google en option), avec validation des comptes par un administrateur. Un
// mot de passe reste possible par compte, à la discrétion de l'admin (voir
// definirMotDePasse ci-dessous) : utile pour les comptes qui ne veulent/
// peuvent pas dépendre d'un mail à chaque connexion. Les deux méthodes
// coexistent par compte — définir un mot de passe n'invalide jamais le lien
// magique.
//
// Deux façons de devenir admin :
//  1. ADMIN_EMAILS (server/.env) : liste blanche explicite et déterministe —
//     ces adresses sont TOUJOURS admin+validées, y compris si le compte
//     existait déjà en "en_attente" (auto-guérison : plus besoin de manip en
//     base si l'adresse était restée bloquée avant que la variable ne soit
//     configurée).
//  2. À défaut, le tout premier compte jamais créé devient automatiquement
//     administrateur (bootstrap) — sinon personne ne pourrait jamais valider
//     le premier administrateur.
// Tous les autres comptes restent "en_attente" jusqu'à validation manuelle.
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import db from "./db.js";
import { envoyerMail, estEnvoiConfigure } from "./mail.js";

const TOURS_BCRYPT = 10;
const LONGUEUR_MIN_MOT_DE_PASSE = 8;

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-non-securise-a-changer-en-production";
const DUREE_LIEN_MINUTES = 15;
const DUREE_SESSION_JOURS = 30;
export const NOM_COOKIE = "crm_session";

function normaliserEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function emailsAdminForces() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => normaliserEmail(e))
    .filter(Boolean);
}

export function trouverUtilisateurParEmail(email) {
  const cherche = normaliserEmail(email);
  return db.data.utilisateurs.find((u) => u.email === cherche) || null;
}

export function trouverUtilisateurParId(id) {
  return db.data.utilisateurs.find((u) => u.id === id) || null;
}

export async function trouverOuCreerUtilisateur(email, { prenom = "", nom = "" } = {}) {
  const propre = normaliserEmail(email);
  const estAdminForce = emailsAdminForces().includes(propre);
  const existant = trouverUtilisateurParEmail(propre);

  if (existant) {
    if (estAdminForce && (existant.role !== "admin" || existant.statut !== "valide")) {
      existant.role = "admin";
      existant.statut = "valide";
      existant.dateValidation = existant.dateValidation || new Date().toISOString();
      await db.write();
      console.log(`[auth] ${propre} promu administrateur (listé dans ADMIN_EMAILS).`);
    }
    return existant;
  }

  const premierCompte = db.data.utilisateurs.length === 0;
  const admin = estAdminForce || premierCompte;
  const utilisateur = {
    id: nanoid(),
    email: propre,
    prenom,
    nom,
    role: admin ? "admin" : "agent",
    statut: admin ? "valide" : "en_attente",
    dateCreation: new Date().toISOString(),
    dateValidation: admin ? new Date().toISOString() : null,
  };
  db.data.utilisateurs.push(utilisateur);
  await db.write();
  console.log(`[auth] Nouveau compte ${propre} (${utilisateur.role}, ${utilisateur.statut}).`);
  return utilisateur;
}

// Création directe d'un compte agent par un administrateur (interface
// "Gestion des accès" — voir AdminUtilisateurs.jsx) : contrairement à
// trouverOuCreerUtilisateur ci-dessus (déclenché par l'agent lui-même via
// "demander un lien", et qui crée un compte "en_attente" à valider), ici
// c'est l'admin qui anticipe l'accès — le compte est donc créé directement
// "valide", l'agent n'a plus qu'à se connecter avec cette adresse.
// `telephone`/`siret` sont de simples métadonnées optionnelles (le SIRET,
// s'il correspond à une entreprise déjà suivie dans le CRM, est résolu côté
// index.js en `entrepriseLieeId` avant d'arriver ici — cette fonction se
// contente de les persister telles quelles, sans logique de recherche).
export async function creerUtilisateurParAdmin(
  email,
  { prenom = "", nom = "", role = "agent", appUrl, motDePasse, telephone = "", siret = "", entrepriseLieeId = null } = {}
) {
  const propre = normaliserEmail(email);
  if (!propre || !propre.includes("@")) {
    const erreur = new Error("Adresse mail invalide.");
    erreur.code = "EMAIL_INVALIDE";
    throw erreur;
  }
  if (!prenom.trim()) {
    const erreur = new Error("Le prénom est requis.");
    erreur.code = "PRENOM_REQUIS";
    throw erreur;
  }
  if (!nom.trim()) {
    const erreur = new Error("Le nom est requis.");
    erreur.code = "NOM_REQUIS";
    throw erreur;
  }

  const existant = trouverUtilisateurParEmail(propre);
  if (existant) {
    const erreur = new Error(`Un compte existe déjà pour ${propre} (statut : ${existant.statut}).`);
    erreur.code = "COMPTE_EXISTANT";
    throw erreur;
  }

  // Optionnel : mot de passe défini dès la création, en plus du lien
  // magique (voir definirMotDePasse — même validation de longueur).
  let motDePasseHash = null;
  if (motDePasse) {
    if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
      const erreur = new Error(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
      erreur.code = "MOT_DE_PASSE_TROP_COURT";
      throw erreur;
    }
    motDePasseHash = await bcrypt.hash(motDePasse, TOURS_BCRYPT);
  }

  const utilisateur = {
    id: nanoid(),
    email: propre,
    prenom: prenom.trim(),
    nom: nom.trim(),
    telephone: telephone.trim() || null,
    siret: siret.trim() || null,
    entrepriseLieeId: entrepriseLieeId || null,
    role: role === "admin" ? "admin" : "agent",
    statut: "valide",
    motDePasseHash,
    dateCreation: new Date().toISOString(),
    dateValidation: new Date().toISOString(),
  };
  db.data.utilisateurs.push(utilisateur);
  await db.write();
  console.log(`[auth] Compte ${propre} créé directement par un administrateur (${utilisateur.role}, validé).`);

  // Best-effort : l'agent peut aussi être prévenu autrement (oral, Slack…) —
  // un échec d'envoi ne doit pas faire échouer la création du compte, qui a
  // déjà réussi côté base au moment où on tente ce mail.
  let mailEnvoye = false;
  if (appUrl && estEnvoiConfigure()) {
    try {
      // Le mot de passe éventuel n'est jamais inclus dans ce mail (canal non
      // sécurisé) : s'il en a été défini un, c'est à l'administrateur de le
      // communiquer à l'agent par un moyen séparé (oral, message chiffré...).
      await envoyerMail({
        to: utilisateur.email,
        subject: "Votre accès au CRM OETH/AGEFIPH est prêt",
        text:
          `Bonjour ${utilisateur.prenom},\n\nUn accès au CRM OETH/AGEFIPH vient d'être créé pour vous.\n\n` +
          `Pour vous connecter, rendez-vous sur ${appUrl} et indiquez cette adresse mail : ` +
          `vous recevrez un lien de connexion valable ${DUREE_LIEN_MINUTES} minutes.` +
          (motDePasseHash
            ? " Si un mot de passe vous a été communiqué par ailleurs, vous pouvez aussi l'utiliser directement."
            : "") +
          `\n\nPôle OETH / AGEFIPH`,
        fromName: "Pôle OETH / AGEFIPH",
      });
      mailEnvoye = true;
    } catch (e) {
      console.error(`[auth] Compte ${propre} créé mais échec d'envoi du mail d'invitation : ${e.message}`);
    }
  }

  return { utilisateur, mailEnvoye };
}

// Définit, change ou retire (motDePasse vide/null) le mot de passe d'un
// compte existant — utilisé par l'interface admin "Gestion des accès" aussi
// bien à la création qu'après coup. Ne touche à rien d'autre (rôle, statut) :
// le mot de passe est une méthode de connexion additionnelle, pas une
// validation de compte.
export async function definirMotDePasse(utilisateurId, motDePasse) {
  const utilisateur = trouverUtilisateurParId(utilisateurId);
  if (!utilisateur) {
    const erreur = new Error("Utilisateur introuvable.");
    erreur.code = "UTILISATEUR_INTROUVABLE";
    throw erreur;
  }

  if (!motDePasse) {
    utilisateur.motDePasseHash = null;
    await db.write();
    console.log(`[auth] Mot de passe retiré pour ${utilisateur.email} (connexion par lien magique uniquement).`);
    return utilisateur;
  }

  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    const erreur = new Error(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
    erreur.code = "MOT_DE_PASSE_TROP_COURT";
    throw erreur;
  }

  utilisateur.motDePasseHash = await bcrypt.hash(motDePasse, TOURS_BCRYPT);
  await db.write();
  console.log(`[auth] Mot de passe défini pour ${utilisateur.email}.`);
  return utilisateur;
}

// Connexion par e-mail + mot de passe — alternative au lien magique pour les
// comptes qui en ont un (voir definirMotDePasse). Message d'erreur volontai-
// rement générique entre "email inconnu" et "mot de passe incorrect" (évite
// de confirmer l'existence d'un compte à qui tenterait plusieurs adresses),
// mais distingue le cas "compte sans mot de passe défini" pour rediriger
// l'utilisateur vers le lien magique plutôt que le laisser deviner.
export async function verifierMotDePasse(email, motDePasse) {
  const utilisateur = trouverUtilisateurParEmail(email);
  if (!utilisateur || !utilisateur.motDePasseHash) {
    if (utilisateur && !utilisateur.motDePasseHash) {
      const erreur = new Error("Aucun mot de passe défini pour ce compte — utilisez le lien de connexion par mail.");
      erreur.code = "MOT_DE_PASSE_NON_DEFINI";
      throw erreur;
    }
    const erreur = new Error("Adresse mail ou mot de passe incorrect.");
    erreur.code = "IDENTIFIANTS_INVALIDES";
    throw erreur;
  }

  const valide = await bcrypt.compare(motDePasse || "", utilisateur.motDePasseHash);
  if (!valide) {
    const erreur = new Error("Adresse mail ou mot de passe incorrect.");
    erreur.code = "IDENTIFIANTS_INVALIDES";
    throw erreur;
  }

  if (utilisateur.statut !== "valide") {
    const erreur = new Error("Compte introuvable ou non validé.");
    erreur.code = "COMPTE_NON_VALIDE";
    throw erreur;
  }

  return utilisateur;
}

function genererLienMagique(utilisateur, appUrl) {
  const token = jwt.sign({ uid: utilisateur.id, type: "lien_magique" }, SESSION_SECRET, {
    expiresIn: `${DUREE_LIEN_MINUTES}m`,
  });
  return `${appUrl}/api/auth/verifier?token=${token}`;
}

function genererSessionJWT(utilisateur) {
  return jwt.sign(
    { uid: utilisateur.id, type: "session" },
    SESSION_SECRET,
    { expiresIn: `${DUREE_SESSION_JOURS}d` }
  );
}

// Cookie marqué "secure" dès que l'URL publique du CRM est en HTTPS (Render
// en production) — plus fiable que NODE_ENV, que Render ne définit pas
// systématiquement à "production".
export function optionsCookie() {
  const https = (process.env.APP_URL || "").startsWith("https://");
  return {
    httpOnly: true,
    secure: https,
    sameSite: "lax",
    maxAge: DUREE_SESSION_JOURS * 24 * 60 * 60 * 1000,
  };
}

// Envoie le mail contenant le lien de connexion (via la boîte du pôle déjà
// configurée dans mail.js — mêmes identifiants OVH que le reste du CRM).
export async function envoyerLienMagique(utilisateur, appUrl) {
  const lien = genererLienMagique(utilisateur, appUrl);
  console.log(`[auth] Envoi du lien de connexion à ${utilisateur.email}…`);
  try {
    await envoyerMail({
      to: utilisateur.email,
      subject: "Votre lien de connexion — CRM OETH/AGEFIPH",
      text: `Bonjour,\n\nCliquez sur ce lien pour vous connecter (valable ${DUREE_LIEN_MINUTES} minutes) :\n\n${lien}\n\nSi vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.\n\nPôle OETH / AGEFIPH`,
      fromName: "Pôle OETH / AGEFIPH",
    });
    console.log(`[auth] Lien de connexion envoyé avec succès à ${utilisateur.email}.`);
  } catch (e) {
    console.error(`[auth] ÉCHEC d'envoi du lien de connexion à ${utilisateur.email} : ${e.message}`);
    throw e;
  }
}

// Confirmation envoyée quand l'admin valide une demande d'accès en attente
// (voir POST /api/utilisateurs/:id/valider) — distincte du lien magique :
// il n'y a pas encore de jeton à ce stade, juste l'info que l'accès est
// désormais ouvert et où aller le demander. Best-effort côté appelant (la
// validation du compte doit réussir même si ce mail échoue).
export async function envoyerConfirmationAcces(utilisateur, appUrl) {
  console.log(`[auth] Envoi de la confirmation d'accès à ${utilisateur.email}…`);
  await envoyerMail({
    to: utilisateur.email,
    subject: "Votre accès au CRM OETH/AGEFIPH a été validé",
    text:
      `Bonjour${utilisateur.prenom ? ` ${utilisateur.prenom}` : ""},\n\n` +
      `Votre demande d'accès au CRM OETH/AGEFIPH vient d'être validée par l'administrateur.\n\n` +
      `Pour vous connecter, rendez-vous sur ${appUrl} et indiquez cette adresse mail : ` +
      `vous recevrez un lien de connexion valable ${DUREE_LIEN_MINUTES} minutes.\n\nPôle OETH / AGEFIPH`,
    fromName: "Pôle OETH / AGEFIPH",
  });
  console.log(`[auth] Confirmation d'accès envoyée avec succès à ${utilisateur.email}.`);
}

// Vérifie un jeton de lien magique et retourne l'utilisateur correspondant
// (ou lève une erreur si le jeton est invalide/expiré/le compte non validé).
export function verifierLienMagique(token) {
  const payload = jwt.verify(token, SESSION_SECRET);
  if (payload.type !== "lien_magique") throw new Error("Type de jeton invalide.");
  const utilisateur = trouverUtilisateurParId(payload.uid);
  if (!utilisateur || utilisateur.statut !== "valide") throw new Error("Compte introuvable ou non validé.");
  return utilisateur;
}

export function creerCookieSession(res, utilisateur) {
  res.cookie(NOM_COOKIE, genererSessionJWT(utilisateur), optionsCookie());
}

// Middleware : exige une session valide, attache req.utilisateur.
export function exigerAuth(req, res, next) {
  const token = req.cookies?.[NOM_COOKIE];
  if (!token) return res.status(401).json({ error: "Non authentifié." });
  try {
    const payload = jwt.verify(token, SESSION_SECRET);
    const utilisateur = trouverUtilisateurParId(payload.uid);
    if (!utilisateur || utilisateur.statut !== "valide") {
      return res.status(401).json({ error: "Session invalide." });
    }
    req.utilisateur = utilisateur;
    next();
  } catch {
    return res.status(401).json({ error: "Session expirée ou invalide." });
  }
}

export function exigerAdmin(req, res, next) {
  exigerAuth(req, res, () => {
    if (req.utilisateur.role !== "admin") {
      return res.status(403).json({ error: "Réservé aux administrateurs." });
    }
    next();
  });
}
