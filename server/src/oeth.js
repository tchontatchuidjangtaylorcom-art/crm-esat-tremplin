// Moteur de calcul de l'obligation d'emploi des travailleurs handicapés (OETH).
// Toute la logique métier vit ici, côté serveur, pour rester la seule source
// de vérité : le frontend affiche simplement le résultat renvoyé par l'API.

export const SEUIL_ASSUJETTISSEMENT = 20; // effectif à partir duquel l'OETH s'applique
export const TAUX_LEGAL = 0.06; // règle des 6 %
export const SMIC_HORAIRE_BRUT = 12.31; // € — à mettre à jour chaque revalorisation du SMIC
export const DUREE_NEUTRALISATION_ANNEES = 5; // délai légal de neutralisation pour une entreprise nouvellement créée

// Coefficient (nombre de SMIC horaires par unité manquante) selon la taille de
// l'entreprise, hors situation de "zéro recrutement". Seuils de droit commun
// depuis la réforme 2020 (art. D5212-20 ; fiche Agefiph n°6) : 20 à moins de
// 250, 250 à moins de 750, 750 et plus — l'ancien seuil de 200 n'existe plus.
const TRANCHES_COEFFICIENT = [
  { max: 249, coefficient: 400, label: "20-249" },
  { max: 749, coefficient: 500, label: "250-749" },
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

// --- Simulateur public (vitrine) -------------------------------------------
// Calcul complet de la contribution annuelle, déductions comprises, selon les
// règles de droit commun (fiche Agefiph n°6, réforme 2020) :
//  - quota = arrondi inférieur de 6 % de l'effectif d'assujettissement ;
//  - contribution brute = unités manquantes × coefficient × SMIC horaire ;
//  - surcontribution (1 500 × SMIC) si, sur les 4 dernières années, aucun
//    bénéficiaire employé ET sous-traitance EA/ESAT/TIH < 600 × SMIC ;
//  - déduction sous-traitance = 30 % du coût de main-d'œuvre HT, plafonnée à
//    50 % de la contribution brute (75 % si taux d'emploi ≥ 3 %) ;
//  - dépenses déductibles plafonnées à 10 % de la contribution brute ;
//  - ECAP : 17 × SMIC par salarié relevant d'un emploi exigeant des
//    conditions d'aptitude particulières.
const TAUX_DEDUCTION_SOUS_TRAITANCE = 0.3;
const PLAFOND_SOUS_TRAITANCE_BAS = 0.5;
const PLAFOND_SOUS_TRAITANCE_HAUT = 0.75;
const SEUIL_TAUX_EMPLOI_PLAFOND_HAUT = 3; // %
const PLAFOND_DEPENSES_DEDUCTIBLES = 0.1;
const COEFFICIENT_ECAP = 17;
const SEUIL_SOUS_TRAITANCE_SMIC = 600;

const arrondi2 = (n) => Math.round(n * 100) / 100;
const positif = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function simulerContributionOeth({
  effectif,
  boeth = 0,
  coutMainOeuvreSousTraitance = 0,
  nbEcap = 0,
  depensesDeductibles = 0,
  aEmployeBoeth4Ans = null,
  sousTraitance4Ans = null,
  montantSousTraitance4Ans = 0,
  accordAgree = null,
  smicHoraire = SMIC_HORAIRE_BRUT,
} = {}) {
  const eff = positif(effectif);
  const beneficiaires = positif(boeth);
  const coutST = positif(coutMainOeuvreSousTraitance);
  const ecap = Math.floor(positif(nbEcap));
  const depenses = positif(depensesDeductibles);

  const assujetti = eff >= SEUIL_ASSUJETTISSEMENT;
  const quota = assujetti ? Math.floor(eff * TAUX_LEGAL) : 0;
  const manque = assujetti ? Math.max(0, arrondi2(quota - beneficiaires)) : 0;
  const tauxEmploi = eff > 0 ? arrondi2((beneficiaires / eff) * 100) : 0;
  const tranche = assujetti ? trancheEffectif(eff) : null;

  const seuilSousTraitanceMin = arrondi2(SEUIL_SOUS_TRAITANCE_SMIC * smicHoraire);
  // Sous-traitance cumulée sur la période : "Oui" suffit si aucun montant
  // n'est précisé ; un montant saisi doit atteindre le seuil de 600 × SMIC.
  const montantST4Ans = positif(montantSousTraitance4Ans);
  const sousTraitance4AnsSuffisante =
    sousTraitance4Ans === true && (montantST4Ans === 0 || montantST4Ans >= seuilSousTraitanceMin);
  const actionMinimale =
    beneficiaires > 0 ||
    aEmployeBoeth4Ans === true ||
    coutST >= seuilSousTraitanceMin ||
    sousTraitance4AnsSuffisante ||
    accordAgree === true;
  const surcontribution = assujetti && manque > 0 && !actionMinimale;

  const coefficient = manque > 0 ? (surcontribution ? COEFFICIENT_SURCONTRIBUTION : tranche.coefficient) : null;
  const contributionBrute = coefficient ? arrondi2(manque * coefficient * smicHoraire) : 0;
  const baseMaximale = arrondi2(manque * COEFFICIENT_SURCONTRIBUTION * smicHoraire);

  const tauxPlafondST =
    tauxEmploi >= SEUIL_TAUX_EMPLOI_PLAFOND_HAUT ? PLAFOND_SOUS_TRAITANCE_HAUT : PLAFOND_SOUS_TRAITANCE_BAS;
  const stCalculee = coutST * TAUX_DEDUCTION_SOUS_TRAITANCE;
  const plafondST = contributionBrute * tauxPlafondST;
  const deductionSousTraitance = arrondi2(Math.min(stCalculee, plafondST));

  const plafondDepenses = contributionBrute * PLAFOND_DEPENSES_DEDUCTIBLES;
  const deductionDepenses = arrondi2(Math.min(depenses, plafondDepenses));

  const deductionEcap = arrondi2(ecap * COEFFICIENT_ECAP * smicHoraire);

  const totalDeductions = arrondi2(
    Math.min(contributionBrute, deductionSousTraitance + deductionDepenses + deductionEcap)
  );
  const contributionNette = arrondi2(Math.max(0, contributionBrute - totalDeductions));

  return {
    smicHoraire,
    tauxLegal: TAUX_LEGAL * 100,
    seuilAssujettissement: SEUIL_ASSUJETTISSEMENT,
    effectif: eff,
    assujetti,
    quota,
    boeth: beneficiaires,
    manque,
    tauxEmploi,
    conforme: assujetti && manque === 0,
    tranche: tranche?.label || null,
    coefficientTranche: tranche?.coefficient || null,
    surcontribution,
    actionMinimale,
    accordAgree: accordAgree === true,
    sousTraitance4AnsInsuffisante: sousTraitance4Ans === true && !sousTraitance4AnsSuffisante,
    seuilSousTraitanceMin,
    coefficient,
    contributionBrute,
    baseMaximale,
    deductions: {
      sousTraitance: deductionSousTraitance,
      sousTraitancePlafonnee: coutST > 0 && stCalculee > plafondST,
      tauxPlafondSousTraitance: tauxPlafondST * 100,
      depenses: deductionDepenses,
      depensesPlafonnees: depenses > 0 && depenses > plafondDepenses,
      plafondDepenses: arrondi2(plafondDepenses),
      ecap: deductionEcap,
      total: totalDeductions,
    },
    contributionNette,
    economie: arrondi2(Math.max(0, baseMaximale - contributionNette)),
  };
}
