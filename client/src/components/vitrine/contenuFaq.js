// Foire aux questions (bouton flottant FAQ, page /vitrine/faq, données
// structurées FAQPage injectées par le serveur — voir server/src/seo.js — et
// base de réponses de l'assistant automatique). `motsCles` sert à l'assistant
// pour retrouver la bonne réponse (comparaison sans accents ni majuscules).
// Réponses factuelles, alignées sur les règles de droit commun du simulateur,
// rédigées avec les expressions recherchées par les DRH (calcul contribution
// Agefiph, plafond OETH, déclaration obligatoire d'emploi, seuils d'effectif).

export const CATEGORIES_FAQ = ["L'obligation", "Le calcul", "Les déductions", "La déclaration", "Vigilance et contact"];

export const FAQ = [
  // ── L'obligation ───────────────────────────────────────────────────────
  {
    id: "qui-concerne",
    categorie: "L'obligation",
    question: "Quelles entreprises sont soumises à l'obligation d'emploi des travailleurs handicapés (OETH) ?",
    reponse:
      "Toutes les entreprises déclarent chaque mois leurs bénéficiaires de l'obligation d'emploi dans la DSN. Mais seules celles qui atteignent le seuil d'effectif de 20 salariés doivent employer 6 % de travailleurs handicapés, et versent une contribution OETH (souvent appelée « contribution Agefiph ») si ce taux n'est pas atteint.",
    motsCles: ["concerne", "qui", "assujetti", "soumis", "obligation", "20 salaries", "entreprise", "oeth"],
    populaire: true,
  },
  {
    id: "doeth",
    categorie: "L'obligation",
    question: "Qu'est-ce que la DOETH, la déclaration obligatoire d'emploi des travailleurs handicapés ?",
    reponse:
      "La DOETH est la déclaration annuelle par laquelle l'employeur d'au moins 20 salariés justifie du respect de son obligation d'emploi de 6 % et déclare, le cas échéant, sa contribution. Depuis la réforme de 2020, elle est intégrée à la DSN : les bénéficiaires sont déclarés chaque mois, puis la déclaration annuelle se fait dans la DSN d'avril de l'année suivante (la DOETH 2026 se déclare en avril 2027).",
    motsCles: ["doeth", "declaration obligatoire", "declaration annuelle", "definition", "c'est quoi"],
    populaire: true,
  },
  {
    id: "seuils",
    categorie: "L'obligation",
    question: "Quels sont les seuils d'effectif de l'obligation d'emploi handicap ?",
    reponse:
      "20 salariés : seuil d'assujettissement à l'OETH et au taux d'emploi de 6 %. 250 salariés : le coefficient de contribution passe de 400 à 500 × SMIC et la désignation d'un référent handicap devient obligatoire. 750 salariés : le coefficient passe à 600 × SMIC. Une entreprise qui franchit le seuil de 20 salariés dispose de 5 ans pour se mettre en conformité.",
    motsCles: ["seuil", "seuils", "effectif", "20 salaries", "250", "750", "tranche", "taille"],
    populaire: true,
  },
  {
    id: "employeur-public",
    categorie: "L'obligation",
    question: "Mon organisation est un employeur public : que dois-je faire ?",
    reponse:
      "Les employeurs publics (État, collectivités territoriales, établissements hospitaliers et autres établissements publics) d'au moins 20 agents sont aussi soumis au taux d'emploi de 6 %, mais ils déclarent chaque année au FIPHFP (Fonds pour l'insertion des personnes handicapées dans la fonction publique), et non dans la DSN auprès de l'URSSAF. Le calcul de leur contribution suit des règles propres à la fonction publique.",
    motsCles: ["public", "fiphfp", "fonction publique", "collectivite", "mairie", "hopital", "etat", "agents"],
    lien: { label: "Site du FIPHFP", href: "https://www.fiphfp.fr/" },
  },
  {
    id: "boeth",
    categorie: "L'obligation",
    question: "Qu'est-ce qu'un BOETH (bénéficiaire de l'obligation d'emploi) ?",
    reponse:
      "Un bénéficiaire de l'obligation d'emploi des travailleurs handicapés : salarié titulaire d'une RQTH, d'une pension d'invalidité, de l'AAH, de la carte mobilité inclusion mention invalidité, ou victime d'un accident du travail ou d'une maladie professionnelle avec un taux d'incapacité d'au moins 10 %. Il compte au prorata de son temps de travail et de sa présence dans l'année.",
    motsCles: ["boeth", "beneficiaire", "rqth", "travailleur handicape", "aah", "invalidite"],
  },
  {
    id: "franchissement",
    categorie: "L'obligation",
    question: "Que se passe-t-il quand l'entreprise atteint 20 salariés ?",
    reponse:
      "Une entreprise qui franchit le seuil d'effectif de 20 salariés dispose de 5 ans pour se mettre en conformité avec l'obligation d'emploi de 6 %. Elle continue néanmoins de déclarer ses bénéficiaires chaque mois en DSN.",
    motsCles: ["franchissement", "atteint 20", "nouvelle entreprise", "creation", "5 ans", "delai"],
  },
  {
    id: "effectif",
    categorie: "L'obligation",
    question: "Qu'est-ce que l'effectif d'assujettissement OETH ?",
    reponse:
      "C'est l'effectif moyen annuel de l'entreprise, calculé selon les règles de la Sécurité sociale. L'URSSAF (ou la MSA) le met à disposition de l'employeur chaque année : c'est ce chiffre qui détermine le seuil d'assujettissement et sert au calcul du quota de 6 %.",
    motsCles: ["effectif", "assujettissement", "ema", "effectif moyen"],
  },

  // ── Le calcul ──────────────────────────────────────────────────────────
  {
    id: "quota",
    categorie: "Le calcul",
    question: "Comment calculer le quota de 6 % de travailleurs handicapés ?",
    reponse:
      "On applique 6 % à l'effectif d'assujettissement et on arrondit à l'entier inférieur. Exemple : 45 salariés × 6 % = 2,7, soit un quota de 2 bénéficiaires. Le taux d'emploi direct se calcule ensuite ainsi : bénéficiaires ÷ effectif × 100.",
    motsCles: ["quota", "6 %", "6%", "taux", "taux d'emploi", "calcul 6", "arrondi"],
  },
  {
    id: "taxe-agefiph",
    categorie: "Le calcul",
    question: "Qu'appelle-t-on la « taxe Agefiph » ou contribution Agefiph ?",
    reponse:
      "C'est le nom courant de la contribution OETH, due par une entreprise d'au moins 20 salariés qui n'atteint pas le taux d'emploi de 6 %. Depuis la réforme de 2020, elle est déclarée dans la DSN et recouvrée par l'URSSAF (ou la MSA), qui la reverse à l'Agefiph pour financer l'insertion professionnelle des personnes handicapées.",
    motsCles: ["taxe", "taxe agefiph", "contribution agefiph", "agefiph", "impot"],
  },
  {
    id: "contribution",
    categorie: "Le calcul",
    question: "Comment calculer la contribution Agefiph (contribution OETH) ?",
    reponse:
      "Contribution brute = bénéficiaires manquants × coefficient × SMIC horaire. Le coefficient est de 400 de 20 à 249 salariés, 500 de 250 à 749 salariés et 600 à partir de 750 salariés. Les déductions (sous-traitance, ECAP, dépenses) sont ensuite retranchées, dans leurs plafonds. Exemple : 34 salariés et 0,34 BOETH, soit un quota de 2 et un manque de 1,66 : 1,66 × 400 × 12,31 € = 8 174 €.",
    motsCles: ["contribution", "montant", "calcul", "calculer", "coefficient", "combien", "payer", "cout"],
    populaire: true,
  },
  {
    id: "smic",
    categorie: "Le calcul",
    question: "Quel SMIC retenir pour le calcul de la contribution OETH ?",
    reponse:
      "Le SMIC horaire brut en vigueur au 31 décembre de l'exercice concerné : 11,88 € pour l'exercice 2025, 12,31 € depuis le 1er juin 2026 pour l'exercice 2026 (sauf nouvelle revalorisation d'ici la fin de l'année).",
    motsCles: ["smic", "taux horaire", "12,31", "11,88", "revalorisation"],
  },
  {
    id: "majoree",
    categorie: "Le calcul",
    question: "Qu'est-ce que la contribution majorée (surcontribution de 1 500 × SMIC) ?",
    reponse:
      "Après plus de 3 années consécutives sans aucune action — aucun bénéficiaire employé, pas de sous-traitance EA/ESAT/TIH d'au moins 600 × SMIC, pas d'accord agréé — chaque bénéficiaire manquant est calculé à 1 500 × SMIC, soit 18 465 € avec le SMIC de 12,31 €, au lieu de 400, 500 ou 600 × SMIC.",
    motsCles: ["surcontribution", "majoree", "majoration", "1500", "1 500", "4 ans", "3 ans"],
    populaire: true,
  },
  {
    id: "sortir-majoree",
    categorie: "Le calcul",
    question: "Comment éviter ou sortir de la contribution majorée ?",
    reponse:
      "Une seule action suffit : employer au moins un bénéficiaire (même à temps partiel), confier au moins 600 × SMIC de main-d'œuvre à une EA, un ESAT ou un TIH (7 386 € avec le SMIC de 12,31 €), ou appliquer un accord agréé. Le coefficient normal (400, 500 ou 600) s'applique alors.",
    motsCles: ["sortir", "eviter", "surcontribution", "majoree", "reduire", "baisser"],
  },
  {
    id: "fiabilite",
    categorie: "Le calcul",
    question: "Le simulateur de contribution OETH est-il fiable ?",
    reponse:
      "Il applique les règles de droit commun issues de la réforme de 2020 (quota, coefficients, contribution majorée, déductions et plafonds) et donne une estimation indicative à partir de vos données. Il ne remplace pas votre déclaration : seule l'URSSAF (ou la MSA) calcule et recouvre la contribution.",
    motsCles: ["fiable", "simulateur", "estimation", "exact", "officiel"],
  },

  // ── Les déductions ─────────────────────────────────────────────────────
  {
    id: "plafonds",
    categorie: "Les déductions",
    question: "Quels sont les plafonds de déduction de la contribution OETH ?",
    reponse:
      "Sous-traitance auprès d'une EA, d'un ESAT ou d'un TIH : déduction limitée à 50 % de la contribution brute, ou 75 % si votre taux d'emploi direct atteint 3 %. Dépenses déductibles (codes DSN 062, 063, 064 et 072) : plafond de 10 % de la contribution brute. Les déductions ne peuvent pas rendre la contribution négative. L'écrêtement, plafonnement transitoire appliqué de 2020 à 2024, a pris fin.",
    motsCles: ["plafond", "plafonds", "plafond oeth", "limite", "maximum", "50 %", "75 %", "10 %", "ecretement"],
    populaire: true,
  },
  {
    id: "sous-traitance",
    categorie: "Les déductions",
    question: "Comment déduire la sous-traitance EA / ESAT / TIH de la contribution Agefiph ?",
    reponse:
      "La déduction est égale à 30 % du coût de la main-d'œuvre facturée, hors taxes et hors matières premières, dans la limite de 50 % de la contribution brute (75 % si votre taux d'emploi direct atteint 3 %). Elle se déclare sous le code DSN 061, sur la base de l'attestation annuelle de la structure.",
    motsCles: ["sous-traitance", "sous traitance", "esat", "ea", "tih", "achat", "prestation", "061", "entreprise adaptee"],
  },
  {
    id: "ecap",
    categorie: "Les déductions",
    question: "Qu'est-ce qu'un ECAP et quelle déduction ouvre-t-il ?",
    reponse:
      "Un emploi exigeant des conditions d'aptitude particulières (conducteurs routiers, ouvriers du BTP, agents de sécurité…). Chaque salarié occupant un ECAP ouvre droit à une déduction de 17 × SMIC horaire sur la contribution OETH (code DSN 060).",
    motsCles: ["ecap", "aptitude", "060", "chauffeur", "btp"],
  },
  {
    id: "depenses",
    categorie: "Les déductions",
    question: "Quelles dépenses sont déductibles de la contribution OETH ?",
    reponse:
      "Les dépenses d'accessibilité allant au-delà des obligations légales (062), de maintien dans l'emploi et de reconversion (063), d'accompagnement, de formation et de sensibilisation (064) et les partenariats associatifs (072), non financées par des aides, dans la limite de 10 % de la contribution brute.",
    motsCles: ["depenses", "deductibles", "062", "063", "064", "072", "accessibilite", "formation", "sensibilisation"],
  },
  {
    id: "accord",
    categorie: "Les déductions",
    question: "Qu'est-ce qu'un accord agréé en faveur de l'emploi des travailleurs handicapés ?",
    reponse:
      "Un accord de branche, de groupe ou d'entreprise agréé par l'administration, conclu pour 3 ans et renouvelable une fois. L'entreprise s'acquitte alors de son obligation d'emploi en finançant le programme de l'accord plutôt qu'en versant la contribution.",
    motsCles: ["accord", "agree", "accord agree", "branche", "groupe"],
  },

  // ── La déclaration ─────────────────────────────────────────────────────
  {
    id: "quand-declarer",
    categorie: "La déclaration",
    question: "Quand et comment faire la déclaration obligatoire d'emploi (DOETH 2026) ?",
    reponse:
      "La déclaration annuelle se fait dans la DSN d'avril de l'année suivant l'exercice (échéance du 5 ou du 15 mai), à partir des effectifs mis à disposition par l'URSSAF ou la MSA. La DOETH au titre de l'exercice 2026 se déclare donc dans la DSN d'avril 2027.",
    motsCles: ["declarer", "declaration", "quand", "echeance", "dsn", "avril", "mai", "date", "doeth 2026"],
  },
  {
    id: "codes-dsn",
    categorie: "La déclaration",
    question: "Quels codes DSN utiliser pour la déclaration OETH ?",
    reponse:
      "Dans le bloc S21.G00.82 : 060 (ECAP), 061 (sous-traitance), 062, 063, 064 et 072 (dépenses déductibles), puis 065 (contribution brute), 066 et 067 (nette avant et après écrêtement) et 068 (contribution réelle due). Les codes 065 à 068 se déclarent ensemble, arrondis à l'euro.",
    motsCles: ["code", "codes", "dsn", "065", "066", "067", "068", "s21.g00.82", "bloc"],
  },
  {
    id: "qui-encaisse",
    categorie: "La déclaration",
    question: "Qui encaisse la contribution OETH ?",
    reponse:
      "Uniquement l'URSSAF, ou la MSA pour le régime agricole ; les employeurs publics relèvent du FIPHFP. Aucun prestataire, cabinet ou organisme tiers n'est habilité à encaisser la contribution OETH à leur place.",
    motsCles: ["encaisse", "payer", "paiement", "regler", "urssaf", "msa", "qui paie"],
  },

  // ── Vigilance et contact ───────────────────────────────────────────────
  {
    id: "sollicitation",
    categorie: "Vigilance et contact",
    question: "On m'a contacté au sujet d'un « dossier OETH », que faire ?",
    reponse:
      "Ne réglez rien dans l'urgence. Demandez le nom de la structure, son SIRET et une adresse e-mail professionnelle, notez le numéro appelant, puis faites vérifier la sollicitation via notre page Vigilance.",
    motsCles: ["appel", "contacte", "sollicitation", "arnaque", "fraude", "vigilance", "dossier", "suspect"],
    lien: { label: "Page Vigilance", to: "/vitrine/vigilance" },
  },
  {
    id: "contact",
    categorie: "Vigilance et contact",
    question: "Comment contacter le pôle ?",
    reponse:
      "Par e-mail à contact@oeth-fiph.fr, par téléphone au +33 7 44 12 79 17, ou en réservant directement un créneau avec un expert (du lundi au vendredi, 8h45–18h). L'adresse postale, utile pour l'envoi de documents, vous est communiquée par un conseiller.",
    motsCles: ["contact", "contacter", "joindre", "telephone", "email", "mail", "adresse", "rendez-vous", "expert", "conseiller"],
    lien: { label: "Réserver un échange", to: "/vitrine/pilotage" },
  },
  {
    id: "accompagnement",
    categorie: "Vigilance et contact",
    question: "Comment pouvez-vous m'accompagner sur l'OETH ?",
    reponse:
      "Un conseiller fait le point sur votre situation OETH, identifie vos leviers (recrutement, démarches RQTH, achats auprès d'EA/ESAT/TIH, dépenses déductibles) et vous aide à préparer votre déclaration obligatoire d'emploi. Le premier échange est gratuit et sans engagement.",
    motsCles: ["accompagner", "aide", "accompagnement", "conseil", "analyse", "diagnostic"],
    lien: { label: "Découvrir le pilotage handicap", to: "/vitrine/pilotage" },
  },
];

// Recherche sans accents ni majuscules (assistant et page FAQ).
export function normaliser(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%., -]/g, " ");
}

// Meilleure réponse pour une question libre : score = mots-clés trouvés
// (poids 3) + mots de la question retrouvés dans l'intitulé (poids 1).
// Un mot-clé ne compte qu'en début de mot ("ema" ne doit pas matcher
// "demain", "ea" ne doit pas matcher "creation").
function contientMotCle(texteNormalise, cle) {
  const c = normaliser(cle).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s'-])${c}`).test(texteNormalise);
}

export function trouverReponse(question) {
  const q = normaliser(question);
  const mots = q.split(/\s+/).filter((m) => m.length > 3);
  let meilleure = null;
  let meilleurScore = 0;
  for (const item of FAQ) {
    let score = 0;
    for (const cle of item.motsCles) if (contientMotCle(q, cle)) score += 3;
    const intitule = normaliser(item.question);
    for (const m of mots) if (intitule.includes(m)) score += 1;
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleure = item;
    }
  }
  return meilleurScore >= 3 ? meilleure : null;
}
