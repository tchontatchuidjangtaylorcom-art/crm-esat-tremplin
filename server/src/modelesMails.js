// Modèles de mails stratégiques, prêts à copier-coller vers le client mail
// réel de l'agent.
//
// Le jeton {{SIGNATURE}} en fin de message n'est pas résolu ici : il est
// remplacé côté frontend au moment de l'insertion dans la fiche entreprise,
// avec le bloc adapté au collecteur réel (Pôle OETH/AGEFIPH pour le privé,
// Pôle FIPHFP — avec mention ESAT — pour le public) et les coordonnées
// réelles de la boîte connectée. Voir client/src/components/MessagerieMail.jsx.
//
// Ces modèles ont été révisés par rapport à une version fournie qui : (1)
// faisait dire à l'agent qu'il travaillait "à l'AGEFIPH" elle-même plutôt
// que dans un pôle en lien avec elle, (2) affirmait qu'un signalement URSSAF
// individuel existait sans preuve, et (3) menaçait d'appliquer directement
// contribution/surcontribution/majorations en cas de "fausse attestation" —
// un pouvoir que ce pôle n'a pas (seule l'URSSAF peut l'exercer). Ce
// mécanisme relève du pretexting (fausse autorité + menace pour extraire des
// documents) et a été retiré, en gardant l'urgence réelle et vérifiable :
// le déficit d'UB calculé par le CRM lui-même à partir de l'effectif déclaré.
export function getModelesMails() {
  return {
    modeles: [
      {
        cle: "urgence_ecrit_accueil",
        titre: "1. Suite à un échange avec l'accueil (écrit demandé)",
        objet: "Obligation OETH — suite à notre appel, action requise",
        corps:
          "Bonjour,\n\nSuite à notre échange téléphonique avec votre service d'accueil, je vous recontacte au sujet de l'obligation d'emploi des travailleurs handicapés (OETH) de votre entreprise.\n\nD'après les effectifs déclarés, votre entreprise présente un déficit d'unités bénéficiaires au regard du quota légal de 6 %. Cette situation entraîne une contribution — désormais déclarée et recouvrée directement par l'URSSAF — dont le montant dépend de votre tranche d'effectif et du nombre de travailleurs handicapés déjà recrutés.\n\nNotre objectif n'est pas de vous pénaliser : cette contribution est dissuasive, pas punitive — elle vise à inciter au recrutement de personnes en situation de handicap. Nous sommes là pour faire le point avec vous et étudier les solutions adaptées : recrutement direct, accompagnement Cap Emploi, ou dispositifs de sous-traitance comme l'ESAT Tremplin.\n\nSi votre entreprise est déjà en conformité, n'hésitez pas à nous le confirmer par retour de mail — nous mettrons votre dossier à jour sans qu'un nouvel échange soit nécessaire.\n\nMerci de nous recontacter dans les meilleurs délais pour en discuter.\n\n{{SIGNATURE}}",
      },
      {
        cle: "relance_nrp",
        titre: "2. Relance NRP (tentatives infructueuses)",
        objet: "Votre dossier OETH — merci de nous rappeler",
        corps:
          "Bonjour,\n\nNous avons essayé à plusieurs reprises de joindre votre entreprise au sujet de son obligation d'emploi des travailleurs handicapés (OETH), sans succès.\n\nD'après les effectifs déclarés, votre entreprise présente un déficit d'unités bénéficiaires, ce qui entraîne une contribution due au titre de cette obligation. Des solutions existent pour la limiter ou l'éviter (recrutement, Cap Emploi, ESAT Tremplin/TIH selon les places disponibles) — encore faut-il faire le point ensemble avant l'échéance.\n\nMerci de nous rappeler dès que possible, ou de répondre à ce mail pour convenir d'un moment qui vous convient.\n\n{{SIGNATURE}}",
      },
      {
        cle: "confirmation_rdv",
        titre: "3. Confirmation de rendez-vous",
        objet: "Confirmation de notre rendez-vous — Obligation OETH",
        corps:
          "Bonjour,\n\nJe vous confirme notre rendez-vous du [date] à [heure] pour faire le point sur votre obligation d'emploi des travailleurs handicapés (OETH) et les solutions envisageables (recrutement, accompagnement Cap Emploi, ESAT Tremplin selon votre situation).\n\nN'hésitez pas à revenir vers moi si vous avez la moindre question d'ici là.\n\n{{SIGNATURE}}",
      },
      {
        cle: "verification_conformite",
        titre: "4. Vérification de conformité déclarée",
        objet: "Confirmation de votre conformité OETH",
        corps:
          "Bonjour,\n\nSuite à notre échange, vous nous avez indiqué que votre entreprise est aujourd'hui en conformité avec son obligation d'emploi des travailleurs handicapés (OETH).\n\nPour mettre à jour votre dossier de notre côté et éviter toute relance inutile, pourriez-vous nous confirmer par retour de mail le nombre de travailleurs handicapés actuellement employés dans votre entreprise (ou nous transmettre l'élément de votre choix : DSN, attestation interne) ?\n\nDès réception, nous clôturerons votre dossier sans qu'un nouvel entretien soit nécessaire.\n\n{{SIGNATURE}}",
      },
      {
        cle: "envoi_documentation",
        titre: "5. Envoi de documentation (recrutement & ESAT Tremplin)",
        objet: "Documentation — obligation OETH et pistes d'action",
        corps:
          "Bonjour,\n\nSuite à notre échange téléphonique, voici un récapitulatif des pistes évoquées pour votre obligation OETH :\n\n- Recrutement direct ou en alternance : Cap Emploi peut vous accompagner sur le sourcing de candidats.\n- Sous-traitance ou mise à disposition via un ESAT/EA de votre secteur.\n- ESAT Tremplin (600h pour 9 232 €) en complément d'une démarche de recrutement, pour réduire votre contribution.\n\nCes solutions ne s'excluent pas : le recrutement reste la voie la plus durable, les autres pistes viennent en appui.\n\nJe reste à votre disposition pour en discuter.\n\n{{SIGNATURE}}",
      },
    ],
  };
}
