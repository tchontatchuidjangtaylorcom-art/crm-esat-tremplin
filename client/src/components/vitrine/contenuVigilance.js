// Messages "Vigilance" (bouton flottant rouge + page /vitrine/vigilance).
// Règle éditoriale : uniquement des faits vérifiables et des conseils de
// prudence utiles aux entreprises — aucune revendication de mandat public,
// d'exclusivité ou de dénigrement d'autres acteurs. Les coordonnées
// officielles du pôle se limitent au domaine, à l'e-mail et au téléphone
// (l'adresse postale est communiquée par un conseiller).

export const DOMAINE_OFFICIEL = "oeth-fiph.fr";
export const EMAIL_OFFICIEL = "contact@oeth-fiph.fr";
export const TELEPHONE_OFFICIEL = "+33 7 44 12 79 17";

export const LIEN_ANNUAIRE_ENTREPRISES = "https://annuaire-entreprises.data.gouv.fr/";
export const LIEN_SIGNALCONSO = "https://signal.conso.gouv.fr/";
export const LIEN_URSSAF_OETH = "https://www.urssaf.fr/accueil/employeur/cotisations/liste-cotisations/contribution-annuelle-oeth.html";

// `action` : { label, to } (page interne) ou { label, href } (site externe).
export const VIGILANCE = [
  {
    titre: "Seule l'URSSAF recouvre la contribution",
    texte:
      "La contribution OETH se déclare dans votre DSN et se règle uniquement à l'URSSAF (ou à la MSA pour le régime agricole). Aucun autre organisme n'est habilité à l'encaisser.",
    action: { label: "Lire l'article", to: "/vitrine/vigilance" },
  },
  {
    titre: "Vérifiez chaque sollicitation",
    texte:
      "Vous avez été contacté au sujet d'un « dossier OETH », d'une attestation ou d'un règlement ? Vérifiez l'origine de la demande avant d'y donner suite.",
  },
  {
    titre: "Identifiez votre interlocuteur",
    texte: `Demandez le nom de la structure, son SIRET et une adresse e-mail professionnelle. Nos échanges se font uniquement depuis des adresses @${DOMAINE_OFFICIEL}.`,
  },
  {
    titre: "Ne réglez jamais dans l'urgence",
    texte:
      "Aucun paiement ne doit être exigé par téléphone ou sous pression. Prenez le temps de vérifier avant tout engagement lié à l'OETH.",
  },
  {
    titre: "ESAT, EA, TIH : vérifiez la structure",
    texte:
      "Avant de signer, contrôlez le SIRET de la structure sur l'annuaire officiel des entreprises et demandez l'attestation annuelle de main-d'œuvre, indispensable à la déduction (DSN 061).",
    action: { label: "Annuaire des entreprises ↗", href: LIEN_ANNUAIRE_ENTREPRISES },
  },
  {
    titre: "Méfiez-vous des promesses trop belles",
    texte:
      "« Exonération totale », « dossier à régulariser d'urgence », « pénalité imminente » : ces formules doivent vous alerter. La contribution dépend uniquement de votre situation réelle.",
  },
  {
    titre: "Conservez une trace",
    texte:
      "En cas de doute, notez le numéro appelant, l'adresse e-mail utilisée et la nature exacte de la demande avant de la faire vérifier.",
  },
  {
    titre: "Un doute ? Faites vérifier",
    texte:
      "Transmettez-nous la sollicitation reçue : un conseiller vous aide à vérifier l'interlocuteur et la démarche. Vous pouvez aussi la signaler sur SignalConso.",
    action: { label: "Faire vérifier", to: "/vitrine/vigilance#verifier" },
  },
];
