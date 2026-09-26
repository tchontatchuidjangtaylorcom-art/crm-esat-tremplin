import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { buildSeedData } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Emplacement du fichier de données. Sur Render, le disque du conteneur est
// ÉPHÉMÈRE : il est entièrement remplacé à chaque déploiement/redémarrage,
// quel que soit le code d'initialisation ci-dessous (rien côté Node ne peut
// empêcher ça, le fichier est écrasé par la plateforme avant même que ce
// process ne démarre). La seule vraie protection est un disque persistant
// Render monté sur un chemin fixe, indiqué ici via DATA_DIR — sans cette
// variable, le comportement local habituel (dossier "data" du dépôt) est
// inchangé, ce qui reste correct en développement.
//
// Configuration du disque persistant sur Render (plan Starter minimum, les
// disques ne sont pas disponibles sur le plan Free) :
//   1. Dashboard Render > le service > Settings > Disks > "Add Disk"
//      (ex: nom "data", mount path "/var/data", 1 Go suffit largement).
//   2. Variable d'environnement DATA_DIR = /var/data
//   3. Redéployer. Le premier démarrage sur un disque vide amorce les
//      données (seed), puis chaque redémarrage suivant les retrouve intactes.
const dossierDonnees = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const file = path.join(dossierDonnees, "db.json");

// Le dossier peut ne pas exister encore (disque tout juste monté, ou premier
// lancement local) — lowdb ne le crée pas lui-même.
fs.mkdirSync(dossierDonnees, { recursive: true });

console.log(
  process.env.DATA_DIR
    ? `[db] Stockage persistant activé : ${file} (survit aux redémarrages/déploiements).`
    : `[db] DATA_DIR non configurée — stockage local ${file} (⚠ non persistant si hébergé sur un disque éphémère type Render sans Disk attaché).`
);

const adapter = new JSONFile(file);
const db = new Low(adapter, { entreprises: [], archives: [], utilisateurs: [], canaux: [], messages: [], presence: [] });

export const CANAL_GENERAL_ID = "general";

export async function initDb() {
  await db.read();
  // Amorce les données UNIQUEMENT si le fichier est réellement vide/absent —
  // jamais si des entreprises existent déjà, pour ne strictement jamais
  // écraser des données réelles (contacts, numéros de téléphone, historique)
  // avec le jeu de démonstration, y compris en cas de redémarrage répété.
  if (!db.data || !db.data.entreprises || db.data.entreprises.length === 0) {
    db.data = buildSeedData();
    await db.write();
  }
  // Migrations douces pour les bases existantes créées avant l'ajout de
  // l'archivage automatique des dossiers "mort", puis des comptes agents —
  // n'ajoutent que les champs manquants, ne touchent jamais aux données déjà
  // présentes.
  let aEcrire = false;
  if (!db.data.archives) {
    db.data.archives = [];
    aEcrire = true;
  }
  if (!db.data.utilisateurs) {
    db.data.utilisateurs = [];
    aEcrire = true;
  }
  if (!db.data.canaux) {
    db.data.canaux = [];
    aEcrire = true;
  }
  if (!db.data.messages) {
    db.data.messages = [];
    aEcrire = true;
  }
  // Suivi de présence (voir presence.js) : la date de mise en service sert
  // à ne jamais signaler d'absence sur des jours antérieurs, pour lesquels
  // il n'existe tout simplement pas de données.
  if (!db.data.presence) {
    db.data.presence = [];
    aEcrire = true;
  }
  // Prises de rendez-vous et demandes de démo depuis la page publique
  // "Pilotage handicap" (voir vitrineRdv.js).
  if (!db.data.rendezVousVitrine) {
    db.data.rendezVousVitrine = [];
    aEcrire = true;
  }
  if (!db.data.demandesDemo) {
    db.data.demandesDemo = [];
    aEcrire = true;
  }
  if (!db.data.presenceDebutSuivi) {
    db.data.presenceDebutSuivi = new Date().toISOString();
    aEcrire = true;
  }
  // Canal "Infos Générales" : visible de tous implicitement (voir
  // estMembreCanal côté index.js), pas besoin d'y lister chaque agent.
  if (!db.data.canaux.some((c) => c.id === CANAL_GENERAL_ID)) {
    db.data.canaux.push({
      id: CANAL_GENERAL_ID,
      type: "general",
      nom: "Infos Générales",
      membres: null,
      createurId: null,
      dateCreation: new Date().toISOString(),
    });
    aEcrire = true;
  }
  if (aEcrire) await db.write();
  return db;
}

export default db;
