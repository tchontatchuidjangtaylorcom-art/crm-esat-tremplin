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
//
// Chaque modèle se termine par un rappel du risque financier réel en cas de
// non-régularisation (majorations, redressement) — volontairement formulé
// comme un fait général attribué à l'URSSAF ("l'entreprise s'expose à..."),
// jamais comme une menace du pôle lui-même ni comme une accusation ciblée de
// "fausse déclaration" envers le destinataire : c'est exactement la nuance
// qui distingue ce rappel du mécanisme de pretexting retiré ci-dessus.
// Contenu par défaut — voir getModelesMails ci-dessous pour la substitution
// par un contenu personnalisé (édition super-admin, PUT /api/modeles-mails).
export const MODELES_PAR_DEFAUT = [
      {
        cle: "urgence_ecrit_accueil",
        titre: "1. Suite à un échange avec l'accueil (écrit demandé)",
        objet: "Obligation OETH — suite à notre appel, action requise",
        corps:
          "Bonjour,\n\nSuite à notre échange téléphonique avec votre service d'accueil, qui nous a invités à vous envoyer un mail, je vous contacte au sujet de l'obligation d'emploi des travailleurs handicapés (OETH) de votre entreprise.\n\nDans le cadre de la nouvelle démarche simplifiée du Pôle OETH / AGEFIPH, nous accompagnons les entreprises pour rendre cette obligation simple, rapide et compréhensible :\n• comprendre votre obligation (6 % de votre effectif) et le montant de votre contribution ;\n• identifier les bénéficiaires (RQTH) que vous employez peut-être déjà sans les avoir déclarés — un handicap n'est pas toujours visible ;\n• mettre en place les solutions qui réduisent, voire évitent, la contribution due au titre des unités manquantes (recrutement, Cap Emploi, sous-traitance ESAT / TIH).\n\nD'après les effectifs déclarés, votre entreprise présente un déficit d'unités bénéficiaires au regard du quota légal de 6 % : notre estimation, établie sur la base de 0 bénéficiaire (RQTH) déclaré à ce jour, est détaillée dans la synthèse jointe.\n\nCes informations peuvent ne plus être à jour : un recrutement récent, un départ ou une reconnaissance RQTH en cours changent le calcul. Il est donc important de les confirmer : en 2 minutes sur notre simulateur gratuit, qui vous permet de télécharger votre récapitulatif (https://oeth-fiph.fr/vitrine), ou avec l'un de nos conseillers, qui vous guidera pas à pas.\n\nCalendrier de l'exercice 2026 : seules les actions réalisées avant le 31 décembre 2026 (recrutement, sous-traitance auprès d'un ESAT / d'une EA / d'un TIH) comptent pour 2026 ; la contribution de l'exercice 2026 sera ensuite déclarée dans la DSN d'avril 2027 et réglée auprès de l'URSSAF. Plus tôt votre dossier est finalisé, plus vous avez de solutions pour réduire le montant.\n\nUn échange de 15 minutes suffit pour faire le point. Si votre entreprise est déjà en conformité, un simple retour de mail nous permet de mettre votre dossier à jour, sans nouvel échange.\n\nPour rappel, la contribution se déclare dans la DSN et se règle auprès de l'URSSAF : un dossier non régularisé expose à des majorations de retard, voire à un redressement sur la contribution OETH. Mieux vaut vérifier vos chiffres dès maintenant.\n\n{{SIGNATURE}}",
      },
      {
        cle: "relance_nrp",
        titre: "2. Relance NRP (tentatives infructueuses)",
        objet: "Votre dossier OETH — merci de nous rappeler",
        corps:
          "Bonjour,\n\nNous avons essayé à plusieurs reprises de joindre votre entreprise au sujet de son obligation d'emploi des travailleurs handicapés (OETH), sans parvenir à vous parler.\n\nDans le cadre de la nouvelle démarche simplifiée du Pôle OETH / AGEFIPH, nous proposons aux entreprises un point rapide pour :\n• comprendre votre obligation (6 % de votre effectif) et le montant de votre contribution ;\n• identifier les bénéficiaires (RQTH) que vous employez peut-être déjà sans les avoir déclarés — un handicap n'est pas toujours visible ;\n• mettre en place les solutions qui réduisent, voire évitent, la contribution due au titre des unités manquantes (recrutement, Cap Emploi, sous-traitance ESAT / TIH).\n\nD'après les effectifs déclarés, votre entreprise présente un déficit d'unités bénéficiaires au regard du quota légal de 6 % : notre estimation, établie sur la base de 0 bénéficiaire (RQTH) déclaré à ce jour, est détaillée dans la synthèse jointe.\n\nCes informations peuvent ne plus être à jour : un recrutement récent, un départ ou une reconnaissance RQTH en cours changent le calcul. Il est donc important de les confirmer : en 2 minutes sur notre simulateur gratuit, qui vous permet de télécharger votre récapitulatif (https://oeth-fiph.fr/vitrine), ou avec l'un de nos conseillers, qui vous guidera pas à pas.\n\nCalendrier de l'exercice 2026 : seules les actions réalisées avant le 31 décembre 2026 (recrutement, sous-traitance auprès d'un ESAT / d'une EA / d'un TIH) comptent pour 2026 ; la contribution de l'exercice 2026 sera ensuite déclarée dans la DSN d'avril 2027 et réglée auprès de l'URSSAF. Plus tôt votre dossier est finalisé, plus vous avez de solutions pour réduire le montant.\n\nRépondez simplement à ce mail avec le créneau qui vous convient, ou rappelez-nous : 15 minutes suffisent. Sans régularisation auprès des organismes compétents, votre dossier reste exposé à des majorations, voire à un redressement URSSAF sur la contribution OETH.\n\n{{SIGNATURE}}",
      },
      {
        cle: "confirmation_rdv",
        titre: "3. Confirmation de rendez-vous",
        objet: "Confirmation de notre rendez-vous — Obligation OETH",
        corps:
          "Bonjour,\n\nJe vous confirme notre rendez-vous du [date] à [heure] pour faire le point sur votre obligation d'emploi des travailleurs handicapés (OETH) et les solutions envisageables (recrutement, accompagnement Cap Emploi, ESAT Tremplin selon votre situation).\n\nD'ici là, un point sur vos effectifs déclarés reste utile : un dossier non régularisé auprès des organismes compétents expose à des majorations, voire à un redressement URSSAF — autant arriver à notre échange avec une situation claire.\n\nN'hésitez pas à revenir vers moi si vous avez la moindre question d'ici là.\n\n{{SIGNATURE}}",
      },
      {
        cle: "verification_conformite",
        titre: "4. Vérification de conformité déclarée",
        objet: "Confirmation de votre conformité OETH",
        corps:
          "Bonjour,\n\nSuite à notre échange, vous nous avez indiqué que votre entreprise est aujourd'hui en conformité avec son obligation d'emploi des travailleurs handicapés (OETH).\n\nPour mettre à jour votre dossier de notre côté et éviter toute relance inutile, pourriez-vous nous confirmer par retour de mail le nombre de travailleurs handicapés actuellement employés dans votre entreprise (ou nous transmettre l'élément de votre choix : DSN, attestation interne) ?\n\nDès réception, nous clôturerons votre dossier sans qu'un nouvel entretien soit nécessaire. Sans cette confirmation, votre dossier reste ouvert de notre côté : une conformité déclarée mais non régularisée auprès des organismes compétents n'a pas de valeur en cas de contrôle, et expose à des majorations de retard, voire à un redressement URSSAF sur la contribution OETH. Merci de vérifier vos chiffres et de nous répondre dès aujourd'hui pour sécuriser définitivement votre dossier avant toute application de pénalités.\n\n{{SIGNATURE}}",
      },
      {
        cle: "envoi_documentation",
        titre: "5. Envoi de documentation (recrutement & ESAT Tremplin)",
        objet: "Documentation — obligation OETH et pistes d'action",
        corps:
          "Bonjour,\n\nSuite à notre échange téléphonique, voici un récapitulatif des pistes évoquées pour votre obligation OETH :\n\n- Recrutement direct ou en alternance : Cap Emploi peut vous accompagner sur le sourcing de candidats.\n- Sous-traitance ou mise à disposition via un ESAT/EA de votre secteur.\n- ESAT Tremplin (600h pour 9 232 €) en complément d'une démarche de recrutement, pour réduire votre contribution.\n\nCes solutions ne s'excluent pas : le recrutement reste la voie la plus durable, les autres pistes viennent en appui.\n\nPour rappel, une conformité non régularisée auprès des organismes compétents expose à des majorations et à un éventuel redressement URSSAF sur la contribution OETH : mieux vaut vérifier vos chiffres et avancer sur ces pistes sans attendre.\n\nJe reste à votre disposition pour en discuter.\n\n{{SIGNATURE}}",
      },
];

// `modeles` : contenu personnalisé par un super-administrateur (voir
// PUT /api/modeles-mails dans index.js), persisté dans
// db.data.contenusEditables.modelesMails — absent/null tant que personne n'a
// rien modifié, auquel cas MODELES_PAR_DEFAUT s'applique.
export function getModelesMails(modeles = null) {
  return { modeles: modeles || MODELES_PAR_DEFAUT };
}
