// Modèles de mails stratégiques, prêts à copier-coller vers le client mail
// réel de l'agent.
//
// Le jeton {{SIGNATURE}} en fin de message n'est pas résolu ici : il est
// remplacé côté frontend au moment de l'insertion dans la fiche entreprise,
// avec le bloc adapté au collecteur réel (Pôle OETH/AGEFIPH pour le privé,
// Pôle FIPHFP — avec mention ESAT — pour le public). Voir
// client/src/components/MessagerieMail.jsx.
export function getModelesMails() {
  return {
    modeles: [
      {
        cle: "urgence_non_conformite",
        titre: "Urgence — non-conformité OETH (RH injoignable)",
        objet: "Action requise — obligation OETH non régularisée",
        corps:
          "Bonjour,\n\nNous n'arrivons pas à joindre votre entreprise au sujet de son obligation d'emploi des travailleurs handicapés (OETH), et votre dossier n'est aujourd'hui pas régularisé.\n\nÀ défaut de mise à jour rapide de votre situation, votre entreprise reste exposée à la contribution due au titre de cette obligation — désormais déclarée et recouvrée directement par l'URSSAF.\n\nMerci de nous recontacter dans les meilleurs délais afin que nous fassions le point ensemble sur votre situation (recrutement, postes ouverts, accompagnement Cap Emploi) avant l'échéance de déclaration.\n\n{{SIGNATURE}}",
      },
      {
        cle: "confirmation_rdv",
        titre: "Confirmation de rendez-vous",
        objet: "Confirmation de notre rendez-vous — Obligation OETH",
        corps:
          "Bonjour,\n\nJe vous confirme notre rendez-vous du [date] à [heure] pour faire le point sur votre obligation d'emploi des travailleurs handicapés (OETH) et les solutions envisageables (recrutement, accompagnement Cap Emploi, ESAT Tremplin selon votre situation).\n\nN'hésitez pas à revenir vers moi si vous avez la moindre question d'ici là.\n\n{{SIGNATURE}}",
      },
      {
        cle: "relance_nrp",
        titre: "Relance NRP (prospect injoignable)",
        objet: "Votre dossier OETH — merci de nous rappeler",
        corps:
          "Bonjour,\n\nNous avons essayé de vous joindre au sujet de votre obligation OETH, sans succès.\n\nMerci de nous rappeler dès que possible pour faire le point sur votre dossier.\n\n{{SIGNATURE}}",
      },
      {
        cle: "envoi_documentation",
        titre: "Envoi de documentation (recrutement & ESAT Tremplin)",
        objet: "Documentation — obligation OETH et pistes d'action",
        corps:
          "Bonjour,\n\nSuite à notre échange téléphonique, voici un récapitulatif des pistes évoquées pour votre obligation OETH :\n\n- Recrutement direct ou en alternance : Cap Emploi peut vous accompagner sur le sourcing de candidats.\n- Sous-traitance ou mise à disposition via un ESAT/EA de votre secteur.\n- ESAT Tremplin (600h pour 9 232 €) en complément d'une démarche de recrutement, pour réduire votre contribution.\n\nCes solutions ne s'excluent pas : le recrutement reste la voie la plus durable, les autres pistes viennent en appui.\n\nJe reste à votre disposition pour en discuter.\n\n{{SIGNATURE}}",
      },
    ],
  };
}
