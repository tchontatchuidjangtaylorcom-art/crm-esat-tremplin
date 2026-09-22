// Classification des secteurs d'activité en grandes catégories, pour adapter
// l'argumentaire de l'agent (embauche directe vs. sous-traitance ESAT/EA).

export const CATEGORIES = {
  service_public: {
    label: "Mairie / Service public",
    motsCles: ["mairie", "commune", "service public", "administration", "collectivité", "département", "région"],
    argumentaire:
      "Employeur public : relève en principe du FIPHFP et non de l'AGEFIPH — vérifier l'assujettissement avant tout argumentaire commercial.",
  },
  restauration: {
    label: "Restauration",
    motsCles: ["restaur", "café", "brasserie", "traiteur", "hôtellerie", "hotel"],
    argumentaire:
      "Postes physiques et horaires contraints : embauche directe difficile → orienter vers la sous-traitance à un ESAT/EA ou un ESAT Tremplin.",
  },
  logistique: {
    label: "Logistique / Transport",
    motsCles: ["logistique", "transport", "entrepôt", "livraison", "manutention"],
    argumentaire:
      "Postes standardisés (préparation, conditionnement) : bon potentiel pour un ESAT Tremplin ou de la mise à disposition de travailleurs handicapés.",
  },
  conseil: {
    label: "Conseil / Gestion",
    motsCles: ["conseil", "gestion", "audit", "affaires", "comptab"],
    argumentaire:
      "Postes tertiaires peu pénibles : l'embauche directe ou l'alternance sont souvent envisageables en priorité.",
  },
  commerce: {
    label: "Commerce",
    motsCles: ["commerce", "vente", "distribution", "négoce", "magasin"],
    argumentaire:
      "Postes d'accueil/caisse : embauche directe possible avec un aménagement de poste raisonnable.",
  },
  industrie: {
    label: "Industrie / Production",
    motsCles: ["industrie", "production", "fabrication", "usine", "métallurgie"],
    argumentaire:
      "Étudier d'abord l'aménagement de poste (RQTH) ; à défaut, la sous-traitance ESAT/EA reste une solution rapide.",
  },
  espaces_verts: {
    label: "Espaces verts / Paysagisme",
    motsCles: ["paysag", "espaces verts", "jardin", "horticulture"],
    argumentaire:
      "Secteur historiquement partenaire des ESAT Espaces Verts : la sous-traitance y est souvent bien accueillie.",
  },
  fourniture_bureau: {
    label: "Fournitures & équipement de bureau",
    motsCles: ["bureau", "fourniture", "bureautique", "papeterie"],
    argumentaire:
      "Activité tertiaire légère : l'embauche directe ou le recours à un ESAT pour des prestations (numérisation, façonnage) fonctionnent bien.",
  },
};

const CATEGORIE_PAR_DEFAUT = {
  label: "Autre",
  argumentaire: "Secteur non classifié : analyser le poste au cas par cas avec le client.",
};

// `secteurPublic` (booléen, déterminé de façon fiable à partir de la nature
// juridique INSEE lors de l'enrichissement par SIREN) prime sur la détection
// par mots-clés : une administration reste "service public" même si son
// libellé d'activité ne contient aucun des mots-clés ci-dessus.
export function classifierSecteur(secteurActivite, { secteurPublic } = {}) {
  if (secteurPublic) {
    const c = CATEGORIES.service_public;
    return { cle: "service_public", label: c.label, argumentaire: c.argumentaire };
  }
  const texte = (secteurActivite || "").toLowerCase();
  for (const [cle, categorie] of Object.entries(CATEGORIES)) {
    if (categorie.motsCles.some((mot) => texte.includes(mot))) {
      return { cle, label: categorie.label, argumentaire: categorie.argumentaire };
    }
  }
  return { cle: "autre", ...CATEGORIE_PAR_DEFAUT };
}

// Organisme collecteur de l'obligation d'emploi : AGEFIPH pour le privé,
// FIPHFP pour le public. Utilise le champ `secteurPublic` (fiable, dérivé de
// la nature juridique INSEE) quand il est renseigné ; à défaut (fiches
// historiques créées avant l'enrichissement par SIREN), repli sur la
// classification par mots-clés du secteur d'activité.
export function determinerCollecteur(entreprise) {
  const secteurPublic =
    typeof entreprise.secteurPublic === "boolean"
      ? entreprise.secteurPublic
      : classifierSecteur(entreprise.secteurActivite).cle === "service_public";
  return secteurPublic ? "FIPHFP" : "AGEFIPH";
}

export function listerCategories() {
  return [
    ...Object.entries(CATEGORIES).map(([cle, c]) => ({ value: cle, label: c.label })),
    { value: "autre", label: CATEGORIE_PAR_DEFAUT.label },
  ];
}
