// Positions simulées de l'espace AcademTrade (formation trading) — phase
// pédagogique : le prix vient du marché simulé (academtradeMarche.js), le
// solde est une unité virtuelle (voir SOLDE_DEPART_SIMULE dans
// academtradeAuth.js). Modélise un levier simplifié (1:100, voir
// academtradeMarche.js), le coût du spread à l'ouverture et le swap
// quotidien — pour habituer le client aux frais réels d'un courtier, pas
// pour les reproduire exactement (ce ne sont pas des données de marché).
import { nanoid } from "nanoid";
import db from "./db.js";
import { instrument, prixActuel, TAUX_MARGE } from "./academtradeMarche.js";

const LOTS_MIN = 0.01;
const LOTS_MAX = 50;

// Jour calendaire UTC (pour ne facturer le swap qu'une fois par jour, quelle
// que soit la fréquence des passages du marché simulé).
function jourUtc(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function positionsDe(compteId) {
  return db.data.positionsAcademtrade
    .filter((p) => p.compteId === compteId)
    .sort((a, b) => new Date(b.dateOuverture) - new Date(a.dateOuverture));
}

// Marge déjà immobilisée par les positions ouvertes — figée au prix
// d'ouverture (comme une vraie marge retenue par un courtier), pas recalculée
// au prix courant.
function margeEngagee(compteId) {
  return positionsDe(compteId)
    .filter((p) => p.statut === "ouverte")
    .reduce((s, p) => s + p.margeRequise, 0);
}

export function soldeDisponible(compte) {
  return compte.soldeSimule - margeEngagee(compte.id);
}

export async function ouvrirPosition(compte, { instrumentId, sens, lots }) {
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
  const lotsNombre = Number(lots);
  if (!Number.isFinite(lotsNombre) || lotsNombre < LOTS_MIN || lotsNombre > LOTS_MAX) {
    const erreur = new Error(`Le nombre de lots doit être compris entre ${LOTS_MIN} et ${LOTS_MAX}.`);
    erreur.code = "LOTS_INVALIDES";
    throw erreur;
  }
  const prixOuverture = prixActuel(instrumentId);
  const margeRequise = prixOuverture * def.tailleContrat * lotsNombre * TAUX_MARGE;
  const coutSpread = def.spread * def.valeurTick * lotsNombre;
  if (margeRequise + coutSpread > soldeDisponible(compte)) {
    const erreur = new Error("Solde simulé insuffisant pour cette taille de position (marge + spread).");
    erreur.code = "SOLDE_INSUFFISANT";
    throw erreur;
  }
  const position = {
    id: nanoid(),
    compteId: compte.id,
    instrumentId,
    instrumentNom: def.nom,
    categorie: def.categorie,
    unite: def.unite,
    sens,
    lots: lotsNombre,
    prixOuverture,
    prixFermeture: null,
    statut: "ouverte",
    dateOuverture: new Date().toISOString(),
    dateFermeture: null,
    tailleTick: def.tailleTick,
    valeurTick: def.valeurTick,
    margeRequise,
    coutSpread,
    swapParJour: sens === "achat" ? def.swapLong * lotsNombre : def.swapCourt * lotsNombre,
    swapCumule: 0,
    dernierSwapJour: jourUtc(),
    pnlBrut: null,
    pnlNet: null,
  };
  // Le spread est débité immédiatement (comme l'écart achat/vente d'un
  // courtier réel) — la marge, elle, reste immobilisée tant que la position
  // est ouverte, voir margeEngagee() ci-dessus.
  compte.soldeSimule -= coutSpread;
  db.data.positionsAcademtrade.push(position);
  await db.write();
  return position;
}

// Applique le swap du jour à toute position encore ouverte qui n'a pas déjà
// été facturée aujourd'hui — appelé depuis le tick du marché simulé
// (academtrade.js). Ne lève jamais d'erreur : un swap qu'on ne peut pas
// couvrir (solde déjà négatif) reste dû, affiché dans le cumul de la position.
export async function appliquerSwapQuotidien() {
  const aujourdhui = jourUtc();
  let modifie = false;
  for (const position of db.data.positionsAcademtrade) {
    if (position.statut !== "ouverte" || position.dernierSwapJour === aujourdhui) continue;
    const compte = db.data.comptesAcademtrade.find((c) => c.id === position.compteId);
    if (!compte) continue;
    compte.soldeSimule += position.swapParJour;
    position.swapCumule += position.swapParJour;
    position.dernierSwapJour = aujourdhui;
    modifie = true;
  }
  if (modifie) await db.write();
}

// Passage horaire (comme recyclageNrp.js) : largement suffisant puisque le
// swap n'est de toute façon facturé qu'une fois par jour calendaire UTC
// (voir dernierSwapJour ci-dessus).
export function demarrerSwapQuotidienAcademtrade() {
  const passage = () => appliquerSwapQuotidien().catch((e) => console.error("[academtrade] Swap quotidien :", e.message));
  setTimeout(passage, 30_000);
  setInterval(passage, 60 * 60 * 1000);
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
  const def = instrument(position.instrumentId);
  const prixFermeture = prixActuel(position.instrumentId);
  const pnlBrut = (prixFermeture - position.prixOuverture) * def.tailleContrat * position.lots * (position.sens === "achat" ? 1 : -1);
  position.prixFermeture = prixFermeture;
  position.statut = "fermee";
  position.dateFermeture = new Date().toISOString();
  position.pnlBrut = pnlBrut;
  position.pnlNet = pnlBrut - position.coutSpread - position.swapCumule;
  // Le spread et le swap ont déjà été débités au fil de l'eau (ouverture et
  // chaque jour de détention) : à la fermeture, seul le résultat brut du
  // marché reste à créditer/débiter.
  compte.soldeSimule += pnlBrut;
  await db.write();
  return position;
}
