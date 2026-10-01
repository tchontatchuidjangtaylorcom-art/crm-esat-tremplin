// Message automatique des fenêtres "À rappeler" / "RDV" : rédigé à partir du
// motif choisi en un clic et de la date, pour que l'agent n'ait rien à
// écrire et reste concentré sur l'appel. Il peut toujours le modifier.

export const MOTIFS_RAPPEL = [
  { cle: "accueil", label: "Accueil", texte: "L'accueil demande de rappeler" },
  { cle: "absent", label: "Absent", texte: "Interlocuteur absent, à rappeler" },
  { cle: "reunion", label: "En réunion", texte: "Interlocuteur en réunion, à rappeler" },
  { cle: "conges", label: "En congés", texte: "Interlocuteur en congés, à rappeler" },
];

export const MOTIFS_RDV = [
  { cle: "fixe", label: "Avec l'interlocuteur", texte: "Rendez-vous téléphonique fixé avec l'interlocuteur" },
  { cle: "rh", label: "Avec les RH", texte: "Rendez-vous téléphonique fixé avec les RH" },
  { cle: "dirigeant", label: "Avec le dirigeant", texte: "Rendez-vous téléphonique fixé avec le dirigeant" },
];

export function motifsPour(statut) {
  return statut === "rdv" ? MOTIFS_RDV : MOTIFS_RAPPEL;
}

// "demain à 10h00", "aujourd'hui à 14h30", "le lundi 5 octobre à 09h00".
export function formatQuandCourt(dateTexte) {
  const d = new Date(dateTexte);
  if (Number.isNaN(d.getTime())) return "";
  const heure = `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
  const jour = (decalage) => {
    const x = new Date();
    x.setDate(x.getDate() + decalage);
    return x.toDateString();
  };
  if (d.toDateString() === jour(0)) return `aujourd'hui à ${heure}`;
  if (d.toDateString() === jour(1)) return `demain à ${heure}`;
  if (d.toDateString() === jour(2)) return `après-demain à ${heure}`;
  return `le ${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${heure}`;
}

export function messageEcheance(statut, cleMotif, dateTexte) {
  const motif = motifsPour(statut).find((m) => m.cle === cleMotif) || motifsPour(statut)[0];
  const quand = dateTexte ? formatQuandCourt(dateTexte) : "";
  return quand ? `${motif.texte} ${quand}.` : `${motif.texte}.`;
}
