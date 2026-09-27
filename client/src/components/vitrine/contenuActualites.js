// Actualités réglementaires (bouton flottant orange + page /vitrine/actualites).
// Faits vérifiés (URSSAF, Code du travail, réforme OETH 2020, SMIC 2026) —
// à mettre à jour à chaque évolution (SMIC, échéances, textes).

export const ACTUALITES = [
  {
    titre: "DOETH 2026 : déclaration en avril 2027",
    texte:
      "La contribution au titre de l'exercice 2026 se déclare dans la DSN d'avril 2027 (échéance du 5 ou du 15 mai 2027) et se règle à l'URSSAF, ou à la MSA pour le régime agricole.",
    theme: "Échéance",
  },
  {
    titre: "SMIC revalorisé au 1er juin 2026",
    texte:
      "Le SMIC horaire brut est de 12,31 € depuis le 1er juin 2026 (12,02 € au 1er janvier). Le SMIC retenu pour la contribution est celui en vigueur au 31 décembre de l'exercice.",
    theme: "SMIC",
  },
  {
    titre: "Fin de l'écrêtement OETH",
    texte:
      "Le mécanisme transitoire d'écrêtement, prévu par la réforme de 2020, a concerné les déclarations 2020 à 2024. Il ne s'applique plus : en DSN, le code 067 reprend le montant du code 066.",
    theme: "Réforme",
  },
  {
    titre: "Coefficients de contribution",
    texte:
      "Chaque bénéficiaire manquant coûte 400 × SMIC de 20 à 249 salariés, 500 × SMIC de 250 à 749 salariés et 600 × SMIC à partir de 750 salariés.",
    theme: "Calcul",
  },
  {
    titre: "Contribution majorée : 1 500 × SMIC",
    texte:
      "Après plus de 3 années consécutives sans aucune action (aucun bénéficiaire employé, pas de sous-traitance suffisante, pas d'accord agréé), le coefficient passe à 1 500 × SMIC par unité manquante.",
    theme: "Calcul",
  },
  {
    titre: "Seuil de sous-traitance : 7 386 €",
    texte:
      "600 × SMIC horaire, soit 7 386 € avec le SMIC de 12,31 € : c'est le montant de main-d'œuvre confié à une EA, un ESAT ou un TIH qui permet d'écarter la contribution majorée.",
    theme: "Sous-traitance",
  },
  {
    titre: "Quota légal de 6 %",
    texte:
      "Les entreprises assujetties doivent employer 6 % de bénéficiaires de l'obligation d'emploi, calculé sur l'effectif d'assujettissement et arrondi à l'entier inférieur.",
    theme: "Obligation",
  },
  {
    titre: "Entreprises de 20 salariés et plus",
    texte:
      "Toutes les entreprises déclarent chaque mois leurs bénéficiaires en DSN, mais seules celles d'au moins 20 salariés sont soumises au quota. Une entreprise qui franchit ce seuil dispose de 5 ans pour s'y conformer.",
    theme: "Obligation",
  },
  {
    titre: "Référent handicap dès 250 salariés",
    texte:
      "Les entreprises d'au moins 250 salariés doivent désigner un référent chargé d'orienter, d'informer et d'accompagner les personnes en situation de handicap (article L5213-6-1 du Code du travail).",
    theme: "Obligation",
  },
  {
    titre: "Accord agréé",
    texte:
      "Un accord de branche, de groupe ou d'entreprise agréé, conclu pour 3 ans et renouvelable une fois, permet de s'acquitter de l'obligation en mettant en œuvre un programme en faveur de l'emploi des travailleurs handicapés.",
    theme: "Accord",
  },
  {
    titre: "Sous-traitance : 30 % de la main-d'œuvre",
    texte:
      "La déduction est égale à 30 % du coût de la main-d'œuvre facturée par l'EA, l'ESAT ou le TIH, dans la limite de 50 % de la contribution brute (75 % si le taux d'emploi direct atteint 3 %).",
    theme: "Sous-traitance",
  },
  {
    titre: "Dépenses déductibles : plafond de 10 %",
    texte:
      "Accessibilité (062), maintien et reconversion (063), accompagnement et sensibilisation (064), partenariats associatifs (072) : ces dépenses se déduisent dans la limite de 10 % de la contribution brute.",
    theme: "Déductions",
  },
  {
    titre: "ECAP : 17 × SMIC par salarié",
    texte:
      "Chaque salarié occupant un emploi exigeant des conditions d'aptitude particulières ouvre droit à une déduction de 17 × SMIC horaire, déclarée sous le code DSN 060.",
    theme: "Déductions",
  },
  {
    titre: "Codes DSN 065 à 068",
    texte:
      "Contribution brute (065), nette avant écrêtement (066), nette après écrêtement (067) et réelle due (068) se déclarent ensemble, arrondies à l'euro, dans le bloc S21.G00.82.",
    theme: "Déclaration",
  },
  {
    titre: "Préparer sa déclaration dès maintenant",
    texte:
      "Vérifiez les effectifs mis à disposition par l'URSSAF, vos bénéficiaires, les attestations de vos fournisseurs EA/ESAT/TIH et vos dépenses. Une simulation permet d'anticiper le montant.",
    theme: "Conseil",
    action: { label: "Simuler ma contribution", to: "/vitrine#simulateur" },
  },
];
