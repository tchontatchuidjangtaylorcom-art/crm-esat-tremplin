// Fiches d'aide du simulateur OETH public (icônes ⓘ → AideModale.jsx).
// Tous les textes pédagogiques sont centralisés ici pour être relus et
// corrigés sans toucher au composant. Le bouton "Écouter" lit exactement ces
// textes (synthèse vocale du navigateur) : pas d'écart entre l'écrit et l'oral.
//
// Règles de droit commun issues de la réforme 2020 (Code du travail,
// art. L5212-1 et suivants ; guide OETH URSSAF ; fiche Agefiph n°6). Montants
// d'exemple calculés avec le SMIC horaire retenu par le simulateur (12,31 €).

const SOURCE_URSSAF = {
  label: "URSSAF — Contribution annuelle OETH",
  url: "https://www.urssaf.fr/accueil/employeur/cotisations/liste-cotisations/contribution-annuelle-oeth.html",
};
const SOURCE_GUIDE = {
  label: "Guide officiel OETH (URSSAF / Agefiph, PDF)",
  url: "https://www.urssaf.fr/files/live/sites/urssaffr/files/outils-documentation/guides/Guide-OETH.pdf",
};

export const AIDES = {
  effectif: {
    titre: "Effectif d'assujettissement",
    definition:
      "C'est le nombre moyen de salariés de votre entreprise sur l'année, calculé selon les règles de la Sécurité sociale. L'URSSAF vous le communique chaque année : c'est ce chiffre qu'il faut reprendre ici.",
    calcul:
      "La contribution ne concerne que les entreprises d'au moins 20 salariés. Si votre effectif est inférieur à 20, vous n'êtes pas concerné : aucune contribution à payer. À partir de 20, vous devez employer 6 % de bénéficiaires, arrondi à l'entier inférieur. Exemple : 45 salariés × 6 % = 2,7, soit un quota de 2 bénéficiaires.",
    conseil:
      "Même sous 20 salariés, toutes les entreprises déclarent chaque mois leurs salariés bénéficiaires dans la DSN. Une entreprise qui franchit le seuil de 20 dispose de 5 ans avant d'être redevable.",
    sources: [SOURCE_URSSAF],
  },
  boeth: {
    titre: "BOETH — Bénéficiaires de l'obligation d'emploi",
    definition:
      "Ce sont les salariés que la loi reconnaît comme travailleurs handicapés : titulaires d'une RQTH, d'une pension d'invalidité, de l'AAH, de la carte mobilité inclusion mention invalidité, ou victimes d'un accident du travail ou d'une maladie professionnelle avec un taux d'incapacité d'au moins 10 %.",
    calcul:
      "Chaque bénéficiaire compte au prorata de son temps de travail et de sa présence dans l'année : c'est pourquoi le chiffre peut avoir des décimales. Exemple : un salarié à mi-temps toute l'année compte pour 0,5. Les stagiaires, intérimaires et personnes en mise en situation professionnelle bénéficiaires sont aussi pris en compte.",
    conseil:
      "Reprenez le nombre de bénéficiaires indiqué par l'URSSAF ou votre logiciel de paie. Beaucoup de salariés ne signalent pas leur reconnaissance : une démarche interne de sensibilisation peut révéler des bénéficiaires déjà présents.",
    sources: [SOURCE_URSSAF],
  },
  sousTraitance: {
    titre: "Sous-traitance EA / ESAT / TIH",
    definition:
      "Ce sont les achats de biens ou de services auprès du secteur protégé et adapté : les Entreprises Adaptées (EA), les Établissements et Services d'Aide par le Travail (ESAT) et les Travailleurs Indépendants Handicapés (TIH). Exemples : entretien d'espaces verts, blanchisserie, impression, restauration, prestations administratives.",
    calcul:
      "On retient uniquement le coût de la main-d'œuvre figurant sur les factures, hors taxes et hors matières premières. La déduction vaut 30 % de ce montant. Exemple : 20 000 € de main-d'œuvre, soit 6 000 € de déduction. Elle est plafonnée à 50 % de la contribution brute, ou 75 % si votre taux d'emploi direct atteint 3 %.",
    conseil:
      "Si vous ne travaillez avec aucun de ces organismes, répondez simplement Non. Demandez à vos fournisseurs EA, ESAT ou TIH l'attestation annuelle qui indique le montant de main-d'œuvre valorisable.",
    sources: [SOURCE_GUIDE],
  },
  ecap: {
    titre: "ECAP — Emplois exigeant des conditions d'aptitude particulières",
    definition:
      "Ce sont des métiers qu'une liste officielle considère comme difficiles à confier à une personne handicapée, en raison de fortes exigences physiques ou de sécurité : conducteurs routiers, ouvriers du BTP, agents de sécurité, convoyeurs de fonds, marins, pompiers…",
    calcul:
      "Chaque salarié occupant un ECAP ouvre droit à une déduction de 17 × SMIC horaire, soit environ 209 € par salarié. Exemple : 10 chauffeurs routiers, soit 10 × 17 × 12,31 € = 2 093 € déduits.",
    conseil:
      "La plupart des entreprises de bureau, de commerce ou de services n'en ont aucun : laissez alors le champ vide.",
    sources: [SOURCE_GUIDE],
  },
  depenses: {
    titre: "Autres dépenses déductibles",
    definition:
      "Ce sont certaines dépenses engagées en faveur de l'emploi des personnes handicapées, non financées par des aides : travaux d'accessibilité des locaux allant au-delà des obligations légales, maintien dans l'emploi et reconversion, accompagnement des salariés bénéficiaires, sensibilisation et formation des équipes, partenariats avec des associations spécialisées.",
    calcul:
      "Le montant est déduit à 100 %, mais dans la limite de 10 % de la contribution brute. Exemple : pour une contribution brute de 18 465 €, au plus 1 846,50 € de dépenses peuvent être déduites.",
    conseil: "Conservez les factures et justificatifs : ils peuvent être demandés en cas de contrôle.",
    sources: [SOURCE_GUIDE],
  },
  regle4ans: {
    titre: "La règle des 4 ans (base majorée)",
    definition:
      "La loi pénalise plus fortement les entreprises qui n'ont engagé aucune action pendant plus de 3 années consécutives, c'est-à-dire dès la 4e année.",
    calcul:
      "Si, sur cette période, l'entreprise n'a employé aucun bénéficiaire, n'a pas sous-traité au moins 600 × SMIC (soit 7 386 €) au secteur protégé, et n'applique pas d'accord agréé, la contribution passe à 1 500 × SMIC par bénéficiaire manquant, soit 18 465 € par unité manquante.",
    conseil:
      "Répondez Oui si vous avez employé au moins un bénéficiaire, même à temps partiel, au cours des 4 dernières années. Un seul recrutement ou un contrat suffisant avec un ESAT ou une EA suffit à sortir de cette base majorée.",
    sources: [SOURCE_URSSAF],
  },
  objectif: {
    titre: "Le taux d'emploi et l'objectif de 6 %",
    definition:
      "Le taux d'emploi direct est la part de bénéficiaires dans votre effectif. La loi fixe un objectif de 6 %.",
    calcul:
      "Taux d'emploi = bénéficiaires ÷ effectif × 100. Exemple : 1 bénéficiaire pour 50 salariés, soit 2 %. La jauge montre votre progression vers l'objectif de 6 %.",
    conseil:
      "Atteindre 3 % permet déjà de relever le plafond de déduction de la sous-traitance de 50 % à 75 %.",
    sources: [SOURCE_URSSAF],
  },
  coefficient: {
    titre: "Le coefficient",
    definition:
      "C'est le nombre de SMIC horaires à payer pour chaque bénéficiaire manquant. Il dépend de la taille de l'entreprise.",
    calcul:
      "400 × SMIC de 20 à 249 salariés, 500 × SMIC de 250 à 749 salariés, 600 × SMIC à partir de 750 salariés. Il passe à 1 500 × SMIC en cas de base majorée, c'est-à-dire sans aucune action depuis plus de 3 ans.",
    conseil: "Avec un SMIC à 12,31 €, une unité manquante coûte 4 924 € au coefficient 400, et 18 465 € en base majorée.",
    sources: [SOURCE_URSSAF],
  },
  contribution: {
    titre: "Contribution brute et nette",
    definition:
      "La contribution brute est le montant dû avant toute déduction. La contribution nette est ce qu'il reste à payer une fois les déductions appliquées.",
    calcul:
      "Contribution brute = bénéficiaires manquants × coefficient × SMIC horaire. Contribution nette = brute − sous-traitance − ECAP − dépenses déductibles. Exemple : 20 salariés, aucun bénéficiaire et aucune action, soit 1 × 1 500 × 12,31 € = 18 465 €.",
    conseil:
      "La contribution d'une année se déclare dans la DSN d'avril de l'année suivante, pour un paiement au 5 ou au 15 mai. Ce simulateur donne une estimation indicative : seule l'URSSAF calcule et recouvre la contribution.",
    sources: [SOURCE_URSSAF, SOURCE_GUIDE],
  },
  economie: {
    titre: "Potentiel d'économie",
    definition:
      "C'est l'écart entre le montant maximal prévu par la loi, 1 500 × SMIC par unité manquante, et votre contribution nette estimée.",
    calcul:
      "Économie = base maximale − contribution nette. Elle mesure l'effet de vos actions déjà engagées : emploi direct, sous-traitance, ECAP et dépenses déductibles.",
    conseil:
      "Chaque bénéficiaire recruté ou chaque achat auprès d'un ESAT ou d'une EA réduit directement la contribution. Un conseiller peut vous aider à identifier les leviers les plus efficaces.",
    sources: [SOURCE_GUIDE],
  },
};

// Texte lu par le bouton "Écouter" : les symboles sont remplacés par des mots
// pour que la synthèse vocale les prononce correctement.
export function texteAudio(aide) {
  return [aide.titre, aide.definition, "Comment c'est calculé.", aide.calcul, "Ce que ça change pour vous.", aide.conseil]
    .join(". ")
    .replace(/\.\s*\./g, ".")
    .replace(/×/g, " fois ")
    .replace(/÷/g, " divisé par ")
    .replace(/−/g, " moins ")
    .replace(/ⓘ/g, "");
}
