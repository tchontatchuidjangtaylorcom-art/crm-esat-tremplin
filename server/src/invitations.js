// Liens d'invitation à un ou plusieurs espaces de travail (OETH/CEE… — voir
// espaces.js pour le modèle des espaces). Permet à un administrateur de
// générer un lien qui, une fois ouvert, attribue directement les espaces
// choisis à la personne qui le consomme — remplace le processus manuel en
// deux étapes (créer le compte dans "Gestion des accès", puis cocher les
// espaces séparément). Même convention de jeton que les autres liens à
// usage unique/scopé du projet (lien magique dans auth.js, fiche-client et
// rendez-vous vitrine dans ficheClient.js/vitrineRdv.js) :
// crypto.randomBytes(18) encodé en base64url.
//
// Choix v1 (documentés ici, car c'est le cœur de la décision produit de ce
// chantier — garder simple, on affinera si l'usage réel le demande) :
//  - RÉUTILISABLE, pas à usage unique : un même lien « Espace CEE » doit
//    pouvoir servir à inviter plusieurs nouveaux agents au fil du temps,
//    sans que l'admin régénère un lien par personne. C'est d'autant plus
//    pertinent que l'objectif à terme est qu'un espace se comporte comme un
//    produit CRM autonome ("un CRM CEE") distribué à toute une équipe — pas
//    un jeton à jeter après une seule invitation.
//  - EXPIRATION À 30 JOURS (même ordre de grandeur que la durée d'une
//    session, DUREE_SESSION_JOURS dans auth.js) : assez long pour qu'un lien
//    partagé à l'avance (ex. glissé dans un document d'onboarding) reste
//    valable, mais pas indéfiniment si le besoin change — un admin peut de
//    toute façon le désactiver avant terme (desactiverLienInvitation) ou en
//    générer un nouveau à tout moment.
//  - Si la personne qui ouvre le lien a DÉJÀ un compte : les espaces du lien
//    s'AJOUTENT à ceux qu'elle a déjà, jamais un retrait (voir la route
//    POST /api/invitations/:jeton/ajouter dans index.js) — un lien
//    d'invitation ne doit jamais pouvoir réduire un accès existant. Pour
//    éviter qu'un lien ne permette d'élargir le compte de quelqu'un d'autre
//    simplement en connaissant son adresse mail, cet ajout exige une session
//    déjà authentifiée (exigerAuth) ; un visiteur non connecté dont
//    l'adresse correspond à un compte existant est invité à se connecter
//    d'abord, puis à ouvrir à nouveau le même lien (réutilisable, voir
//    ci-dessus) pour recevoir l'accès.
import crypto from "crypto";
import { nanoid } from "nanoid";
import db from "./db.js";

export const DUREE_INVITATION_JOURS = 30;

function dansNJours(dateIso, jours) {
  return new Date(Date.parse(dateIso) + jours * 24 * 60 * 60 * 1000).toISOString();
}

export function listerLiensInvitation() {
  if (!Array.isArray(db.data.liensInvitation)) db.data.liensInvitation = [];
  return db.data.liensInvitation;
}

// `espaces` : identifiants déjà validés par l'appelant (voir listeEspaces()
// dans espaces.js, utilisé côté index.js — ce module reste volontairement
// indépendant d'espaces.js pour éviter un import circulaire avec auth.js).
export function creerLienInvitation(espaces, creeParId) {
  const maintenant = new Date().toISOString();
  const lien = {
    id: nanoid(),
    jeton: crypto.randomBytes(18).toString("base64url"),
    espaces: [...new Set(espaces)],
    creeParId: creeParId || null,
    dateCreation: maintenant,
    expiration: dansNJours(maintenant, DUREE_INVITATION_JOURS),
    actif: true,
    usages: 0,
    derniereUtilisation: null,
  };
  listerLiensInvitation().unshift(lien);
  return lien;
}

export function trouverLienParJeton(jeton) {
  const j = String(jeton || "");
  if (j.length < 16) return null;
  return listerLiensInvitation().find((l) => l.jeton === j) || null;
}

export function trouverLienParId(id) {
  return listerLiensInvitation().find((l) => l.id === id) || null;
}

export function lienValide(lien) {
  if (!lien || !lien.actif) return false;
  if (lien.expiration && Date.parse(lien.expiration) < Date.now()) return false;
  return true;
}

export function enregistrerUsageLien(lien) {
  lien.usages = (lien.usages || 0) + 1;
  lien.derniereUtilisation = new Date().toISOString();
}

export function desactiverLienInvitation(id) {
  const lien = trouverLienParId(id);
  if (!lien) return null;
  lien.actif = false;
  return lien;
}
