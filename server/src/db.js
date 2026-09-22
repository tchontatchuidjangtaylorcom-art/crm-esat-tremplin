import path from "path";
import { fileURLToPath } from "url";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { buildSeedData } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "..", "data", "db.json");

const adapter = new JSONFile(file);
const db = new Low(adapter, { entreprises: [], archives: [] });

export async function initDb() {
  await db.read();
  if (!db.data || !db.data.entreprises || db.data.entreprises.length === 0) {
    db.data = buildSeedData();
    await db.write();
  }
  // Migration douce pour les bases existantes créées avant l'ajout de
  // l'archivage automatique des dossiers "mort".
  if (!db.data.archives) {
    db.data.archives = [];
    await db.write();
  }
  return db;
}

export default db;
