// Recherche IA d'un contact/téléphone alternatif + suggestion de secteur, via
// l'API Google Gemini et son outil de recherche Google (grounding) —
// déclenchée depuis une fiche entreprise quand l'agent signale un numéro
// invalide/non attribué (voir EntrepriseDetail.jsx, section
// "Espace IA — Contact alternatif").
//
// Fonctionnalité optionnelle : nécessite GEMINI_API_KEY (alias accepté :
// GOOGLE_API_KEY), gratuite à générer sur Google AI Studio (quota gratuit).
// Sans base de téléphonie payante dédiée (Pappers Pro, Societe.com Pro...),
// la recherche web via un modèle reste la seule source disponible ici — le
// résultat est une PROPOSITION à valider par l'agent (pré-remplit les champs
// existants, jamais appliqué automatiquement) : un numéro ou une catégorie
// hallucinés seraient pires qu'une fiche laissée à corriger manuellement.
import { CATEGORIES, listerCategories } from "./secteurs.js";

// Modèle configurable : la nomenclature des modèles Gemini change avec le
// temps et Google retire régulièrement les anciennes générations (ex :
// gemini-1.5-flash renvoie 404 depuis son arrêt complet ; gemini-2.5-flash,
// utilisé ici jusqu'ici, a cessé de répondre après son propre arrêt le
// 17/06/2026 — d'où l'échec en production) — vérifiez le nom exact
// disponible pour votre clé sur https://aistudio.google.com/ et ajustez
// GEMINI_MODEL (sans toucher au code) si ce modèle par défaut venait à son
// tour à être retiré. Valeur par défaut : le modèle "Flash" généralement
// disponible (GA, donc pas un aperçu susceptible d'être coupé sans préavis)
// le plus récent connu au moment de l'écriture.
const MODELE_PAR_DEFAUT = "gemini-3.8-flash";
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 20000;

// Le plan gratuit de l'API Gemini limite le débit à quelques requêtes par
// minute (bien moins que l'API Sirene) : un enrichissement en lot sur
// plusieurs dizaines de fiches y cogne systématiquement après les toutes
// premières requêtes. Même parade que pour l'API Sirene (voir insee.js) —
// retry/backoff dédié aux 429, en respectant le délai indiqué par Gemini.
const TENTATIVES_MAX_429 = 3;
const ATTENTE_429_PLAFOND_MS = 65_000;

function cleApi() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function attendre(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Lit le délai d'attente conseillé par Gemini sur un 429 : d'abord l'en-tête
// HTTP standard Retry-After, à défaut le champ RetryInfo.retryDelay que
// l'API Gemini renvoie dans le corps de l'erreur (ex : "38s").
function delaiAttenteConseille(reponse, corpsErreur) {
  const enTete = reponse.headers.get("retry-after");
  if (enTete) {
    const secondes = Number(enTete);
    if (!Number.isNaN(secondes)) return secondes * 1000;
    const date = Date.parse(enTete);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  const retryInfo = (corpsErreur?.error?.details || []).find((d) =>
    d["@type"]?.includes("RetryInfo")
  );
  if (retryInfo?.retryDelay) {
    const secondes = Number(String(retryInfo.retryDelay).replace(/s$/, ""));
    if (!Number.isNaN(secondes)) return secondes * 1000;
  }
  return null;
}

export function estRechercheIaConfiguree() {
  return Boolean(cleApi());
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
  const identite = [
    entreprise.nom,
    entreprise.adresse,
    [entreprise.codePostal, entreprise.ville].filter(Boolean).join(" "),
    entreprise.siret ? `SIRET ${entreprise.siret}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const listeCategories = listerCategories()
    .map((c) => `${c.value} = ${c.label}`)
    .join(" ; ");

  return (
    `Tu aides un télé-prospecteur français à mettre à jour la fiche de cette entreprise : ${identite}.\n` +
    `Le numéro actuellement enregistré (${entreprise.contact?.telephone || "aucun"}) est invalide ou non attribué.\n` +
    `Cherche sur le web (site officiel de l'entreprise, PagesJaunes, Societe.com, Verif.com, Infogreffe, LinkedIn) un numéro de standard ou un contact (nom + fonction) plus fiable.\n` +
    `Détermine aussi, à partir de l'activité réelle de cette entreprise, la catégorie la plus pertinente EXCLUSIVEMENT parmi cette liste officielle (utilise la clé, pas le libellé) : ${listeCategories}.\n` +
    `Termine IMPÉRATIVEMENT ta réponse par une seule ligne contenant uniquement un objet JSON strict, sans texte autour, exactement au format :\n` +
    `{"telephone": "<numéro ou null>", "contact": "<nom et fonction ou null>", "secteurCategorie": "<une des clés ci-dessus ou null>", "source": "<url ou null>", "confiance": "haute|moyenne|faible"}\n` +
    `Si tu ne trouves rien de fiable pour un champ, mets-le à null plutôt que d'inventer une valeur — une mauvaise info est pire qu'aucune info ici.`
  );
}

// Extrait le premier objet JSON complet contenant "telephone" du texte —
// par comptage d'accolades plutôt qu'une regex à profondeur fixe (qui
// échouait dès que la réponse groundée par la recherche web contenait des
// accolades imbriquées avant le JSON final, ex. citations/notes de l'outil
// google_search), ce qui faisait systématiquement échouer l'extraction sur
// certaines fiches.
function extraireBlocJson(texte) {
  const debutCle = texte.indexOf('"telephone"');
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
  const texte = (corpsReponse.candidates || [])
    .flatMap((candidat) => candidat.content?.parts || [])
    .map((partie) => partie.text || "")
    .join("\n");

  const bloc = extraireBlocJson(texte);
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

async function appelerGemini(entreprise, cle, modele) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent?key=${cle}`;

  const controleur = new AbortController();
  const idAbort = setTimeout(() => controleur.abort(), TIMEOUT_MS);
  let reponse;
  try {
    reponse = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: construirePrompt(entreprise) }] }],
        tools: [{ google_search: {} }],
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
      corps.error?.message || `L'API Gemini a répondu ${reponse.status} (modèle "${modele}" invalide/indisponible ?).`
    );
    erreur.code = corps.error?.status || `HTTP_${reponse.status}`;
    erreur.responseCode = reponse.status;
    erreur.response = JSON.stringify(corps).slice(0, 500);
    erreur.reponseHttp = reponse;
    erreur.corpsErreur = corps;
    throw erreur;
  }

  return extraireResultat(corps);
}

export async function rechercherContactAlternatif(entreprise) {
  const cle = cleApi();
  if (!cle) {
    const erreur = new Error("Recherche IA non configurée (renseignez GEMINI_API_KEY).");
    erreur.code = "IA_NON_CONFIGUREE";
    throw erreur;
  }

  const modele = process.env.GEMINI_MODEL || MODELE_PAR_DEFAUT;

  let derniereErreur;
  for (let tentative = 1; tentative <= TENTATIVES_MAX_429; tentative++) {
    try {
      return await appelerGemini(entreprise, cle, modele);
    } catch (e) {
      // Seul le 429 (quota/débit dépassé — le cas courant sur le plan
      // gratuit Gemini lors d'un enrichissement en lot) vaut la peine d'être
      // réessayé : une clé invalide, un modèle inconnu ou un timeout
      // donneront systématiquement la même erreur, autant échouer tout de
      // suite plutôt que de perdre du temps à réessayer 3 fois par fiche.
      if (e.responseCode !== 429 || tentative === TENTATIVES_MAX_429) throw e;
      derniereErreur = e;
      const delaiMs = delaiAttenteConseille(e.reponseHttp, e.corpsErreur) ?? 5000 * tentative;
      console.warn(
        `[ia] 429 Gemini pour ${entreprise.nom} — nouvelle tentative dans ${Math.round(
          Math.min(delaiMs, ATTENTE_429_PLAFOND_MS) / 1000
        )}s (${tentative}/${TENTATIVES_MAX_429}).`
      );
      await attendre(Math.min(delaiMs, ATTENTE_429_PLAFOND_MS));
    }
  }
  throw derniereErreur;
}
