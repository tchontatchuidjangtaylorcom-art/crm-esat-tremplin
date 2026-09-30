// Territoires couverts par l'obligation d'emploi (OETH) du Code du travail :
// la métropole et les départements et régions d'outre-mer, plus
// Saint-Pierre-et-Miquelon. (La Polynésie française, la Nouvelle-Calédonie et
// Wallis-et-Futuna ont leur propre droit du travail : hors périmètre.)
// Même liste côté client : client/src/territoires.js.
export const TERRITOIRES = [
  { cle: "metropole", nom: "France métropolitaine" },
  { cle: "974", nom: "La Réunion" },
  { cle: "971", nom: "Guadeloupe" },
  { cle: "972", nom: "Martinique" },
  { cle: "973", nom: "Guyane" },
  { cle: "976", nom: "Mayotte" },
  { cle: "975", nom: "Saint-Pierre-et-Miquelon" },
];

// Territoire d'une fiche, déduit du code postal de son siège : 971xx →
// Guadeloupe (Saint-Barthélemy et Saint-Martin compris), 974xx → La Réunion…
// Tout le reste (dont la Corse) → métropole.
export function territoireDe(codePostal) {
  const m = String(codePostal || "").trim().match(/^97([1-6])/);
  return m ? `97${m[1]}` : "metropole";
}

export function territoireValide(cle) {
  return TERRITOIRES.some((t) => t.cle === cle);
}

export function nomTerritoire(cle) {
  return TERRITOIRES.find((t) => t.cle === cle)?.nom || null;
}
