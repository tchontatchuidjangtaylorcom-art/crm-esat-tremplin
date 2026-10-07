// Bloc de signature mail unique et officiel, utilisé partout où un mail part
// du CRM (fil de messagerie d'une fiche entreprise — MessagerieMail — et
// panneau générique de modèles à copier-coller — ModelesMailsContenu) : le
// même bloc normalisé sur tous les envois, sans nom d'agent individuel — seule
// l'adresse de contact générale du pôle apparaît, jamais celle d'un agent en
// particulier. Coordonnées sourcées depuis /api/emails/statut (voir
// server/src/mail.js) plutôt que codées en dur ici, pour rester la même
// valeur partout si elles changent un jour.
//
// Plus de lien « simulation en 2 minutes » (retiré en octobre 2026) : les
// chiffres sont présentés par le conseiller au téléphone, et la mise en page
// officielle propose le bouton « Parler à un conseiller » (prise de
// rendez-vous, voir server/src/emailOfficiel.js).
// Jetons des modèles de mails, remplacés à l'insertion : {{SIGNATURE}},
// {{ANNEE}} (exercice en cours : 2026, puis 2027 l'an prochain…) et
// {{ANNEE_SUIVANTE}} (année de la déclaration de cet exercice).
export function remplirAnnees(texte) {
  const annee = new Date().getFullYear();
  return String(texte || "")
    .replaceAll("{{ANNEE_SUIVANTE}}", String(annee + 1))
    .replaceAll("{{ANNEE}}", String(annee));
}
export function remplirJetons(corps, { statutMail, collecteur } = {}) {
  return remplirAnnees(corps).replaceAll("{{SIGNATURE}}", construireSignature({ statutMail, collecteur }));
}

// `collecteur` : "FIPHFP" pour une fiche publique (signature « Pôle FIPHFP »).
export function construireSignature({ statutMail, collecteur } = {}) {
  const ligneEmail = statutMail?.adresse ? `\n✉️ ${statutMail.adresse}` : "";
  const ligneTelephone = statutMail?.telephone ? `\n📞 ${statutMail.telephone}` : "";
  // Pas d'adresse postale : les bureaux changent, un conseiller la communique.
  return `— ${collecteur === "FIPHFP" ? "Pôle FIPHFP" : "Pôle OETH / AGEFIPH"}${ligneEmail}${ligneTelephone}`;
}
