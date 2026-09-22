import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import db, { initDb } from "./db.js";
import { calculerObligationOeth } from "./oeth.js";
import { classifierSecteur, listerCategories, determinerCollecteur } from "./secteurs.js";
import { estSirenValide, rechercherEntrepriseParSiren } from "./insee.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Build de production du frontend React (généré par `npm run build` côté
// client). N'existe pas en développement local (Vite sert le frontend
// séparément sur le port 5173) — uniquement en production (Render).
const distClient = path.join(__dirname, "..", "..", "client", "dist");

const app = express();
app.use(cors());
app.use(express.json());

await initDb();

// ---- Libellés des issues d'appel / sorties de dossier (source de vérité) ----
const ISSUES_APPEL = {
  nrp: "NRP (Non Répondant)",
  me_rappelle: "Me rappelle",
  a_rappeler: "À rappeler",
  rdv: "RDV",
  mail: "Mail",
  autre: "Autre",
};

const SORTIES_DOSSIER = {
  fiche: "Fiche → atelier",
  fiche_one_shot: "Fiche one-shot → atelier",
  mort: "Mort (dossier clos)",
};

// Cherche dans les dossiers actifs puis dans les archives, pour que les
// fiches archivées (dossiers "mort") restent consultables via les mêmes
// routes GET/PATCH sans dupliquer d'endpoints.
function findEntreprise(id) {
  return db.data.entreprises.find((e) => e.id === id) || db.data.archives.find((e) => e.id === id);
}

function estDejaConnu(siren) {
  return (
    db.data.entreprises.find((e) => e.siret && e.siret.slice(0, 9) === siren) ||
    db.data.archives.find((e) => e.siret && e.siret.slice(0, 9) === siren)
  );
}

// Purge automatique du pipeline actif : dès qu'un dossier passe "mort", il
// est déplacé vers `archives` plutôt que supprimé, pour alléger le tableau de
// bord sans perdre l'historique.
function archiver(entreprise) {
  const idx = db.data.entreprises.findIndex((e) => e.id === entreprise.id);
  if (idx !== -1) db.data.entreprises.splice(idx, 1);
  if (!db.data.archives.some((e) => e.id === entreprise.id)) db.data.archives.push(entreprise);
}

// Ajoute les champs calculés (obligation OETH, catégorie de secteur) sans les
// persister : ils sont toujours recalculés à partir des données brutes.
function enrichir(entreprise) {
  return {
    ...entreprise,
    oeth: calculerObligationOeth(entreprise),
    categorie: classifierSecteur(entreprise.secteurActivite, { secteurPublic: entreprise.secteurPublic }),
    collecteur: determinerCollecteur(entreprise),
  };
}

// ---- Routes ----

app.get("/api/categories", (req, res) => {
  res.json(listerCategories());
});

app.get("/api/entreprises", (req, res) => {
  res.json(db.data.entreprises.map(enrichir));
});

app.get("/api/entreprises/:id", (req, res) => {
  const entreprise = findEntreprise(req.params.id);
  if (!entreprise) return res.status(404).json({ error: "Entreprise introuvable" });
  res.json(enrichir(entreprise));
});

// Dossiers "mort" archivés automatiquement (consultation seule, hors pipeline actif).
app.get("/api/archives", (req, res) => {
  res.json(db.data.archives.map(enrichir));
});

// Vagues de prospection (lots) déjà utilisées, pour alimenter le filtre du tableau de bord.
app.get("/api/lots", (req, res) => {
  const lots = new Set(db.data.entreprises.map((e) => e.lot).filter(Boolean));
  res.json([...lots].sort());
});

// Crée un lead qualifié à partir d'un SIREN : déduplication (actifs + archivés),
// enrichissement INSEE, classification public/privé, et purge immédiate en
// archives si l'entreprise est déjà radiée. Réutilisée par la recherche unitaire
// et par l'import par lot.
async function creerLeadDepuisSiren(siren, { lot = null } = {}) {
  if (!estSirenValide(siren)) {
    const erreur = new Error("SIREN invalide (9 chiffres attendus, clé de contrôle incorrecte).");
    erreur.code = "SIREN_INVALIDE";
    throw erreur;
  }

  const existante = estDejaConnu(siren);
  if (existante) {
    return { existant: true, archive: !db.data.entreprises.includes(existante), entreprise: enrichir(existante) };
  }

  const donnees = await rechercherEntrepriseParSiren(siren);

  const nouvelle = {
    id: nanoid(),
    nom: donnees.nom,
    siret: donnees.siret,
    formeJuridique: donnees.formeJuridique,
    adresse: donnees.adresse,
    codePostal: donnees.codePostal,
    ville: donnees.ville,
    secteurActivite: donnees.secteurActivite,
    secteurPublic: donnees.secteurPublic,
    dateCreation: null,
    effectif: donnees.effectifEstime,
    effectifBeneficiaire: 0,
    typeContrat: "-",
    esatAssocie: "-",
    statut: donnees.actif ? "a_relancer" : "mort",
    lot,
    partManquant: null,
    partDebutOp: null,
    partFinOp: null,
    contact: { nom: "-", fonction: "-", telephone: "", email: "", telephoneInvalide: false },
    dateRappel: null,
    dateRdv: null,
    commentaires: [
      {
        id: nanoid(),
        date: new Date().toISOString(),
        auteur: "Système",
        texte: donnees.actif
          ? `Lead créé automatiquement par SIREN (source : répertoire Sirene INSEE)${
              lot ? ` — ${lot}` : ""
            }. Effectif indicatif : ${donnees.trancheEffectifLabel} — à confirmer avec le client. Coordonnées de contact non fournies par l'INSEE : à compléter manuellement.`
          : `Entreprise radiée d'après le répertoire Sirene (fermeture le ${donnees.dateFermeture || "date inconnue"}) — dossier archivé automatiquement, aucune action requise.`,
      },
    ],
    historiqueAppels: [],
  };

  if (donnees.actif) {
    db.data.entreprises.push(nouvelle);
  } else {
    db.data.archives.push(nouvelle);
  }
  await db.write();
  return { existant: false, archive: !donnees.actif, entreprise: enrichir(nouvelle) };
}

// Module d'automatisation des leads par SIREN : déduplication, puis
// enrichissement + qualification automatique via le répertoire Sirene (INSEE).
app.post("/api/leads/siren", async (req, res) => {
  const siren = String(req.body.siren || "").replace(/\s/g, "");
  try {
    const resultat = await creerLeadDepuisSiren(siren, { lot: req.body.lot || null });
    res.status(resultat.existant ? 200 : 201).json(resultat);
  } catch (e) {
    const statutHttp = e.code === "SIREN_INVALIDE" ? 400 : e.code === "SIREN_INTROUVABLE" ? 404 : 502;
    res.status(statutHttp).json({ error: e.message });
  }
});

// Import d'une vague (lot) de SIREN en une fois, pour alimenter la
// prospection en continu sans surcharger le tableau de bord.
app.post("/api/leads/siren/lot", async (req, res) => {
  const sirens = Array.isArray(req.body.sirens) ? req.body.sirens : [];
  const lot = String(req.body.lot || "").trim();
  if (!lot) return res.status(400).json({ error: "Le nom du lot est requis." });
  if (sirens.length === 0) return res.status(400).json({ error: "Aucun SIREN fourni." });
  if (sirens.length > 100) return res.status(400).json({ error: "100 SIREN maximum par lot (limite anti-abus de l'API publique)." });

  const resultats = [];
  for (const brut of sirens) {
    const siren = String(brut || "").replace(/\s/g, "");
    if (!siren) continue;
    try {
      const { existant, archive, entreprise } = await creerLeadDepuisSiren(siren, { lot });
      resultats.push({ siren, statut: existant ? "existant" : archive ? "radiee" : "cree", nom: entreprise.nom });
    } catch (e) {
      resultats.push({ siren, statut: "erreur", erreur: e.message });
    }
    // Petite pause polie entre deux appels à l'API publique Sirene.
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  res.status(201).json({ lot, resultats });
});

app.patch("/api/entreprises/:id", async (req, res) => {
  const entreprise = findEntreprise(req.params.id);
  if (!entreprise) return res.status(404).json({ error: "Entreprise introuvable" });

  const champsAutorises = [
    "statut",
    "dateRappel",
    "dateRdv",
    "nom",
    "contact",
    "effectif",
    "effectifBeneficiaire",
    "typeContrat",
    "esatAssocie",
    "dateCreation",
    "secteurPublic",
    "lot",
  ];
  for (const champ of champsAutorises) {
    if (champ in req.body) entreprise[champ] = req.body[champ];
  }

  await db.write();
  res.json(enrichir(entreprise));
});

// Enregistre une nouvelle issue d'appel (module AGIR) et met à jour le statut
app.post("/api/entreprises/:id/appels", async (req, res) => {
  const entreprise = findEntreprise(req.params.id);
  if (!entreprise) return res.status(404).json({ error: "Entreprise introuvable" });

  const { issue, date, details, dureeSecondes } = req.body;
  if (!ISSUES_APPEL[issue]) {
    return res.status(400).json({ error: "Issue d'appel inconnue" });
  }

  const entree = {
    id: nanoid(),
    date: new Date().toISOString(),
    type: "appel",
    issue,
    issueLabel: ISSUES_APPEL[issue],
    details: details || null,
    dateProgrammee: date || null,
    dureeSecondes: Number.isFinite(dureeSecondes) ? dureeSecondes : null,
  };

  entreprise.historiqueAppels.unshift(entree);
  entreprise.statut = issue;
  if (issue === "a_rappeler") entreprise.dateRappel = date || null;
  if (issue === "rdv") entreprise.dateRdv = date || null;

  await db.write();
  res.json(enrichir(entreprise));
});

// Enregistre une sortie de dossier (Fiche / Fiche one-shot / Mort)
app.post("/api/entreprises/:id/sortie", async (req, res) => {
  const entreprise = findEntreprise(req.params.id);
  if (!entreprise) return res.status(404).json({ error: "Entreprise introuvable" });

  const { sortie, details, dureeSecondes } = req.body;
  if (!SORTIES_DOSSIER[sortie]) {
    return res.status(400).json({ error: "Sortie de dossier inconnue" });
  }

  const entree = {
    id: nanoid(),
    date: new Date().toISOString(),
    type: "sortie",
    issue: sortie,
    issueLabel: SORTIES_DOSSIER[sortie],
    details: details || null,
    dateProgrammee: null,
    dureeSecondes: Number.isFinite(dureeSecondes) ? dureeSecondes : null,
  };

  entreprise.historiqueAppels.unshift(entree);
  entreprise.statut = sortie;

  // Purge automatique du pipeline actif : un dossier "mort" est déplacé vers
  // les archives plutôt que laissé dans la liste active des entreprises.
  const archive = sortie === "mort";
  if (archive) archiver(entreprise);

  await db.write();
  res.json({ archive, entreprise: enrichir(entreprise) });
});

// Ajoute un commentaire libre (messagerie / historique)
app.post("/api/entreprises/:id/commentaires", async (req, res) => {
  const entreprise = findEntreprise(req.params.id);
  if (!entreprise) return res.status(404).json({ error: "Entreprise introuvable" });

  const { texte, auteur } = req.body;
  if (!texte || !texte.trim()) {
    return res.status(400).json({ error: "Le commentaire ne peut pas être vide" });
  }

  const commentaire = {
    id: nanoid(),
    date: new Date().toISOString(),
    auteur: auteur || "Philippe",
    texte: texte.trim(),
  };

  entreprise.commentaires.unshift(commentaire);
  await db.write();
  res.json(enrichir(entreprise));
});

// Espace IA (assistant de correction de contact) : un agent signale un
// numéro non attribué/invalide. Faute d'API de téléphonie payante (Pappers)
// configurée, l'assistant ne devine pas un numéro : il flague le contact et
// journalise l'anomalie, pendant que le frontend propose des pistes de
// recherche externes prêtes à cliquer.
app.post("/api/entreprises/:id/telephone-invalide", async (req, res) => {
  const entreprise = findEntreprise(req.params.id);
  if (!entreprise) return res.status(404).json({ error: "Entreprise introuvable" });

  const ancienNumero = entreprise.contact?.telephone || "(aucun)";
  entreprise.contact = { ...entreprise.contact, telephoneInvalide: true };
  entreprise.commentaires.unshift({
    id: nanoid(),
    date: new Date().toISOString(),
    auteur: "Assistant IA",
    texte: `Numéro signalé non attribué/invalide (${ancienNumero}). Recherche d'un contact alternatif recommandée — voir les pistes proposées dans la fiche.`,
  });

  await db.write();
  res.json(enrichir(entreprise));
});

// Sert le frontend React buildé et gère le routage côté client (React
// Router) : toute route qui n'est pas une route API renvoie index.html,
// pour que /entreprise/:id fonctionne aussi en accès direct ou au rechargement.
if (fs.existsSync(distClient)) {
  app.use(express.static(distClient));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(distClient, "index.html"));
  });
} else {
  console.warn(
    `Build client introuvable (${distClient}) — le frontend n'est pas servi. ` +
      "Lancez `npm run build` à la racine du projet avant `npm start` en production."
  );
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API CRM OETH/AGEFIPH démarrée sur http://localhost:${PORT}`);
});
