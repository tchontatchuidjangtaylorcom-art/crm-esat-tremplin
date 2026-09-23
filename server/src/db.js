import path from "path";
import { fileURLToPath } from "url";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { buildSeedData } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "..", "data", "db.json");

const adapter = new JSONFile(file);
const db = new Low(adapter, { entreprises: [], archives: [], utilisateurs: [] });

export async function initDb() {
  await db.read();
  if (!db.data || !db.data.entreprises || db.data.entreprises.length === 0) {
    db.data = buildSeedData();
    await db.write();
  }
  // Migrations douces pour les bases existantes créées avant l'ajout de
  // l'archivage automatique des dossiers "mort", puis des comptes agents.
  let aEcrire = false;
  if (!db.data.archives) {
    db.data.archives = [];
    aEcrire = true;
  }
  if (!db.data.utilisateurs) {
    db.data.utilisateurs = [];
    aEcrire = true;
  }
  if (aEcrire) await db.write();
  return db;
}

export default db;
