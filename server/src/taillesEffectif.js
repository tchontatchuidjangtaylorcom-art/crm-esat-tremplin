// Tailles d'entreprise pour cibler la génération de fiches (et la demande de
// fiches des agents). Calées sur les tranches d'effectif du répertoire Sirene
// (INSEE), qui ne donne pas l'effectif exact : 12 = 20-49, 21 = 50-99,
// 22 = 100-199, 31 = 200-249, 32 = 250-499, 41 = 500-999, 42 = 1000-1999,
// 51 = 2000-4999, 52 = 5000-9999, 53 = 10000 et plus.
//
// Cible conseillée : 20 à 249 salariés — des entreprises pour qui la
// contribution pèse, plus faciles à joindre que les RH des grands groupes, et
// pour qui la sous-traitance ESAT est une vraie solution.
export const TAILLES_EFFECTIF = {
  "20-249": { label: "20 à 249 salariés (conseillé)", min: 20, max: 249, tranches: ["12", "21", "22", "31"] },
  "20-49": { label: "20 à 49 salariés", min: 20, max: 49, tranches: ["12"] },
  "50-99": { label: "50 à 99 salariés", min: 50, max: 99, tranches: ["21"] },
  "100-199": { label: "100 à 199 salariés", min: 100, max: 199, tranches: ["22"] },
  "200-249": { label: "200 à 249 salariés", min: 200, max: 249, tranches: ["31"] },
  "250-999": { label: "250 à 999 salariés", min: 250, max: 999, tranches: ["32", "41"] },
  // Plus de taille « 1 000 et plus » (octobre 2026) : ces entreprises sont
  // hors cible et retirées du CRM (voir db.js) — « Toutes » s'arrête à 999.
  "20+": { label: "Toutes (20 à 999 salariés)", min: 20, max: 999, tranches: ["12", "21", "22", "31", "32", "41"] },
};

export function tailleEffectif(cle) {
  return TAILLES_EFFECTIF[cle] || null;
}

// Une fiche existante entre-t-elle dans la taille choisie ? (effectif estimé
// depuis la tranche INSEE, ou saisi par l'agent / confirmé par le client).
export function dansTaille(entreprise, taille) {
  if (!taille) return true;
  const n = Number(entreprise.effectif);
  return Number.isFinite(n) && n >= taille.min && n <= taille.max;
}
