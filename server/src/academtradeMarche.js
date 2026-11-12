// Marché simulé de l'espace AcademTrade (formation trading) — environnement
// pédagogique : les prix utilisés pour CALCULER les positions (pips, spread,
// swap, gains/pertes) viennent d'une marche aléatoire générée côté serveur,
// sans lien avec un marché réel. Le graphique affiché au client, lui, vient
// du widget TradingView (vraies valeurs de marché, voir
// WidgetGraphiqueTradingView.jsx côté client) — les deux ne sont pas
// synchronisés au prix près, ce qui reste cohérent avec la phase pédagogique
// (aucun argent réel engagé sur un marché). Aucun historique n'est persisté
// en base (perdu au redémarrage) : c'est un décor pour s'entraîner.
const INTERVALLE_MS = 3_000;
const POINTS_MAX = 400; // ~20 minutes d'historique à 3 s/point.

// Levier unique et simplifié (1:100), pour que le nombre de lots ait un vrai
// effet pédagogique sur la marge immobilisée — un courtier réel varie le
// levier par instrument/réglementation, volontairement ignoré ici.
export const LEVIER = 100;
export const TAUX_MARGE = 1 / LEVIER;

// `tailleTick` : taille d'un pip (Forex) ou d'un point (autres catégories),
// dans l'unité de cotation. `tailleContrat` : unités d'actif pour 1.0 lot
// (100 000 = lot standard Forex ; 1 unité pour les autres catégories, pour
// rester lisible). `valeurTick` = tailleTick × tailleContrat = valeur d'un
// pip/point pour 1.0 lot, dans l'unité du solde simulé.
// `spread` : coût simulé à l'ouverture, en pips/points. `swapLong`/`swapCourt` :
// coût (négatif) ou gain (positif) simulé par lot et par jour calendaire de
// détention — valeurs indicatives typiques d'un courtier CFD/Forex, pas des
// données réelles. Chiffres volontairement arrondis, uniquement pédagogiques.
function instrumentDef(base) {
  return { ...base, valeurTick: base.tailleTick * base.tailleContrat };
}

export const INSTRUMENTS = [
  // --- Forex — paires majeures --------------------------------------
  instrumentDef({ id: "eurusd", nom: "EUR/USD", categorie: "forex", groupe: "majeures", symboleTradingView: "FX:EURUSD", unite: "pip", prixDepart: 1.085, volatilite: 0.00015, tailleTick: 0.0001, tailleContrat: 100000, spread: 1.0, swapLong: -6.5, swapCourt: 1.2, decimales: 5 }),
  instrumentDef({ id: "gbpusd", nom: "GBP/USD", categorie: "forex", groupe: "majeures", symboleTradingView: "FX:GBPUSD", unite: "pip", prixDepart: 1.265, volatilite: 0.00018, tailleTick: 0.0001, tailleContrat: 100000, spread: 1.4, swapLong: -4.8, swapCourt: 0.3, decimales: 5 }),
  instrumentDef({ id: "usdjpy", nom: "USD/JPY", categorie: "forex", groupe: "majeures", symboleTradingView: "FX:USDJPY", unite: "pip", prixDepart: 155.0, volatilite: 0.02, tailleTick: 0.01, tailleContrat: 100000, spread: 1.2, swapLong: 2.1, swapCourt: -8.4, decimales: 3 }),
  instrumentDef({ id: "usdchf", nom: "USD/CHF", categorie: "forex", groupe: "majeures", symboleTradingView: "FX:USDCHF", unite: "pip", prixDepart: 0.885, volatilite: 0.00015, tailleTick: 0.0001, tailleContrat: 100000, spread: 1.6, swapLong: 1.5, swapCourt: -5.0, decimales: 5 }),
  instrumentDef({ id: "audusd", nom: "AUD/USD", categorie: "forex", groupe: "majeures", symboleTradingView: "FX:AUDUSD", unite: "pip", prixDepart: 0.655, volatilite: 0.00016, tailleTick: 0.0001, tailleContrat: 100000, spread: 1.3, swapLong: -2.0, swapCourt: 0.4, decimales: 5 }),
  instrumentDef({ id: "usdcad", nom: "USD/CAD", categorie: "forex", groupe: "majeures", symboleTradingView: "FX:USDCAD", unite: "pip", prixDepart: 1.385, volatilite: 0.00017, tailleTick: 0.0001, tailleContrat: 100000, spread: 1.5, swapLong: 0.8, swapCourt: -3.2, decimales: 5 }),
  // --- Forex — paires mineures ---------------------------------------
  instrumentDef({ id: "eurgbp", nom: "EUR/GBP", categorie: "forex", groupe: "mineures", symboleTradingView: "FX:EURGBP", unite: "pip", prixDepart: 0.858, volatilite: 0.00014, tailleTick: 0.0001, tailleContrat: 100000, spread: 2.0, swapLong: -1.8, swapCourt: -0.5, decimales: 5 }),
  instrumentDef({ id: "eurjpy", nom: "EUR/JPY", categorie: "forex", groupe: "mineures", symboleTradingView: "FX:EURJPY", unite: "pip", prixDepart: 168.2, volatilite: 0.025, tailleTick: 0.01, tailleContrat: 100000, spread: 2.2, swapLong: -1.2, swapCourt: -6.0, decimales: 3 }),
  instrumentDef({ id: "gbpjpy", nom: "GBP/JPY", categorie: "forex", groupe: "mineures", symboleTradingView: "FX:GBPJPY", unite: "pip", prixDepart: 196.1, volatilite: 0.03, tailleTick: 0.01, tailleContrat: 100000, spread: 2.8, swapLong: -2.5, swapCourt: -4.5, decimales: 3 }),
  instrumentDef({ id: "audjpy", nom: "AUD/JPY", categorie: "forex", groupe: "mineures", symboleTradingView: "FX:AUDJPY", unite: "pip", prixDepart: 101.5, volatilite: 0.02, tailleTick: 0.01, tailleContrat: 100000, spread: 2.5, swapLong: -1.0, swapCourt: -3.0, decimales: 3 }),
  instrumentDef({ id: "nzdusd", nom: "NZD/USD", categorie: "forex", groupe: "mineures", symboleTradingView: "FX:NZDUSD", unite: "pip", prixDepart: 0.605, volatilite: 0.00016, tailleTick: 0.0001, tailleContrat: 100000, spread: 1.8, swapLong: -1.5, swapCourt: 0.2, decimales: 5 }),
  // --- Cryptomonnaies --------------------------------------------------
  instrumentDef({ id: "btcusd", nom: "Bitcoin / USD", categorie: "cryptos", groupe: null, symboleTradingView: "BINANCE:BTCUSDT", unite: "point", prixDepart: 62000, volatilite: 40, tailleTick: 1, tailleContrat: 1, spread: 25, swapLong: -15, swapCourt: 5, decimales: 1 }),
  instrumentDef({ id: "ethusd", nom: "Ethereum / USD", categorie: "cryptos", groupe: null, symboleTradingView: "BINANCE:ETHUSDT", unite: "point", prixDepart: 3400, volatilite: 3, tailleTick: 0.1, tailleContrat: 1, spread: 2, swapLong: -1.2, swapCourt: 0.3, decimales: 2 }),
  instrumentDef({ id: "solusd", nom: "Solana / USD", categorie: "cryptos", groupe: null, symboleTradingView: "BINANCE:SOLUSDT", unite: "point", prixDepart: 145, volatilite: 0.3, tailleTick: 0.01, tailleContrat: 1, spread: 0.08, swapLong: -0.1, swapCourt: 0.02, decimales: 2 }),
  instrumentDef({ id: "xrpusd", nom: "XRP / USD", categorie: "cryptos", groupe: null, symboleTradingView: "BINANCE:XRPUSDT", unite: "point", prixDepart: 0.62, volatilite: 0.0015, tailleTick: 0.0001, tailleContrat: 1, spread: 0.0015, swapLong: -0.0005, swapCourt: 0.0001, decimales: 4 }),
  // --- Actions -----------------------------------------------------------
  instrumentDef({ id: "aapl", nom: "Apple", categorie: "actions", groupe: null, symboleTradingView: "NASDAQ:AAPL", unite: "point", prixDepart: 228, volatilite: 0.3, tailleTick: 0.01, tailleContrat: 1, spread: 0.05, swapLong: -0.03, swapCourt: -0.01, decimales: 2 }),
  instrumentDef({ id: "msft", nom: "Microsoft", categorie: "actions", groupe: null, symboleTradingView: "NASDAQ:MSFT", unite: "point", prixDepart: 430, volatilite: 0.4, tailleTick: 0.01, tailleContrat: 1, spread: 0.06, swapLong: -0.04, swapCourt: -0.01, decimales: 2 }),
  instrumentDef({ id: "tsla", nom: "Tesla", categorie: "actions", groupe: null, symboleTradingView: "NASDAQ:TSLA", unite: "point", prixDepart: 250, volatilite: 0.6, tailleTick: 0.01, tailleContrat: 1, spread: 0.08, swapLong: -0.05, swapCourt: -0.01, decimales: 2 }),
  instrumentDef({ id: "amzn", nom: "Amazon", categorie: "actions", groupe: null, symboleTradingView: "NASDAQ:AMZN", unite: "point", prixDepart: 190, volatilite: 0.35, tailleTick: 0.01, tailleContrat: 1, spread: 0.05, swapLong: -0.03, swapCourt: -0.01, decimales: 2 }),
  // --- Indices -------------------------------------------------------------
  instrumentDef({ id: "sp500", nom: "S&P 500", categorie: "indices", groupe: null, symboleTradingView: "FOREXCOM:SPXUSD", unite: "point", prixDepart: 5800, volatilite: 4, tailleTick: 1, tailleContrat: 1, spread: 0.6, swapLong: -1.5, swapCourt: -0.3, decimales: 1 }),
  instrumentDef({ id: "nasdaq100", nom: "Nasdaq 100", categorie: "indices", groupe: null, symboleTradingView: "FOREXCOM:NSXUSD", unite: "point", prixDepart: 20500, volatilite: 10, tailleTick: 1, tailleContrat: 1, spread: 1.2, swapLong: -2.5, swapCourt: -0.5, decimales: 1 }),
  instrumentDef({ id: "dowjones", nom: "Dow Jones", categorie: "indices", groupe: null, symboleTradingView: "FOREXCOM:DJI", unite: "point", prixDepart: 43000, volatilite: 8, tailleTick: 1, tailleContrat: 1, spread: 2.0, swapLong: -3.0, swapCourt: -0.6, decimales: 1 }),
  instrumentDef({ id: "cac40", nom: "CAC 40", categorie: "indices", groupe: null, symboleTradingView: "EURONEXT:PX1", unite: "point", prixDepart: 7700, volatilite: 5, tailleTick: 1, tailleContrat: 1, spread: 1.0, swapLong: -1.8, swapCourt: -0.4, decimales: 1 }),
  // --- Matières premières -------------------------------------------------
  instrumentDef({ id: "or", nom: "Or (XAU/USD)", categorie: "matieres_premieres", groupe: null, symboleTradingView: "OANDA:XAUUSD", unite: "point", prixDepart: 2650, volatilite: 1.2, tailleTick: 0.01, tailleContrat: 100, spread: 0.3, swapLong: -4.5, swapCourt: 1.0, decimales: 2 }),
  instrumentDef({ id: "argent", nom: "Argent (XAG/USD)", categorie: "matieres_premieres", groupe: null, symboleTradingView: "OANDA:XAGUSD", unite: "point", prixDepart: 31, volatilite: 0.05, tailleTick: 0.001, tailleContrat: 5000, spread: 0.03, swapLong: -3.0, swapCourt: 0.8, decimales: 3 }),
  instrumentDef({ id: "petrole_wti", nom: "Pétrole brut (WTI)", categorie: "matieres_premieres", groupe: null, symboleTradingView: "TVC:USOIL", unite: "point", prixDepart: 70, volatilite: 0.15, tailleTick: 0.01, tailleContrat: 1000, spread: 0.04, swapLong: -5.0, swapCourt: 1.5, decimales: 2 }),
  instrumentDef({ id: "gaz_naturel", nom: "Gaz naturel", categorie: "matieres_premieres", groupe: null, symboleTradingView: "TVC:NATURALGAS", unite: "point", prixDepart: 2.8, volatilite: 0.01, tailleTick: 0.001, tailleContrat: 10000, spread: 0.005, swapLong: -2.0, swapCourt: 0.5, decimales: 3 }),
  // --- ETF ------------------------------------------------------------------
  instrumentDef({ id: "spy", nom: "SPY (ETF S&P 500)", categorie: "etf", groupe: null, symboleTradingView: "AMEX:SPY", unite: "point", prixDepart: 580, volatilite: 0.4, tailleTick: 0.01, tailleContrat: 1, spread: 0.02, swapLong: -0.02, swapCourt: -0.01, decimales: 2 }),
  instrumentDef({ id: "qqq", nom: "QQQ (ETF Nasdaq)", categorie: "etf", groupe: null, symboleTradingView: "NASDAQ:QQQ", unite: "point", prixDepart: 495, volatilite: 0.4, tailleTick: 0.01, tailleContrat: 1, spread: 0.02, swapLong: -0.02, swapCourt: -0.01, decimales: 2 }),
  instrumentDef({ id: "gld", nom: "GLD (ETF Or)", categorie: "etf", groupe: null, symboleTradingView: "AMEX:GLD", unite: "point", prixDepart: 245, volatilite: 0.3, tailleTick: 0.01, tailleContrat: 1, spread: 0.03, swapLong: -0.02, swapCourt: 0.0, decimales: 2 }),
];

// Catégories affichées (ordre et libellés) — un futur instrument ajouté à
// INSTRUMENTS avec une `categorie` déjà listée ici y apparaît automatiquement.
export const CATEGORIES = [
  { id: "forex", nom: "Forex" },
  { id: "cryptos", nom: "Cryptomonnaies" },
  { id: "actions", nom: "Actions" },
  { id: "indices", nom: "Indices" },
  { id: "matieres_premieres", nom: "Matières premières" },
  { id: "etf", nom: "ETF" },
];

const etat = new Map(INSTRUMENTS.map((i) => [i.id, { prix: i.prixDepart, historique: [{ t: Date.now(), p: i.prixDepart }] }]));

export function instrument(id) {
  return INSTRUMENTS.find((i) => i.id === id) || null;
}

export function prixActuel(id) {
  return etat.get(id)?.prix ?? null;
}

export function historique(id) {
  return etat.get(id)?.historique ?? [];
}

// Catalogue complet (catégories + instruments, avec le prix courant) — sert
// à la fois à peupler la navigation du client et aux calculs pip/spread/swap
// côté interface (le serveur reste seul maître du calcul réel, voir
// academtradePositions.js).
export function catalogue() {
  return {
    categories: CATEGORIES,
    instruments: INSTRUMENTS.map((i) => ({ ...i, prix: prixActuel(i.id) })),
  };
}

export function etatMarche() {
  return INSTRUMENTS.map((i) => ({ id: i.id, nom: i.nom, prix: prixActuel(i.id), historique: historique(i.id) }));
}

function tick() {
  for (const def of INSTRUMENTS) {
    const e = etat.get(def.id);
    // Légère force de rappel vers le prix de départ : évite une dérive
    // dégénérée (prix qui s'effondre ou s'envole) sur une très longue session.
    const rappel = (def.prixDepart - e.prix) * 0.01;
    const bruit = (Math.random() - 0.5) * 2 * def.volatilite;
    e.prix = Math.max(def.prixDepart * 0.3, e.prix + bruit + rappel);
    e.historique.push({ t: Date.now(), p: e.prix });
    if (e.historique.length > POINTS_MAX) e.historique.shift();
  }
}

export function demarrerMarcheAcademtrade() {
  setInterval(tick, INTERVALLE_MS);
}
