// Script de vente (aide-mémoire agent) : scénario d'appel complet, de
// l'accueil à la clôture. Chaque section alterne deux types de lignes :
//   - "instruction" : consigne pour l'agent (non lue au prospect)
//   - "texte"        : texte à lire verbatim, entre guillemets
// (voir ScriptVenteContenu.jsx pour le rendu visuel distinct des deux)
//
// Posture métier : le pôle OETH/AGEFIPH n'a pas pour rôle de "vendre" des
// aides — elles sont rares (ESAT Tremplin, TIH…) et ne doivent jamais être
// présentées comme acquises. La priorité de l'appel est de COMPRENDRE la
// situation réelle de l'entreprise (déficit d'UB, tentatives de recrutement,
// contact Cap Emploi) et de la mettre en conformité avant l'échéance URSSAF.
//
// Deux points corrigés par rapport au script fourni initialement : l'agent
// se présente comme membre d'un pôle "en lien avec" l'AGEFIPH (pas comme
// employé de l'AGEFIPH elle-même — risque d'usurpation d'identité d'un
// organisme), et l'urgence s'appuie sur le déficit d'UB réellement calculé
// dans la fiche plutôt que sur un courrier/portail URSSAF fictif visant
// spécifiquement le prospect (pratique commerciale trompeuse sinon).
const AGENT = "[Prénom]"; // remplacé dynamiquement par ScriptVenteContenu.jsx

// Contenu par défaut — voir getScriptVente ci-dessous pour la substitution
// par un contenu personnalisé (édition super-admin, PUT /api/script-vente).
export const SECTIONS_PAR_DEFAUT = [
      {
        titre: "1. Passer le rempart (accueil)",
        lignes: [
          {
            type: "instruction",
            texte:
              "Demander à joindre poliment mais fermement la personne en charge des DSN. Si la secrétaire demande le motif de l'appel, lire le texte ci-dessous :",
          },
          {
            type: "texte",
            texte: `« Bonjour, c'est ${AGENT} à l'appareil, du pôle OETH en lien avec l'AGEFIPH. J'aimerais m'entretenir avec le ou la responsable des ressources humaines en charge des déclarations sociales nominatives (DSN), au sujet de leur obligation d'emploi des travailleurs handicapés. Je vous laisse me le/la passer, merci. »`,
          },
        ],
      },
      {
        titre: "2. Arrivée sur la bonne personne — urgence",
        lignes: [
          {
            type: "instruction",
            texte:
              "Vérifier que vous êtes bien avec la bonne personne avant de poursuivre. Si oui, enchaîner immédiatement sur l'urgence réelle : le déficit d'unités bénéficiaires calculé dans la fiche, pas une menace inventée.",
          },
          {
            type: "texte",
            texte: `« Bonjour, c'est ${AGENT}, du pôle OETH en lien avec l'AGEFIPH. Est-ce que je suis bien en ligne avec la personne en charge des déclarations sociales nominatives (DSN) ? Je vous appelle au sujet de votre obligation d'emploi de travailleurs handicapés (OETH) : d'après votre effectif, votre entreprise présente un déficit d'unités bénéficiaires, ce qui déclenche une contribution — désormais déclarée et recouvrée directement par l'URSSAF. Je vous contacte pour faire le point avec vous avant que cette contribution ne devienne due. »`,
          },
        ],
      },
      {
        titre: "3. Posture pédagogique — phase d'enquête",
        lignes: [
          {
            type: "instruction",
            texte:
              "Installer une posture d'accompagnement, pas de menace, puis poser les questions d'enquête pour analyser la situation réelle du client :",
          },
          {
            type: "texte",
            texte:
              "« Notre objectif n'est pas de vous pénaliser : cette contribution n'est pas punitive, elle est dissuasive — elle existe pour inciter les entreprises à l'embauche de travailleurs en situation de handicap. Nous sommes là pour comprendre votre situation et voir comment vous mettre à jour avant qu'elle ne s'applique. »",
          },
          {
            type: "texte",
            texte:
              "« Étiez-vous conscient de cette situation en interne, et quelles démarches avez-vous déjà entreprises pour la régulariser ? »",
          },
          {
            type: "texte",
            texte:
              "« Avez-vous fait un recensement des salariés en situation de handicap (RQTH) en interne — le handicap couvre un champ large : diabète, dyslexie, troubles chroniques, etc. — ou tenté de recruter via Cap Emploi ? »",
          },
        ],
      },
      {
        titre: "4. Présentation des solutions (ESAT Tremplin / TIH)",
        lignes: [
          {
            type: "instruction",
            texte:
              "Expliquer les solutions de façon claire, en appuyant sur la rareté réelle des places pour créer une urgence légitime — jamais fabriquée. Chiffres à confirmer avec votre référent avant usage réel.",
          },
          {
            type: "texte",
            texte:
              "« Soit vous partez sur de l'embauche directe — c'est l'objectif prioritaire pour l'avenir, mais attention : le délai (environ 6 mois) ne permet pas de rattraper rétroactivement l'année en cours — soit sur une solution indirecte. »",
          },
          {
            type: "texte",
            texte:
              "« Plutôt qu'un ESAT classique, qui ne déduit qu'environ 30 % et demande un effort chaque année, je peux vous orienter vers un ESAT Tremplin ou un dispositif TIH (Travailleurs Indépendants Handicapés). »",
          },
          {
            type: "texte",
            texte:
              "« Le minimum légal pour éviter la surcontribution est de 600 heures de prestation (modulable à 400 heures selon les unités déjà couvertes). En multipliant ce volume par le taux horaire du SMIC (12,31 €) et le coefficient de déduction de l'ESAT Tremplin — qui couvre 80 % et vous protège juridiquement pendant 3 ans — cela représente un investissement d'environ 9 232 € en prestations ou consommables, qui vous exonère de la surcontribution. »",
          },
          {
            type: "texte",
            texte:
              "« Attention : ces dispositifs sont limités — environ 200 à 220 structures ESAT Tremplin/TIH en France au total. Je peux enregistrer votre demande pour vérifier s'il reste une place, mais sans garantie : c'est pourquoi il est important d'anticiper dès maintenant, notamment via le recrutement direct, pour les années suivantes. »",
          },
        ],
      },
      {
        titre: "5. Clôture & qualification",
        lignes: [
          {
            type: "instruction",
            texte:
              "Selon la situation : basculer le dossier au statut « Conforme » si le client est en règle, ou noter les informations pour une demande ESAT Tremplin/TIH si le prospect est intéressé.",
          },
          {
            type: "texte",
            texte:
              "Si conforme : « C'est parfait, votre dossier est en règle : je bascule votre fiche au statut Conforme pour clore le dossier dans notre base et arrêter les relances. Bonne continuation ! »",
          },
          {
            type: "texte",
            texte:
              "Si intéressé : « Je note l'ensemble de vos informations pour transmettre votre demande au pôle de supervision et vérifier s'il reste une place disponible dans le dispositif. »",
          },
        ],
      },
];

// Script CEE (agriculteurs sous serre) : même structure instruction/texte.
// Contenu initial — voir le document "Pitch CEE — Agriculteurs sous serre"
// partagé avec l'équipe le 2026-10-26. Les montants/taux précis restent à
// confirmer avec le partenaire (voir section 5) : l'agent ne doit jamais en
// citer tant que ce n'est pas validé.
export const SECTIONS_CEE = [
  {
    titre: "1. Ouverture",
    lignes: [
      { type: "instruction", texte: "Souriez en décrochant — le ton compte autant que les mots." },
      {
        type: "texte",
        texte: `« Bonjour, je suis ${AGENT}, on accompagne les exploitations agricoles sous serre dans la réduction de leurs charges d'énergie, dans le cadre d'un dispositif national. Vous avez deux minutes ? »`,
      },
    ],
  },
  {
    titre: "2. Qualification",
    lignes: [
      {
        type: "instruction",
        texte: "Objectif : confirmer qu'il s'agit bien d'une serre chauffée et identifier la douleur (facture énergie).",
      },
      {
        type: "texte",
        texte:
          "« Vous exploitez bien une ou plusieurs serres chauffées ? Et aujourd'hui, comment est géré le chauffage — vous avez une idée de ce que ça représente sur votre facture d'énergie ? »",
      },
    ],
  },
  {
    titre: "3. Présentation du dispositif",
    lignes: [
      {
        type: "instruction",
        texte: "Rester factuel, ne jamais annoncer de montant ou taux précis tant que non confirmé (voir section 5 ci-dessous).",
      },
      {
        type: "texte",
        texte:
          "« Ce que je vous propose, c'est de faire intervenir gratuitement un technicien pour étudier comment réduire votre consommation de chauffage — écran thermique, régulation, isolation selon votre installation. Les travaux sont financés par les fournisseurs d'énergie dans le cadre d'une obligation légale, les CEE : ça ne vous coûte rien, ce n'est ni une subvention de l'État ni un crédit. »",
      },
    ],
  },
  {
    titre: "4. Transition et clôture",
    lignes: [
      {
        type: "texte",
        texte:
          "« Je vous propose qu'un technicien vous contacte pour faire un point sur votre installation, sans engagement de votre part. Vous êtes disponible plutôt en début ou fin de semaine ? »",
      },
      {
        type: "instruction",
        texte: "Confirmer les coordonnées, poser le rendez-vous, rassurer sur la suite administrative (signature électronique, pas de paperasse).",
      },
      {
        type: "texte",
        texte:
          "« Parfait, je note. Si vous êtes d'accord sur le principe à l'issue de l'étude, tout se fait ensuite par signature électronique : vous recevrez le dossier directement par e-mail, rien à imprimer ni à envoyer par courrier. Merci de votre temps, à bientôt ! »",
      },
    ],
  },
  {
    titre: "5. Objections fréquentes",
    lignes: [
      {
        type: "instruction",
        texte:
          "« C'est une arnaque ? » → Dispositif encadré par l'État (CEE, loi de 2005), financé par les fournisseurs d'énergie eux-mêmes, aucun paiement n'est jamais demandé.",
      },
      {
        type: "instruction",
        texte: "« Ça coûte combien ? » → 0 € de principe. Ne jamais citer de montant de reste à charge sans confirmation du partenaire.",
      },
      {
        type: "instruction",
        texte: "« Pas le temps » → proposer un simple appel/passage technicien de 15-20 min, à l'horaire choisi par l'exploitant.",
      },
      {
        type: "instruction",
        texte: "« Déjà démarché » → demander si les travaux ont déjà été réalisés ; sinon confirmer que l'offre reste valable.",
      },
    ],
  },
];

// `sections` : contenu personnalisé par un super-administrateur (voir
// PUT /api/script-vente dans index.js), persisté dans
// db.data.contenusEditables.scriptVente — seulement pour l'espace OETH pour
// l'instant (absent/null tant que personne n'a rien modifié, auquel cas
// SECTIONS_PAR_DEFAUT s'applique). L'espace CEE a son propre contenu fixe
// (SECTIONS_CEE) ; l'édition par un super-admin pourra être ajoutée plus tard
// de la même façon si besoin.
export function getScriptVente(sections = null, espace = "oeth") {
  if (espace === "cee") return { sections: SECTIONS_CEE };
  return { sections: sections || SECTIONS_PAR_DEFAUT };
}
