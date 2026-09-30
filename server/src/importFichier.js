// Import d'un lot d'entreprises depuis un fichier (Excel, CSV, Word…) ou un
// texte collé : le navigateur en extrait les SIREN / SIRET ou, à défaut, les
// noms d'entreprise (voir client/src/extractionEntreprises.js) ; ici chaque
// entrée est retrouvée dans le répertoire Sirene, filtrée, puis créée.
//
// Écartées automatiquement (avec le motif, pour le compte rendu) :
//  - entreprise fermée (cessation dans Sirene) ;
//  - moins de 20 salariés (seuil d'assujettissement OETH) ;
//  - créée il y a moins de 5 ans (période d'exonération des nouvelles
//    entreprises — voir calculerNeutralisation dans oeth.js) ;
//  - déjà présente dans le CRM.
// Les fiches créées peuvent partir en recherche IA des numéros et du contact
// RH (même file d'attente que les autres imports).
import db from "./db.js";
import { normaliserSiren, rechercherEntrepriseParSiren, rechercherEntreprises } from "./insee.js";

const TAILLE_MAX_APPEL = 25;
const PAUSE_SIRENE_MS = 300;
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// Mots significatifs d'un nom (sans accents, ponctuation, formes juridiques
// ni petits mots) : "Onet Propreté & Services" → ["onet", "proprete", "services"].
const MOTS_VIDES = new Set(["sa", "sas", "sasu", "sarl", "eurl", "sci", "snc", "et", "de", "du", "des", "la", "le", "les", "l", "d", "a", "au", "aux", "en", "groupe", "societe", "ste"]);
function motsSignificatifs(nom) {
  return String(nom || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length >= 2 && !MOTS_VIDES.has(m));
}

// Parmi les résultats Sirene d'une recherche par nom, garde le premier dont
// le nom contient TOUS les mots significatifs saisis — évite d'importer une
// entreprise au hasard à partir d'un titre ou d'une ligne de texte du fichier.
function meilleureCorrespondance(nomSaisi, resultats) {
  const mots = motsSignificatifs(nomSaisi);
  if (mots.length === 0) return null;
  return (
    resultats.find((r) => {
      const motsResultat = new Set(motsSignificatifs(`${r.nom} ${r.sigle || ""}`));
      const trouves = mots.filter((m) => motsResultat.has(m)).length;
      // Tous les mots, ou tous sauf un quand le nom saisi en compte 3 ou plus
      // (ex. "Onet Propreté & Services" → "ONET SERVICES").
      return trouves === mots.length || (mots.length >= 3 && trouves >= mots.length - 1 && motsResultat.has(mots[0]));
    }) || null
  );
}

function creeeIlYaMoinsDe5Ans(dateCreation) {
  if (!dateCreation) return false;
  const d = new Date(dateCreation);
  if (Number.isNaN(d.getTime())) return false;
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - 5);
  return d > limite;
}

export function enregistrerRoutesImportFichier(
  app,
  { exigerAdmin, creerLeadDepuisSiren, estDejaConnu, findEntreprise, mettreEnFileRechercheIA }
) {
  app.post("/api/leads/import-fichier", exigerAdmin, async (req, res) => {
    const entrees = Array.isArray(req.body.entrees) ? req.body.entrees : [];
    const lot = String(req.body.lot || "").trim();
    const assigneA = req.body.assigneA || null;
    const rechercheIA = req.body.rechercheIA !== false;
    if (!lot) return res.status(400).json({ error: "Le nom du lot est requis." });
    if (entrees.length === 0) return res.status(400).json({ error: "Aucune entreprise à importer." });
    if (entrees.length > TAILLE_MAX_APPEL) {
      return res.status(400).json({ error: `${TAILLE_MAX_APPEL} entreprises maximum par appel.` });
    }

    const resultats = [];
    const creees = [];
    for (const entree of entrees) {
      const saisie = entree.siren || entree.nom || "";
      try {
        // 1. Retrouver l'entreprise dans Sirene (par numéro ou par nom).
        let donnees = null;
        if (entree.siren) {
          const siren = normaliserSiren(entree.siren);
          if (!siren) {
            resultats.push({ saisie, statut: "ecartee", motif: "numéro SIREN / SIRET invalide" });
            continue;
          }
          donnees = await rechercherEntrepriseParSiren(siren);
        } else if (entree.nom) {
          const resultatsNom = await rechercherEntreprises(String(entree.nom).slice(0, 120), { limite: 5 });
          donnees = meilleureCorrespondance(entree.nom, resultatsNom);
        }
        if (!donnees) {
          resultats.push({ saisie, statut: "introuvable", motif: "introuvable dans le répertoire Sirene" });
          continue;
        }

        const ligne = { saisie, nom: donnees.nom, siren: donnees.siren, ville: donnees.ville };
        // 2. Filtres.
        if (estDejaConnu(donnees.siren)) {
          resultats.push({ ...ligne, statut: "existant", motif: "déjà dans le CRM" });
        } else if (!donnees.actif) {
          resultats.push({ ...ligne, statut: "ecartee", motif: "entreprise fermée" });
        } else if ((donnees.effectifEstime || 0) < 20) {
          resultats.push({ ...ligne, statut: "ecartee", motif: `moins de 20 salariés (${donnees.trancheEffectifLabel})` });
        } else if (creeeIlYaMoinsDe5Ans(donnees.dateCreation)) {
          resultats.push({ ...ligne, statut: "ecartee", motif: `créée il y a moins de 5 ans (${donnees.dateCreation})` });
        } else {
          // 3. Création de la fiche.
          const { existant, entreprise } = await creerLeadDepuisSiren(donnees.siren, { lot, assigneA, utilisateur: req.utilisateur });
          if (existant || !entreprise) {
            resultats.push({ ...ligne, statut: "existant", motif: "déjà dans le CRM" });
          } else {
            const fiche = findEntreprise(entreprise.id);
            if (fiche && donnees.dateCreation) fiche.dateCreation = donnees.dateCreation;
            if (fiche) creees.push(fiche);
            resultats.push({ ...ligne, statut: "cree", effectif: donnees.trancheEffectifLabel });
          }
        }
      } catch (e) {
        if (/Aucune entreprise trouvée/i.test(e.message)) {
          resultats.push({ saisie, statut: "introuvable", motif: "introuvable dans le répertoire Sirene" });
        } else {
          resultats.push({ saisie, statut: "erreur", motif: e.message });
        }
      }
      await attendre(PAUSE_SIRENE_MS);
    }

    if (creees.length) await db.write();
    const avecIA = rechercheIA && creees.length > 0 && mettreEnFileRechercheIA(creees);
    res.status(201).json({ lot, resultats, rechercheIA: Boolean(avecIA) });
  });
}
