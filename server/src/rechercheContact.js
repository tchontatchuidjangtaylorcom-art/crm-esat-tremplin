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

const API_URL = "https://api.anthropic.com/v1/messages";
const VERSION_API = "2023-06-01";

// Modèle configurable : "claude-sonnet-5" est le modèle Claude Sonnet actuel
// au moment de l'écriture — ajustez ANTHROPIC_MODEL (sans toucher au code)
// si Anthropic publie une version plus récente à privilégier.
const MODELE_PAR_DEFAUT = "claude-sonnet-5";
const TIMEOUT_MS = Number(process.env.ANTHROPIC_TIMEOUT_MS) || 20000;

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
    erreur.responseCode = reponse.status;
    throw erreur;
  }
  return (corps.data || []).map((m) => ({ id: m.id, displayName: m.display_name || null }));
}

export function detailErreur(e) {
  return {
    message: e.message,
    code: e.code,
    responseCode: e.responseCode,
    response: e.response,
  };
}

function construirePrompt(entreprise) {
  const villeOuCp = [entreprise.codePostal, entreprise.ville].filter(Boolean).join(" ");
  // Même requête que le lien manuel "Rechercher sur Google" déjà proposé à
  // l'agent (voir EntrepriseDetail.jsx) — on demande au modèle de faire
  // EXACTEMENT la recherche qu'un agent ferait lui-même à la main, plutôt
  // qu'une formulation plus verbeuse qui disperse la recherche web sur des
  // pages moins directement pertinentes.
  const requetePrincipale = [entreprise.nom, villeOuCp, "téléphone"].filter(Boolean).join(" ");
  const requeteSiret = entreprise.siret ? `${entreprise.nom} ${entreprise.siret}` : null;

  const identite = [entreprise.nom, entreprise.adresse, villeOuCp, entreprise.siret ? `SIRET ${entreprise.siret}` : null]
    .filter(Boolean)
    .join(", ");

  const listeCategories = listerCategories()
    .map((c) => `${c.value} = ${c.label}`)
    .join(" ; ");

  return (
    `Tu aides un télé-prospecteur français à mettre à jour la fiche de cette entreprise : ${identite}.\n` +
    `Le numéro actuellement enregistré (${entreprise.contact?.telephone || "aucun"}) est invalide ou non attribué.\n` +
    `Pour le retrouver, lance ta recherche web EXACTEMENT comme le ferait un agent qui tape lui-même dans Google — ` +
    `pas une formulation plus longue ou plus explicative : requête "${requetePrincipale}"` +
    (requeteSiret ? `, et si besoin en repli "${requeteSiret}"` : "") +
    `.\n` +
    `Priorité stricte à l'extraction directe : regarde D'ABORD si un numéro apparaît directement dans le bloc de ` +
    `résultat Google lui-même (fiche d'établissement / pavé "Google Maps"/"Business Profile" affiché en tête de ` +
    `page, avec le numéro de standard déjà visible) — c'est presque toujours la source la plus fiable et la plus ` +
    `rapide, exactement ce qu'un agent verrait au premier coup d'œil sans avoir à cliquer plus loin. Ne creuse dans ` +
    `des pages individuelles (site officiel, PagesJaunes, Societe.com, Verif.com, Infogreffe, LinkedIn) que si ce ` +
    `bloc direct est absent ou ne donne pas de numéro exploitable.\n` +
    `Détermine aussi, à partir de l'activité réelle de cette entreprise, la catégorie la plus pertinente EXCLUSIVEMENT parmi cette liste officielle (utilise la clé, pas le libellé) : ${listeCategories}.\n` +
    `Termine IMPÉRATIVEMENT ta réponse par une seule ligne contenant uniquement un objet JSON strict, sans texte autour, exactement au format :\n` +
    `{"telephone": "<numéro ou null>", "contact": "<nom et fonction ou null>", "secteurCategorie": "<une des clés ci-dessus ou null>", "source": "<url ou null>", "confiance": "haute|moyenne|faible"}\n` +
    `Si tu ne trouves rien de fiable pour un champ, mets-le à null plutôt que d'inventer une valeur — une mauvaise info est pire qu'aucune info ici.`
  );
}

// Extrait le premier objet JSON complet contenant la clé donnée du texte —
// par comptage d'accolades plutôt qu'une regex à profondeur fixe (qui
// échouerait dès que la réponse groundée par la recherche web contient des
// accolades imbriquées avant le JSON final, ex. citations/notes de l'outil
// de recherche). Généralisée par clé pour servir les deux formats de réponse
// (recherche de téléphone : "telephone" ; assistant conversationnel : "reponse").
function extraireBlocJsonParCle(texte, cle) {
  const debutCle = texte.indexOf(`"${cle}"`);
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

function extraireResultat(corpsReponse) {
  const texte = (corpsReponse.content || [])
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text || "")
    .join("\n");

  const bloc = extraireBlocJsonParCle(texte, "telephone");
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
  // Défense contre une clé de catégorie hallucinée/inconnue : on ignore
  // plutôt que de laisser une clé invalide se propager jusqu'à classifierSecteur.
  const cleCategorie = nettoie(resultat.secteurCategorie);
  const categorieValide = cleCategorie && CATEGORIES[cleCategorie] ? cleCategorie : null;

  return {
    telephone: nettoie(resultat.telephone),
    contact: nettoie(resultat.contact),
    source: nettoie(resultat.source),
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
    reponse = await fetch(API_URL, {
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
      corps.error?.message || `L'API Anthropic a répondu ${reponse.status} (modèle "${modele}" invalide/indisponible ?).`
    );
    erreur.code = corps.error?.type || `HTTP_${reponse.status}`;
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

async function appelerClaude(entreprise, cle, modele) {
  const controleur = new AbortController();
  const idAbort = setTimeout(() => controleur.abort(), TIMEOUT_MS);
  let reponse;
  try {
    reponse = await fetch(API_URL, {
      method: "POST",
      headers: enTetes(cle),
      body: JSON.stringify({
        model: modele,
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        messages: [{ role: "user", content: construirePrompt(entreprise) }],
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
      corps.error?.message || `L'API Anthropic a répondu ${reponse.status} (modèle "${modele}" invalide/indisponible ?).`
    );
    erreur.code = corps.error?.type || `HTTP_${reponse.status}`;
    erreur.responseCode = reponse.status;
    erreur.response = JSON.stringify(corps).slice(0, 500);
    erreur.reponseHttp = reponse;
    throw erreur;
  }

  return extraireResultat(corps);
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
    reponse = await fetch(API_URL, {
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
      corps.error?.message || `L'API Anthropic a répondu ${reponse.status} (modèle "${modele}" invalide/indisponible ?).`
    );
    erreur.code = corps.error?.type || `HTTP_${reponse.status}`;
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
