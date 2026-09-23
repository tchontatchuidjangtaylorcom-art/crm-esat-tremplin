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

export function getScriptVente() {
  return {
    sections: [
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
    ],
  };
}
