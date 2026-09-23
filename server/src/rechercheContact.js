// Recherche IA d'un contact/téléphone alternatif via l'API Anthropic (Claude)
// et son outil de recherche web intégré — déclenchée depuis une fiche
// entreprise quand l'agent signale un numéro invalide/non attribué (voir
// EntrepriseDetail.jsx, section "Espace IA — Contact alternatif").
//
// Fonctionnalité optionnelle : nécessite ANTHROPIC_API_KEY (clé payante,
// facturée à l'usage par Anthropic). Sans base de téléphonie payante dédiée
// (Pappers Pro, Societe.com Pro...), la recherche web via un modèle reste la
// seule source disponible ici — le résultat est une PROPOSITION à valider
// par l'agent (pré-remplit le champ existant, jamais appliqué automatiquement) :
// un numéro halluciné ou périmé utilisé pour un vrai appel commercial serait
// pire que l'absence de numéro.
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = Number(process.env.ANTHROPIC_TIMEOUT_MS) || 20000;

export function estRechercheIaConfiguree() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function detailErreur(e) {
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

  return (
    `Tu aides un télé-prospecteur français à retrouver un numéro de téléphone professionnel à jour et, si possible, un contact officiel (nom + fonction) pour cette entreprise : ${identite}.\n` +
    `Le numéro actuellement enregistré (${entreprise.contact?.telephone || "aucun"}) est invalide ou non attribué.\n` +
    `Cherche sur le web (site officiel de l'entreprise, PagesJaunes, Societe.com, Verif.com, Infogreffe, LinkedIn) un numéro de standard ou un contact plus fiable.\n` +
    `Termine IMPÉRATIVEMENT ta réponse par une seule ligne contenant uniquement un objet JSON strict, sans texte autour, exactement au format :\n` +
    `{"telephone": "<numéro ou null>", "contact": "<nom et fonction ou null>", "source": "<url ou null>", "confiance": "haute|moyenne|faible"}\n` +
    `Si tu ne trouves rien de fiable, mets telephone à null plutôt que d'inventer un numéro — une mauvaise info est pire qu'aucune info ici.`
  );
}

function extraireResultat(corpsReponse) {
  const texte = (corpsReponse.content || [])
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text)
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
  return {
    telephone: nettoie(resultat.telephone),
    contact: nettoie(resultat.contact),
    source: nettoie(resultat.source),
    confiance: resultat.confiance || "faible",
  };
}

export async function rechercherContactAlternatif(entreprise) {
  if (!estRechercheIaConfiguree()) {
    const erreur = new Error("Recherche IA non configurée (renseignez ANTHROPIC_API_KEY).");
    erreur.code = "IA_NON_CONFIGUREE";
    throw erreur;
  }

  const controleur = new AbortController();
  const idAbort = setTimeout(() => controleur.abort(), TIMEOUT_MS);
  let reponse;
  try {
    reponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
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
    const erreur = new Error(corps.error?.message || `L'API Anthropic a répondu ${reponse.status}.`);
    erreur.code = corps.error?.type || `HTTP_${reponse.status}`;
    erreur.responseCode = reponse.status;
    erreur.response = JSON.stringify(corps).slice(0, 500);
    throw erreur;
  }

  return extraireResultat(corps);
}

export { detailErreur };
