// Demandes entrantes du site public (/vitrine) → fiches entreprise du CRM.
// Chaque demande (rendez-vous expert, démo, formulaire de contact, demande
// d'analyse du simulateur, vérification Vigilance) crée ou complète une fiche
// "entreprise" rangée dans le lot "Demandes site web", non assignée : un
// administrateur la voit dans ses notifications, l'assigne à un agent, qui
// rappelle le client et complète la fiche (SIRET, effectif, contact...).
import { nanoid } from "nanoid";
import db from "./db.js";
import { normaliserSiren, estSirenValide, rechercherEntrepriseParSiren } from "./insee.js";

export const LOT_DEMANDES_SITE = "Demandes site web";

export const TYPES_DEMANDE = {
  rdv: "Rendez-vous expert",
  demo: "Demande de démo",
  contact: "Formulaire de contact",
  vigilance: "Vérification d'une sollicitation",
  simulation: "Simulation (synthèse demandée par e-mail)",
  serres: "Demande serres agricoles (CEE)",
};

const normaliserNombreOuNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const normaliserTexteOuNull = (v) => {
  const s = String(v ?? "").trim();
  return s || null;
};
// `oui`/`non` acceptés en plus du booléen direct, au cas où un appelant
// transmettrait la valeur brute d'un <select> plutôt qu'un booléen déjà
// converti (voir InfosSerreCee.jsx, qui fait cette conversion côté CRM).
const normaliserBooleenOuNull = (v) => {
  if (v === true || v === "oui") return true;
  if (v === false || v === "non") return false;
  return null;
};

const normaliserNom = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Retrouve une fiche existante (active ou archivée) : même e-mail de contact,
// sinon même raison sociale, pour éviter les doublons quand un client écrit
// plusieurs fois. Limité au MÊME espace (voir espaces.js, espaceDe) que la
// demande entrante : OETH et CEE sont deux activités distinctes, une même
// adresse mail dans les deux ne doit jamais fusionner une demande CEE dans
// une fiche OETH (ou l'inverse), même par coïncidence.
function trouverFicheExistante({ email, entreprise, siren, espace }) {
  const mail = String(email || "").toLowerCase();
  const nom = normaliserNom(entreprise);
  const toutes = [...db.data.entreprises, ...db.data.archives].filter((e) => (e.espace || "oeth") === espace);
  return (
    (siren && toutes.find((e) => String(e.siret || "").replace(/\D/g, "").startsWith(siren))) ||
    (mail && toutes.find((e) => (e.contact?.email || "").toLowerCase() === mail)) ||
    (nom && nom.length > 2 && toutes.find((e) => normaliserNom(e.nom) === nom)) ||
    null
  );
}

// `type` : clé de TYPES_DEMANDE. `details` : lignes "Libellé : valeur"
// reprises dans le commentaire de la fiche. `espace` : espace de la fiche
// créée (voir espaces.js — "oeth" par défaut pour ne rien changer aux appels
// existants de la vitrine OETH). `nombreSerres`/`surfaceSerres`/`cultures`/
// `serreChauffee`/`energieChauffage`/`depenseEnergieMensuelle` : champs
// propres à une demande CEE (serres agricoles), mêmes forme et types que
// InfosSerreCee.jsx côté CRM — restent null/absents pour tout appel qui ne
// les transmet pas (OETH). `consentementAppel` : coché par le visiteur sur le
// formulaire public — posé en `consentementAppelCee` (date), jamais réécrit
// ensuite, jamais modifiable depuis le CRM.
export async function enregistrerDemandeSite({
  type,
  nom = "",
  prenom = "",
  email = "",
  telephone = "",
  entreprise = "",
  fonction = "",
  effectif = null,
  beneficiaires = null,
  siret = "",
  message = "",
  details = [],
  espace = "oeth",
  nombreSerres = null,
  surfaceSerres = null,
  cultures = "",
  serreChauffee = null,
  energieChauffage = "",
  depenseEnergieMensuelle = "",
  consentementAppel = false,
}) {
  // SIRET (facultatif) saisi par le visiteur : sert à retrouver la fiche et,
  // pour une nouvelle fiche, à la compléter depuis le répertoire INSEE.
  const siren = siret ? normaliserSiren(siret) : "";
  const sirenValide = siren && estSirenValide(siren) ? siren : "";
  if (sirenValide) details = [...details, `SIRET / SIREN indiqué : ${String(siret).trim()}`];
  const libelleType = TYPES_DEMANDE[type] || "Demande site web";
  const nomContact = [prenom, nom].filter(Boolean).join(" ").trim() || "-";
  const maintenant = new Date().toISOString();
  const texteCommentaire = [
    `📥 ${libelleType} reçue depuis le site web.`,
    `Contact : ${nomContact}${fonction ? ` (${fonction})` : ""} — ${email || "-"}${telephone ? ` — ${telephone}` : ""}`,
    ...details.filter(Boolean),
    message ? `Message : ${message}` : null,
    "À faire : rappeler le client, qualifier le besoin et compléter la fiche (SIRET, effectif, contact).",
  ]
    .filter(Boolean)
    .join("\n");

  const commentaire = { id: nanoid(), date: maintenant, auteur: "Site web", texte: texteCommentaire };
  const demande = { type, libelle: libelleType, date: maintenant };

  const existante = trouverFicheExistante({ email, entreprise, siren: sirenValide, espace });
  if (existante) {
    if (sirenValide && !existante.siret) existante.siret = String(siret).replace(/\D/g, "");
    existante.commentaires = [commentaire, ...(existante.commentaires || [])];
    existante.demandesSite = [demande, ...(existante.demandesSite || [])];
    existante.demandeSiteNonVue = true;
    // Complète le contact seulement s'il était vide : ne jamais écraser une
    // donnée saisie par un agent.
    existante.contact = existante.contact || {};
    if (!existante.contact.email || existante.contact.email === "-") existante.contact.email = email;
    if (!existante.contact.telephone && telephone) existante.contact.telephone = telephone;
    if ((!existante.contact.nom || existante.contact.nom === "-") && nomContact !== "-") existante.contact.nom = nomContact;
    // Champs serres (demande CEE) : même principe que le contact ci-dessus —
    // ne complète que ce qui manque encore sur la fiche, ne remplace jamais
    // une valeur déjà saisie par un agent. Utile quand le client remplit le
    // formulaire public après un premier appel où tout n'était pas confirmé.
    const nvNombreSerres = normaliserNombreOuNull(nombreSerres);
    if (existante.nombreSerres == null && nvNombreSerres !== null) existante.nombreSerres = nvNombreSerres;
    const nvSurfaceSerres = normaliserNombreOuNull(surfaceSerres);
    if (existante.surfaceSerres == null && nvSurfaceSerres !== null) existante.surfaceSerres = nvSurfaceSerres;
    const nvCultures = normaliserTexteOuNull(cultures);
    if (!existante.cultures && nvCultures) existante.cultures = nvCultures;
    const nvSerreChauffee = normaliserBooleenOuNull(serreChauffee);
    if (existante.serreChauffee == null && nvSerreChauffee !== null) existante.serreChauffee = nvSerreChauffee;
    const nvEnergieChauffage = normaliserTexteOuNull(energieChauffage);
    if (!existante.energieChauffage && nvEnergieChauffage) existante.energieChauffage = nvEnergieChauffage;
    const nvDepenseEnergieMensuelle = normaliserTexteOuNull(depenseEnergieMensuelle);
    if (!existante.depenseEnergieMensuelle && nvDepenseEnergieMensuelle) existante.depenseEnergieMensuelle = nvDepenseEnergieMensuelle;
    // Consentement à être recontacté par téléphone : un log factuel daté, posé
    // une seule fois (jamais réécrit ensuite, même si le client redépose le
    // formulaire) — jamais modifiable depuis le CRM (voir InfosSerreCee.jsx,
    // affiché en lecture seule).
    if (consentementAppel && !existante.consentementAppelCee) existante.consentementAppelCee = maintenant;
    // Un dossier archivé qui redemande un contact revient dans le pipeline.
    const idxArchive = db.data.archives.findIndex((e) => e.id === existante.id);
    if (idxArchive !== -1) {
      db.data.archives.splice(idxArchive, 1);
      existante.statut = "nouveau";
      db.data.entreprises.push(existante);
    }
    await db.write();
    return { entreprise: existante, nouvelle: false };
  }

  const fiche = {
    id: nanoid(),
    nom: entreprise || `${nomContact} (entreprise à préciser)`,
    siret: "",
    formeJuridique: "",
    adresse: "",
    codePostal: "",
    ville: "",
    secteurActivite: "",
    secteurPublic: false,
    categorieForcee: null,
    assigneA: null,
    assignationVue: true,
    dateAssignation: null,
    dateCreation: null,
    effectif: Number.isFinite(Number(effectif)) && Number(effectif) > 0 ? Number(effectif) : null,
    effectifBeneficiaire: Number.isInteger(Number(beneficiaires)) && Number(beneficiaires) >= 0 ? Number(beneficiaires) : 0,
    typeContrat: "-",
    esatAssocie: "-",
    statut: "nouveau",
    lot: LOT_DEMANDES_SITE,
    origine: "site_web",
    espace,
    demandesSite: [demande],
    demandeSiteNonVue: true,
    partManquant: null,
    partDebutOp: null,
    partFinOp: null,
    // Champs serres agricoles (demande CEE) : null/absents pour une demande
    // OETH, qui ne les transmet jamais.
    nombreSerres: normaliserNombreOuNull(nombreSerres),
    surfaceSerres: normaliserNombreOuNull(surfaceSerres),
    cultures: normaliserTexteOuNull(cultures),
    serreChauffee: normaliserBooleenOuNull(serreChauffee),
    energieChauffage: normaliserTexteOuNull(energieChauffage),
    depenseEnergieMensuelle: normaliserTexteOuNull(depenseEnergieMensuelle),
    // Log factuel daté (jamais modifiable depuis le CRM) : voir le
    // commentaire plus haut, sur la branche "fiche déjà existante".
    consentementAppelCee: consentementAppel ? maintenant : null,
    contact: { nom: nomContact, fonction: fonction || "-", telephone, email, telephoneInvalide: false },
    dateRappel: null,
    dateRdv: null,
    commentaires: [commentaire],
    historiqueAppels: [],
    emails: [],
  };
  if (sirenValide) {
    try {
      const insee = await rechercherEntrepriseParSiren(sirenValide);
      Object.assign(fiche, {
        nom: insee.nom || fiche.nom,
        siret: insee.siret || String(siret).replace(/\D/g, ""),
        formeJuridique: insee.formeJuridique || "",
        adresse: insee.adresse || "",
        codePostal: insee.codePostal || "",
        ville: insee.ville || "",
        secteurActivite: insee.secteurActivite || "",
        secteurPublic: Boolean(insee.secteurPublic),
        effectif: fiche.effectif || insee.effectifEstime || null,
      });
      commentaire.texte += `\n🏢 Fiche complétée automatiquement depuis le répertoire INSEE (SIRET ${fiche.siret}).`;
    } catch (e) {
      fiche.siret = String(siret).replace(/\D/g, "");
      console.error("[site] Enrichissement INSEE impossible :", e.message);
    }
  }
  db.data.entreprises.push(fiche);
  await db.write();
  return { entreprise: fiche, nouvelle: true };
}

// Enregistrement "au mieux" : une erreur ici ne doit jamais faire échouer la
// demande du visiteur (déjà transmise par e-mail au pôle).
export async function enregistrerDemandeSiteSansEchec(donnees) {
  try {
    return await enregistrerDemandeSite(donnees);
  } catch (e) {
    console.error("[site] Création de la fiche CRM impossible :", e.message);
    return null;
  }
}
