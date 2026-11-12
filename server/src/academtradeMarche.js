// Marché simulé de l'espace AcademTrade (formation trading) — environnement
// pédagogique : les prix sont une marche aléatoire générée côté serveur, sans
// lien avec un marché réel. Aucun historique n'est persisté en base (perdu au
// redémarrage) : c'est un décor pour s'entraîner à ouvrir/fermer des
// positions, pas une donnée à conserver.
const INTERVALLE_MS = 3_000;
const POINTS_MAX = 400; // ~20 minutes d'historique à 3 s/point.

export const INSTRUMENTS = [
  { id: "eurusd", nom: "EUR / USD", prixDepart: 1.08, volatilite: 0.0006 },
  { id: "btcusd", nom: "Bitcoin / USD", prixDepart: 62000, volatilite: 120 },
  { id: "xauusd", nom: "Or (XAU/USD)", prixDepart: 2350, volatilite: 3.5 },
  { id: "cac40", nom: "Indice CAC 40 (démo)", prixDepart: 7500, volatilite: 9 },
];

const etat = new Map(
  INSTRUMENTS.map((i) => [i.id, { prix: i.prixDepart, historique: [{ t: Date.now(), p: i.prixDepart }] }])
);

export function instrument(id) {
  return INSTRUMENTS.find((i) => i.id === id) || null;
}

export function prixActuel(id) {
  return etat.get(id)?.prix ?? null;
}

export function historique(id) {
  return etat.get(id)?.historique ?? [];
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
