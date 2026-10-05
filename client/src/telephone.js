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

// Numéro au format international, pour l'appel et la copie (Aircall,
// téléphone à l'étranger…) : +33 pour la métropole, et l'indicatif propre à
// chaque territoire d'outre-mer, reconnu au début du numéro national :
// 0262 / 0263 / 0692 / 0693 (La Réunion) et 0269 / 0639 (Mayotte) → +262 ;
// 0590 / 0690 / 0691 (Guadeloupe, St-Martin, St-Barthélemy) → +590 ;
// 0596 / 0696 / 0697 (Martinique) → +596 ; 0594 / 0694 (Guyane) → +594 ;
// 0508 (Saint-Pierre-et-Miquelon) → +508. Un numéro déjà international
// (+… ou 00…) est gardé tel quel.
const INDICATIFS_OUTRE_MER = [
  [/^0(262|263|692|693|269|639)/, "262"],
  [/^0(590|690|691)/, "590"],
  [/^0(596|696|697)/, "596"],
  [/^0(594|694)/, "594"],
  [/^0508/, "508"],
];
export function numeroInternational(valeur) {
  const brut = String(valeur || "").trim();
  if (brut.startsWith("+")) return "+" + brut.slice(1).replace(/\D/g, "");
  const chiffres = brut.replace(/\D/g, "");
  if (chiffres.startsWith("00")) return "+" + chiffres.slice(2);
  if (chiffres.length === 10 && chiffres.startsWith("0")) {
    const outreMer = INDICATIFS_OUTRE_MER.find(([re]) => re.test(chiffres));
    if (outreMer) {
      // SPM : le numéro local suit l'indicatif (0508 41 23 45 → +508 41 23 45).
      return outreMer[1] === "508" ? "+508" + chiffres.slice(4) : "+" + outreMer[1] + chiffres.slice(1);
    }
    return "+33" + chiffres.slice(1);
  }
  return chiffres;
}
