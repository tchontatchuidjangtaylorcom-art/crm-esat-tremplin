// Bloc de signature mail partagé entre le fil de messagerie d'une fiche
// entreprise (MessagerieMail) et le panneau générique de modèles à
// copier-coller (ModelesMailsContenu) : coordonnées réelles du pôle
// (adresse mail, téléphone, adresse postale — voir server/src/mail.js) +
// nom de l'agent actuellement connecté, pour que chaque mail engage
// nommément l'agent tout en gardant l'adresse d'expédition unique du pôle.
//
// `collecteur` : "FIPHFP" pour le secteur public, sinon privé (AGEFIPH).
// `null`/absent (ex: panneau générique sans fiche entreprise) → traité
// comme privé par défaut.
export function construireSignature({ utilisateur, statutMail, collecteur }) {
  const nomAgent = utilisateur?.prenom || utilisateur?.nom || utilisateur?.email || "";
  const libellePole = collecteur === "FIPHFP" ? "Pôle FIPHFP" : "Pôle OETH / AGEFIPH";
  const entete = nomAgent ? `${nomAgent} — ${libellePole}` : libellePole;
  const mention =
    collecteur === "FIPHFP" ? "\nN'hésitez pas à nous solliciter pour une mise en relation avec un ESAT partenaire." : "";
  const ligneEmail = statutMail?.adresse ? `\n✉️ ${statutMail.adresse}` : "";
  const ligneTelephone = statutMail?.telephone ? `\n📞 ${statutMail.telephone}` : "";
  const ligneAdresse = statutMail?.adressePostale ? `\n📍 ${statutMail.adressePostale}` : "";
  return `${entete}${mention}${ligneEmail}${ligneTelephone}${ligneAdresse}`;
}
