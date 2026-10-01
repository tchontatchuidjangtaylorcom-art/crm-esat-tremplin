// Recherche IA d'un contact/téléphone alternatif + suggestion de secteur, via
// l'API Anthropic (Claude) et son outil de recherche web — déclenchée depuis
// une fiche entreprise quand l'agent signale un numéro invalide/non attribué
// (voir EntrepriseDetail.jsx, section "Espace IA — Contact alternatif").
//
// Remplace l'intégration Gemini précédente : le plan gratuit Google limitait
// le débit à quelques requêtes/minute, ce qui faisait systématiquement
// échouer un enrichissement en lot après une dizaine de fiches (429 en
// boucle). L'API Anthropic est payante à l'usage mais sans ce plafond de
// débit aussi restrictif, et évite l'instabilité des noms de modèles Gemini
// (deux retraits de modèle déjà subis en production : gemini-1.5-flash puis
// gemini-2.5-flash).
//
// Fonctionnalité optionnelle : nécessite ANTHROPIC_API_KEY (générée sur
// https://console.anthropic.com). Sans base de téléphonie payante dédiée
// (Pappers Pro, Societe.com Pro...), la recherche web via un modèle reste la
// seule source disponible ici — le résultat est une PROPOSITION à valider
// par l'agent (pré-remplit les champs existants, jamais appliqué
// automatiquement) : un numéro ou une catégorie hallucinés seraient pires
// qu'une fiche laissée à corriger manuellement.
import { CATEGORIES, listerCategories } from "./secteurs.js";
import { baremeParUnite, SEUIL_ASSUJETTISSEMENT, TAUX_LEGAL, DUREE_NEUTRALISATION_ANNEES } from "./oeth.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const VERSION_API = "2023-06-01";

// Modèle configurable : "claude-sonnet-5" est le modèle Claude Sonnet actuel
// au moment de l'écriture — ajustez ANTHROPIC_MODEL (sans toucher au code)
// si Anthropic publie une version plus récente à privilégier.
const MODELE_PAR_DEFAUT = "claude-sonnet-5";
// Une recherche web + lecture de pages prend facilement 30 à 60 s : l'ancien
// délai de 20 s coupait une bonne partie des recherches avant la réponse.
const TIMEOUT_MS = Number(process.env.ANTHROPIC_TIMEOUT_MS) || 120000;

// Outils de recherche web côté serveur Anthropic. Les variantes 20260209
// (filtrage dynamique des résultats) n'existent que sur les modèles récents ;
// les autres gardent les variantes de base, sinon l'API répond 400.
function estModeleRecent(modele) {
  return /^claude-(opus-5|opus-4-[678]|sonnet-5|sonnet-4-6|fable-5)/.test(modele);
}

function outilsWeb(modele, { maxRecherches = 3, maxLectures = 2 } = {}) {
  const recent = estModeleRecent(modele);
  return [
    { type: recent ? "web_search_20260209" : "web_search_20250305", name: "web_search", max_uses: maxRecherches },
    { type: recent ? "web_fetch_20260209" : "web_fetch_20250910", name: "web_fetch", max_uses: maxLectures },
  ];
}

// Anthropic ne plafonne pas le débit aussi bas que le plan gratuit Gemini,
// mais applique tout de même des limites de requêtes/minute selon le palier
// de compte — retry/backoff dédié aux 429, en respectant le délai indiqué.
const TENTATIVES_MAX_429 = 3;
const ATTENTE_429_PLAFOND_MS = 65_000;

function cleApi() {
  return process.env.ANTHROPIC_API_KEY || "";
}

function attendre(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enTetes(cle) {
  return {
    "x-api-key": cle,
    "anthropic-version": VERSION_API,
    "content-type": "application/json",
  };
}

// Lit le délai d'attente conseillé par Anthropic sur un 429 : l'en-tête HTTP
// standard Retry-After (le seul renseigné par cette API pour le rate limit).
function delaiAttenteConseille(reponse) {
  const enTete = reponse?.headers?.get("retry-after");
  if (!enTete) return null;
  const secondes = Number(enTete);
  if (!Number.isNaN(secondes)) return secondes * 1000;
  const date = Date.parse(enTete);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

export function estRechercheIaConfiguree() {
  return Boolean(cleApi());
}

// Diagnostic : interroge Anthropic pour la vraie liste de modèles
// disponibles pour cette clé, au cas où ANTHROPIC_MODEL tomberait en erreur
// "not found" après un retrait de modèle — voir GET /api/ia/modeles-disponibles
// (admin) dans index.js.
export async function listerModelesDisponibles() {
  const cle = cleApi();
  if (!cle) {
    const erreur = new Error("Recherche IA non configurée (renseignez ANTHROPIC_API_KEY).");
    erreur.code = "IA_NON_CONFIGUREE";
    throw erreur;
  }
  const reponse = await fetch("https://api.anthropic.com/v1/models", {
    headers: enTetes(cle),
  });
  const corps = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const erreur = new Error(corps.error?.message || `L'API Anthropic a répondu ${reponse.status}.`);
    erreur.code = corps.error?.type || `HTTP_${reponse.status}`;
    signalerCreditsEpuises(erreur, corps);
    erreur.responseCode = reponse.status;
    throw erreur;
  }
  return (corps.data || []).map((m) => ({ id: m.id, displayName: m.display_name || null }));
}

// Erreurs passagères côté Anthropic (surcharge, indisponibilité, trop de
// requêtes simultanées) : on patiente et on réessaie avant d'abandonner —
// une seule réponse 503 ne doit pas faire échouer la recherche de l'agent.
const STATUTS_PASSAGERS = new Set([429, 500, 502, 503, 504, 529]);
const TENTATIVES_API = 3;

async function fetchAnthropic(url, options) {
  for (let tentative = 1; ; tentative++) {
    const reponse = await fetch(url, options);
    if (!STATUTS_PASSAGERS.has(reponse.status) || tentative >= TENTATIVES_API || options?.signal?.aborted) {
      return reponse;
    }
    const retryAfter = Number(reponse.headers.get("retry-after"));
    const attente = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 8000) : 2000 * tentative;
    console.warn(`[ia] Anthropic a répondu ${reponse.status} — nouvel essai dans ${attente} ms (${tentative}/${TENTATIVES_API - 1}).`);
    await new Promise((resolve) => setTimeout(resolve, attente));
  }
}

// Message lisible selon la cause réelle : une surcharge passagère
// d'Anthropic (503/529) n'est pas un problème de modèle ni de configuration.
function messageErreurApi(status, corps, modele) {
  const type = corps?.error?.type;
  if (status === 529 || status >= 500 || type === "overloaded_error" || type === "api_error") {
    return `Le service Claude (Anthropic) est momentanément surchargé ou indisponible (HTTP ${status}). Ce n'est pas un problème de configuration du CRM : réessayez dans quelques instants.`;
  }
  if (status === 429 || type === "rate_limit_error") {
    return "Trop de demandes envoyées à Claude en même temps (HTTP 429) : réessayez dans une minute.";
  }
  if (status === 401 || type === "authentication_error") {
    return "Clé API Anthropic refusée (HTTP 401) : vérifiez ANTHROPIC_API_KEY dans les variables Render.";
  }
  if (status === 403 || type === "permission_error") {
    return "Cette clé Anthropic n'a pas accès à ce service (HTTP 403) : vérifiez les droits de la clé.";
  }
  if (status === 404 || type === "not_found_error") {
    return `Modèle "${modele}" introuvable pour cette clé (HTTP 404) : vérifiez ANTHROPIC_MODEL dans les variables Render.`;
  }
  return corps?.error?.message || `L'API Anthropic a répondu ${status}.`;
}

export function detailErreur(e) {
  return {
    message: e.message,
    code: e.code,
    responseCode: e.responseCode,
    response: e.response,
  };
}

// Page de facturation de la console Anthropic : les fonctions IA du CRM
// consomment des crédits de l'API (ANTHROPIC_API_KEY), distincts de tout
// abonnement claude.ai. Le rechargement automatique s'y active aussi.
export const LIEN_RECHARGE_CREDITS_IA = "https://console.anthropic.com/settings/billing";

// Crédit épuisé : l'API répond 400 "Your credit balance is too low…" (ou
// une erreur de type billing_error). Message clair + lien de recharge, pour
// que l'admin sache quoi faire au lieu d'un message technique en anglais.
function signalerCreditsEpuises(erreur, corps) {
  const texte = `${corps?.error?.type || ""} ${corps?.error?.message || ""}`;
  if (corps?.error?.type === "billing_error" || /credit balance|purchase credits/i.test(texte)) {
    erreur.code = "CREDITS_IA_EPUISES";
    erreur.message =
      "Crédits de l'API Claude épuisés : les fonctions IA sont en pause jusqu'à la recharge du compte Anthropic.";
    erreur.lienRecharge = LIEN_RECHARGE_CREDITS_IA;
  }
  return erreur;
}

// L'outil de recherche web d'Anthropic ne voit PAS la page de résultats
// Google (ni son encart "fiche d'établissement") : l'ancien prompt lui
// demandait d'y lire le numéro, d'où beaucoup de "rien trouvé" alors qu'un
// agent le trouve en un clic. On lui demande désormais d'ouvrir (web_fetch)
// les pages qu'un agent consulterait — PagesJaunes, site officiel,
// Societe.com — et d'y lire les numéros, plus le contact RH si disponible.
function construirePrompt(entreprise) {
  const villeOuCp = [entreprise.codePostal, entreprise.ville].filter(Boolean).join(" ");
  const requeteAgent = [entreprise.nom, villeOuCp, "téléphone"].filter(Boolean).join(" ");
  const identite = [
    entreprise.nom,
    entreprise.adresse,
    villeOuCp,
    entreprise.siret ? `SIRET ${entreprise.siret}` : null,
    entreprise.secteurActivite ? `activité : ${entreprise.secteurActivite}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const listeCategories = listerCategories()
    .map((c) => `${c.value} = ${c.label}`)
    .join(" ; ");

  const numeroActuel = entreprise.contact?.telephone;

  return (
    `Un télé-prospecteur français doit appeler cette entreprise : ${identite}.\n` +
    (numeroActuel
      ? `Le numéro enregistré (${numeroActuel}) est invalide ou injoignable : trouves-en d'autres.\n`
      : `Aucun numéro n'est enregistré.\n`) +
    `\n` +
    `Objectif 1 — les numéros de téléphone de cet établissement (standard, accueil, agence locale, siège si c'est ` +
    `le même site). Un agent qui tape "${requeteAgent}" dans Google le trouve presque toujours dès les premiers ` +
    `résultats : PagesJaunes, site officiel (pages Contact, Mentions légales, Nos agences), Societe.com, annuaires ` +
    `professionnels. Cherche de la même façon, puis ouvre avec web_fetch les pages les plus prometteuses pour lire ` +
    `le numéro dans la page elle-même plutôt que de te fier à un extrait de résultat.\n` +
    `Objectif 2 — si possible, la personne à contacter pour le recrutement ou l'obligation d'emploi des travailleurs ` +
    `handicapés : DRH, responsable RH, chargé(e) de recrutement, référent handicap, ou à défaut le dirigeant. ` +
    `Uniquement un nom réel lu dans une source (site officiel, LinkedIn, presse, Societe.com pour le dirigeant). ` +
    `Ajoute son e-mail professionnel s'il est publié ; sinon, l'adresse e-mail RH / recrutement publiée par ` +
    `l'entreprise (ex. rh@…, recrutement@…, jobs@…). Jamais une adresse devinée ou reconstituée.\n` +
    `Note aussi l'adresse e-mail de contact générale si elle est publiée (page Contact, mentions légales) : ` +
    `contact@…, accueil@…, info@….\n` +
    `Objectif 3 — la catégorie la plus pertinente EXCLUSIVEMENT parmi cette liste (clé, pas libellé) : ${listeCategories}.\n` +
    `\n` +
    `Ne renvoie que des informations lues dans une source : un numéro ou un nom inventé ferait perdre du temps à ` +
    `l'agent, laisse plutôt le champ vide. Si un numéro est celui d'un autre établissement du groupe, dis-le dans ` +
    `son libellé.\n` +
    `Termine ta réponse par un unique objet JSON, sans texte après, au format :\n` +
    `{"telephones": [{"numero": "01 23 45 67 89", "libelle": "standard | accueil | agence | siège | RH | ...", "source": "<url>"}], ` +
    `"contactRH": {"nom": "<prénom nom>", "fonction": "<fonction>", "email": "<e-mail publié ou null>", "source": "<url>"} ou null, ` +
    `"emailRH": "<adresse RH ou recrutement publiée par l'entreprise, ou null>", ` +
    `"emailGeneral": "<adresse e-mail de contact générale publiée (contact@…, accueil@…, info@…), ou null>", ` +
    `"secteurCategorie": "<clé ou null>", "confiance": "haute|moyenne|faible"}\n` +
    `Classe les numéros du plus utile au moins utile (3 au maximum) ; "telephones" vaut [] si rien de fiable.`
  );
}

// Extrait le premier objet JSON complet contenant la clé donnée du texte —
// par comptage d'accolades plutôt qu'une regex à profondeur fixe (qui
// échouerait dès que la réponse groundée par la recherche web contient des
// accolades imbriquées avant le JSON final, ex. citations/notes de l'outil
// de recherche). Généralisée par clé pour servir les deux formats de réponse
// (recherche de téléphone : "telephone" ; assistant conversationnel : "reponse").
function extraireBlocJsonParCle(texte, cle, { dernier = false } = {}) {
  const debutCle = dernier ? texte.lastIndexOf(`"${cle}"`) : texte.indexOf(`"${cle}"`);
  if (debutCle === -1) return null;
  const debutObjet = texte.lastIndexOf("{", debutCle);
  if (debutObjet === -1) return null;

  let profondeur = 0;
  for (let i = debutObjet; i < texte.length; i++) {
    if (texte[i] === "{") profondeur++;
    else if (texte[i] === "}") {
      profondeur--;
      if (profondeur === 0) return texte.slice(debutObjet, i + 1);
    }
  }
  return null;
}

// Garde un numéro seulement s'il ressemble à un vrai numéro (9 à 15 chiffres),
// pour écarter les "null", "non trouvé" et autres valeurs de remplissage.
function nettoieNumero(v) {
  if (!v || typeof v !== "string") return null;
  const numero = v.replace(/[^\d+ .()-]/g, "").trim();
  const chiffres = numero.replace(/\D/g, "");
  return chiffres.length >= 9 && chiffres.length <= 15 ? numero : null;
}

// Garde une adresse e-mail seulement si elle en a la forme (écarte "null",
// "non trouvé", "via le formulaire de contact"…).
export function nettoieEmail(v) {
  if (!v || typeof v !== "string") return null;
  const email = v.trim().replace(/^mailto:/i, "").toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

function extraireResultat(texte) {
  // Le JSON final est en fin de réponse : on part de la DERNIÈRE occurrence,
  // le texte intermédiaire pouvant contenir des bribes de JSON.
  const bloc = extraireBlocJsonParCle(texte, "telephones", { dernier: true });
  if (!bloc) {
    const erreur = new Error("Réponse de l'IA illisible (pas de JSON de résultat trouvé).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = texte.slice(-500);
    throw erreur;
  }

  let resultat;
  try {
    resultat = JSON.parse(bloc);
  } catch {
    const erreur = new Error("Réponse de l'IA illisible (JSON invalide).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = bloc;
    throw erreur;
  }

  const nettoie = (v) => (v && v !== "null" ? v : null);
  const vus = new Set();
  const telephones = (Array.isArray(resultat.telephones) ? resultat.telephones : [])
    .map((t) => ({ numero: nettoieNumero(t?.numero), libelle: nettoie(t?.libelle), source: nettoie(t?.source) }))
    .filter((t) => {
      if (!t.numero) return false;
      const chiffres = t.numero.replace(/\D/g, "");
      if (vus.has(chiffres)) return false;
      vus.add(chiffres);
      return true;
    })
    .slice(0, 3);

  const rh = resultat.contactRH && typeof resultat.contactRH.nom === "string" && nettoie(resultat.contactRH.nom);
  const contactRH = rh
    ? {
        nom: resultat.contactRH.nom.trim(),
        fonction: nettoie(resultat.contactRH.fonction) || "",
        email: nettoieEmail(resultat.contactRH.email),
        source: nettoie(resultat.contactRH.source),
      }
    : null;
  const emailRH = nettoieEmail(resultat.emailRH);
  const emailGeneral = nettoieEmail(resultat.emailGeneral);

  // Défense contre une clé de catégorie hallucinée/inconnue : on ignore
  // plutôt que de laisser une clé invalide se propager jusqu'à classifierSecteur.
  const cleCategorie = nettoie(resultat.secteurCategorie);
  const categorieValide = cleCategorie && CATEGORIES[cleCategorie] ? cleCategorie : null;

  return {
    telephones,
    contactRH,
    emailRH,
    emailGeneral,
    // Champs historiques, lus par /api/entreprises/:id/rechercher-contact.
    telephone: telephones[0]?.numero || null,
    contact: contactRH ? [contactRH.nom, contactRH.fonction].filter(Boolean).join(", ") : null,
    source: telephones[0]?.source || null,
    confiance: resultat.confiance || "faible",
    secteurCategorie: categorieValide,
    secteurCategorieLabel: categorieValide ? CATEGORIES[categorieValide].label : null,
  };
}

// Prompt de l'assistant conversationnel "Contact nominatif" : contrairement à
// la recherche de téléphone ci-dessus (qui cherche UN numéro), ici l'agent
// pose une question libre (ex: "Qui contacter pour la comptabilité ?") et
// attend une réponse nominative — un nom et une fonction, pas juste "le
// service RH". Même garde-fou anti-hallucination : si aucune source fiable
// ne confirme l'existence de la personne, le contact structuré reste null
// (seule la réponse texte, qui peut rester générale, est renvoyée).
function construirePromptQuestion(entreprise, question) {
  const villeOuCp = [entreprise.codePostal, entreprise.ville].filter(Boolean).join(" ");
  const identite = [entreprise.nom, entreprise.adresse, villeOuCp, entreprise.siret ? `SIRET ${entreprise.siret}` : null]
    .filter(Boolean)
    .join(", ");

  return (
    `Tu es un assistant qui aide un télé-prospecteur français (Pôle OETH/AGEFIPH) à identifier la bonne personne à ` +
    `contacter dans une entreprise.\n` +
    `Entreprise : ${identite}.\n` +
    `Question de l'agent : "${question}"\n` +
    `Utilise la recherche web (site officiel, LinkedIn, Societe.com, annuaires professionnels, presse locale) pour ` +
    `trouver le NOM et la FONCTION d'une personne précise correspondant à la demande (ex : Responsable RH, DRH, ` +
    `Responsable comptable/paie, Dirigeant, Gérant) — un simple renvoi vers "le service RH" sans nom ne répond pas ` +
    `vraiment à la question posée.\n` +
    `Réponds d'abord en français, en 2 à 4 phrases maximum, directement utilisable au téléphone ` +
    `(ex : "Demandez à parler à Untel, responsable RH — c'est elle qui gère ce type de dossier.").\n` +
    `Termine IMPÉRATIVEMENT ta réponse par une seule ligne contenant uniquement un objet JSON strict, sans texte ` +
    `autour, exactement au format :\n` +
    `{"reponse": "<texte à afficher tel quel>", "contact": {"nom": "<nom complet ou null>", "role": "<fonction ou null>", "telephone": "<numéro direct ou null>", "email": "<email ou null>"}, "source": "<url ou null>", "confiance": "haute|moyenne|faible"}\n` +
    `Si l'existence réelle de cette personne n'est pas confirmée par une source fiable, mets "contact" entièrement à ` +
    `null (ou ses champs internes à null) plutôt que d'inventer un nom — une identité inventée utilisée lors d'un ` +
    `vrai appel commercial serait pire qu'une absence d'info.`
  );
}

function extraireResultatQuestion(corpsReponse) {
  const texte = (corpsReponse.content || [])
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text || "")
    .join("\n");

  const bloc = extraireBlocJsonParCle(texte, "reponse");
  if (!bloc) {
    const erreur = new Error("Réponse de l'IA illisible (pas de JSON de résultat trouvé).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = texte.slice(0, 500);
    throw erreur;
  }

  let resultat;
  try {
    resultat = JSON.parse(bloc);
  } catch {
    const erreur = new Error("Réponse de l'IA illisible (JSON invalide).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = bloc;
    throw erreur;
  }

  const nettoie = (v) => (v && v !== "null" ? v : null);
  const c = resultat.contact;
  const contact =
    c && (nettoie(c.nom) || nettoie(c.role))
      ? { nom: nettoie(c.nom), role: nettoie(c.role), telephone: nettoie(c.telephone), email: nettoie(c.email) }
      : null;

  return {
    reponse: nettoie(resultat.reponse) || "Aucune réponse exploitable.",
    contact,
    source: nettoie(resultat.source),
    confiance: resultat.confiance || "faible",
  };
}

async function appelerClaudeQuestion(entreprise, question, cle, modele) {
  const controleur = new AbortController();
  const idAbort = setTimeout(() => controleur.abort(), TIMEOUT_MS);
  let reponse;
  try {
    reponse = await fetchAnthropic(API_URL, {
      method: "POST",
      headers: enTetes(cle),
      body: JSON.stringify({
        model: modele,
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
        messages: [{ role: "user", content: construirePromptQuestion(entreprise, question) }],
      }),
      signal: controleur.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      const erreur = new Error(`Délai de recherche IA dépassé (${TIMEOUT_MS}ms).`);
      erreur.code = "TIMEOUT_MANUEL";
      throw erreur;
    }
    throw e;
  } finally {
    clearTimeout(idAbort);
  }

  const corps = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const erreur = new Error(
      messageErreurApi(reponse.status, corps, modele)
    );
    erreur.code = corps.error?.type || `HTTP_${reponse.status}`;
    signalerCreditsEpuises(erreur, corps);
    erreur.responseCode = reponse.status;
    erreur.response = JSON.stringify(corps).slice(0, 500);
    erreur.reponseHttp = reponse;
    throw erreur;
  }

  return extraireResultatQuestion(corps);
}

// Réessai commun sur 429 (débit dépassé) — seul cas qui vaut la peine d'être
// retenté : une clé invalide, un modèle inconnu ou un timeout donneraient
// systématiquement la même erreur.
async function avecRetry429(appelFn, nomEntreprise) {
  let derniereErreur;
  for (let tentative = 1; tentative <= TENTATIVES_MAX_429; tentative++) {
    try {
      return await appelFn();
    } catch (e) {
      if (e.responseCode !== 429 || tentative === TENTATIVES_MAX_429) throw e;
      derniereErreur = e;
      const delaiMs = delaiAttenteConseille(e.reponseHttp) ?? 5000 * tentative;
      console.warn(
        `[ia] 429 Anthropic pour ${nomEntreprise} — nouvelle tentative dans ${Math.round(
          Math.min(delaiMs, ATTENTE_429_PLAFOND_MS) / 1000
        )}s (${tentative}/${TENTATIVES_MAX_429}).`
      );
      await attendre(Math.min(delaiMs, ATTENTE_429_PLAFOND_MS));
    }
  }
  throw derniereErreur;
}

// Assistant conversationnel "Contact nominatif" : l'agent pose une question
// libre (ex : "Qui contacter pour la comptabilité ?") et reçoit une réponse
// nominative si une source fiable en confirme une — jamais écrit en base ici
// (voir index.js / EntrepriseDetail.jsx : c'est une PROPOSITION, l'agent
// valide explicitement avant que ça n'affecte la fiche).
export async function poserQuestionContact(entreprise, question) {
  const cle = cleApi();
  if (!cle) {
    const erreur = new Error("Recherche IA non configurée (renseignez ANTHROPIC_API_KEY).");
    erreur.code = "IA_NON_CONFIGUREE";
    throw erreur;
  }
  const modele = process.env.ANTHROPIC_MODEL || MODELE_PAR_DEFAUT;
  return avecRetry429(() => appelerClaudeQuestion(entreprise, question, cle, modele), entreprise.nom);
}

// Prompt d'analyse d'une dictée d'appel (dictaphone) : contrairement aux
// deux fonctions ci-dessus (qui cherchent des infos EXTÉRIEURES à
// l'entreprise via le web), ici on ne fait qu'analyser ce que l'agent
// vient lui-même de dire — aucun outil de recherche web, pour ne jamais
// chercher sur internet à partir du contenu d'un appel privé. Le seul
// garde-fou anti-hallucination pertinent ici est inverse : ne jamais
// AJOUTER une information que l'agent n'a pas dite, seulement reformuler.
function construirePromptDictee(entreprise, transcription) {
  const villeOuCp = [entreprise.codePostal, entreprise.ville].filter(Boolean).join(" ");
  const identite = [entreprise.nom, villeOuCp].filter(Boolean).join(", ");

  return (
    `Tu aides un télé-prospecteur français (Pôle OETH/AGEFIPH) à rédiger le compte-rendu d'un appel qu'il vient de ` +
    `terminer avec cette entreprise : ${identite}.\n` +
    `Voici sa dictée brute, telle que transcrite automatiquement par reconnaissance vocale (peut contenir des ` +
    `hésitations, du langage parlé, des répétitions, des fautes de transcription) :\n"${transcription}"\n\n` +
    `Rédige un compte-rendu ULTRA-COMPACT à partir de cette dictée : UNE SEULE PHRASE (20 mots maximum), assez ` +
    `dense pour qu'un collègue ou un manager comprenne d'un coup d'œil ce qui s'est passé avec ce lead sans avoir ` +
    `à relire la dictée. Va droit à l'essentiel (résultat de l'appel, contact obtenu, prochaine étape si ` +
    `mentionnée) — aucune formule creuse du type "aucun autre élément n'a été précisé". Restitue FIDÈLEMENT ce que ` +
    `l'agent a dit — ne complète JAMAIS avec une information qu'il n'a pas mentionnée, ne déduis rien au-delà de ` +
    `ce qui est dit explicitement. Corrige seulement la forme (orthographe, ponctuation, tournures orales), ` +
    `jamais le fond.\n` +
    `Si la dictée mentionne un ou plusieurs contacts nominatifs (nom de personne + fonction, ex : "j'ai eu Madame ` +
    `Dupont des RH"), extrais-les. Si elle mentionne aussi un numéro de téléphone ou une adresse mail dits à voix ` +
    `haute, extrais-les, rattachés au bon contact si possible.\n` +
    `Termine IMPÉRATIVEMENT ta réponse par une seule ligne contenant uniquement un objet JSON strict, sans texte ` +
    `autour, exactement au format :\n` +
    `{"resume": "<compte-rendu rédigé>", "contacts": [{"nom": "<nom ou null>", "role": "<fonction ou null>", "telephone": "<numéro ou null>", "email": "<email ou null>"}]}\n` +
    `Si aucun contact nominatif n'est mentionné, renvoie "contacts": [].`
  );
}

function extraireResultatDictee(corpsReponse) {
  const texte = (corpsReponse.content || [])
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text || "")
    .join("\n");

  const bloc = extraireBlocJsonParCle(texte, "resume");
  if (!bloc) {
    const erreur = new Error("Réponse de l'IA illisible (pas de JSON de résultat trouvé).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = texte.slice(0, 500);
    throw erreur;
  }

  let resultat;
  try {
    resultat = JSON.parse(bloc);
  } catch {
    const erreur = new Error("Réponse de l'IA illisible (JSON invalide).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = bloc;
    throw erreur;
  }

  const nettoie = (v) => (v && v !== "null" ? v : null);
  const resume = nettoie(resultat.resume);
  if (!resume) {
    const erreur = new Error("L'IA n'a renvoyé aucun compte-rendu exploitable.");
    erreur.code = "REPONSE_IA_INVALIDE";
    throw erreur;
  }

  const contacts = Array.isArray(resultat.contacts)
    ? resultat.contacts
        .map((c) => ({
          nom: nettoie(c?.nom),
          role: nettoie(c?.role),
          telephone: nettoie(c?.telephone),
          email: nettoie(c?.email),
        }))
        .filter((c) => c.nom || c.role || c.telephone || c.email)
    : [];

  return { resume, contacts };
}

async function appelerClaudeDictee(entreprise, transcription, cle, modele) {
  const controleur = new AbortController();
  const idAbort = setTimeout(() => controleur.abort(), TIMEOUT_MS);
  let reponse;
  try {
    reponse = await fetchAnthropic(API_URL, {
      method: "POST",
      headers: enTetes(cle),
      body: JSON.stringify({
        model: modele,
        max_tokens: 1024,
        // Pas d'outil de recherche web ici (voir le commentaire au-dessus de
        // construirePromptDictee) : uniquement une reformulation/extraction à
        // partir du texte fourni par l'agent lui-même.
        messages: [{ role: "user", content: construirePromptDictee(entreprise, transcription) }],
      }),
      signal: controleur.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      const erreur = new Error(`Délai de recherche IA dépassé (${TIMEOUT_MS}ms).`);
      erreur.code = "TIMEOUT_MANUEL";
      throw erreur;
    }
    throw e;
  } finally {
    clearTimeout(idAbort);
  }

  const corps = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const erreur = new Error(
      messageErreurApi(reponse.status, corps, modele)
    );
    erreur.code = corps.error?.type || `HTTP_${reponse.status}`;
    signalerCreditsEpuises(erreur, corps);
    erreur.responseCode = reponse.status;
    erreur.response = JSON.stringify(corps).slice(0, 500);
    erreur.reponseHttp = reponse;
    throw erreur;
  }

  return extraireResultatDictee(corps);
}

// Dictaphone IA : transcrit côté client (Web Speech API — voir
// DicteeCommentaire.jsx), puis analysé ici pour produire un compte-rendu
// propre + extraire d'éventuels contacts nominatifs cités pendant l'appel.
// Ne persiste RIEN — l'agent valide et enregistre explicitement via les
// routes /commentaires et PATCH existantes une fois satisfait du résultat.
export async function analyserDictee(entreprise, transcription) {
  const cle = cleApi();
  if (!cle) {
    const erreur = new Error("Recherche IA non configurée (renseignez ANTHROPIC_API_KEY).");
    erreur.code = "IA_NON_CONFIGUREE";
    throw erreur;
  }
  const modele = process.env.ANTHROPIC_MODEL || MODELE_PAR_DEFAUT;
  return avecRetry429(() => appelerClaudeDictee(entreprise, transcription, cle, modele), entreprise.nom);
}

async function appelerClaude(entreprise, cle, modele) {
  const controleur = new AbortController();
  const idAbort = setTimeout(() => controleur.abort(), TIMEOUT_MS);
  const messages = [{ role: "user", content: construirePrompt(entreprise) }];
  const textes = [];
  try {
    // Les outils serveur (recherche/lecture web) peuvent rendre la main en
    // cours de route (stop_reason "pause_turn") : on renvoie alors la réponse
    // telle quelle pour que Claude continue, sinon le JSON final n'arrive
    // jamais. Avec l'ancien max_tokens de 1024, la réponse était aussi
    // souvent tronquée avant le JSON — deux causes des "réponses illisibles".
    for (let tour = 0; tour < 4; tour++) {
      let reponse;
      try {
        reponse = await fetchAnthropic(API_URL, {
          method: "POST",
          headers: enTetes(cle),
          body: JSON.stringify({
            model: modele,
            max_tokens: 16000,
            tools: outilsWeb(modele),
            // Effort bas : une recherche de numéro est une tâche simple, et
            // l'effort par défaut faisait enchaîner de longues réflexions et
            // de nombreux appels d'outils — au point de dépasser le délai.
            // Non supporté par les anciens modèles (400), d'où la condition.
            ...(estModeleRecent(modele) ? { output_config: { effort: "low" } } : {}),
            messages,
          }),
          signal: controleur.signal,
        });
      } catch (e) {
        if (e.name === "AbortError") {
          const erreur = new Error(`Délai de recherche IA dépassé (${TIMEOUT_MS}ms).`);
          erreur.code = "TIMEOUT_MANUEL";
          throw erreur;
        }
        throw e;
      }

      const corps = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        const erreur = new Error(
          messageErreurApi(reponse.status, corps, modele)
        );
        erreur.code = corps.error?.type || `HTTP_${reponse.status}`;
        signalerCreditsEpuises(erreur, corps);
        erreur.responseCode = reponse.status;
        erreur.response = JSON.stringify(corps).slice(0, 500);
        erreur.reponseHttp = reponse;
        throw erreur;
      }

      for (const bloc of corps.content || []) {
        if (bloc.type === "text" && bloc.text) textes.push(bloc.text);
      }
      if (corps.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: corps.content });
    }
  } finally {
    clearTimeout(idAbort);
  }

  return extraireResultat(textes.join("\n"));
}

export async function rechercherContactAlternatif(entreprise) {
  const cle = cleApi();
  if (!cle) {
    const erreur = new Error("Recherche IA non configurée (renseignez ANTHROPIC_API_KEY).");
    erreur.code = "IA_NON_CONFIGUREE";
    throw erreur;
  }
  const modele = process.env.ANTHROPIC_MODEL || MODELE_PAR_DEFAUT;
  return avecRetry429(() => appelerClaude(entreprise, cle, modele), entreprise.nom);
}

// Prompt de génération d'e-mail de relance/prospection — s'appuie
// UNIQUEMENT sur les données déjà connues du CRM (pas de recherche web ici,
// contrairement aux deux fonctions ci-dessus) : secteur, chiffres OETH,
// interlocuteur identifié, et historique d'échange pour adapter
// automatiquement le ton (premier contact vs. relance sans réponse).
// `entreprise` doit être la version ENRICHIE (avec .oeth et .categorie
// calculés — voir enrichir() dans index.js), pas la fiche brute.
function construirePromptEmail(entreprise) {
  const villeOuCp = [entreprise.codePostal, entreprise.ville].filter(Boolean).join(" ");
  const identite = [entreprise.nom, villeOuCp].filter(Boolean).join(", ");
  const secteurLabel = entreprise.categorie?.label || entreprise.secteurActivite || null;

  const contact = entreprise.contact || {};
  const interlocuteur =
    contact.nom && contact.nom !== "-"
      ? `${contact.nom}${contact.fonction && contact.fonction !== "-" ? ` (${contact.fonction})` : ""}`
      : null;

  const oeth = entreprise.oeth || {};
  const oethResume = !oeth.assujetti
    ? `non assujettie à l'obligation OETH (effectif ${entreprise.effectif ?? "?"} salariés, sous le seuil de 20) — pas d'angle réglementaire pertinent ici, privilégier une prise de contact générale sur l'inclusion du handicap`
    : oeth.conforme
      ? `assujettie à l'obligation OETH mais déjà conforme (${oeth.beneficiairesRecrutes}/${oeth.unitesRequises} unités bénéficiaires) — l'angle est une proposition de service (ESAT Tremplin), pas une alerte de non-conformité`
      : `assujettie à l'obligation OETH avec un déficit de ${oeth.deficit} unité(s) bénéficiaire(s) sur ${oeth.unitesRequises} requises (effectif ${entreprise.effectif ?? "?"} salariés)`;

  const emails = entreprise.emails || [];
  const dernierEnvoye = [...emails].reverse().find((m) => m.direction === "envoye");
  const aRepondu =
    dernierEnvoye && emails.some((m) => m.direction === "recu" && new Date(m.date) > new Date(dernierEnvoye.date));
  let contexte;
  if (dernierEnvoye && !aRepondu) {
    contexte =
      `un e-mail a déjà été envoyé le ${new Date(dernierEnvoye.date).toLocaleDateString("fr-FR")} ` +
      `(objet : "${dernierEnvoye.objet}") et est resté sans réponse à ce jour — rédige une RELANCE courtoise qui ` +
      `fait brièvement référence à ce premier message sans être insistante ni redondante`;
  } else {
    contexte = `aucun échange préalable exploitable — rédige un PREMIER message de prise de contact/prospection`;
  }

  return (
    `Tu rédiges, au nom du Pôle OETH/AGEFIPH, un e-mail professionnel en français pour l'entreprise ${identite}` +
    `${secteurLabel ? ` (secteur : ${secteurLabel})` : ""}.\n` +
    `Interlocuteur identifié : ${interlocuteur || "aucun nom précis connu — adresse-toi génériquement au service RH ou à la direction, sans inventer de nom"}.\n` +
    `Situation OETH de l'entreprise : ${oethResume}.\n` +
    `Contexte de cet envoi : ${contexte}.\n` +
    `Règles impératives, à ne jamais enfreindre :\n` +
    `- Le pôle est un relais en lien avec l'AGEFIPH, jamais l'AGEFIPH ou l'URSSAF elles-mêmes : ne jamais prétendre parler en leur nom ni employer leur identité.\n` +
    `- Ne jamais affirmer qu'un contrôle ou une procédure URSSAF a déjà individuellement visé cette entreprise sans preuve réelle.\n` +
    `- Ne jamais menacer d'une pénalité, majoration ou sanction que le pôle appliquerait lui-même — seule l'URSSAF en a le pouvoir.\n` +
    `- Rester strictement factuel sur les chiffres OETH donnés ci-dessus ; ne rien inventer si une donnée manque.\n` +
    `Ton : professionnel, direct, consultatif — jamais commercial agressif. 120 à 180 mots pour le corps. Termine le ` +
    `corps par le jeton littéral {{SIGNATURE}} seul sur sa dernière ligne (il sera remplacé automatiquement par la ` +
    `vraie signature — ne l'explique pas, n'écris rien après).\n` +
    `Termine ta réponse par une seule ligne contenant uniquement un objet JSON strict, sans texte autour, exactement au format :\n` +
    `{"objet": "<objet du mail>", "corps": "<corps du mail, avec de vrais retours à la ligne entre les paragraphes>"}`
  );
}

function extraireResultatEmail(corpsReponse) {
  const texte = (corpsReponse.content || [])
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text || "")
    .join("\n");

  const bloc = extraireBlocJsonParCle(texte, "objet");
  if (!bloc) {
    const erreur = new Error("Réponse de l'IA illisible (pas de JSON de résultat trouvé).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = texte.slice(0, 500);
    throw erreur;
  }

  let resultat;
  try {
    resultat = JSON.parse(bloc);
  } catch {
    const erreur = new Error("Réponse de l'IA illisible (JSON invalide).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = bloc;
    throw erreur;
  }

  if (!resultat.objet || !resultat.corps) {
    const erreur = new Error("Réponse de l'IA incomplète (objet ou corps manquant).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = bloc;
    throw erreur;
  }

  return { objet: String(resultat.objet), corps: String(resultat.corps) };
}

async function appelerClaudeEmail(entreprise, cle, modele) {
  const controleur = new AbortController();
  const idAbort = setTimeout(() => controleur.abort(), TIMEOUT_MS);
  let reponse;
  try {
    reponse = await fetchAnthropic(API_URL, {
      method: "POST",
      headers: enTetes(cle),
      // Pas d'outil de recherche web ici : contrairement à la recherche de
      // contact, la génération d'e-mail s'appuie uniquement sur les données
      // déjà présentes dans le prompt (secteur, OETH, historique).
      body: JSON.stringify({
        model: modele,
        max_tokens: 1024,
        messages: [{ role: "user", content: construirePromptEmail(entreprise) }],
      }),
      signal: controleur.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      const erreur = new Error(`Délai de génération IA dépassé (${TIMEOUT_MS}ms).`);
      erreur.code = "TIMEOUT_MANUEL";
      throw erreur;
    }
    throw e;
  } finally {
    clearTimeout(idAbort);
  }

  const corps = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const erreur = new Error(
      messageErreurApi(reponse.status, corps, modele)
    );
    erreur.code = corps.error?.type || `HTTP_${reponse.status}`;
    signalerCreditsEpuises(erreur, corps);
    erreur.responseCode = reponse.status;
    erreur.response = JSON.stringify(corps).slice(0, 500);
    erreur.reponseHttp = reponse;
    throw erreur;
  }

  return extraireResultatEmail(corps);
}

// Génère un e-mail de relance/prospection personnalisé — déclenché
// EXPLICITEMENT par l'agent (bouton dédié dans MessagerieMail.jsx), jamais
// automatiquement. Renvoie une PROPOSITION (objet + corps) qui ne fait que
// pré-remplir le formulaire d'envoi existant côté client : l'agent relit,
// ajuste si besoin, et clique lui-même sur "Envoyer" — rien n'est expédié
// directement par cette fonction.
export async function genererEmailProspection(entreprise) {
  const cle = cleApi();
  if (!cle) {
    const erreur = new Error("Recherche IA non configurée (renseignez ANTHROPIC_API_KEY).");
    erreur.code = "IA_NON_CONFIGUREE";
    throw erreur;
  }
  const modele = process.env.ANTHROPIC_MODEL || MODELE_PAR_DEFAUT;
  return avecRetry429(() => appelerClaudeEmail(entreprise, cle, modele), entreprise.nom);
}

// Assistant de questions "domaine" (OETH / contribution / surcontribution /
// ESAT Tremplin / TIH) : contrairement aux fonctions ci-dessus (qui portent
// sur UNE entreprise précise), l'agent pose ici une question générale de
// connaissance métier (ex : "à partir de combien de salariés on passe à 500
// SMIC ?"), typiquement pour préparer ou sécuriser un argumentaire pendant un
// appel — voir AssistantDomaineCrm.jsx (bouton flottant du CRM, au-dessus du
// chat d'équipe). Pas d'outil de recherche web ici : tous les chiffres utiles
// (barème, seuils, SMIC courant) sont injectés directement dans le prompt
// depuis oeth.js (seule source de vérité déjà utilisée par le simulateur et
// les fiches), pour qu'il ne puisse jamais répondre avec un montant obsolète
// ou halluciné.
function construirePromptDomaine(question) {
  const bareme = baremeParUnite();
  const lignesBareme = bareme.classique
    .map((t) => `- ${t.tranche} salariés : ${t.montantParUnite} € par unité manquante (coefficient ${t.coefficient} × SMIC)`)
    .join("\n");

  return (
    `Tu es un assistant qui aide les agents du Pôle OETH/AGEFIPH à répondre à des questions de connaissance métier ` +
    `pendant ou avant un appel commercial : obligation d'emploi des travailleurs handicapés (OETH), contribution, ` +
    `surcontribution, dispositifs ESAT Tremplin et TIH (Travailleurs Indépendants Handicapés).\n\n` +
    `Données de référence EXACTES et À JOUR — n'utilise JAMAIS un chiffre différent de ceux-ci, n'en invente aucun :\n` +
    `- Seuil d'assujettissement : ${SEUIL_ASSUJETTISSEMENT} salariés\n` +
    `- Taux légal : ${TAUX_LEGAL * 100} % de l'effectif\n` +
    `- SMIC horaire retenu : ${bareme.smicHoraire} €\n` +
    `- Barème de contribution par unité manquante, selon la taille de l'entreprise :\n${lignesBareme}\n` +
    `- Surcontribution (aucune action sur les 4 dernières années : aucun recrutement, aucune sous-traitance ` +
    `EA/ESAT/TIH suffisante, aucun accord agréé) : ${bareme.majoree.montantParUnite} € par unité manquante ` +
    `(coefficient ${bareme.majoree.coefficient} × SMIC) — le montant le plus élevé, à réserver aux entreprises en ` +
    `inaction totale.\n` +
    `- Seuil de sous-traitance EA/ESAT/TIH permettant d'écarter la surcontribution : ${bareme.seuilSousTraitance} € ` +
    `de coût de main-d'œuvre sur la période (déduction de ${bareme.tauxDeductionSousTraitance * 100} % du coût réel, ` +
    `plafonnée selon le taux d'emploi de l'entreprise).\n` +
    `- Neutralisation légale : une entreprise créée depuis moins de ${DUREE_NEUTRALISATION_ANNEES} ans n'a aucune ` +
    `obligation OETH, quel que soit son effectif.\n` +
    `- ESAT Tremplin : minimum légal de 600 heures de prestation (modulable à 400 heures selon les unités déjà ` +
    `couvertes), déduction d'environ 80 % du coût de la prestation, protection contre la surcontribution pendant ` +
    `3 ans — à la différence d'un ESAT classique, qui ne déduit qu'environ 30 % du coût et exige un nouvel effort ` +
    `chaque année. Investissement total approximatif pour le minimum légal (600 h × SMIC + matières premières) : ` +
    `environ 9 232 €.\n` +
    `- TIH (Travailleurs Indépendants Handicapés) : dispositif alternatif de sous-traitance auprès d'un travailleur ` +
    `handicapé indépendant, soumis aux mêmes règles de seuil que l'EA/ESAT ci-dessus.\n\n` +
    `Question de l'agent : "${question}"\n\n` +
    `Réponds en français, en 2 à 5 phrases maximum, directement utilisable au téléphone ou pour se préparer avant ` +
    `un appel. Si la question sort du champ OETH/contribution/ESAT/TIH/AGEFIPH, dis-le clairement plutôt que ` +
    `d'inventer une réponse hors sujet.\n` +
    `Termine IMPÉRATIVEMENT ta réponse par une seule ligne contenant uniquement un objet JSON strict, sans texte ` +
    `autour, exactement au format :\n{"reponse": "<texte à afficher tel quel>"}`
  );
}

function extraireResultatDomaine(corpsReponse) {
  const texte = (corpsReponse.content || [])
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text || "")
    .join("\n");

  const bloc = extraireBlocJsonParCle(texte, "reponse");
  if (!bloc) {
    const erreur = new Error("Réponse de l'IA illisible (pas de JSON de résultat trouvé).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = texte.slice(0, 500);
    throw erreur;
  }

  let resultat;
  try {
    resultat = JSON.parse(bloc);
  } catch {
    const erreur = new Error("Réponse de l'IA illisible (JSON invalide).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = bloc;
    throw erreur;
  }

  if (!resultat.reponse) {
    const erreur = new Error("L'IA n'a renvoyé aucune réponse exploitable.");
    erreur.code = "REPONSE_IA_INVALIDE";
    throw erreur;
  }
  return { reponse: String(resultat.reponse) };
}

async function appelerClaudeDomaine(question, cle, modele) {
  const controleur = new AbortController();
  const idAbort = setTimeout(() => controleur.abort(), TIMEOUT_MS);
  let reponse;
  try {
    reponse = await fetchAnthropic(API_URL, {
      method: "POST",
      headers: enTetes(cle),
      body: JSON.stringify({
        model: modele,
        max_tokens: 512,
        // Pas d'outil de recherche web : réponse construite uniquement à
        // partir des chiffres injectés ci-dessus (voir construirePromptDomaine).
        messages: [{ role: "user", content: construirePromptDomaine(question) }],
      }),
      signal: controleur.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      const erreur = new Error(`Délai de réponse IA dépassé (${TIMEOUT_MS}ms).`);
      erreur.code = "TIMEOUT_MANUEL";
      throw erreur;
    }
    throw e;
  } finally {
    clearTimeout(idAbort);
  }

  const corps = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const erreur = new Error(
      messageErreurApi(reponse.status, corps, modele)
    );
    erreur.code = corps.error?.type || `HTTP_${reponse.status}`;
    signalerCreditsEpuises(erreur, corps);
    erreur.responseCode = reponse.status;
    erreur.response = JSON.stringify(corps).slice(0, 500);
    erreur.reponseHttp = reponse;
    throw erreur;
  }

  return extraireResultatDomaine(corps);
}

// Assistant de questions "domaine" — voir construirePromptDomaine ci-dessus.
// Ne persiste rien, aucun lien avec une entreprise précise.
export async function repondreQuestionDomaine(question) {
  const cle = cleApi();
  if (!cle) {
    const erreur = new Error("Recherche IA non configurée (renseignez ANTHROPIC_API_KEY).");
    erreur.code = "IA_NON_CONFIGUREE";
    throw erreur;
  }
  const modele = process.env.ANTHROPIC_MODEL || MODELE_PAR_DEFAUT;
  return avecRetry429(() => appelerClaudeDomaine(question, cle, modele), "assistant-domaine");
}

// Correcteur d'orthographe des mails rédigés à la main : accents, a / à,
// accords, ponctuation — sans changer le sens, le ton ni la mise en forme.
// Renvoie uniquement le texte corrigé (rien n'est enregistré ici).
export async function corrigerTexte(texte) {
  const cle = cleApi();
  if (!cle) {
    const erreur = new Error("Correction IA non configurée (renseignez ANTHROPIC_API_KEY).");
    erreur.code = "IA_NON_CONFIGUREE";
    throw erreur;
  }
  const modele = process.env.ANTHROPIC_MODEL || MODELE_PAR_DEFAUT;
  const consigne =
    "Corrige l'orthographe, les accents, la grammaire, les accords et la ponctuation de ce texte en français " +
    "(par exemple « a » / « à », « invités a envoyer » → « invités à envoyer »). Ne change ni le sens, ni le ton, " +
    "ni la structure : garde les retours à la ligne, les listes, les adresses e-mail, les liens, les numéros, les " +
    "noms propres et le jeton {{SIGNATURE}} tels quels. N'ajoute et ne retire aucune phrase. Réponds uniquement " +
    "avec le texte corrigé, sans commentaire ni guillemets.\n\nTexte :\n" +
    texte;

  return avecRetry429(async () => {
    const controleur = new AbortController();
    const idAbort = setTimeout(() => controleur.abort(), TIMEOUT_MS);
    let reponse;
    try {
      reponse = await fetchAnthropic(API_URL, {
        method: "POST",
        headers: enTetes(cle),
        body: JSON.stringify({ model: modele, max_tokens: 4096, messages: [{ role: "user", content: consigne }] }),
        signal: controleur.signal,
      });
    } catch (e) {
      if (e.name === "AbortError") {
        const erreur = new Error(`Délai de correction IA dépassé (${TIMEOUT_MS}ms).`);
        erreur.code = "TIMEOUT_MANUEL";
        throw erreur;
      }
      throw e;
    } finally {
      clearTimeout(idAbort);
    }
    const corps = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      const erreur = new Error(messageErreurApi(reponse.status, corps, modele));
      erreur.code = corps.error?.type || `HTTP_${reponse.status}`;
      signalerCreditsEpuises(erreur, corps);
      erreur.responseCode = reponse.status;
      erreur.reponseHttp = reponse;
      throw erreur;
    }
    const corrige = (corps.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!corrige) throw new Error("Réponse de correction vide.");
    return corrige;
  }, "correction de texte");
}
