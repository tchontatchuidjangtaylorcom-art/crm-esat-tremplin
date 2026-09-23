// Script de vente (aide-mémoire agent) : trame d'appel type, de l'ouverture
// à la clôture, ancrée sur l'argumentaire OETH et l'offre ESAT Tremplin
// (9 232 € / 600h).
export function getScriptVente() {
  return {
    sections: [
      {
        titre: "1. Ouverture",
        lignes: [
          "« Bonjour [Nom], je suis [Prénom], je fais partie du pôle mis en place par l'AGEFIPH — on ne vend rien, on conseille les entreprises sur leur obligation d'emploi des travailleurs handicapés. »",
          "« Vous avez deux minutes ? Votre effectif vous rend potentiellement redevable de l'OETH, je vous appelle à ce sujet. »",
        ],
      },
      {
        titre: "2. Qualification",
        lignes: [
          "Confirmer l'effectif total de l'entreprise.",
          "« Avez-vous aujourd'hui au moins un collaborateur en situation de handicap dans vos effectifs ? »",
        ],
      },
      {
        titre: "3. Argumentaire OETH — créer l'urgence légale",
        lignes: [
          "Donner le calcul exact affiché dans la fiche : « Avec votre effectif, vous devez [X] unités bénéficiaires. Sans recrutement, cela représente [Y] € de contribution chaque année, sans aucune contrepartie pour votre entreprise. »",
          "Rappeler que la contribution est due qu'on agisse ou non — autant que ce budget serve à quelque chose de concret.",
        ],
      },
      {
        titre: "4. Présentation ESAT Tremplin",
        lignes: [
          "« Il existe une solution simple et rapide : l'ESAT Tremplin. Pour 9 232 € et 600h de prestation, vous réduisez directement votre contribution OETH, tout en confiant une mission concrète à des travailleurs en situation de handicap. »",
          "« C'est un contrat de sous-traitance classique, sans embauche ni engagement de recrutement — la mise en place se fait en quelques semaines. »",
        ],
      },
      {
        titre: "5. Traitement des objections",
        lignes: [
          "« On n'a pas le budget » → « Le montant de l'ESAT Tremplin est très inférieur à la contribution que vous payez déjà — c'est le même budget, utilisé utilement. »",
          "« On va y réfléchir » → « Bien sûr — je vous envoie une documentation par mail pour en discuter en interne ? »",
          "« On n'est pas concernés » → vérifier l'effectif exact et la date de création (neutralisation des 5 ans) avant de clore le dossier.",
        ],
      },
      {
        titre: "6. Clôture",
        lignes: [
          "Toujours proposer une suite concrète : un RDV, un rappel programmé, ou l'envoi d'un mail (voir modèles).",
          "Ne jamais raccrocher sans qualifier l'appel dans le CRM.",
        ],
      },
    ],
  };
}
