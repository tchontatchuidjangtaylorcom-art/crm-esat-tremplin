// Territoires couverts par l'obligation d'emploi (même liste que
// server/src/territoires.js), avec leur fuseau horaire : l'agent voit l'heure
// locale et si les bureaux sont ouverts avant d'appeler (La Réunion le matin,
// les Antilles l'après-midi…).
export const TERRITOIRES = [
  { cle: "metropole", nom: "France métropolitaine", court: "Métropole", fuseau: "Europe/Paris" },
  { cle: "974", nom: "La Réunion", court: "La Réunion", fuseau: "Indian/Reunion" },
  { cle: "971", nom: "Guadeloupe", court: "Guadeloupe", fuseau: "America/Guadeloupe" },
  { cle: "972", nom: "Martinique", court: "Martinique", fuseau: "America/Martinique" },
  { cle: "973", nom: "Guyane", court: "Guyane", fuseau: "America/Cayenne" },
  { cle: "976", nom: "Mayotte", court: "Mayotte", fuseau: "Indian/Mayotte" },
  { cle: "975", nom: "Saint-Pierre-et-Miquelon", court: "St-Pierre-et-Miquelon", fuseau: "America/Miquelon" },
];

// Territoire d'une fiche d'après le code postal de son siège (971xx →
// Guadeloupe, 974xx → La Réunion…), la métropole sinon.
export function territoireDe(codePostal) {
  const m = String(codePostal || "").trim().match(/^97([1-6])/);
  return m ? `97${m[1]}` : "metropole";
}

export function trouverTerritoire(cle) {
  return TERRITOIRES.find((t) => t.cle === cle) || null;
}

function partiesLocales(fuseau, date) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: fuseau,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const val = (type) => parts.find((p) => p.type === type)?.value;
  return { heure: Number(val("hour")), minute: Number(val("minute")), jour: val("weekday") };
}

export function heureLocale(fuseau, date = new Date()) {
  const { heure, minute } = partiesLocales(fuseau, date);
  return `${String(heure).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Heures d'appel habituelles : du lundi au vendredi, 9 h – 12 h et 14 h – 18 h
// (heure locale du territoire).
export function etatBureaux(fuseau, date = new Date()) {
  const { heure, minute, jour } = partiesLocales(fuseau, date);
  if (/^(sam|dim)/i.test(jour || "")) return "ferme";
  const t = heure + minute / 60;
  if ((t >= 9 && t < 12) || (t >= 14 && t < 18)) return "ouvert";
  if (t >= 12 && t < 14) return "pause";
  return "ferme";
}
