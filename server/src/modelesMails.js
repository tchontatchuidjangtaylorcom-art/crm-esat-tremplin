// Modèles de mails prêts à copier-coller pendant ou après un appel.
export function getModelesMails() {
  return {
    modeles: [
      {
        cle: "confirmation_rdv",
        titre: "Confirmation de rendez-vous",
        objet: "Confirmation de notre rendez-vous — Obligation OETH",
        corps:
          "Bonjour,\n\nJe vous confirme notre rendez-vous du [date] à [heure] concernant votre obligation d'emploi des travailleurs handicapés (OETH) et la solution ESAT Tremplin.\n\nN'hésitez pas à revenir vers moi si vous avez la moindre question d'ici là.\n\nBien cordialement,\n[Signature]",
      },
      {
        cle: "envoi_documentation",
        titre: "Envoi de documentation ESAT Tremplin",
        objet: "Documentation — ESAT Tremplin et obligation OETH",
        corps:
          "Bonjour,\n\nSuite à notre échange téléphonique, voici les informations sur l'ESAT Tremplin :\n\n- Prestation de 600h pour 9 232 €\n- Réduction directe de votre contribution OETH\n- Aucune embauche, aucun engagement de recrutement\n- Mise en place en quelques semaines\n\nJe reste à votre disposition pour en discuter et répondre à vos questions.\n\nBien cordialement,\n[Signature]",
      },
      {
        cle: "relance_sans_reponse",
        titre: "Relance après appel sans réponse",
        objet: "Votre obligation OETH — nous essayons de vous joindre",
        corps:
          "Bonjour,\n\nNous avons essayé de vous joindre au sujet de votre obligation d'emploi des travailleurs handicapés (OETH), sans succès.\n\nSi vous êtes disponible, n'hésitez pas à nous rappeler ou à répondre à ce mail pour convenir d'un moment qui vous convient.\n\nBien cordialement,\n[Signature]",
      },
    ],
  };
}
