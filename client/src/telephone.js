// Même règles que server/src/telephone.js : un numéro saisi à la main ne
// contient que chiffres, espaces, points, tirets, parenthèses, "/" et "+",
// avec 8 à 15 chiffres.
export function estNumeroTelephone(valeur) {
  if (typeof valeur !== "string") return false;
  const v = valeur.trim();
  if (!/^[+\d\s.()\-/]+$/.test(v)) return false;
  const chiffres = v.replace(/\D/g, "").length;
  return chiffres >= 8 && chiffres <= 15;
}

// Plus tolérant, pour l'affichage d'un numéro déjà enregistré (ex : "01 23
// 45 67 89 poste 3") : tout sauf un e-mail ou un texte sans chiffres.
export function estNumeroAffichable(valeur) {
  if (typeof valeur !== "string") return false;
  return !valeur.includes("@") && valeur.replace(/\D/g, "").length >= 8;
}

// Message d'erreur à afficher pour une saisie refusée dans un champ numéro,
// ou null si la saisie est valide.
export function erreurNumero(valeur) {
  const v = String(valeur || "").trim();
  if (!v) return "Saisissez un numéro de téléphone.";
  if (v.includes("@")) return `« ${v} » est une adresse e-mail, pas un numéro — ajoutez-la dans « Adresses e-mail ».`;
  if (!estNumeroTelephone(v)) return `« ${v} » n'est pas un numéro valide (ex : 01 41 33 84 00).`;
  return null;
}
