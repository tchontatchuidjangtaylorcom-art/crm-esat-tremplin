// Script de vente (aide-mémoire agent) : trame d'appel type, de l'ouverture
// à la clôture.
//
// Posture métier volontairement affirmée : le pôle OETH/AGEFIPH n'a pas pour
// rôle de "vendre" des aides financières — elles sont rares (aides Tremplin,
// TITH…) et ne doivent jamais être présentées comme un argument marketing
// facile. La priorité de l'appel est de COMPRENDRE la situation réelle de
// l'entreprise (pourquoi le déficit d'UB, ont-ils tenté de recruter, ont-ils
// déjà contacté Cap Emploi ou l'Agefiph) et de la mettre en conformité avant
// l'échéance de la taxe URSSAF — le recrutement (direct ou via ESAT/EA)
// restant la solution principale, l'aide financière n'étant qu'un
// atténuateur secondaire quand elle est disponible.
export function getScriptVente() {
  return {
    sections: [
      {
        titre: "1. Ouverture",
        lignes: [
          "« Bonjour [Nom], je suis [Prénom], je fais partie du pôle mis en place par l'AGEFIPH — on ne vend rien, on accompagne les entreprises dans leur obligation d'emploi des travailleurs handicapés. »",
          "« Vous avez deux minutes ? Votre effectif vous rend potentiellement redevable de l'OETH, je vous appelle pour faire le point avec vous. »",
        ],
      },
      {
        titre: "2. Investigation — comprendre avant de proposer",
        lignes: [
          "Confirmer l'effectif total et le nombre de bénéficiaires déjà recrutés.",
          "« Pourquoi êtes-vous aujourd'hui en déficit d'unités bénéficiaires ? Avez-vous déjà essayé de recruter sur ce type de profil ? »",
          "« Avez-vous des postes ouverts actuellement, ou des postes qui pourraient être adaptés ? »",
          "« Avez-vous déjà pris contact avec Cap Emploi ou le site de l'Agefiph pour vous accompagner sur le recrutement ? »",
          "Ne jamais sauter cette étape : c'est le diagnostic réel de l'entreprise qui doit orienter la suite de l'appel, pas un script figé.",
        ],
      },
      {
        titre: "3. Cadre légal et risque — créer l'urgence, pas la vente",
        lignes: [
          "Donner le calcul exact affiché dans la fiche : « Avec votre effectif, vous devez [X] unités bénéficiaires. Sans recrutement, cela représente [Y] € de contribution chaque année, sans aucune contrepartie pour votre entreprise. »",
          "Rappeler que la contribution est due qu'on agisse ou non, et que depuis 2025 c'est l'URSSAF qui reprend la déclaration et le recouvrement — le contrôle et la taxation sont automatisés et systématiques.",
          "L'objectif de l'appel n'est pas de faire peur, mais de faire réaliser que l'inaction a un coût réel et certain.",
        ],
      },
      {
        titre: "4. Priorité n°1 : le recrutement, pas l'aide financière",
        lignes: [
          "Toujours présenter le recrutement (direct, alternance, ou sous-traitance ESAT/EA) comme LA solution — c'est ce qui règle durablement l'obligation, contrairement à une contribution qui se répète chaque année.",
          "Si l'entreprise n'a pas de piste : réorienter vers Cap Emploi pour le sourcing de candidats, et/ou vers un ESAT/EA du secteur pour de la sous-traitance ou de la mise à disposition.",
          "« Il existe aussi l'ESAT Tremplin (9 232 € / 600h de prestation) qui réduit directement votre contribution tout en confiant une mission concrète à des travailleurs en situation de handicap — mais ce n'est utile qu'en complément d'une vraie démarche de recrutement, pas à sa place. »",
        ],
      },
      {
        titre: "5. Aides financières — à mentionner en dernier, avec prudence",
        lignes: [
          "Les aides (aides Tremplin, TITH, etc.) sont très limitées en nombre et soumises à conditions : ne jamais les présenter comme acquises ou comme un argument commercial facile.",
          "« Il existe ponctuellement des aides financières, mais elles sont rares et ne doivent pas être le levier principal de votre décision — l'enjeu reste avant tout la mise en conformité. »",
        ],
      },
      {
        titre: "6. Traitement des objections",
        lignes: [
          "« On n'a pas le budget » → recentrer sur le coût de l'inaction (la contribution URSSAF, due de toute façon) avant de parler budget d'une solution.",
          "« On a déjà essayé de recruter, sans succès » → creuser pourquoi (poste, canal, accompagnement) et orienter vers Cap Emploi si ce n'est pas déjà fait.",
          "« On va y réfléchir » → « Bien sûr — je vous envoie un mail récapitulatif pour en discuter en interne ? »",
          "« On n'est pas concernés » → vérifier l'effectif exact et la date de création (neutralisation des 5 ans) avant de clore le dossier.",
        ],
      },
      {
        titre: "7. Clôture",
        lignes: [
          "Toujours proposer une suite concrète : un RDV, un rappel programmé, ou l'envoi d'un mail (voir modèles).",
          "Ne jamais raccrocher sans qualifier l'appel dans le CRM.",
        ],
      },
    ],
  };
}
