// Authentification sans mot de passe (lien magique par mail + Google en
// option) avec validation des comptes par un administrateur.
//
// Bootstrap : le tout premier compte jamais créé devient automatiquement
// administrateur validé — sinon personne ne pourrait jamais valider le
// premier administrateur. Tous les comptes suivants restent "en_attente"
// jusqu'à validation manuelle par un administrateur existant.
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

export function trouverUtilisateurParEmail(email) {
  const cherche = normaliserEmail(email);
  return db.data.utilisateurs.find((u) => u.email === cherche) || null;
}

export function trouverUtilisateurParId(id) {
  return db.data.utilisateurs.find((u) => u.id === id) || null;
}

export async function trouverOuCreerUtilisateur(email, { prenom = "", nom = "" } = {}) {
  const propre = normaliserEmail(email);
  const existant = trouverUtilisateurParEmail(propre);
  if (existant) return existant;

  const premierCompte = db.data.utilisateurs.length === 0;
  const utilisateur = {
    id: nanoid(),
    email: propre,
    prenom,
    nom,
    role: premierCompte ? "admin" : "agent",
    statut: premierCompte ? "valide" : "en_attente",
    dateCreation: new Date().toISOString(),
    dateValidation: premierCompte ? new Date().toISOString() : null,
  };
  db.data.utilisateurs.push(utilisateur);
  await db.write();
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

export function optionsCookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DUREE_SESSION_JOURS * 24 * 60 * 60 * 1000,
  };
}

// Envoie le mail contenant le lien de connexion (via la boîte du pôle déjà
// configurée dans mail.js — mêmes identifiants OVH que le reste du CRM).
export async function envoyerLienMagique(utilisateur, appUrl) {
  const lien = genererLienMagique(utilisateur, appUrl);
  await envoyerMail({
    to: utilisateur.email,
    subject: "Votre lien de connexion — CRM OETH/AGEFIPH",
    text: `Bonjour,\n\nCliquez sur ce lien pour vous connecter (valable ${DUREE_LIEN_MINUTES} minutes) :\n\n${lien}\n\nSi vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.\n\nPôle OETH / AGEFIPH`,
    fromName: "Pôle OETH / AGEFIPH",
  });
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
