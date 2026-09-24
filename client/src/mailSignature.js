// Bloc de signature mail unique et officiel, utilisé partout où un mail part
// du CRM (fil de messagerie d'une fiche entreprise — MessagerieMail — et
// panneau générique de modèles à copier-coller — ModelesMailsContenu) : le
// même bloc normalisé sur tous les envois, sans nom d'agent individuel — seule
// l'adresse de contact générale du pôle apparaît, jamais celle d'un agent en
// particulier. Coordonnées sourcées depuis /api/emails/statut (voir
// server/src/mail.js) plutôt que codées en dur ici, pour rester la même
// valeur partout si elles changent un jour.
export function construireSignature({ statutMail } = {}) {
  const ligneEmail = statutMail?.adresse ? `\n✉️ ${statutMail.adresse}` : "";
  const ligneTelephone = statutMail?.telephone ? `\n📞 ${statutMail.telephone}` : "";
  const ligneAdresse = statutMail?.adressePostale ? `\n📍 ${statutMail.adressePostale}` : "";
  return `— Pôle OETH / AGEFIPH${ligneEmail}${ligneTelephone}${ligneAdresse}`;
}
