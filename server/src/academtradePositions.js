// Positions simulées de l'espace AcademTrade (formation trading) — phase
// pédagogique : le prix vient du marché simulé (academtradeMarche.js), le
// montant engagé est une unité virtuelle (voir SOLDE_DEPART_SIMULE dans
// academtradeAuth.js), rien ici ne touche un marché ou un compte bancaire
// réel.
import { nanoid } from "nanoid";
import db from "./db.js";
import { instrument, prixActuel } from "./academtradeMarche.js";

export function positionsDe(compteId) {
  return db.data.positionsAcademtrade
    .filter((p) => p.compteId === compteId)
    .sort((a, b) => new Date(b.dateOuverture) - new Date(a.dateOuverture));
}

// Montant déjà engagé sur des positions ouvertes — n'est pas disponible pour
// une nouvelle position tant que celles-ci ne sont pas fermées.
function montantEngage(compteId) {
  return positionsDe(compteId)
    .filter((p) => p.statut === "ouverte")
    .reduce((s, p) => s + p.montant, 0);
}

export function soldeDisponible(compte) {
  return compte.soldeSimule - montantEngage(compte.id);
}

export async function ouvrirPosition(compte, { instrumentId, sens, montant }) {
  const def = instrument(instrumentId);
  if (!def) {
    const erreur = new Error("Instrument inconnu.");
    erreur.code = "INSTRUMENT_INCONNU";
    throw erreur;
  }
  if (sens !== "achat" && sens !== "vente") {
    const erreur = new Error("Sens de position invalide.");
    erreur.code = "SENS_INVALIDE";
    throw erreur;
  }
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
  const position = {
    id: nanoid(),
    compteId: compte.id,
    instrumentId,
    instrumentNom: def.nom,
    sens,
    montant: montantNombre,
    prixOuverture: prixActuel(instrumentId),
    prixFermeture: null,
    statut: "ouverte",
    dateOuverture: new Date().toISOString(),
    dateFermeture: null,
    pnl: null,
  };
  db.data.positionsAcademtrade.push(position);
  await db.write();
  return position;
}

export async function fermerPosition(compte, positionId) {
  const position = db.data.positionsAcademtrade.find((p) => p.id === positionId && p.compteId === compte.id);
  if (!position) {
    const erreur = new Error("Position introuvable.");
    erreur.code = "POSITION_INTROUVABLE";
    throw erreur;
  }
  if (position.statut !== "ouverte") {
    const erreur = new Error("Cette position est déjà fermée.");
    erreur.code = "POSITION_DEJA_FERMEE";
    throw erreur;
  }
  const prixFermeture = prixActuel(position.instrumentId);
  const variation = (prixFermeture - position.prixOuverture) / position.prixOuverture;
  const pnl = position.montant * variation * (position.sens === "achat" ? 1 : -1);
  position.prixFermeture = prixFermeture;
  position.statut = "fermee";
  position.dateFermeture = new Date().toISOString();
  position.pnl = pnl;
  compte.soldeSimule += pnl;
  await db.write();
  return position;
}
