// Demandes de retrait de l'espace AcademTrade — phase pédagogique : rien de
// réel ne circule, mais le client voit et utilise le même parcours qu'avec un
// courtier réel (phase 2), et le gestionnaire de compte s'entraîne à les
// traiter. Voir la décision validée : retraits simulés et visibles dès la
// phase 1, pas masqués.
import { nanoid } from "nanoid";
import db from "./db.js";
import { soldeDisponible } from "./academtradePositions.js";

export function retraitsDe(compteId) {
  return db.data.demandesRetraitAcademtrade
    .filter((d) => d.compteId === compteId)
    .sort((a, b) => new Date(b.dateDemande) - new Date(a.dateDemande));
}

export function retraitsEnAttente() {
  return db.data.demandesRetraitAcademtrade.filter((d) => d.statut === "en_attente");
}

export async function demanderRetrait(compte, montant) {
  const montantNombre = Number(montant);
  if (!Number.isFinite(montantNombre) || montantNombre <= 0) {
    const erreur = new Error("Montant invalide.");
    erreur.code = "MONTANT_INVALIDE";
    throw erreur;
  }
  if (montantNombre > soldeDisponible(compte)) {
    const erreur = new Error("Solde simulé insuffisant pour ce montant.");
    erreur.code = "SOLDE_INSUFFISANT";
    throw erreur;
  }
  const demande = {
    id: nanoid(),
    compteId: compte.id,
    montant: montantNombre,
    statut: "en_attente",
    dateDemande: new Date().toISOString(),
    dateTraitement: null,
    traiteParId: null,
    commentaireAgent: null,
  };
  db.data.demandesRetraitAcademtrade.push(demande);
  await db.write();
  return demande;
}

export async function traiterRetrait(demandeId, { decision, commentaire, agent }) {
  const demande = db.data.demandesRetraitAcademtrade.find((d) => d.id === demandeId);
  if (!demande) {
    const erreur = new Error("Demande introuvable.");
    erreur.code = "DEMANDE_INTROUVABLE";
    throw erreur;
  }
  if (demande.statut !== "en_attente") {
    const erreur = new Error("Cette demande a déjà été traitée.");
    erreur.code = "DEMANDE_DEJA_TRAITEE";
    throw erreur;
  }
  if (decision !== "validee" && decision !== "refusee") {
    const erreur = new Error("Décision invalide.");
    erreur.code = "DECISION_INVALIDE";
    throw erreur;
  }
  if (decision === "validee") {
    const compte = db.data.comptesAcademtrade.find((c) => c.id === demande.compteId);
    if (!compte || demande.montant > soldeDisponible(compte)) {
      const erreur = new Error("Solde simulé insuffisant pour valider ce retrait.");
      erreur.code = "SOLDE_INSUFFISANT";
      throw erreur;
    }
    compte.soldeSimule -= demande.montant;
  }
  demande.statut = decision;
  demande.dateTraitement = new Date().toISOString();
  demande.traiteParId = agent?.id || null;
  demande.commentaireAgent = String(commentaire || "").trim().slice(0, 500) || null;
  await db.write();
  return demande;
}
