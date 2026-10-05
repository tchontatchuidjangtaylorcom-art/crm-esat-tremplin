// Recyclage automatique des NRP : une fiche NRP 1 / NRP 2 repasse en
// « Nouveau » chez le MÊME agent 24 h après la dernière tentative, pour qu'il
// la rappelle (la base est vraiment appelée, rien ne dort en NRP). Au plus
// MAX_RECYCLAGES fois par fiche : au-delà, elle reste en NRP (et peut encore
// être reprise par un autre agent qui demande des fiches, voir
// DELAI_RECYCLAGE_NRP_JOURS dans index.js).
//
// Passage toutes les heures, sans appel payant (aucune recherche Claude).
import { nanoid } from "nanoid";
import db from "./db.js";

export const DELAI_RECYCLAGE_NRP_HEURES = 24;
export const MAX_RECYCLAGES = 5;
const INTERVALLE_MS = 60 * 60 * 1000;

// Dernière tentative : le plus récent résultat d'appel (historiqueAppels est
// du plus récent au plus ancien), à défaut le moment où la fiche a été vue en
// NRP pour la première fois par ce passage.
function derniereTentative(e) {
  const t = new Date(e.historiqueAppels?.[0]?.date || e.nrpVuLe || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function recyclerNrp(maintenant = Date.now()) {
  const limite = maintenant - DELAI_RECYCLAGE_NRP_HEURES * 3600 * 1000;
  let modifiees = 0;
  for (const e of db.data.entreprises) {
    if (e.statut !== "nrp" && e.statut !== "nrp2") {
      if (e.nrpVuLe) {
        delete e.nrpVuLe;
        modifiees++;
      }
      continue;
    }
    if (!e.assigneA || (e.recyclagesNrp || 0) >= MAX_RECYCLAGES) continue;
    // Fiche passée en NRP sans résultat d'appel daté (ex. changement groupé) :
    // le délai part d'ici.
    if (!e.historiqueAppels?.[0]?.date && !e.nrpVuLe) {
      e.nrpVuLe = new Date(maintenant).toISOString();
      modifiees++;
      continue;
    }
    if (derniereTentative(e) > limite) continue;

    const ancien = e.statut === "nrp2" ? "NRP 2" : "NRP 1";
    e.recyclagesNrp = (e.recyclagesNrp || 0) + 1;
    e.statut = "nouveau";
    delete e.nrpVuLe;
    e.commentaires = Array.isArray(e.commentaires) ? e.commentaires : [];
    e.commentaires.unshift({
      id: nanoid(),
      date: new Date(maintenant).toISOString(),
      auteur: "Système",
      texte:
        `🔁 ${ancien} sans réponse depuis ${DELAI_RECYCLAGE_NRP_HEURES} h : fiche remise en « Nouveau » pour un nouvel essai ` +
        `(${e.recyclagesNrp}/${MAX_RECYCLAGES}).`,
    });
    modifiees++;
  }
  return modifiees;
}

export function demarrerRecyclageNrp() {
  const passage = async () => {
    try {
      if (recyclerNrp() > 0) await db.write();
    } catch (e) {
      console.error("[recyclage-nrp]", e.message);
    }
  };
  // Premier passage peu après le démarrage, puis toutes les heures.
  setTimeout(passage, 30_000);
  setInterval(passage, INTERVALLE_MS);
}
