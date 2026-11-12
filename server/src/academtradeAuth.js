// Comptes clients de l'espace AcademTrade (formation trading) — séparés de
// db.data.utilisateurs (réservé au personnel du CRM) : un client final ne
// doit jamais pouvoir se faire passer pour un agent, ni l'inverse. Même
// principe de mot de passe (bcrypt) que auth.js, mais cookie et jeton de
// session propres (NOM_COOKIE ci-dessous), pour qu'une session CRM et une
// session AcademTrade dans le même navigateur restent totalement étanches.
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import db from "./db.js";
import { envoyerMail, estEnvoiConfigure } from "./mail.js";
import { SITE_URL } from "./seo.js";

const TOURS_BCRYPT = 10;
const LONGUEUR_MIN_MOT_DE_PASSE = 8;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-non-securise-a-changer-en-production";
const DUREE_SESSION_JOURS = 30;
export const NOM_COOKIE = "academtrade_session";

// Solde pédagogique de départ (unités virtuelles, aucun argent réel) — voir
// academtradePositions.js.
export const SOLDE_DEPART_SIMULE = 10_000;

function normaliserEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function compteParEmail(email) {
  const propre = normaliserEmail(email);
  return db.data.comptesAcademtrade.find((c) => c.email === propre) || null;
}

export function compteParId(id) {
  return db.data.comptesAcademtrade.find((c) => c.id === id) || null;
}

export function compteParJeton(jeton) {
  const j = String(jeton || "");
  if (j.length < 16) return null;
  return db.data.comptesAcademtrade.find((c) => c.jetonAcces === j) || null;
}

export function sansMotDePasse(compte) {
  const { motDePasseHash, jetonAcces, ...reste } = compte;
  return reste;
}

// Créé après un paiement confirmé (voir academtradePaiements.js) — ou
// directement par un administrateur, en attendant le branchement de Stripe.
// Le compte n'a pas encore de mot de passe : le jeton d'accès sert une seule
// fois à le définir (lien envoyé par e-mail), comme les liens personnels déjà
// utilisés ailleurs dans le CRM (ficheClient.js, controleRdv.js).
export async function creerCompte({ email, prenom = "", nom = "", paiementId = null, gestionnaireId = null }) {
  const propre = normaliserEmail(email);
  if (!propre || !propre.includes("@")) {
    const erreur = new Error("Adresse mail invalide.");
    erreur.code = "EMAIL_INVALIDE";
    throw erreur;
  }
  if (compteParEmail(propre)) {
    const erreur = new Error(`Un compte existe déjà pour ${propre}.`);
    erreur.code = "COMPTE_EXISTANT";
    throw erreur;
  }
  const compte = {
    id: nanoid(),
    email: propre,
    prenom: prenom.trim(),
    nom: nom.trim(),
    motDePasseHash: null,
    jetonAcces: crypto.randomBytes(18).toString("base64url"),
    soldeSimule: SOLDE_DEPART_SIMULE,
    gestionnaireId: gestionnaireId || null,
    paiementId,
    dateCreation: new Date().toISOString(),
  };
  db.data.comptesAcademtrade.push(compte);
  await db.write();
  return compte;
}

export async function envoyerLienAcces(compte) {
  const lien = `${SITE_URL}/academtrade/definir-mot-de-passe/${compte.jetonAcces}`;
  if (!estEnvoiConfigure()) return false;
  try {
    await envoyerMail({
      to: compte.email,
      subject: "Votre accès à votre espace AcademTrade",
      text:
        `Bonjour${compte.prenom ? ` ${compte.prenom}` : ""},\n\nVotre paiement est confirmé, votre espace personnel AcademTrade est prêt.\n\n` +
        `Choisissez votre mot de passe pour y accéder :\n\n${lien}\n\n` +
        `Rappel : nous sommes dans la phase pédagogique de la formation — les positions et le solde affichés dans votre ` +
        `espace sont simulés, aucun argent réel n'est investi sur un marché à ce stade.\n\n` +
        `Ceci est un message automatique, merci de ne pas y répondre directement.\n\n— AcademTrade`,
      fromName: "AcademTrade",
    });
    return true;
  } catch (e) {
    console.error(`[academtrade] Envoi du lien d'accès impossible pour ${compte.email} :`, e.message);
    return false;
  }
}

export async function definirMotDePasse(jeton, motDePasse) {
  const compte = compteParJeton(jeton);
  if (!compte) {
    const erreur = new Error("Ce lien n'est plus valide.");
    erreur.code = "JETON_INVALIDE";
    throw erreur;
  }
  if (!motDePasse || motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    const erreur = new Error(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
    erreur.code = "MOT_DE_PASSE_TROP_COURT";
    throw erreur;
  }
  compte.motDePasseHash = await bcrypt.hash(motDePasse, TOURS_BCRYPT);
  await db.write();
  return compte;
}

// Changement de mot de passe par le client lui-même, une fois connecté —
// exige l'ancien mot de passe (contrairement à definirMotDePasse, réservé au
// tout premier réglage via le lien personnel).
export async function changerMotDePasse(compte, ancien, nouveau) {
  const valide = await bcrypt.compare(ancien || "", compte.motDePasseHash || "");
  if (!valide) {
    const erreur = new Error("Mot de passe actuel incorrect.");
    erreur.code = "MOT_DE_PASSE_INCORRECT";
    throw erreur;
  }
  if (!nouveau || nouveau.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    const erreur = new Error(`Le nouveau mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
    erreur.code = "MOT_DE_PASSE_TROP_COURT";
    throw erreur;
  }
  compte.motDePasseHash = await bcrypt.hash(nouveau, TOURS_BCRYPT);
  await db.write();
  return compte;
}

// Informations personnelles modifiables par le client lui-même — jamais
// l'e-mail (identifiant de connexion) ni le solde/les positions.
export async function mettreAJourProfil(compte, { prenom, nom, telephone, adresse }) {
  if (prenom !== undefined) compte.prenom = String(prenom || "").trim();
  if (nom !== undefined) compte.nom = String(nom || "").trim();
  if (telephone !== undefined) compte.telephone = String(telephone || "").trim() || null;
  if (adresse !== undefined) {
    const a = adresse || {};
    compte.adresse = {
      rue: String(a.rue || "").trim(),
      ville: String(a.ville || "").trim(),
      codePostal: String(a.codePostal || "").trim(),
      pays: String(a.pays || "").trim(),
    };
  }
  await db.write();
  return compte;
}

export async function verifierMotDePasse(email, motDePasse) {
  const compte = compteParEmail(email);
  if (!compte || !compte.motDePasseHash) {
    const erreur = new Error("Adresse mail ou mot de passe incorrect.");
    erreur.code = "IDENTIFIANTS_INVALIDES";
    throw erreur;
  }
  const valide = await bcrypt.compare(motDePasse || "", compte.motDePasseHash);
  if (!valide) {
    const erreur = new Error("Adresse mail ou mot de passe incorrect.");
    erreur.code = "IDENTIFIANTS_INVALIDES";
    throw erreur;
  }
  return compte;
}

function genererSessionJWT(compte) {
  return jwt.sign({ cid: compte.id, type: "academtrade_session" }, SESSION_SECRET, { expiresIn: `${DUREE_SESSION_JOURS}d` });
}

function optionsCookie() {
  const https = (process.env.APP_URL || SITE_URL || "").startsWith("https://");
  return { httpOnly: true, secure: https, sameSite: "lax", maxAge: DUREE_SESSION_JOURS * 24 * 60 * 60 * 1000 };
}

export function creerCookieSession(res, compte) {
  res.cookie(NOM_COOKIE, genererSessionJWT(compte), optionsCookie());
}

export function supprimerCookieSession(res) {
  res.clearCookie(NOM_COOKIE);
}

export function exigerAuthAcademtrade(req, res, next) {
  const token = req.cookies?.[NOM_COOKIE];
  if (!token) return res.status(401).json({ error: "Non authentifié." });
  try {
    const payload = jwt.verify(token, SESSION_SECRET);
    if (payload.type !== "academtrade_session") throw new Error("Type de jeton invalide.");
    const compte = compteParId(payload.cid);
    if (!compte) return res.status(401).json({ error: "Session invalide." });
    req.compteAcademtrade = compte;
    next();
  } catch {
    return res.status(401).json({ error: "Session expirée ou invalide." });
  }
}
