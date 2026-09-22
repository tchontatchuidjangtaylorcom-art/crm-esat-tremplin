// Moteur de calcul de l'obligation d'emploi des travailleurs handicapés (OETH).
// Toute la logique métier vit ici, côté serveur, pour rester la seule source
// de vérité : le frontend affiche simplement le résultat renvoyé par l'API.

export const SEUIL_ASSUJETTISSEMENT = 20; // effectif à partir duquel l'OETH s'applique
export const TAUX_LEGAL = 0.06; // règle des 6 %
export const SMIC_HORAIRE_BRUT = 12.31; // € — à mettre à jour chaque revalorisation du SMIC
export const DUREE_NEUTRALISATION_ANNEES = 5; // délai légal de neutralisation pour une entreprise nouvellement créée

// Coefficient (nombre de SMIC horaires par unité manquante) selon la taille de
// l'entreprise, hors situation de "zéro recrutement".
const TRANCHES_COEFFICIENT = [
  { max: 199, coefficient: 400, label: "20-199" },
  { max: 749, coefficient: 500, label: "200-749" },
  { max: Infinity, coefficient: 600, label: "750+" },
];

// Coefficient de surcontribution appliqué lorsqu'aucun travailleur handicapé
// n'a été recruté (proxy simplifié de la règle des employeurs n'ayant engagé
// aucune action en faveur de l'emploi des personnes handicapées).
const COEFFICIENT_SURCONTRIBUTION = 1500;

export function calculerUnitesRequises(effectif) {
  if (!Number.isFinite(effectif) || effectif < SEUIL_ASSUJETTISSEMENT) return 0;
  return Math.max(1, Math.floor(effectif * TAUX_LEGAL));
}

function trancheEffectif(effectif) {
  return TRANCHES_COEFFICIENT.find((t) => effectif <= t.max) || TRANCHES_COEFFICIENT[TRANCHES_COEFFICIENT.length - 1];
}

// Ancienneté et éligibilité à la neutralisation légale (les entreprises de
// moins de 5 ans ne sont pas redevables de l'OETH). L'ancienneté se calcule
// en années pleines par rapport à l'année en cours, comme demandé par le
// service commercial (comparaison "année de création" vs "année actuelle").
export function calculerNeutralisation(dateCreation, maintenant = new Date()) {
  const creation = dateCreation ? new Date(dateCreation) : null;
  if (!creation || Number.isNaN(creation.getTime())) {
    return {
      dateCreation: null,
      ancienneteAnnees: null,
      statut: "inconnue",
      neutralise: false,
      alerteAnticipation: false,
    };
  }

  const ancienneteAnnees = maintenant.getFullYear() - creation.getFullYear();
  const neutralise = ancienneteAnnees < DUREE_NEUTRALISATION_ANNEES;
  const alerteAnticipation = ancienneteAnnees === DUREE_NEUTRALISATION_ANNEES - 1; // "An 4" : dernière année avant assujettissement

  return {
    dateCreation: creation.toISOString().slice(0, 10),
    ancienneteAnnees,
    statut: neutralise ? (alerteAnticipation ? "alerte_an4" : "neutralise") : "assujettissable",
    neutralise,
    alerteAnticipation,
  };
}

// Calcule l'obligation OETH hors neutralisation, à partir du seul effectif.
function calculerObligationBrute(effectif, effectifBeneficiaire) {
  const assujetti = Number.isFinite(effectif) && effectif >= SEUIL_ASSUJETTISSEMENT;
  const beneficiairesRecrutes = Math.max(0, Number(effectifBeneficiaire) || 0);
  const unitesRequises = calculerUnitesRequises(effectif);
  const deficit = assujetti ? Math.max(0, unitesRequises - beneficiairesRecrutes) : 0;
  const conforme = assujetti && deficit === 0;
  const surcontribution = assujetti && unitesRequises > 0 && beneficiairesRecrutes === 0;

  let coefficient = null;
  let tranche = null;
  if (assujetti && deficit > 0) {
    if (surcontribution) {
      coefficient = COEFFICIENT_SURCONTRIBUTION;
    } else {
      const t = trancheEffectif(effectif);
      coefficient = t.coefficient;
      tranche = t.label;
    }
  }

  const montantEstime = coefficient ? Math.round(deficit * coefficient * SMIC_HORAIRE_BRUT) : 0;

  return {
    seuilAssujettissement: SEUIL_ASSUJETTISSEMENT,
    assujetti,
    unitesRequises,
    beneficiairesRecrutes,
    deficit,
    conforme,
    surcontribution,
    tranche,
    coefficient,
    tauxHoraireSmic: SMIC_HORAIRE_BRUT,
    montantEstime,
  };
}

// Calcule l'ensemble des indicateurs OETH pour une entreprise donnée.
// `effectif` : effectif total assujetti. `effectifBeneficiaire` : nombre de
// travailleurs handicapés déjà employés en interne (saisi dans la fiche).
// `dateCreation` : date de création de l'entreprise, pour appliquer la
// neutralisation légale des 5 ans le cas échéant.
export function calculerObligationOeth({ effectif = 0, effectifBeneficiaire = 0, dateCreation = null } = {}) {
  const neutralisation = calculerNeutralisation(dateCreation);
  const brut = calculerObligationBrute(effectif, effectifBeneficiaire);

  if (!neutralisation.neutralise) {
    return { ...brut, neutralisation, projectionSiAssujetti: null };
  }

  // Neutralisée : aucune obligation ni taxe, quel que soit l'effectif. On
  // conserve toutefois le calcul "brut" en projection, pour permettre à
  // l'agent d'anticiper le montant dû une fois la neutralisation levée
  // (utile dès l'An 4 pour l'argumentaire ESAT Tremplin).
  return {
    ...brut,
    assujetti: false,
    unitesRequises: 0,
    deficit: 0,
    conforme: true,
    surcontribution: false,
    coefficient: null,
    tranche: null,
    montantEstime: 0,
    neutralisation,
    projectionSiAssujetti: brut,
  };
}
