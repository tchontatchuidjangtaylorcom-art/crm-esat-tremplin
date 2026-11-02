// Détection des procédures collectives (liquidation / redressement judiciaire)
// via le BODACC (Bulletin officiel des annonces civiles et commerciales),
// publié en open data par la DILA — gratuit, sans clé ni inscription.
//
// Pourquoi en plus de Sirene : une société en liquidation judiciaire reste
// "active" (etat_administratif = "A") dans le répertoire Sirene tant qu'elle
// n'est pas radiée — ce qui peut prendre plus d'un an après le jugement. Le
// BODACC, lui, publie le jugement de liquidation dans les jours qui suivent.

const BASE_URL =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";

function attendre(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lireJugement(brut) {
  if (!brut) return null;
  if (typeof brut === "object") return brut;
  try {
    return JSON.parse(brut);
  } catch {
    return null;
  }
}

// Classe un jugement BODACC selon ce qu'il dit de la survie de l'entreprise.
// null = annonce sans effet sur la situation (dépôt de l'état des créances,
// avis aux créanciers…) : on remonte alors au jugement précédent.
function classerJugement(nature = "") {
  const n = nature.toLowerCase();
  // Plan arrêté / clôture pour extinction du passif / infirmation en appel :
  // l'entreprise poursuit son activité.
  if (/extinction du passif|plan de (redressement|sauvegarde|continuation)|infirm|r[ée]solution du plan/.test(n)) {
    // "Résolution du plan … et prononçant la liquidation" reste une liquidation.
    if (/liquidation/.test(n)) return "liquidation";
    return "poursuite";
  }
  // Ouverture, conversion, extension de liquidation judiciaire, ou clôture
  // pour insuffisance d'actif (fin de la liquidation) : entreprise morte.
  if (/liquidation judiciaire|insuffisance d.actif/.test(n)) return "liquidation";
  if (/redressement judiciaire/.test(n)) return "redressement";
  if (/sauvegarde/.test(n)) return "sauvegarde";
  return null;
}

// Renvoie la situation de l'entreprise au regard des procédures collectives,
// d'après le dernier jugement significatif publié au BODACC :
//   null                                → aucune procédure en cours connue ;
//   { type: "liquidation" | "redressement" | "sauvegarde", nature, dateJugement, dateParution, tribunal, detail }
export async function verifierProcedureCollective(siren) {
  const params = new URLSearchParams({
    where: `registre="${siren}" and familleavis="collective"`,
    order_by: "dateparution desc",
    limit: "20",
    select: "dateparution,tribunal,jugement",
  });

  let reponse;
  for (let tentative = 1; tentative <= 3; tentative++) {
    try {
      reponse = await fetch(`${BASE_URL}?${params.toString()}`, {
        headers: { "User-Agent": "CRM-OETH-AGEFIPH/1.0 (prospection ESAT Tremplin)" },
      });
    } catch {
      const erreur = new Error("Impossible de contacter l'API du BODACC.");
      erreur.code = "BODACC_INDISPONIBLE";
      throw erreur;
    }
    if (reponse.status !== 429 || tentative === 3) break;
    await attendre(2000 * tentative);
  }

  if (!reponse.ok) {
    const erreur = new Error(`L'API du BODACC a répondu une erreur (HTTP ${reponse.status}).`);
    erreur.code = reponse.status === 429 ? "BODACC_SATURE" : "BODACC_INDISPONIBLE";
    throw erreur;
  }

  const donnees = await reponse.json();
  for (const annonce of donnees.results || []) {
    const jugement = lireJugement(annonce.jugement);
    const type = classerJugement(jugement?.nature);
    if (!type) continue;
    if (type === "poursuite") return null;
    return {
      type,
      nature: jugement.nature,
      dateJugement: jugement.date || null,
      dateParution: annonce.dateparution || null,
      tribunal: annonce.tribunal || null,
      detail: jugement.complementJugement || null,
    };
  }
  return null;
}
