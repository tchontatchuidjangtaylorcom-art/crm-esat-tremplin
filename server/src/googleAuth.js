// Connexion "Se connecter avec Google" — optionnelle. Utilise le flux de
// vérification de jeton d'identité côté client (Google Identity Services) :
// seul un Client ID (public) est nécessaire côté serveur pour vérifier le
// jeton, pas de Client Secret. Le bouton reste masqué côté frontend et cette
// route refuse proprement tant que GOOGLE_CLIENT_ID n'est pas configuré.
import { OAuth2Client } from "google-auth-library";

function clientId() {
  return process.env.GOOGLE_CLIENT_ID || null;
}

let client = null;
function getClient() {
  if (!client && clientId()) client = new OAuth2Client(clientId());
  return client;
}

export function googleConfigure() {
  return Boolean(clientId());
}

export async function verifierIdTokenGoogle(idToken) {
  const c = getClient();
  if (!c) {
    const erreur = new Error("Connexion Google non configurée (GOOGLE_CLIENT_ID absent de server/.env).");
    erreur.code = "GOOGLE_NON_CONFIGURE";
    throw erreur;
  }
  const ticket = await c.verifyIdToken({ idToken, audience: clientId() });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new Error("Jeton Google invalide.");
  return {
    email: payload.email,
    prenom: payload.given_name || "",
    nom: payload.family_name || "",
  };
}
