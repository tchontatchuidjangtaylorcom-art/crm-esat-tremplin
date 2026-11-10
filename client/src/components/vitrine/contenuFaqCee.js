// Base de questions/réponses de l'offre CEE — serres agricoles (pompe à
// chaleur Démétherme 400, pour le compte d'Eco Smart France), utilisée à la
// fois par la page /vitrine/cee-serres (section "Questions fréquentes") et
// par l'assistant automatique (AssistantCee.jsx). Reprise fidèle du contenu
// déjà validé pour les agents au téléphone (server/src/scriptVente.js,
// SECTIONS_CEE) : accroche, avantages produit (section 4) et
// objections/réponses (section 6) — jamais de chiffre ou de délai inventé.
//
// Garde-fous de conformité (SECTIONS_CEE, section 8 "Points importants pour
// l'équipe"), valables ici aussi : ne jamais promettre le zéro euro, l'absence
// d'avance de fonds ou l'annulation libre comme acquis — toujours conditionné
// à la vérification du dossier ; ne jamais annoncer un chiffre d'économie ou
// un montant précis ; ne jamais présenter la société comme un service public
// ; décrire le financement CEE tel qu'il est réellement (entreprises privées
// soumises à une obligation légale, pas l'État) ; ne jamais annoncer un délai
// de clôture non réellement confirmé (les objections "pourquoi signer
// maintenant" du script ne sont donc pas reprises ici).

export const CATEGORIE_FAQ_CEE = "Offre serres agricoles (CEE)";

export const FAQ_CEE = [
  {
    id: "zero-euro",
    question: "C'est vraiment une offre à zéro euro ?",
    reponse:
      "L'offre à zéro euro ne s'applique qu'aux dossiers qui remplissent les conditions du dispositif CEE : elle est confirmée après vérification de votre dossier, pas avant. Le financement prévu passe par les entreprises soumises aux obligations CEE (notamment des fournisseurs d'énergie), pas par une aide de l'État. Un conseiller vérifie votre éligibilité avant toute confirmation.",
    motsCles: ["zero euro", "0 euro", "gratuit", "gratuite", "prix", "cout", "combien", "payant", "avance"],
    populaire: true,
  },
  {
    id: "quest-ce-que-cee",
    question: "Qu'est-ce que les CEE, les Certificats d'Économies d'Énergie ?",
    reponse:
      "Les CEE sont un dispositif qui oblige certaines entreprises, notamment des fournisseurs d'énergie, à financer des actions d'économies d'énergie. Ce n'est pas un programme public : ce sont des entreprises privées soumises à cette obligation légale qui financent le dispositif, pas l'État directement.",
    motsCles: ["cee", "certificat", "economies d'energie", "economie d'energie", "dispositif", "financement", "aide de l'etat"],
    populaire: true,
  },
  {
    id: "demetherme-400",
    question: "Que fait la pompe à chaleur Démétherme 400 ?",
    reponse:
      "Le Démétherme 400 sert à chauffer une serre agricole, ou à remplacer un chauffage existant. Puissance annoncée : 411,1 kW. Eau chaude jusqu'à 60 °C. COP annoncé de 3,56, selon les conditions de mesure. Les économies réelles dépendent de votre bâtiment et de votre utilisation : nous ne communiquons jamais un chiffre d'économie précis.",
    motsCles: ["demetherme", "pompe a chaleur", "puissance", "technique", "cop", "eau chaude", "caracteristiques", "kw"],
    populaire: true,
  },
  {
    id: "pas-de-chauffage",
    question: "Je n'ai pas de chauffage dans mes serres, ça m'intéresse quand même ?",
    reponse:
      "Oui : l'intérêt est d'avoir un chauffage disponible si vous en avez besoin plus tard, à allumer quand vous en avez l'utilité. Un technicien vérifie sur place si votre serre peut recevoir ce système et si le dossier entre dans le dispositif.",
    motsCles: ["pas de chauffage", "sans chauffage", "non chauffee", "chauffee ou pas"],
  },
  {
    id: "deja-chaudiere",
    question: "J'ai déjà une chaudière, pourquoi changer ?",
    reponse:
      "L'idée est de remplacer votre chaudière (fioul, gaz…) par une pompe à chaleur, pour essayer de réduire votre facture de chauffage. Un conseiller vérifie sur place que l'installation est adaptée à votre exploitation.",
    motsCles: ["chaudiere", "deja un chauffage", "remplacer", "fioul", "gaz", "electrique"],
  },
  {
    id: "consommation",
    question: "Ça consomme beaucoup d'électricité ?",
    reponse:
      "La pompe à chaleur consomme de l'électricité pendant son utilisation. La consommation réelle dépend du temps de chauffage et des caractéristiques de vos serres : nous ne communiquons pas de chiffre général.",
    motsCles: ["consomme", "consommation", "electricite", "facture"],
  },
  {
    id: "qui-etes-vous",
    question: "Qui est Eco Smart France ? Je ne connais pas votre société.",
    reponse:
      "Eco Smart France porte cette offre pour le chauffage des serres agricoles, dans le cadre du dispositif CEE. Un conseiller peut vous communiquer nos coordonnées complètes avant toute signature.",
    motsCles: ["eco smart", "societe", "qui etes vous", "connais pas", "entreprise", "serieux"],
  },
  {
    id: "apres-contact",
    question: "Qu'est-ce qui se passe après ma demande ?",
    reponse:
      "Un conseiller reprend votre dossier (nombre de serres, surface, culture, chauffage actuel), vous recontacte en général sous 24 heures et, si votre dossier est éligible, organise une visite technique avant de préparer un devis détaillé. Rien n'est signé ni facturé sans votre accord.",
    motsCles: ["apres", "suite", "comment ca marche", "etapes", "delai", "recontacte", "rappeler"],
    populaire: true,
  },
  {
    id: "annulation",
    question: "Je peux changer d'avis après avoir signé ?",
    reponse:
      "Les conditions (délais, possibilités d'annulation) sont précisées dans le devis avant toute signature électronique. Prenez le temps de les lire : un conseiller peut vous les expliquer avant que vous ne signiez quoi que ce soit.",
    motsCles: ["changer d'avis", "annuler", "annulation", "resilier", "retracter"],
  },
];

// Recherche sans accents ni majuscules — même principe que contenuFaq.js
// (OETH), gardé volontairement séparé pour que cette page reste autonome.
function normaliser(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%., -]/g, " ");
}

function contientMotCle(texteNormalise, cle) {
  const c = normaliser(cle).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s'-])${c}`).test(texteNormalise);
}

// Score = mots-clés trouvés (poids 3) + mots de la question retrouvés dans
// l'intitulé (poids 1). Réponse retenue seulement au-delà d'un score de 3,
// sinon l'assistant avoue ne pas savoir plutôt que de répondre à côté.
export function trouverReponseCee(question) {
  const q = normaliser(question);
  const mots = q.split(/\s+/).filter((m) => m.length > 3);
  let meilleure = null;
  let meilleurScore = 0;
  for (const item of FAQ_CEE) {
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
