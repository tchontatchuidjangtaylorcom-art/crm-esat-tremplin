// Classification des secteurs d'activité en grandes catégories, pour adapter
// l'argumentaire de l'agent (embauche directe vs. sous-traitance ESAT/EA).

// `nafCodes` : codes NAF Rev.2 représentatifs de chaque catégorie, utilisés
// pour la génération de vagues de prospects par secteur (voir index.js,
// /api/leads/secteur/rechercher) via le filtre `activite_principale` de
// l'API publique Sirene. Volontairement PRÉCIS (codes NAF) plutôt qu'une
// recherche plein texte sur les mots-clés ci-dessous : un test réel a montré
// qu'une requête textuelle "construction bâtiment btp" remonte par exemple
// une compagnie d'ASSURANCE du BTP (le nom contient les mots, l'activité
// n'a rien à voir) — le NAF est la seule façon fiable de cibler une vraie
// activité. Liste non exhaustive (le NAF Rev.2 compte ~700 codes) : à
// affiner si la vague ramène trop peu ou de mauvais résultats.
export const CATEGORIES = {
  service_public: {
    label: "Mairie / Service public",
    motsCles: ["mairie", "commune", "service public", "administration", "collectivité", "département", "région"],
    // Pas de NAF pertinent ici : filtré via est_administration=true (voir index.js).
    estAdministration: true,
    argumentaire:
      "Employeur public : relève en principe du FIPHFP et non de l'AGEFIPH — vérifier l'assujettissement avant tout argumentaire commercial.",
  },
  restauration: {
    label: "Restauration",
    motsCles: ["restaur", "café", "brasserie", "traiteur", "hôtellerie", "hotel"],
    nafCodes: ["56.10A", "56.10B", "56.10C", "56.30Z", "55.10Z"],
    argumentaire:
      "Postes physiques et horaires contraints : embauche directe difficile → orienter vers la sous-traitance à un ESAT/EA ou un ESAT Tremplin.",
  },
  logistique: {
    label: "Logistique / Transport",
    motsCles: ["logistique", "transport", "entrepôt", "livraison", "manutention"],
    nafCodes: ["49.41A", "49.41B", "52.10A", "52.10B"],
    argumentaire:
      "Postes standardisés (préparation, conditionnement) : bon potentiel pour un ESAT Tremplin ou de la mise à disposition de travailleurs handicapés.",
  },
  conseil: {
    label: "Conseil / Gestion",
    motsCles: ["conseil", "gestion", "audit", "affaires", "comptab"],
    nafCodes: ["70.22Z", "69.20Z"],
    argumentaire:
      "Postes tertiaires peu pénibles : l'embauche directe ou l'alternance sont souvent envisageables en priorité.",
  },
  commerce: {
    label: "Commerce",
    motsCles: ["commerce", "vente", "distribution", "négoce", "magasin"],
    nafCodes: ["47.19B", "46.90Z"],
    argumentaire:
      "Postes d'accueil/caisse : embauche directe possible avec un aménagement de poste raisonnable.",
  },
  industrie: {
    label: "Industrie / Production",
    motsCles: ["industrie", "production", "fabrication", "usine", "métallurgie"],
    nafCodes: ["25.11Z", "28.99Z"],
    argumentaire:
      "Étudier d'abord l'aménagement de poste (RQTH) ; à défaut, la sous-traitance ESAT/EA reste une solution rapide.",
  },
  espaces_verts: {
    label: "Espaces verts / Paysagisme",
    motsCles: ["paysag", "espaces verts", "jardin", "horticulture"],
    nafCodes: ["81.30Z"],
    argumentaire:
      "Secteur historiquement partenaire des ESAT Espaces Verts : la sous-traitance y est souvent bien accueillie.",
  },
  fourniture_bureau: {
    label: "Fournitures & équipement de bureau",
    motsCles: ["bureau", "fourniture", "bureautique", "papeterie"],
    nafCodes: ["46.66Z", "47.62Z"],
    argumentaire:
      "Activité tertiaire légère : l'embauche directe ou le recours à un ESAT pour des prestations (numérisation, façonnage) fonctionnent bien.",
  },
  construction: {
    label: "Construction",
    motsCles: ["construction", "bâtiment", "btp", "travaux", "maçonnerie", "gros œuvre", "second œuvre", "chantier"],
    nafCodes: ["41.20A", "41.20B", "43.99C", "43.99D"],
    argumentaire:
      "Postes de chantier physiquement exigeants et soumis à des normes de sécurité strictes : embauche directe souvent limitée aux postes support (administratif, logistique de chantier) → la sous-traitance à un ESAT/EA (nettoyage, conditionnement, espaces verts annexes) reste la solution la plus rapide.",
  },
  securite: {
    label: "Sécurité",
    motsCles: ["sécurité", "surveillance", "gardiennage", "sûreté", "vigile", "télésurveillance"],
    nafCodes: ["80.10Z", "80.20Z", "80.30Z"],
    argumentaire:
      "Les postes de terrain (agent de sécurité, rondier) exigent souvent des certifications physiques (SSIAP, carte professionnelle) limitant l'embauche directe pour certains handicaps ; les postes de télésurveillance/PC sécurité ou le recours à un ESAT pour des prestations annexes (accueil, contrôle d'accès) sont à privilégier.",
  },
};

const CATEGORIE_PAR_DEFAUT = {
  label: "Autre",
  argumentaire: "Secteur non classifié : analyser le poste au cas par cas avec le client.",
};

// `categorieForcee` (clé choisie explicitement — par un agent ou une
// proposition IA validée manuellement, voir rechercheContact.js) prime sur
// tout le reste : c'est une affectation délibérée, elle ne doit pas être
// re-devinée à partir du texte. `secteurPublic` (booléen, déterminé de façon
// fiable à partir de la nature juridique INSEE lors de l'enrichissement par
// SIREN) prime ensuite sur la détection par mots-clés : une administration
// reste "service public" même si son libellé d'activité ne contient aucun
// des mots-clés ci-dessous.
export function classifierSecteur(secteurActivite, { secteurPublic, categorieForcee } = {}) {
  if (categorieForcee && CATEGORIES[categorieForcee]) {
    const c = CATEGORIES[categorieForcee];
    return { cle: categorieForcee, label: c.label, argumentaire: c.argumentaire };
  }
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
