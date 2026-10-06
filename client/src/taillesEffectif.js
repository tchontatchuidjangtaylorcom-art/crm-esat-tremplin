// Tailles d'entreprise ciblables (mêmes clés que server/src/taillesEffectif.js,
// calées sur les tranches d'effectif de l'INSEE).
export const TAILLES_EFFECTIF = [
  { cle: "20-249", label: "20 à 249 salariés (conseillé)", min: 20, max: 249 },
  { cle: "20-49", label: "20 à 49 salariés", min: 20, max: 49 },
  { cle: "50-99", label: "50 à 99 salariés", min: 50, max: 99 },
  { cle: "100-199", label: "100 à 199 salariés", min: 100, max: 199 },
  { cle: "200-249", label: "200 à 249 salariés", min: 200, max: 249 },
  { cle: "250-999", label: "250 à 999 salariés", min: 250, max: 999 },
  // Plus de « 1 000 et plus » : hors cible, retirées du CRM (octobre 2026).
  { cle: "20+", label: "Toutes (20 à 999 salariés)", min: 20, max: 999 },
];

// Filtre de la liste du tableau de bord : la fiche entre-t-elle dans la taille
// choisie (effectif estimé depuis la tranche INSEE, ou saisi / confirmé) ?
export function dansTaille(entreprise, cle) {
  const t = TAILLES_EFFECTIF.find((x) => x.cle === cle);
  if (!t) return true;
  const n = Number(entreprise.effectif);
  return Number.isFinite(n) && n >= t.min && n <= t.max;
}
