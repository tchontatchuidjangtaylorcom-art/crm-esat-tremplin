import db from "./db.js";

// Suivi du temps de travail et de la présence des agents.
//
// Principe : le client (voir client/src/PresenceContext.jsx) envoie un
// "battement" toutes les 30 s tant que l'agent est actif (souris, clavier,
// défilement, ou appel en cours) ; au-delà de 5 min sans la moindre
// activité, il cesse d'en envoyer — c'est la mise en pause automatique. Le
// temps actif d'une journée est donc la somme des écarts entre battements
// consécutifs, chaque écart étant plafonné : un trou plus long qu'un simple
// retard réseau (pause, onglet fermé, veille du poste) n'est jamais compté.
//
// Toutes les dates "jour" sont calculées dans le fuseau de l'équipe (Paris),
// jamais dans celui du serveur (Render tourne en UTC : sans ça, une
// activité à 00h30 heure de Paris serait rattachée à la veille).

export const FUSEAU = process.env.FUSEAU_HORAIRE || "Europe/Paris";
export const INTERVALLE_BATTEMENT_SECONDES = 30;
// Écart maximal entre deux battements encore considéré comme du travail
// continu (intervalle + marge pour un onglet en arrière-plan ralenti par le
// navigateur, ou une requête lente).
const PLAFOND_ECART_SECONDES = 90;
// Au-delà, l'agent n'est plus "actif maintenant" mais en pause/déconnecté.
const SEUIL_EN_LIGNE_SECONDES = 90;
export const OBJECTIF_SECONDES_JOUR = 7 * 3600;
// Heure (locale) à partir de laquelle un agent sans aucune activité le jour
// même est signalé "pas encore connecté" au manager.
export const HEURE_ALERTE_ARRIVEE = 10;
// Délai d'écriture groupée sur disque : un battement toutes les 30 s par
// agent ne doit pas réécrire tout db.json à chaque fois.
const DELAI_ECRITURE_MS = 30_000;

const formatJour = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const formatHeure = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, hour: "2-digit", hourCycle: "h23" });

// "AAAA-MM-JJ" dans le fuseau de l'équipe.
export function jourLocal(date = new Date()) {
  const parts = Object.fromEntries(formatJour.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function heureLocale(date = new Date()) {
  // formatToParts plutôt que format() : en fr-FR, l'heure seule est rendue
  // "11 h", illisible par Number().
  return Number(formatHeure.formatToParts(date).find((p) => p.type === "hour")?.value);
}

// Arithmétique sur les chaînes "AAAA-MM-JJ" (à midi UTC, pour ne jamais être
// décalé d'un jour par un changement d'heure).
function decalerJour(jour, n) {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function jourDeSemaine(jour) {
  return new Date(`${jour}T12:00:00Z`).getUTCDay(); // 0 = dimanche
}

function lundiDeLaSemaine(jour) {
  const j = jourDeSemaine(jour);
  return decalerJour(jour, j === 0 ? -6 : 1 - j);
}

// Dimanche de Pâques (algorithme grégorien anonyme / Meeus).
function paques(annee) {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

const cacheFeries = new Map();

// Jours fériés légaux en France métropolitaine — un agent absent un 14
// juillet ne doit évidemment pas déclencher d'alerte.
function joursFeries(annee) {
  if (!cacheFeries.has(annee)) {
    const p = paques(annee);
    cacheFeries.set(
      annee,
      new Set([
        `${annee}-01-01`,
        decalerJour(p, 1), // lundi de Pâques
        `${annee}-05-01`,
        `${annee}-05-08`,
        decalerJour(p, 39), // Ascension
        decalerJour(p, 50), // lundi de Pentecôte
        `${annee}-07-14`,
        `${annee}-08-15`,
        `${annee}-11-01`,
        `${annee}-11-11`,
        `${annee}-12-25`,
      ])
    );
  }
  return cacheFeries.get(annee);
}

export function estFerie(jour) {
  return joursFeries(Number(jour.slice(0, 4))).has(jour);
}

export function estJourOuvre(jour) {
  const j = jourDeSemaine(jour);
  return j >= 1 && j <= 5 && !estFerie(jour);
}

export function jourOuvrePrecedent(jour) {
  let j = decalerJour(jour, -1);
  while (!estJourOuvre(j)) j = decalerJour(j, -1);
  return j;
}

let ecriturePlanifiee = null;

function planifierEcriture() {
  if (ecriturePlanifiee) return;
  ecriturePlanifiee = setTimeout(() => {
    ecriturePlanifiee = null;
    db.write().catch((e) => console.error("[presence] Écriture impossible :", e.message));
  }, DELAI_ECRITURE_MS);
}

function trouverJour(utilisateurId, jour) {
  return db.data.presence.find((p) => p.utilisateurId === utilisateurId && p.jour === jour) || null;
}

export function enregistrerBattement(utilisateurId, maintenant = new Date()) {
  const jour = jourLocal(maintenant);
  let enregistrement = trouverJour(utilisateurId, jour);
  if (!enregistrement) {
    enregistrement = {
      utilisateurId,
      jour,
      secondesActives: 0,
      premiereActivite: maintenant.toISOString(),
      derniereActivite: null,
    };
    db.data.presence.push(enregistrement);
  }

  // Premier battement de la journée, ou reprise après une pause : on ne
  // crédite que l'intervalle couvert par ce battement, pas le trou qui le
  // précède.
  const ecart = enregistrement.derniereActivite
    ? (maintenant.getTime() - new Date(enregistrement.derniereActivite).getTime()) / 1000
    : Infinity;
  const ajout = ecart < 0 ? 0 : ecart <= PLAFOND_ECART_SECONDES ? ecart : INTERVALLE_BATTEMENT_SECONDES;

  enregistrement.secondesActives = Math.round(enregistrement.secondesActives + ajout);
  enregistrement.derniereActivite = maintenant.toISOString();
  planifierEcriture();
  return enregistrement;
}

// Premier jour où une absence peut être reprochée à cet utilisateur : ni
// avant la création de son compte, ni avant la mise en service du suivi
// (sinon, le lendemain du déploiement, toute l'équipe apparaîtrait absente
// sur l'historique antérieur, faute de données).
function jourDebutSuivi(utilisateur) {
  const candidats = [utilisateur.dateCreation, db.data.presenceDebutSuivi]
    .filter(Boolean)
    .map((iso) => jourLocal(new Date(iso)));
  return candidats.length ? candidats.sort().at(-1) : null;
}

function statsJour(utilisateur, jour, { aujourdHui, debut }) {
  const e = trouverJour(utilisateur.id, jour);
  const secondesActives = e?.secondesActives || 0;
  const present = secondesActives > 0;
  const ouvre = estJourOuvre(jour);
  const futur = jour > aujourdHui;
  // Le jour de début (création du compte / mise en service) ne compte que
  // si l'agent a effectivement travaillé : il a pu être créé en fin de
  // journée. Aujourd'hui ne compte que s'il y a déjà de l'activité, pour que
  // le taux ne chute pas chaque matin avant l'arrivée.
  const compte =
    ouvre && !futur && (!debut || jour > debut || present) && (jour < aujourdHui || present);
  return {
    jour,
    secondesActives,
    premiereActivite: e?.premiereActivite || null,
    derniereActivite: e?.derniereActivite || null,
    present,
    ouvre,
    ferie: estFerie(jour),
    futur,
    estAujourdHui: jour === aujourdHui,
    compte,
    absent: compte && !present,
  };
}

export function calculerKpiAgent(utilisateur, { maintenant = new Date(), decalageSemaines = 0 } = {}) {
  const aujourdHui = jourLocal(maintenant);
  const debut = jourDebutSuivi(utilisateur);
  const contexte = { aujourdHui, debut };

  const lundi = decalerJour(lundiDeLaSemaine(aujourdHui), -7 * decalageSemaines);
  const jours = Array.from({ length: 7 }, (_, i) => statsJour(utilisateur, decalerJour(lundi, i), contexte));

  const joursComptes = jours.filter((j) => j.compte);
  const joursPresents = joursComptes.filter((j) => j.present);
  const secondesActives = jours.reduce((s, j) => s + j.secondesActives, 0);
  const secondesJoursPresents = joursPresents.reduce((s, j) => s + j.secondesActives, 0);

  const jourAujourdHui = statsJour(utilisateur, aujourdHui, contexte);
  const secondesDepuisActivite = jourAujourdHui.derniereActivite
    ? Math.round((maintenant.getTime() - new Date(jourAujourdHui.derniereActivite).getTime()) / 1000)
    : null;
  const etat = !jourAujourdHui.present
    ? "absent"
    : secondesDepuisActivite <= SEUIL_EN_LIGNE_SECONDES
      ? "actif"
      : "pause";
  // "Pas encore connecté" devient une alerte pour le manager passé
  // HEURE_ALERTE_ARRIVEE un jour ouvré — avant, c'est juste un agent pas
  // encore arrivé.
  const retardAujourdHui =
    utilisateur.role === "agent" &&
    etat === "absent" &&
    estJourOuvre(aujourdHui) &&
    heureLocale(maintenant) >= HEURE_ALERTE_ARRIVEE &&
    (!debut || aujourdHui > debut);

  // Alerte d'absence : aucune activité de toute la journée ouvrée
  // précédente (vendredi quand on est lundi, veille d'un férié sautée).
  // Réservée aux agents : les administrateurs pilotent l'équipe, ils ne
  // sont pas soumis au suivi de présence.
  const veille = jourOuvrePrecedent(aujourdHui);
  const alerteAbsence =
    utilisateur.role === "agent" && (!debut || veille > debut) && !trouverJour(utilisateur.id, veille)?.secondesActives
      ? { jour: veille }
      : null;

  return {
    aujourdHui: { ...jourAujourdHui, etat, secondesDepuisActivite, retard: retardAujourdHui },
    semaine: {
      lundi,
      decalageSemaines,
      jours,
      secondesActives,
      joursPresents: joursPresents.length,
      joursOuvres: joursComptes.length,
      tauxPresence: joursComptes.length ? Math.round((joursPresents.length / joursComptes.length) * 100) : null,
      moyenneSecondesParJourPresent: joursPresents.length ? Math.round(secondesJoursPresents / joursPresents.length) : 0,
      objectifSecondes: joursComptes.length * OBJECTIF_SECONDES_JOUR,
    },
    alerteAbsence,
    objectifSecondesJour: OBJECTIF_SECONDES_JOUR,
    heureAlerteArrivee: HEURE_ALERTE_ARRIVEE,
  };
}

export function calculerKpiEquipe(utilisateurs, options = {}) {
  const membres = utilisateurs
    .map((u) => ({
      utilisateur: { id: u.id, prenom: u.prenom, nom: u.nom, email: u.email, role: u.role },
      ...calculerKpiAgent(u, options),
    }))
    .sort((a, b) => {
      const alerteA = a.alerteAbsence || a.aujourdHui.retard ? 0 : 1;
      const alerteB = b.alerteAbsence || b.aujourdHui.retard ? 0 : 1;
      if (alerteA !== alerteB) return alerteA - alerteB;
      const adminA = a.utilisateur.role === "admin" ? 1 : 0;
      const adminB = b.utilisateur.role === "admin" ? 1 : 0;
      if (adminA !== adminB) return adminA - adminB;
      return `${a.utilisateur.prenom} ${a.utilisateur.nom}`.localeCompare(`${b.utilisateur.prenom} ${b.utilisateur.nom}`, "fr");
    });

  // Le résumé ne porte que sur les agents (les admins, non soumis au suivi,
  // restent visibles dans le tableau mais ne faussent pas les moyennes).
  const agents = membres.filter((m) => m.utilisateur.role === "agent");
  const taux = agents.map((m) => m.semaine.tauxPresence).filter((t) => t !== null);
  return {
    aujourdHui: jourLocal(options.maintenant || new Date()),
    membres,
    resume: {
      total: agents.length,
      actifsMaintenant: agents.filter((m) => m.aujourdHui.etat === "actif").length,
      presentsAujourdHui: agents.filter((m) => m.aujourdHui.present).length,
      retardsAujourdHui: agents.filter((m) => m.aujourdHui.retard).length,
      absencesVeille: agents.filter((m) => m.alerteAbsence).length,
      tauxPresenceMoyen: taux.length ? Math.round(taux.reduce((s, t) => s + t, 0) / taux.length) : null,
      secondesActivesSemaine: agents.reduce((s, m) => s + m.semaine.secondesActives, 0),
    },
    objectifSecondesJour: OBJECTIF_SECONDES_JOUR,
    heureAlerteArrivee: HEURE_ALERTE_ARRIVEE,
  };
}

// Alertes d'absence de la veille ouvrée pour toute l'équipe — affichées au
// manager dans le centre de notifications.
export function alertesAbsenceEquipe(utilisateurs, maintenant = new Date()) {
  return utilisateurs
    .map((u) => ({ u, alerte: calculerKpiAgent(u, { maintenant }).alerteAbsence }))
    .filter(({ alerte }) => alerte)
    .map(({ u, alerte }) => ({ utilisateurId: u.id, prenom: u.prenom, nom: u.nom, email: u.email, jour: alerte.jour }));
}
