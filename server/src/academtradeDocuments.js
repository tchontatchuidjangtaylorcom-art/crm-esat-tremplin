// Documents envoyés par les clients AcademTrade (pièce d'identité recto et
// verso, justificatif de domicile) — stockés sur le disque persistant (même
// disque que la base, voir DOSSIER_DONNEES dans db.js), jamais dans un
// dossier temporaire du conteneur. Chaque client ne peut déposer que les
// trois types prévus ; un nouvel envoi remplace le précédent et repasse en
// attente de vérification.
import fs from "fs";
import path from "path";
import multer from "multer";
import { nanoid } from "nanoid";
import db, { DOSSIER_DONNEES } from "./db.js";

const TYPES_DOCUMENTS = new Set(["identite_recto", "identite_verso", "adresse"]);
const DOSSIER_DOCUMENTS = path.join(DOSSIER_DONNEES, "academtrade-documents");
fs.mkdirSync(DOSSIER_DOCUMENTS, { recursive: true });

const EXTENSIONS_AUTORISEES = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
const TAILLE_MAX_OCTETS = 10 * 1024 * 1024; // 10 Mo

const stockage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOSSIER_DOCUMENTS),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${req.compteAcademtrade.id}-${req.body.type}-${nanoid()}${EXTENSIONS_AUTORISEES.has(ext) ? ext : ""}`);
  },
});

export const uploadDocument = multer({
  storage: stockage,
  limits: { fileSize: TAILLE_MAX_OCTETS },
  fileFilter: (req, file, cb) => {
    if (!TYPES_DOCUMENTS.has(req.body.type)) return cb(new Error("Type de document invalide."));
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!EXTENSIONS_AUTORISEES.has(ext)) return cb(new Error("Format accepté : PDF, PNG ou JPG."));
    cb(null, true);
  },
}).single("fichier");

// Remplace l'éventuel fichier précédent du même type (jamais deux documents
// en attente pour la même pièce) et enregistre les métadonnées sur le compte.
export async function enregistrerDocument(compte, type, fichier) {
  compte.documents = compte.documents || {};
  const ancien = compte.documents[type];
  if (ancien?.chemin && fs.existsSync(ancien.chemin)) {
    fs.unlink(ancien.chemin, () => {});
  }
  compte.documents[type] = {
    nomOriginal: fichier.originalname,
    chemin: fichier.path,
    taille: fichier.size,
    dateEnvoi: new Date().toISOString(),
    statut: "en_attente", // en_attente | validee | refusee
    commentaireAgent: null,
  };
  await db.write();
  return compte.documents[type];
}

export function cheminDocument(compte, type) {
  return compte.documents?.[type]?.chemin || null;
}

export async function traiterDocument(compte, type, { decision, commentaire }) {
  const doc = compte.documents?.[type];
  if (!doc) {
    const erreur = new Error("Document introuvable.");
    erreur.code = "DOCUMENT_INTROUVABLE";
    throw erreur;
  }
  if (decision !== "validee" && decision !== "refusee") {
    const erreur = new Error("Décision invalide.");
    erreur.code = "DECISION_INVALIDE";
    throw erreur;
  }
  doc.statut = decision;
  doc.commentaireAgent = String(commentaire || "").trim().slice(0, 500) || null;
  await db.write();
  return doc;
}

// Jamais le chemin disque réel dans une réponse API (évite d'exposer la
// structure du disque) — seulement ce dont l'interface a besoin.
export function documentsSansChemin(compte) {
  const documents = {};
  for (const type of TYPES_DOCUMENTS) {
    const doc = compte.documents?.[type];
    documents[type] = doc ? { nomOriginal: doc.nomOriginal, dateEnvoi: doc.dateEnvoi, statut: doc.statut, commentaireAgent: doc.commentaireAgent } : null;
  }
  return documents;
}
