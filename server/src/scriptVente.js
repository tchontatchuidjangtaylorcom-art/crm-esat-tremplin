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
// Repris du document fourni par le partenaire "Script Télépros — Serres
// agricoles | Version 4" (Démétherme 400), partagé le 2026-10-27 — fait
// autorité sur le pitch maison du 2026-10-26, plus complet (données CRM
// déjà en main, produit chiffré, déroulé de signature Yousign détaillé,
// garde-fous de conformité explicites en section 8).
// Société à annoncer en ouverture : Eco Smart France (confirmé 2026-10-27).
// Un champ reste à vérifier avant diffusion aux agents :
//  - "mandataire CEE" (section 1) : à dire seulement si la société en
//    dispose réellement du mandat — confirmer avec le partenaire.
//  - Les chiffres produit (puissance, COP) sont ceux du partenaire ; ne pas
//    les modifier sans source.
export const SECTIONS_CEE = [
  {
    titre: "1. Accroche — à apprendre par cœur",
    lignes: [
      {
        type: "texte",
        texte: `« Bonjour Monsieur / Madame [Nom], c'est ${AGENT} d'Eco Smart France, mandataire CEE, les Certificats d'Économies d'Énergie. Je vous appelle pour vos serres agricoles. En ce moment, nous proposons une pompe à chaleur pour chauffer les serres, avec une offre à zéro euro pour les dossiers qui remplissent les conditions. On va reprendre ensemble deux ou trois infos sur votre exploitation. Vous avez bien [nombre] serres ? »`,
      },
      {
        type: "instruction",
        texte:
          "Dire « mandataire CEE » seulement si la société dispose réellement du mandat. Vérifier que le zéro euro est prévu pour le dossier concerné.",
      },
    ],
  },
  {
    titre: "2. Questions pour orienter l'appel (CRM)",
    lignes: [
      {
        type: "texte",
        texte:
          "« Je vois ici [nombre] serres, pour à peu près [surface] m². C'est toujours ça ? Elles sont chauffées aujourd'hui ou pas ? Vous cultivez quoi dedans ? Et vous êtes toujours à [commune] ? »",
      },
      { type: "instruction", texte: "Ne pas tout redemander : reprendre simplement ce qui est déjà dans le CRM (fiche prospect)." },
    ],
  },
  {
    titre: "3A. Si les serres sont déjà chauffées",
    lignes: [
      {
        type: "texte",
        texte:
          "« D'accord, donc vous avez déjà un chauffage. L'idée, c'est de remplacer votre chaudière par une pompe à chaleur. Ça peut vous permettre de dépenser moins pour chauffer vos serres. On vérifiera sur place que c'est adapté à votre installation. »",
      },
    ],
  },
  {
    titre: "3B. Si les serres ne sont pas chauffées",
    lignes: [
      {
        type: "texte",
        texte:
          "« D'accord. L'intérêt, c'est d'avoir un chauffage disponible si vous en avez besoin plus tard. Vous l'allumez quand vous en avez l'utilité. Le technicien vérifiera si votre serre peut recevoir ce système et si le dossier entre dans le dispositif. »",
      },
    ],
  },
  {
    titre: "4. Les avantages du produit (du plus à savoir)",
    lignes: [
      {
        type: "instruction",
        texte:
          "Démétherme 400 : sert à chauffer les serres, peut remplacer un chauffage existant. Puissance annoncée 411,1 kW. Eau chaude jusqu'à 60 °C. COP annoncé 3,56, selon les conditions de mesure. Les économies dépendent du bâtiment et de l'utilisation — ne jamais garantir un chiffre d'économie précis.",
      },
    ],
  },
  {
    titre: "5. Informations à confirmer dans le CRM",
    lignes: [
      {
        type: "instruction",
        texte:
          "Nom de l'exploitation, nom du gérant, téléphone, e-mail, adresse, nombre de serres, surface, cultures, chauffage actuel et énergie utilisée.",
      },
    ],
  },
  {
    titre: "6. Objections clients — réponses simples",
    lignes: [
      {
        type: "instruction",
        texte:
          "« C'est vraiment à zéro euro ? » → « Oui, si votre dossier correspond à cette offre, le devis indique bien zéro euro à votre charge. Vous n'avez pas d'avance de fonds à faire : le financement prévu est versé directement dans le cadre de l'opération. Ce sont les entreprises soumises aux obligations CEE, notamment des fournisseurs d'énergie, qui financent ces économies d'énergie. On vérifie les conditions avant de confirmer votre dossier. »",
      },
      {
        type: "instruction",
        texte: "« Je n'ai pas de chauffage. » → « Justement, ça peut vous permettre d'en avoir un à disposition pour plus tard, si votre installation est adaptée. »",
      },
      {
        type: "instruction",
        texte: "« J'ai déjà une chaudière. » → « Très bien, l'idée est de la remplacer par une pompe à chaleur pour essayer de réduire votre facture. »",
      },
      {
        type: "instruction",
        texte: "« Ça consomme beaucoup ? » → « Ça consomme de l'électricité quand vous l'utilisez. La consommation dépend du temps de chauffage et de vos serres. »",
      },
      {
        type: "instruction",
        texte: "« Envoyez-moi un mail. » → « Oui, bien sûr. Je termine juste les informations de votre exploitation pour que vous receviez le bon document. Votre adresse e-mail, c'est bien [e-mail] ? »",
      },
      {
        type: "instruction",
        texte: "« Je ne connais pas votre société. » → « Je comprends. Vous trouverez notre nom et nos coordonnées sur le document, et je peux vous donner notre SIREN. »",
      },
      {
        type: "instruction",
        texte: "« Je suis occupé. » → « Je comprends. Il me reste juste deux informations à confirmer. Sinon, je peux vous rappeler à un meilleur moment. »",
      },
      {
        type: "instruction",
        texte:
          "« Pourquoi signer maintenant ? » → « Parce que cette offre peut évoluer vite. Si la date de clôture est bien fixée à une semaine, on vous le précise : il reste une semaine pour déposer les dossiers. La signature nous permet de lancer la vérification, pas de garantir automatiquement les aides. » Ne jamais annoncer un délai non réellement confirmé.",
      },
      {
        type: "instruction",
        texte: "« Je peux changer d'avis ? » → « On vous explique les conditions prévues dans le devis, notamment les possibilités d'annulation. Vous pouvez prendre connaissance du document avant de signer. »",
      },
    ],
  },
  {
    titre: "7. Conclusion — signature électronique Yousign",
    lignes: [
      {
        type: "texte",
        texte:
          "« Monsieur / Madame [Nom], je termine les informations de votre exploitation. Je vous envoie maintenant le devis par Yousign, c'est notre système de signature électronique. On va le faire ensemble. »",
      },
      {
        type: "texte",
        texte:
          "« Regardez vos e-mails : vous devriez avoir reçu un message Yousign. Ouvrez-le et cliquez sur le bouton pour consulter le devis. Vous voyez bien le document ? Prenez connaissance des informations et du montant affiché. Ensuite, allez jusqu'à la zone de signature. Selon l'écran, vous cliquez ou vous faites glisser la flèche pour valider. »",
      },
      {
        type: "texte",
        texte:
          "« Vous allez peut-être recevoir un SMS avec un code. Entrez ce code directement dans la case prévue sur votre écran pour terminer la signature. »",
      },
      {
        type: "texte",
        texte:
          "« Voilà, c'est signé. Notre équipe vous rappelle en général sous 24 heures pour vous dire si le dossier est confirmé. Si le dossier est refusé, le devis ne produit plus d'effet si sa clause de caducité le prévoit. S'il est accepté, on organise la visite technique avant de préparer l'installation. »",
      },
      {
        type: "instruction",
        texte: "Laisser le client lire le devis ; il doit saisir lui-même son code SMS et signer lui-même — jamais à la place du client.",
      },
    ],
  },
  {
    titre: "8. Points importants pour l'équipe",
    lignes: [
      {
        type: "instruction",
        texte:
          "Ne jamais annoncer une semaine restante sans date de clôture réellement confirmée. Ne pas promettre le zéro euro, l'absence d'avance ou l'annulation libre si le devis et les règles du dossier ne les prévoient pas. La signature ne bloque pas automatiquement une aide CEE : expliquer le processus réel. Ne pas présenter la société comme un service public.",
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
