// Intégration avec l'API publique "Recherche d'entreprises" (recherche-entreprises.api.gouv.fr),
// qui agrège le répertoire Sirene de l'INSEE. Gratuite, sans clé ni inscription —
// c'est la seule source utilisée pour l'enrichissement automatique par SIREN
// (pas d'accès Pappers payant pour le téléphone/email : à compléter manuellement).

const BASE_URL = "https://recherche-entreprises.api.gouv.fr/search";

// Limite documentée par l'API : 7 requêtes/seconde par IP, 30/seconde par
// ASN (partagé entre TOUS les hébergés du même fournisseur cloud — donc un
// 429 peut survenir même à faible volume si d'autres services sur le même
// ASN Render sollicitent l'API au même moment, indépendamment de notre
// propre débit). Cette API publique et gratuite ne propose aucune clé
// d'authentification (aucun paramètre de ce type dans sa spec OpenAPI) :
// impossible d'obtenir un quota dédié ici. La seule vraie parade est de
// respecter un débit prudent ET de réessayer intelligemment en cas de 429,
// en respectant l'en-tête Retry-After renvoyé par le serveur.
const DELAI_ENTRE_APPELS_MS = 300;
const TENTATIVES_MAX_429 = 3;
const ATTENTE_429_PLAFOND_MS = 10_000;

function attendre(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch avec retry/backoff dédié aux 429 (Too Many Requests) de l'API
// publique Sirene : relit l'en-tête Retry-After (secondes, ou date HTTP)
// pour attendre exactement ce que le serveur demande plutôt qu'un délai
// arbitraire, avec un plafond de sécurité et un nombre de tentatives limité.
async function fetchAvecRetry(url) {
  for (let tentative = 1; tentative <= TENTATIVES_MAX_429; tentative++) {
    let reponse;
    try {
      reponse = await fetch(url, {
        headers: { "User-Agent": "CRM-OETH-AGEFIPH/1.0 (prospection ESAT Tremplin)" },
      });
    } catch {
      const erreur = new Error(
        "Impossible de contacter l'API publique Sirene (INSEE). Vérifiez la connexion et réessayez."
      );
      erreur.code = "INSEE_INDISPONIBLE";
      throw erreur;
    }

    if (reponse.status !== 429) return reponse;

    if (tentative === TENTATIVES_MAX_429) return reponse; // on laisse l'appelant gérer l'échec final

    const enTete = reponse.headers.get("retry-after");
    let delaiMs = 2000 * tentative; // repli si l'en-tête est absent/illisible
    if (enTete) {
      const secondes = Number(enTete);
      if (!Number.isNaN(secondes)) {
        delaiMs = secondes * 1000;
      } else {
        const date = Date.parse(enTete);
        if (!Number.isNaN(date)) delaiMs = Math.max(0, date - Date.now());
      }
    }
    await attendre(Math.min(delaiMs, ATTENTE_429_PLAFOND_MS));
  }
}

// Tranches d'effectifs Sirene (code INSEE -> libellé + effectif indicatif).
// L'INSEE ne donne qu'une fourchette : on prend un point médian pour amorcer
// le calcul OETH, à confirmer/affiner par l'agent au téléphone — exactement
// comme pour toute donnée saisie manuellement dans la fiche.
const TRANCHES_EFFECTIF = {
  NN: { label: "Unité non employeuse ou non renseignée", effectifEstime: 0 },
  "00": { label: "0 salarié", effectifEstime: 0 },
  "01": { label: "1 à 2 salariés", effectifEstime: 1 },
  "02": { label: "3 à 5 salariés", effectifEstime: 4 },
  "03": { label: "6 à 9 salariés", effectifEstime: 7 },
  "11": { label: "10 à 19 salariés", effectifEstime: 15 },
  "12": { label: "20 à 49 salariés", effectifEstime: 35 },
  "21": { label: "50 à 99 salariés", effectifEstime: 75 },
  "22": { label: "100 à 199 salariés", effectifEstime: 150 },
  "31": { label: "200 à 249 salariés", effectifEstime: 225 },
  "32": { label: "250 à 499 salariés", effectifEstime: 375 },
  "41": { label: "500 à 999 salariés", effectifEstime: 750 },
  "42": { label: "1 000 à 1 999 salariés", effectifEstime: 1500 },
  "51": { label: "2 000 à 4 999 salariés", effectifEstime: 3500 },
  "52": { label: "5 000 à 9 999 salariés", effectifEstime: 7500 },
  "53": { label: "10 000 salariés et plus", effectifEstime: 10000 },
};

// Sections NAF (21 grandes divisions) : sert à donner un libellé lisible au
// secteur d'activité, l'API ne renvoyant que le code (ex: "70.10Z") sans son
// intitulé complet.
const SECTIONS_NAF = {
  A: "Agriculture, sylviculture et pêche",
  B: "Industries extractives",
  C: "Industrie manufacturière",
  D: "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné",
  E: "Production et distribution d'eau ; assainissement, gestion des déchets",
  F: "Construction",
  G: "Commerce ; réparation d'automobiles et de motocycles",
  H: "Transports et entreposage",
  I: "Hébergement et restauration",
  J: "Information et communication",
  K: "Activités financières et d'assurance",
  L: "Activités immobilières",
  M: "Activités spécialisées, scientifiques et techniques",
  N: "Activités de services administratifs et de soutien",
  O: "Administration publique",
  P: "Enseignement",
  Q: "Santé humaine et action sociale",
  R: "Arts, spectacles et activités récréatives",
  S: "Autres activités de services",
  T: "Activités des ménages en tant qu'employeurs",
  U: "Activités extra-territoriales",
};

// Sous-ensemble des codes "nature juridique" INSEE les plus courants en
// prospection B2B. Non exhaustif (~100 codes existent) : à défaut de
// correspondance, on affiche le code brut plutôt que d'inventer un libellé.
const FORMES_JURIDIQUES = {
  1000: "Entrepreneur individuel",
  5202: "Société en nom collectif (SNC)",
  5306: "Société en commandite simple",
  5410: "SA à conseil d'administration",
  5415: "SA à directoire",
  5498: "SA, autre forme",
  5499: "SA, forme exercice non déterminée",
  5510: "Société en commandite par actions",
  5610: "SARL",
  5620: "SARL unipersonnelle (EURL)",
  5710: "SAS",
  5720: "SASU",
  6220: "Groupement d'intérêt économique (GIE)",
  7210: "Commune / commune nouvelle",
  7220: "Département",
  7225: "Région",
  7328: "Établissement public communal",
  7330: "Établissement public départemental",
  7340: "Établissement public régional",
  7361: "Centre communal d'action sociale (CCAS)",
  7364: "Établissement public local d'enseignement",
  9220: "Association déclarée",
  9221: "Association déclarée d'utilité publique",
  9300: "Fondation",
};

function trancheEffectif(code) {
  return TRANCHES_EFFECTIF[code] || { label: "Non renseigné", effectifEstime: 0 };
}

// Bornes hautes (division NAF à 2 chiffres) de chaque section, dans l'ordre :
// l'API ne renvoie que le code détaillé (ex: "70.10Z"), jamais l'intitulé de
// la section — on le retrouve à partir de la division (les deux premiers
// chiffres) selon la nomenclature NAF Rev. 2.
const BORNES_SECTIONS_NAF = [
  [3, "A"], [9, "B"], [33, "C"], [35, "D"], [39, "E"], [43, "F"], [47, "G"],
  [53, "H"], [56, "I"], [63, "J"], [66, "K"], [68, "L"], [75, "M"], [82, "N"],
  [84, "O"], [85, "P"], [88, "Q"], [93, "R"], [96, "S"], [98, "T"], [99, "U"],
];

function libelleSecteurActivite(codeNaf) {
  if (!codeNaf) return "-";
  const division = parseInt(codeNaf, 10);
  const entree = BORNES_SECTIONS_NAF.find(([max]) => division <= max);
  const libelleSection = entree ? SECTIONS_NAF[entree[1]] : null;
  return libelleSection ? `${libelleSection} (NAF ${codeNaf})` : `NAF ${codeNaf}`;
}

function libelleFormeJuridique(code) {
  if (!code) return "-";
  return FORMES_JURIDIQUES[code] || `Forme juridique (code ${code})`;
}

// Validation du format SIREN : 9 chiffres + clé de Luhn (même algorithme que
// pour un SIRET, appliqué ici sur les 9 chiffres de l'identifiant entreprise).
export function estSirenValide(siren) {
  if (!/^\d{9}$/.test(siren)) return false;
  let somme = 0;
  for (let i = 0; i < 9; i++) {
    let chiffre = Number(siren[i]);
    if (i % 2 === 1) {
      chiffre *= 2;
      if (chiffre > 9) chiffre -= 9;
    }
    somme += chiffre;
  }
  return somme % 10 === 0;
}

function construireAdresse(siege = {}) {
  const rue = [siege.numero_voie, siege.indice_repetition, siege.type_voie, siege.libelle_voie, siege.complement_adresse]
    .filter(Boolean)
    .join(" ")
    .trim();
  return rue || siege.adresse || "-";
}

// Normalise un résultat brut de l'API "Recherche d'entreprises" vers les
// champs utilisés par la fiche entreprise du CRM — partagé par la recherche
// unitaire (par SIREN) et la recherche multi-résultats (par secteur).
function normaliserResultat(r) {
  const siege = r.siege || {};
  const tranche = trancheEffectif(r.tranche_effectif_salarie);
  // Signal fort si présent (`est_administration`), sinon repli sur le préfixe
  // "7" de la catégorie juridique (nomenclature INSEE des personnes morales
  // de droit public administratif).
  const secteurPublic = r.complements?.est_administration === true || /^7/.test(r.nature_juridique || "");
  const actif = (r.etat_administratif || "A") === "A";

  return {
    siren: r.siren,
    siret: siege.siret || `${r.siren}00000`,
    nom: r.nom_complet,
    adresse: construireAdresse(siege),
    codePostal: siege.code_postal || "",
    ville: siege.libelle_commune || "",
    secteurActivite: libelleSecteurActivite(r.activite_principale),
    formeJuridique: libelleFormeJuridique(r.nature_juridique),
    trancheEffectifLabel: tranche.label,
    effectifEstime: tranche.effectifEstime,
    secteurPublic,
    actif,
    dateFermeture: r.date_fermeture || null,
  };
}

// Interroge l'API publique "Recherche d'entreprises" et normalise la réponse
// vers les champs utilisés par la fiche entreprise du CRM.
export async function rechercherEntrepriseParSiren(siren) {
  const url = `${BASE_URL}?q=${siren}&page=1&per_page=1`;
  const reponse = await fetchAvecRetry(url);

  if (!reponse.ok) {
    const erreur = new Error(
      reponse.status === 429
        ? "L'API publique Sirene (INSEE) est momentanément saturée (limite de débit partagée avec d'autres utilisateurs de l'hébergeur) — réessayez dans quelques instants."
        : `L'API Sirene a répondu une erreur (HTTP ${reponse.status}).`
    );
    erreur.code = "INSEE_INDISPONIBLE";
    throw erreur;
  }

  const donnees = await reponse.json();
  const r = donnees.results?.[0];
  // L'API renvoie parfois une entrée "coquille vide" (tous les champs à null)
  // pour un SIREN syntaxiquement valide mais absent du répertoire.
  if (!r || !r.nom_complet) {
    const erreur = new Error(`Aucune entreprise trouvée pour le SIREN ${siren} dans le répertoire Sirene.`);
    erreur.code = "SIREN_INTROUVABLE";
    throw erreur;
  }

  return normaliserResultat(r);
}

// Recherche multi-résultats par secteur — sert la génération de vagues de
// prospects par catégorie : de VRAIES entreprises du répertoire Sirene,
// jamais une liste inventée par un modèle de langage (voir la note dans
// index.js sur ce choix). Filtre PRÉCISÉMENT par code NAF (`nafCodes`) ou,
// pour le service public, par le indicateur `est_administration` — une
// recherche en texte libre sur des mots-clés a été testée et écartée : une
// requête "construction bâtiment btp" remonte par exemple une compagnie
// d'ASSURANCE du BTP (le nom matche, l'activité n'a rien à voir). `nafCodes`
// et `estAdministration` viennent de CATEGORIES (secteurs.js) ; `departement`
// (code INSEE à 2-3 chiffres) est optionnel — NB: l'API le documente comme un
// filtre sur les établissements (une grande entreprise ayant une agence dans
// ce département matchera même si son siège est ailleurs), donc un grand
// groupe national peut apparaître même en filtrant sur un département donné.
// Pagine jusqu'à `limite` résultats (25 par page, taille max acceptée par
// l'API publique).
export async function rechercherEntreprisesParSecteur(
  { nafCodes, estAdministration } = {},
  { departement, limite = 100 } = {}
) {
  const parPage = 25;
  const resultats = [];
  let page = 1;

  while (resultats.length < limite) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(Math.min(parPage, limite - resultats.length)),
      etat_administratif: "A",
    });
    if (estAdministration) {
      params.set("est_administration", "true");
    } else if (nafCodes?.length) {
      params.set("activite_principale", nafCodes.join(","));
    }
    if (departement) params.set("departement", departement);

    const reponse = await fetchAvecRetry(`${BASE_URL}?${params.toString()}`);
    if (!reponse.ok) {
      const erreur = new Error(
        reponse.status === 429
          ? "L'API publique Sirene (INSEE) est momentanément saturée (limite de débit partagée avec d'autres utilisateurs de l'hébergeur) — réessayez dans quelques instants, ou avec une quantité plus faible."
          : `L'API Sirene a répondu une erreur (HTTP ${reponse.status}).`
      );
      erreur.code = "INSEE_INDISPONIBLE";
      throw erreur;
    }

    const donnees = await reponse.json();
    const lot = (donnees.results || []).filter((r) => r.nom_complet);
    if (lot.length === 0) break;

    for (const r of lot) {
      resultats.push(normaliserResultat(r));
      if (resultats.length >= limite) break;
    }

    if (lot.length < parPage) break; // dernière page atteinte
    page += 1;
    // Pause entre deux pages, en plus du retry/backoff sur 429 ci-dessus.
    await attendre(DELAI_ENTRE_APPELS_MS);
  }

  return resultats;
}
