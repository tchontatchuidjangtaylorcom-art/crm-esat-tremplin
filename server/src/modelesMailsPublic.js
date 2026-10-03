// Modèles de mails pour les employeurs PUBLICS (collecteur FIPHFP). Proposés
// à la place des modèles du privé quand la fiche est publique (voir
// MessagerieMail.jsx) : un organisme public relève du FIPHFP (Fonds pour
// l'insertion des personnes handicapées dans la fonction publique), pas de
// l'AGEFIPH ni de l'URSSAF, et ne déclare pas dans la DSN au titre de l'OETH
// du secteur privé.
//
// Rédaction volontairement prudente et générale (obligation de 6 %, seuil de
// 20 agents, contribution au FIPHFP, leviers de réduction) : texte à faire
// valider par l'équipe avant usage large. Le pôle ne se présente jamais comme
// le FIPHFP lui-même.
export const MODELES_PUBLIC = [
  {
    cle: "public_premier_contact",
    secteur: "public",
    titre: "1. Public — Obligation d'emploi (FIPHFP)",
    objet: "Obligation d'emploi des travailleurs handicapés — point sur votre situation",
    corps:
      "Bonjour,\n\n" +
      "Suite à notre échange téléphonique, je vous contacte au sujet de l'obligation d'emploi des travailleurs handicapés (OETH) qui s'applique à votre structure.\n\n" +
      "Comme tout employeur public d'au moins 20 agents, votre structure doit employer au moins 6 % de bénéficiaires de l'obligation d'emploi. À défaut, une contribution est due au FIPHFP (Fonds pour l'insertion des personnes handicapées dans la fonction publique), lors de la déclaration annuelle.\n\n" +
      "Nous accompagnons les employeurs publics pour :\n" +
      "• faire le point sur le nombre de bénéficiaires déjà présents dans vos effectifs (un handicap n'est pas toujours visible ni déclaré) ;\n" +
      "• identifier les leviers qui réduisent la contribution : recrutement, maintien dans l'emploi, achats auprès d'ESAT, d'entreprises adaptées ou de travailleurs indépendants handicapés ;\n" +
      "• préparer sereinement votre prochaine déclaration.\n\n" +
      "Un échange de 15 minutes suffit pour faire le point. Si votre structure est déjà en conformité, un simple retour de mail nous permet de mettre votre dossier à jour.\n\n" +
      "{{SIGNATURE}}",
  },
  {
    cle: "public_relance_nrp",
    secteur: "public",
    titre: "2. Public — Relance NRP (FIPHFP)",
    objet: "Obligation d'emploi des travailleurs handicapés — nous n'avons pas pu vous joindre",
    corps:
      "Bonjour,\n\n" +
      "Nous avons essayé à plusieurs reprises de joindre votre service au sujet de l'obligation d'emploi des travailleurs handicapés (OETH), sans parvenir à vous parler.\n\n" +
      "Les employeurs publics d'au moins 20 agents doivent compter au moins 6 % de bénéficiaires de l'obligation d'emploi ; à défaut, une contribution est due au FIPHFP. Nous proposons un point rapide pour vérifier votre situation et identifier les solutions qui permettent de la réduire (recrutement, maintien dans l'emploi, achats auprès d'ESAT ou d'entreprises adaptées).\n\n" +
      "Il vous suffit de répondre à ce message en indiquant le meilleur moment pour vous joindre.\n\n" +
      "{{SIGNATURE}}",
  },
  {
    cle: "public_confirmation_rdv",
    secteur: "public",
    titre: "3. Public — Confirmation de rendez-vous",
    objet: "Confirmation de notre rendez-vous — obligation d'emploi",
    corps:
      "Bonjour,\n\n" +
      "Je vous confirme notre rendez-vous du [date] à [heure] pour faire le point sur l'obligation d'emploi des travailleurs handicapés de votre structure et sur les solutions envisageables (recrutement, maintien dans l'emploi, achats auprès d'ESAT ou d'entreprises adaptées).\n\n" +
      "Pour gagner du temps, il est utile d'avoir sous la main votre effectif et le nombre de bénéficiaires de l'obligation d'emploi déjà présents.\n\n" +
      "N'hésitez pas à revenir vers moi si vous avez la moindre question d'ici là.\n\n" +
      "{{SIGNATURE}}",
  },
];

// Ajoute les modèles publics à la liste servie au CRM (sans doublon si un
// super-administrateur les a déjà repris dans sa liste personnalisée).
export function avecModelesPublic(resultat) {
  const modeles = resultat?.modeles || [];
  return { ...resultat, modeles: [...modeles, ...MODELES_PUBLIC.filter((p) => !modeles.some((m) => m.cle === p.cle))] };
}
