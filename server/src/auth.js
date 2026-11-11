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
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import db from "./db.js";
import { envoyerMail, estEnvoiConfigure, adresseNePasRepondre } from "./mail.js";
import {
  genererEmailCreationCompteHtml,
  genererEmailLienConnexionHtml,
  genererEmailConfirmationAccesHtml,
  marqueCompte,
} from "./emailOfficiel.js";

// Espace du compte, pour l'habillage des mails (voir marqueCompte /
// genererEmail*Html dans emailOfficiel.js) — simple objet { id }, sans
// dépendre de espaces.js (qui importe déjà ce fichier pour estAdmin, un
// import circulaire dans l'autre sens serait fragile). Un compte à plusieurs
// espaces (agent interne) retombe sur l'habillage par défaut (OETH).
function espaceDuCompte(utilisateur) {
  return Array.isArray(utilisateur.espaces) && utilisateur.espaces.length === 1 ? { id: utilisateur.espaces[0] } : null;
}

const TOURS_BCRYPT = 10;
const LONGUEUR_MIN_MOT_DE_PASSE = 8;

// Sans caractères ambigus à l'oral/à l'écran (pas de 0/O, 1/l/I) — ce mot de
// passe provisoire peut être lu ou dicté au téléphone à un agent.
const ALPHABET_MOT_DE_PASSE_PROVISOIRE = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

function genererMotDePasseProvisoire(longueur = 12) {
  const octets = crypto.randomBytes(longueur);
  return Array.from(octets, (v) => ALPHABET_MOT_DE_PASSE_PROVISOIRE[v % ALPHABET_MOT_DE_PASSE_PROVISOIRE.length]).join("");
}

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

export async function trouverOuCreerUtilisateur(email, { prenom = "", nom = "", espaceSouhaite = "" } = {}) {
  const propre = normaliserEmail(email);
  const estAdminForce = emailsAdminForces().includes(propre);
  const existant = trouverUtilisateurParEmail(propre);

  if (existant) {
    // Un super-administrateur listé dans ADMIN_EMAILS garde son rôle : la
    // liste garantit un accès admin minimum, elle ne rétrograde jamais.
    if (estAdminForce && (!estAdmin(existant) || existant.statut !== "valide")) {
      existant.role = estAdmin(existant) ? existant.role : "admin";
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
    // Espace demandé via une porte d'entrée dédiée (/oeth, /cee — voir
    // Connexion.jsx) : pré-sélectionné pour ce nouveau compte, pour qu'un
    // agent recruté via la porte CEE n'atterrisse pas par défaut sur OETH une
    // fois validé par l'admin. Déjà validé contre la liste des espaces
    // réels par l'appelant (voir POST /api/auth/demander-lien, index.js) ;
    // sans effet sur un admin, qui a de toute façon accès à tout.
    ...(!admin && espaceSouhaite ? { espaces: [espaceSouhaite] } : {}),
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
// Le formulaire "Gestion des accès" n'a plus qu'un seul champ nom (voir
// AdminUtilisateurs.jsx) : il est envoyé dans `prenom`, seul champ utilisé
// comme nom d'affichage partout ailleurs dans le code (`u.prenom || u.email`)
// — `nom` reste accepté pour les autres appelants mais n'est plus requis.
export async function creerUtilisateurParAdmin(
  email,
  {
    prenom = "",
    nom = "",
    role = "agent",
    appUrl,
    motDePasse,
    telephone = "",
    siret = "",
    entrepriseLieeId = null,
    equipeId = null,
    // Espace de travail du nouveau compte (voir espaces.js, résolu par
    // l'appelant qui a accès à listeEspaces() — objet { id, nom, court,
    // couleur } ou null) : fixe à la fois les accès du compte (espacesAutorises,
    // voir espaces.js) et l'habillage du mail d'invitation ci-dessous. Sans
    // quoi un nouveau compte reste sans espace explicite et retombe sur OETH
    // par défaut (espacesAutorises), ce qui serait faux pour un client CEE.
    espace = null,
  } = {}
) {
  const propre = normaliserEmail(email);
  if (!propre || !propre.includes("@")) {
    const erreur = new Error("Adresse mail invalide.");
    erreur.code = "EMAIL_INVALIDE";
    throw erreur;
  }
  if (!prenom.trim() && !nom.trim()) {
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

  // Mot de passe provisoire : celui saisi par l'admin, sinon un généré
  // automatiquement — dans les deux cas le compte doit le changer à sa
  // première connexion (doitChangerMotDePasse, voir changerMotDePasseObligatoire
  // ci-dessous et RequireAuth.jsx côté client), donc il est sans risque de
  // l'inclure en clair dans le mail d'invitation ci-dessous : il ne sert
  // qu'une fois.
  const motDePasseClair = motDePasse || genererMotDePasseProvisoire();
  if (motDePasseClair.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    const erreur = new Error(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
    erreur.code = "MOT_DE_PASSE_TROP_COURT";
    throw erreur;
  }
  const motDePasseHash = await bcrypt.hash(motDePasseClair, TOURS_BCRYPT);

  const utilisateur = {
    id: nanoid(),
    email: propre,
    prenom: prenom.trim(),
    nom: nom.trim(),
    telephone: telephone.trim() || null,
    siret: siret.trim() || null,
    entrepriseLieeId: entrepriseLieeId || null,
    role: ["admin", "super_admin", "superviseur", "manager"].includes(role) ? role : "agent",
    equipeId: equipeId || null,
    ...(espace?.id ? { espaces: [espace.id] } : {}),
    statut: "valide",
    motDePasseHash,
    doitChangerMotDePasse: true,
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
    const marque = marqueCompte(espace);
    try {
      await envoyerMail({
        to: utilisateur.email,
        subject: `Votre accès au CRM ${marque} est prêt`,
        text:
          `Bonjour ${utilisateur.prenom},\n\nUn accès au CRM vient d'être créé pour vous.\n\n` +
          `Pour vous connecter, rendez-vous sur ${appUrl} et indiquez cette adresse mail : ` +
          `vous recevrez un lien de connexion valable ${DUREE_LIEN_MINUTES} minutes. Vous pouvez aussi vous connecter ` +
          `directement avec le mot de passe provisoire suivant : ${motDePasseClair}\n\n` +
          `À la première connexion, il vous sera demandé de choisir votre propre mot de passe.\n\n` +
          `Ceci est un message automatique, merci de ne pas y répondre directement.\n\n${marque}`,
        html: genererEmailCreationCompteHtml({
          utilisateur,
          appUrl,
          motDePasseProvisoire: motDePasseClair,
          dureeLienMinutes: DUREE_LIEN_MINUTES,
          espace,
        }),
        fromName: marque,
        replyTo: adresseNePasRepondre(),
      });
      mailEnvoye = true;
    } catch (e) {
      console.error(`[auth] Compte ${propre} créé mais échec d'envoi du mail d'invitation : ${e.message}`);
    }
  }

  return { utilisateur, mailEnvoye, motDePasseProvisoire: motDePasseClair };
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

// Remplace le mot de passe provisoire par celui que l'utilisateur choisit
// lui-même, à sa première connexion (doitChangerMotDePasse, voir
// creerUtilisateurParAdmin ci-dessus et le composant client
// ChangerMotDePasseOblige.jsx qui bloque le reste du CRM tant que ce n'est
// pas fait). Contrairement à definirMotDePasse (réservé aux admins), c'est
// l'utilisateur connecté lui-même qui appelle ceci sur son propre compte.
export async function changerMotDePasseObligatoire(utilisateurId, motDePasse) {
  const utilisateur = trouverUtilisateurParId(utilisateurId);
  if (!utilisateur) {
    const erreur = new Error("Utilisateur introuvable.");
    erreur.code = "UTILISATEUR_INTROUVABLE";
    throw erreur;
  }
  if (!motDePasse || motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    const erreur = new Error(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
    erreur.code = "MOT_DE_PASSE_TROP_COURT";
    throw erreur;
  }
  utilisateur.motDePasseHash = await bcrypt.hash(motDePasse, TOURS_BCRYPT);
  utilisateur.doitChangerMotDePasse = false;
  await db.write();
  console.log(`[auth] Mot de passe provisoire remplacé par ${utilisateur.email}.`);
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
  const espace = espaceDuCompte(utilisateur);
  const marque = marqueCompte(espace);
  console.log(`[auth] Envoi du lien de connexion à ${utilisateur.email}…`);
  try {
    await envoyerMail({
      to: utilisateur.email,
      subject: "Votre lien de connexion",
      text: `Bonjour,\n\nCliquez sur ce lien pour vous connecter (valable ${DUREE_LIEN_MINUTES} minutes) :\n\n${lien}\n\nSi vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.\n\nCeci est un message automatique, merci de ne pas y répondre directement.\n\n${marque}`,
      html: genererEmailLienConnexionHtml({ lien, dureeLienMinutes: DUREE_LIEN_MINUTES, espace }),
      fromName: marque,
      replyTo: adresseNePasRepondre(),
    });
    console.log(`[auth] Lien de connexion envoyé avec succès à ${utilisateur.email}.`);
  } catch (e) {
    console.error(`[auth] ÉCHEC d'envoi du lien de connexion à ${utilisateur.email} : ${e.message}`);
    throw e;
  }
}

// Boîte mail personnelle d'un compte (ex: un manager qui reprend un dossier
// en direct, voir le champ `depuis` de /api/entreprises/:id/emails/envoyer
// dans index.js) — indépendante de la boîte de son équipe (equipes.js) :
// l'agent qui envoie choisit laquelle utiliser. `mail` reste `null` tant que
// rien n'est configuré. Mêmes champs qu'une boîte d'équipe (smtpHost/
// smtpPort, imapHost/imapPort, user, password, from, replyTo) — jamais le
// mot de passe en clair après enregistrement (voir sansMotDePasse dans
// index.js, même logique que equipeSansSecrets dans equipes.js).
export function mailPersonnel(utilisateur) {
  return utilisateur?.mail || undefined;
}

// Vrai seulement si le compte a sa PROPRE boîte IMAP distincte (hôte ou
// identifiant renseigné) — comme equipeABoitePropre dans equipes.js, sert à
// savoir si cette boîte doit être relevée séparément (voir
// relevePeriodiqueBoiteMail dans index.js).
export function utilisateurABoitePropre(utilisateur) {
  return Boolean(utilisateur?.mail?.imapHost || utilisateur?.mail?.user);
}

// Même logique de fusion que PUT /api/equipes/:id/mail (equipes.js) : un
// champ non renvoyé (ou vide) garde sa valeur précédente — le mot de passe
// n'étant jamais renvoyé par l'API, le formulaire d'administration ne peut
// de toute façon pas le réafficher pour le renvoyer tel quel à chaque
// enregistrement.
export async function definirMailPersonnel(utilisateurId, m) {
  const utilisateur = trouverUtilisateurParId(utilisateurId);
  if (!utilisateur) {
    const erreur = new Error("Utilisateur introuvable.");
    erreur.code = "UTILISATEUR_INTROUVABLE";
    throw erreur;
  }
  if (!m) {
    utilisateur.mail = null;
  } else {
    const avant = utilisateur.mail || {};
    utilisateur.mail = {
      smtpHost: String(m.smtpHost || "").trim() || avant.smtpHost || null,
      smtpPort: Number(m.smtpPort) || avant.smtpPort || null,
      imapHost: String(m.imapHost || "").trim() || avant.imapHost || null,
      imapPort: Number(m.imapPort) || avant.imapPort || null,
      user: String(m.user || "").trim() || avant.user || null,
      password: String(m.password || "").trim() || avant.password || null,
      from: String(m.from || "").trim() || avant.from || null,
      replyTo: String(m.replyTo || "").trim() || avant.replyTo || null,
    };
  }
  await db.write();
  return utilisateur;
}

// Confirmation envoyée quand l'admin valide une demande d'accès en attente
// (voir POST /api/utilisateurs/:id/valider) — distincte du lien magique :
// il n'y a pas encore de jeton à ce stade, juste l'info que l'accès est
// désormais ouvert et où aller le demander. Best-effort côté appelant (la
// validation du compte doit réussir même si ce mail échoue).
export async function envoyerConfirmationAcces(utilisateur, appUrl) {
  const espace = espaceDuCompte(utilisateur);
  const marque = marqueCompte(espace);
  console.log(`[auth] Envoi de la confirmation d'accès à ${utilisateur.email}…`);
  await envoyerMail({
    to: utilisateur.email,
    subject: "Votre accès au CRM a été validé",
    text:
      `Bonjour${utilisateur.prenom ? ` ${utilisateur.prenom}` : ""},\n\n` +
      `Votre demande d'accès au CRM vient d'être validée par l'administrateur.\n\n` +
      `Pour vous connecter, rendez-vous sur ${appUrl} et indiquez cette adresse mail : ` +
      `vous recevrez un lien de connexion valable ${DUREE_LIEN_MINUTES} minutes.\n\n` +
      `Ceci est un message automatique, merci de ne pas y répondre directement.\n\n${marque}`,
    html: genererEmailConfirmationAccesHtml({ utilisateur, appUrl, dureeLienMinutes: DUREE_LIEN_MINUTES, espace }),
    fromName: marque,
    replyTo: adresseNePasRepondre(),
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

// Le rôle "super_admin" hérite de tout ce que peut faire un "admin" (voir
// exigerAdmin ci-dessous) et débloque en plus l'édition des contenus
// partagés (argumentaire AGEFIPH, script de vente, modèles de mails — voir
// exigerSuperAdmin et les routes PUT correspondantes dans index.js) :
// contenu vu par TOUS les agents, une erreur de frappe ou une suppression
// malheureuse impacterait tout le monde, d'où un troisième palier plutôt que
// d'ouvrir ça à n'importe quel admin.
export function estAdmin(utilisateur) {
  return utilisateur?.role === "admin" || utilisateur?.role === "super_admin";
}

export function exigerAdmin(req, res, next) {
  exigerAuth(req, res, () => {
    if (!estAdmin(req.utilisateur)) {
      return res.status(403).json({ error: "Réservé aux administrateurs." });
    }
    next();
  });
}

export function exigerSuperAdmin(req, res, next) {
  exigerAuth(req, res, () => {
    if (req.utilisateur.role !== "super_admin") {
      return res.status(403).json({ error: "Réservé aux super-administrateurs." });
    }
    next();
  });
}
