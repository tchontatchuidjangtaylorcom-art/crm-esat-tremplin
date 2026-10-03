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
// plusieurs fois.
function trouverFicheExistante({ email, entreprise, siren }) {
  const mail = String(email || "").toLowerCase();
  const nom = normaliserNom(entreprise);
  const toutes = [...db.data.entreprises, ...db.data.archives];
  return (
    (siren && toutes.find((e) => String(e.siret || "").replace(/\D/g, "").startsWith(siren))) ||
    (mail && toutes.find((e) => (e.contact?.email || "").toLowerCase() === mail)) ||
    (nom && nom.length > 2 && toutes.find((e) => normaliserNom(e.nom) === nom)) ||
    null
  );
}

// `type` : clé de TYPES_DEMANDE. `details` : lignes "Libellé : valeur"
// reprises dans le commentaire de la fiche.
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

  const existante = trouverFicheExistante({ email, entreprise, siren: sirenValide });
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
    demandesSite: [demande],
    demandeSiteNonVue: true,
    partManquant: null,
    partDebutOp: null,
    partFinOp: null,
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
