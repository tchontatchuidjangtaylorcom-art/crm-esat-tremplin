// Bloc de signature mail unique et officiel, utilisé partout où un mail part
// du CRM (fil de messagerie d'une fiche entreprise — MessagerieMail — et
// panneau générique de modèles à copier-coller — ModelesMailsContenu) : le
// même bloc normalisé sur tous les envois, sans nom d'agent individuel — seule
// l'adresse de contact générale du pôle apparaît, jamais celle d'un agent en
// particulier. Coordonnées sourcées depuis /api/emails/statut (voir
// server/src/mail.js) plutôt que codées en dur ici, pour rester la même
// valeur partout si elles changent un jour.
// Domaine public de la landing page (simulateur OETH en libre-service) —
// volontairement le nom de domaine dédié plutôt que l'adresse onrender.com
// interne du CRM, jamais destinée à être vue par un prospect.
const URL_SIMULATEUR = "https://oeth-fiph.fr/vitrine";

export function construireSignature({ statutMail } = {}) {
  const ligneEmail = statutMail?.adresse ? `\n✉️ ${statutMail.adresse}` : "";
  const ligneTelephone = statutMail?.telephone ? `\n📞 ${statutMail.telephone}` : "";
  // Call-to-action systématique vers le simulateur public : permet au
  // destinataire de corriger lui-même ses chiffres (effectif, bénéficiaires)
  // en 2 minutes et de reprendre contact — placé dans la signature partagée
  // pour apparaître sur TOUS les mails partant du CRM (modèles ET brouillons
  // générés par IA), sans avoir à dupliquer ce lien dans chaque contenu.
  const ligneCta = `\n\n👉 Mettez vos chiffres à jour et échangez avec un conseiller en 2 minutes : ${URL_SIMULATEUR}`;
  // Pas d'adresse postale : les bureaux changent, un conseiller la communique.
  return `${ligneCta}\n\n— Pôle OETH / AGEFIPH${ligneEmail}${ligneTelephone}`;
}
