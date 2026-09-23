// Authentification sans mot de passe (lien magique par mail + Google en
// option) avec validation des comptes par un administrateur.
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
import { nanoid } from "nanoid";
import db from "./db.js";
import { envoyerMail } from "./mail.js";

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
