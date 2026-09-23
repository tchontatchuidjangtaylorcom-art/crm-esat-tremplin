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
// temps (générations 1.5 / 2.0 / 2.5 / ultérieures) — vérifiez le nom exact
// disponible pour votre clé sur https://aistudio.google.com/ et ajustez
// GEMINI_MODEL si besoin. Valeur par défaut : un modèle "Flash" (rapide, bon
// marché) de la génération la plus récente connue au moment de l'écriture.
const MODELE_PAR_DEFAUT = "gemini-2.5-flash";
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 20000;

function cleApi() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
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

function extraireResultat(corpsReponse) {
  const texte = (corpsReponse.candidates || [])
    .flatMap((candidat) => candidat.content?.parts || [])
    .map((partie) => partie.text || "")
    .join("\n");

  const correspondance = texte.match(/\{[^{}]*"telephone"[^{}]*\}/s);
  if (!correspondance) {
    const erreur = new Error("Réponse de l'IA illisible (pas de JSON de résultat trouvé).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = texte.slice(0, 500);
    throw erreur;
  }

  let resultat;
  try {
    resultat = JSON.parse(correspondance[0]);
  } catch {
    const erreur = new Error("Réponse de l'IA illisible (JSON invalide).");
    erreur.code = "REPONSE_IA_INVALIDE";
    erreur.response = correspondance[0];
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

export async function rechercherContactAlternatif(entreprise) {
  const cle = cleApi();
  if (!cle) {
    const erreur = new Error("Recherche IA non configurée (renseignez GEMINI_API_KEY).");
    erreur.code = "IA_NON_CONFIGUREE";
    throw erreur;
  }

  const modele = process.env.GEMINI_MODEL || MODELE_PAR_DEFAUT;
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
    throw erreur;
  }

  return extraireResultat(corps);
}
