// Contenu de l'affiche officielle du pôle AGEFIPH (aide-mémoire agent) :
// pourquoi l'obligation existe, ses dates clés, et le barème des unités
// bénéficiaires (UB). Le barème n'est pas dupliqué en dur : il est généré à
// partir du moteur de calcul OETH (oeth.js), seule source de vérité.
import { calculerUnitesRequises, SEUIL_ASSUJETTISSEMENT, TAUX_LEGAL } from "./oeth.js";

export const QUI_SOMMES_NOUS = {
  texte: "Nous sommes un pôle mis en place par l'AGEFIPH.",
  points: ["Nous ne vendons pas !", "Nous conseillons les entreprises !"],
};

export const OBJECTIF = "Éviter la taxe et respecter l'obligation.";

export const POURQUOI_OBLIGATION = [
  "Favoriser l'inclusion des personnes en situation de handicap.",
  "Sensibiliser les entreprises à embaucher des travailleurs en situation de handicap.",
  "Inciter les structures à embaucher plutôt qu'à s'acquitter de contributions financières dissuasives.",
];

export const CHRONOLOGIE = [
  { annee: 1987, titre: "Loi OETH", description: "Mise en place de l'obligation d'emploi (6 %)." },
  { annee: 1987, titre: "Création AGEFIPH", description: "Gestion des contributions handicap." },
  { annee: 2005, titre: "Loi handicap", description: "Renforcement des droits et de l'inclusion." },
  { annee: 2025, titre: "URSSAF", description: "Reprise des déclarations et des paiements." },
];

export const DEVISE = "INCLURE AUJOURD'HUI, CONSTRUIRE DEMAIN.";

// Reproduit le barème de l'affiche (tranches d'effectif -> UB requises) en le
// dérivant du moteur de calcul, pour qu'il reste toujours exact même si le
// taux légal ou le seuil d'assujettissement évoluent un jour.
function genererBaremeUB(effectifMax = 149) {
  const bareme = [];
  let effectifDebut = SEUIL_ASSUJETTISSEMENT;
  let ubCourant = calculerUnitesRequises(effectifDebut);

  for (let effectif = SEUIL_ASSUJETTISSEMENT + 1; effectif <= effectifMax; effectif++) {
    const ub = calculerUnitesRequises(effectif);
    if (ub !== ubCourant) {
      bareme.push({ effectifMin: effectifDebut, effectifMax: effectif - 1, unitesBeneficiaires: ubCourant });
      effectifDebut = effectif;
      ubCourant = ub;
    }
  }
  bareme.push({ effectifMin: effectifDebut, effectifMax, unitesBeneficiaires: ubCourant });
  return bareme;
}

const BAREME_UB = genererBaremeUB();

// Retrouve la ligne du barème correspondant à l'effectif d'une entreprise
// donnée, pour l'affichage contextuel dans sa fiche pendant l'appel.
export function trouverLigneBareme(effectif) {
  if (!Number.isFinite(effectif) || effectif < SEUIL_ASSUJETTISSEMENT) return null;
  return (
    BAREME_UB.find((ligne) => effectif >= ligne.effectifMin && effectif <= ligne.effectifMax) || {
      effectifMin: 150,
      effectifMax: null,
      unitesBeneficiaires: calculerUnitesRequises(effectif),
    }
  );
}

export function getArgumentaireAgefiph() {
  return {
    quiSommesNous: QUI_SOMMES_NOUS,
    objectif: OBJECTIF,
    pourquoiObligation: POURQUOI_OBLIGATION,
    chronologie: CHRONOLOGIE,
    devise: DEVISE,
    calcul: {
      formule: "Effectif × 6 %",
      tauxLegal: TAUX_LEGAL,
      seuilAssujettissement: SEUIL_ASSUJETTISSEMENT,
    },
    bareme: BAREME_UB,
  };
}
