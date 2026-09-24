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

// Extrait le premier objet JSON complet contenant "telephone" du texte — par
// comptage d'accolades plutôt qu'une regex à profondeur fixe (qui échouerait
// dès que la réponse groundée par la recherche web contient des accolades
// imbriquées avant le JSON final, ex. citations/notes de l'outil de recherche).
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
  const texte = (corpsReponse.content || [])
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text || "")
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

  let derniereErreur;
  for (let tentative = 1; tentative <= TENTATIVES_MAX_429; tentative++) {
    try {
      return await appelerClaude(entreprise, cle, modele);
    } catch (e) {
      // Seul le 429 (débit dépassé) vaut la peine d'être réessayé : une clé
      // invalide, un modèle inconnu ou un timeout donneront systématiquement
      // la même erreur, autant échouer tout de suite plutôt que de perdre du
      // temps à réessayer 3 fois par fiche.
      if (e.responseCode !== 429 || tentative === TENTATIVES_MAX_429) throw e;
      derniereErreur = e;
      const delaiMs = delaiAttenteConseille(e.reponseHttp) ?? 5000 * tentative;
      console.warn(
        `[ia] 429 Anthropic pour ${entreprise.nom} — nouvelle tentative dans ${Math.round(
          Math.min(delaiMs, ATTENTE_429_PLAFOND_MS) / 1000
        )}s (${tentative}/${TENTATIVES_MAX_429}).`
      );
      await attendre(Math.min(delaiMs, ATTENTE_429_PLAFOND_MS));
    }
  }
  throw derniereErreur;
}
