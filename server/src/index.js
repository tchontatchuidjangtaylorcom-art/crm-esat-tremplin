import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import db, { initDb } from "./db.js";
import { calculerObligationOeth } from "./oeth.js";
import { classifierSecteur, listerCategories, determinerCollecteur, CATEGORIES } from "./secteurs.js";
import { estSirenValide, rechercherEntrepriseParSiren, rechercherEntreprisesParSecteur } from "./insee.js";
import { getArgumentaireAgefiph, trouverLigneBareme } from "./argumentaire.js";
import { getScriptVente } from "./scriptVente.js";
import { getModelesMails } from "./modelesMails.js";
import {
  estSmtpConfigure,
  estBrevoConfigure,
  estEnvoiConfigure,
  estImapConfigure,
  relaverBoiteMail,
  envoyerMail,
  signatureMail,
  adresseMailPole,
  verifierConnexionSMTP,
} from "./mail.js";
import {
  estRechercheIaConfiguree,
  rechercherContactAlternatif,
  detailErreur as detailErreurIa,
} from "./rechercheContact.js";
import {
  trouverOuCreerUtilisateur,
  trouverUtilisateurParId,
  envoyerLienMagique,
  verifierLienMagique,
  creerCookieSession,
  optionsCookie,
  NOM_COOKIE,
  exigerAuth,
  exigerAdmin,
} from "./auth.js";
import { googleConfigure, verifierIdTokenGoogle } from "./googleAuth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Build de production du frontend React (généré par `npm run build` côté
// client). N'existe pas en développement local (Vite sert le frontend
// séparément sur le port 5173) — uniquement en production (Render).
const distClient = path.join(__dirname, "..", "..", "client", "dist");
// URL publique du CRM telle qu'accédée par un navigateur — sert à construire
// les liens de connexion envoyés par mail. Doit pointer vers le service
// Render en production (voir server/.env.example).
const APP_URL = process.env.APP_URL || "http://localhost:5173";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

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
  conforme: "Conforme — dossier réglé",
  refus: "Refus (dossier clos)",
  mort: "Mort (dossier clos)",
};

// Sorties qui font quitter le pipeline actif : le dossier est archivé
// automatiquement (voir `archiver()`) — que ce soit un succès (déjà en
// conformité, plus rien à prospecter), un refus explicite du prospect, ou
// une entreprise injoignable/radiée. On distingue volontairement "conforme"
// de "mort"/"refus" pour ne pas mélanger un dossier réglé avec un échec de
// prospection dans les statistiques.
const SORTIES_ARCHIVANTES = new Set(["conforme", "refus", "mort"]);

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
  const assigne = entreprise.assigneA ? trouverUtilisateurParId(entreprise.assigneA) : null;
  return {
    ...entreprise,
    emails: entreprise.emails || [],
    oeth: calculerObligationOeth(entreprise),
    categorie: classifierSecteur(entreprise.secteurActivite, {
      secteurPublic: entreprise.secteurPublic,
      categorieForcee: entreprise.categorieForcee,
    }),
    collecteur: determinerCollecteur(entreprise),
    ligneBareme: trouverLigneBareme(entreprise.effectif),
    assigneANom: assigne ? assigne.prenom || assigne.email : null,
  };
}

// Un agent ne voit/traite que les dossiers qui lui sont assignés ;
// l'administrateur garde une vue et un accès globaux sur tout le pipeline.
function estVisiblePar(entreprise, utilisateur) {
  return utilisateur.role === "admin" || entreprise.assigneA === utilisateur.id;
}

// Attache req.entreprise si elle existe ET est visible par l'utilisateur
// connecté, sinon répond 404 (dossier introuvable) ou 403 (existe mais pas
// assigné à cet agent) — utilisé par toutes les routes /api/entreprises/:id/*.
function chargerEntrepriseAutorisee(req, res, next) {
  const entreprise = findEntreprise(req.params.id);
  if (!entreprise) return res.status(404).json({ error: "Entreprise introuvable" });
  if (!estVisiblePar(entreprise, req.utilisateur)) {
    return res.status(403).json({ error: "Ce dossier est assigné à un autre agent." });
  }
  req.entreprise = entreprise;
  next();
}

// Retrouve l'entreprise (active ou archivée) dont l'adresse mail de contact
// correspond à l'expéditeur d'un message reçu.
function trouverEntrepriseParEmail(adresse) {
  const cherche = (adresse || "").toLowerCase();
  if (!cherche) return null;
  return (
    db.data.entreprises.find((e) => (e.contact?.email || "").toLowerCase() === cherche) ||
    db.data.archives.find((e) => (e.contact?.email || "").toLowerCase() === cherche) ||
    null
  );
}

// ---- Authentification (lien magique + Google, validation admin) ----
//
// Note de déploiement : ces routes sont fonctionnelles et testables dès
// maintenant, mais ne sont pas encore appliquées au reste du CRM (aucune
// route entreprise/dashboard n'exige de session) — le temps de valider que
// l'envoi de mail et la connexion fonctionnent bout en bout avec de vrais
// identifiants avant de verrouiller l'accès à toute l'application.

app.get("/api/auth/config", (req, res) => {
  res.json({ mailConfigure: estEnvoiConfigure(), googleConfigure: googleConfigure(), googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

app.post("/api/auth/demander-lien", async (req, res) => {
  const email = String(req.body.email || "").trim();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Adresse mail invalide." });
  }

  const utilisateur = await trouverOuCreerUtilisateur(email);

  if (utilisateur.statut === "refuse") {
    return res.status(403).json({ error: "Accès non autorisé pour cette adresse. Contactez l'administrateur." });
  }
  if (utilisateur.statut === "en_attente") {
    return res.json({
      statut: "en_attente",
      message: "Votre demande d'accès a été transmise à l'administrateur. Vous recevrez un lien dès validation.",
    });
  }

  try {
    await envoyerLienMagique(utilisateur, APP_URL);
  } catch (e) {
    const statutHttp = e.code === "MAIL_NON_CONFIGURE" ? 503 : 502;
    return res.status(statutHttp).json({ error: e.message });
  }
  res.json({ statut: "lien_envoye", message: "Un lien de connexion vient de vous être envoyé par mail." });
});

// Lien cliqué depuis le mail : vérifie le jeton, ouvre la session, puis
// redirige vers l'application (jamais une réponse JSON, c'est une navigation
// de navigateur).
app.get("/api/auth/verifier", (req, res) => {
  try {
    const utilisateur = verifierLienMagique(String(req.query.token || ""));
    creerCookieSession(res, utilisateur);
    res.redirect(`${APP_URL}/`);
  } catch {
    res.redirect(`${APP_URL}/connexion?erreur=lien_invalide`);
  }
});

app.post("/api/auth/google", async (req, res) => {
  try {
    const { email, prenom, nom } = await verifierIdTokenGoogle(req.body.idToken);
    const utilisateur = await trouverOuCreerUtilisateur(email, { prenom, nom });

    if (utilisateur.statut === "refuse") {
      return res.status(403).json({ error: "Accès non autorisé pour cette adresse." });
    }
    if (utilisateur.statut === "en_attente") {
      return res.json({ statut: "en_attente", message: "Votre demande d'accès a été transmise à l'administrateur." });
    }

    creerCookieSession(res, utilisateur);
    res.json({ statut: "connecte", utilisateur: { email: utilisateur.email, prenom: utilisateur.prenom, nom: utilisateur.nom, role: utilisateur.role } });
  } catch (e) {
    const statutHttp = e.code === "GOOGLE_NON_CONFIGURE" ? 503 : 400;
    res.status(statutHttp).json({ error: e.message });
  }
});

app.get("/api/auth/moi", exigerAuth, (req, res) => {
  const { id, email, prenom, nom, role } = req.utilisateur;
  res.json({ id, email, prenom, nom, role });
});

app.post("/api/auth/deconnexion", (req, res) => {
  res.clearCookie(NOM_COOKIE, optionsCookie());
  res.json({ ok: true });
});

// Administration des accès (réservé aux comptes "admin")
app.get("/api/utilisateurs", exigerAdmin, (req, res) => {
  res.json(db.data.utilisateurs);
});

app.post("/api/utilisateurs/:id/valider", exigerAdmin, async (req, res) => {
  const utilisateur = trouverUtilisateurParId(req.params.id);
  if (!utilisateur) return res.status(404).json({ error: "Utilisateur introuvable." });
  utilisateur.statut = "valide";
  utilisateur.role = req.body.role === "admin" ? "admin" : "agent";
  utilisateur.dateValidation = new Date().toISOString();
  await db.write();
  res.json(utilisateur);
});

app.post("/api/utilisateurs/:id/refuser", exigerAdmin, async (req, res) => {
  const utilisateur = trouverUtilisateurParId(req.params.id);
  if (!utilisateur) return res.status(404).json({ error: "Utilisateur introuvable." });
  utilisateur.statut = "refuse";
  await db.write();
  res.json(utilisateur);
});

// ---- Routes ----

app.get("/api/categories", (req, res) => {
  res.json(listerCategories());
});

// Indique si la recherche IA (Gemini) est configurée, pour afficher/masquer
// côté frontend l'option d'enrichissement automatique du téléphone à
// l'import par secteur (voir plus bas) et l'espace IA de la fiche entreprise.
app.get("/api/ia/statut", (req, res) => {
  res.json({ configuree: estRechercheIaConfiguree() });
});

// Aide-mémoire agent (affiche officielle du pôle AGEFIPH) : argumentaire,
// dates clés et barème des unités bénéficiaires — contenu statique partagé
// par le tiroir d'aide et la fiche entreprise.
app.get("/api/argumentaire-agefiph", (req, res) => {
  res.json(getArgumentaireAgefiph());
});

// Script de vente et modèles de mails : mêmes principes que l'argumentaire
// AGEFIPH ci-dessus — contenu statique, source unique côté serveur.
app.get("/api/script-vente", (req, res) => {
  res.json(getScriptVente());
});

app.get("/api/modeles-mails", (req, res) => {
  res.json(getModelesMails());
});

// Vue filtrée par rôle : un agent ne reçoit que ses dossiers assignés,
// l'administrateur reçoit tout le pipeline (voir estVisiblePar ci-dessus).
app.get("/api/entreprises", exigerAuth, (req, res) => {
  const visibles = db.data.entreprises.filter((e) => estVisiblePar(e, req.utilisateur));
  res.json(visibles.map(enrichir));
});

app.get("/api/entreprises/:id", exigerAuth, chargerEntrepriseAutorisee, (req, res) => {
  res.json(enrichir(req.entreprise));
});

// Dossiers "mort" archivés automatiquement (consultation seule, hors pipeline actif).
app.get("/api/archives", exigerAuth, (req, res) => {
  const visibles = db.data.archives.filter((e) => estVisiblePar(e, req.utilisateur));
  res.json(visibles.map(enrichir));
});

// Vagues de prospection (lots) déjà utilisées, pour alimenter le filtre du
// tableau de bord — limité aux dossiers visibles par l'utilisateur connecté.
app.get("/api/lots", exigerAuth, (req, res) => {
  const visibles = db.data.entreprises.filter((e) => estVisiblePar(e, req.utilisateur));
  const lots = new Set(visibles.map((e) => e.lot).filter(Boolean));
  res.json([...lots].sort());
});

// Crée un lead qualifié à partir d'un SIREN : déduplication (actifs + archivés),
// enrichissement INSEE, classification public/privé, et purge immédiate en
// archives si l'entreprise est déjà radiée. Réutilisée par la recherche unitaire
// et par l'import par lot.
async function creerLeadDepuisSiren(siren, { lot = null, categorieForcee = null, assigneA = null, utilisateur } = {}) {
  if (!estSirenValide(siren)) {
    const erreur = new Error("SIREN invalide (9 chiffres attendus, clé de contrôle incorrecte).");
    erreur.code = "SIREN_INVALIDE";
    throw erreur;
  }

  const existante = estDejaConnu(siren);
  if (existante) {
    // Le SIREN existe déjà dans le CRM mais est assigné à un autre agent :
    // on confirme juste la duplication, sans exposer ses données (contact,
    // historique...) à quelqu'un qui n'y a pas accès.
    if (utilisateur && !estVisiblePar(existante, utilisateur)) {
      return { existant: true, archive: !db.data.entreprises.includes(existante), entreprise: null };
    }
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
    categorieForcee,
    assigneA,
    dateCreation: null,
    effectif: donnees.effectifEstime,
    effectifBeneficiaire: 0,
    typeContrat: "-",
    esatAssocie: "-",
    statut: donnees.actif ? "nouveau" : "mort",
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
            }${categorieForcee && CATEGORIES[categorieForcee] ? `, catégorie assignée : ${CATEGORIES[categorieForcee].label}` : ""}. Effectif indicatif : ${donnees.trancheEffectifLabel} — à confirmer avec le client. Coordonnées de contact non fournies par l'INSEE : à compléter manuellement.`
          : `Entreprise radiée d'après le répertoire Sirene (fermeture le ${donnees.dateFermeture || "date inconnue"}) — dossier archivé automatiquement, aucune action requise.`,
      },
    ],
    historiqueAppels: [],
    emails: [],
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
// Recherche ponctuelle et personnelle (l'agent est en train de qualifier ce
// prospect) : assignée directement à qui la déclenche, admin ou agent.
app.post("/api/leads/siren", exigerAuth, async (req, res) => {
  const siren = String(req.body.siren || "").replace(/\s/g, "");
  try {
    const resultat = await creerLeadDepuisSiren(siren, {
      lot: req.body.lot || null,
      assigneA: req.utilisateur.id,
      utilisateur: req.utilisateur,
    });
    res.status(resultat.existant ? 200 : 201).json(resultat);
  } catch (e) {
    const statutHttp = e.code === "SIREN_INVALIDE" ? 400 : e.code === "SIREN_INTROUVABLE" ? 404 : 502;
    res.status(statutHttp).json({ error: e.message });
  }
});

// Import d'une vague (lot) de SIREN en une fois, pour alimenter la
// prospection en continu sans surcharger le tableau de bord. Réservé aux
// administrateurs : c'est une action de constitution de pipeline, pas une
// qualification individuelle — les fiches restent non assignées (visibles
// seulement des admins) jusqu'à distribution explicite à un agent, sauf si
// `assigneA` est fourni pour assigner la vague dès l'import.
app.post("/api/leads/siren/lot", exigerAdmin, async (req, res) => {
  const sirens = Array.isArray(req.body.sirens) ? req.body.sirens : [];
  const lot = String(req.body.lot || "").trim();
  const assigneA = req.body.assigneA || null;
  if (!lot) return res.status(400).json({ error: "Le nom du lot est requis." });
  if (sirens.length === 0) return res.status(400).json({ error: "Aucun SIREN fourni." });
  if (sirens.length > 100) return res.status(400).json({ error: "100 SIREN maximum par lot (limite anti-abus de l'API publique)." });

  const resultats = [];
  for (const brut of sirens) {
    const siren = String(brut || "").replace(/\s/g, "");
    if (!siren) continue;
    try {
      const { existant, archive, entreprise } = await creerLeadDepuisSiren(siren, { lot, assigneA, utilisateur: req.utilisateur });
      resultats.push({ siren, statut: existant ? "existant" : archive ? "radiee" : "cree", nom: entreprise?.nom || "(déjà assigné à un autre agent)" });
    } catch (e) {
      resultats.push({ siren, statut: "erreur", erreur: e.message });
    }
    // Petite pause polie entre deux appels à l'API publique Sirene.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  res.status(201).json({ lot, resultats });
});

// Enrichissement automatique du téléphone via Gemini (recherche web), pour
// les fiches fraîchement créées par un import par secteur : l'API Sirene ne
// fournit aucun contact, ce qui laisse jusqu'ici les fiches inexploitables au
// Power Dialer tant qu'un agent ne les complète pas à la main. Lancé APRÈS
// l'envoi de la réponse HTTP (voir /api/leads/secteur/importer), sans
// attendre sa fin : un lot de 100 SIREN à raison de plusieurs secondes par
// appel Gemini dépasserait largement les délais des proxys si on bloquait la
// requête d'import dessus. Meilleur effort volontairement silencieux côté
// résultat d'import : une fiche non enrichie (échec IA, rien trouvé) reste
// simplement à compléter manuellement comme avant cette fonctionnalité — pas
// d'écriture de numéro halluciné, rechercherContactAlternatif renvoie déjà
// null plutôt qu'inventer une valeur.
async function enrichirTelephonesViaIA(entreprises) {
  for (const entreprise of entreprises) {
    try {
      const resultat = await rechercherContactAlternatif(entreprise);
      if (resultat.telephone) {
        entreprise.contact.telephone = resultat.telephone;
        entreprise.commentaires.unshift({
          id: nanoid(),
          date: new Date().toISOString(),
          auteur: "Assistant IA",
          texte:
            `Numéro de téléphone trouvé automatiquement via recherche IA (confiance ${resultat.confiance}` +
            `${resultat.source ? `, source : ${resultat.source}` : ""})` +
            `${resultat.contact ? ` — contact suggéré : ${resultat.contact}` : ""}. À vérifier au premier appel.`,
        });
        await db.write();
      }
    } catch (e) {
      console.error(
        `[ia] Échec de recherche automatique de téléphone pour ${entreprise.nom} :`,
        JSON.stringify(detailErreurIa(e))
      );
    }
    // Petite pause polie entre deux appels à l'API Gemini.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

// Génération d'une vague de prospects par secteur : recherche de candidats
// RÉELS dans le répertoire Sirene (INSEE), filtrés par code NAF (précis —
// voir la note dans insee.js sur pourquoi une recherche par mots-clés a été
// écartée) — délibérément PAS de génération par un modèle de langage ici :
// un LLM invente des identifiants d'entreprise à l'échelle (SIREN,
// adresses...) au lieu de les retrouver, ce qui pollue le CRM de leads
// fictifs utilisés ensuite pour de vrais appels commerciaux. Étape de
// PRÉVISUALISATION seulement : rien n'est créé en base, voir
// /api/leads/secteur/importer.
app.post("/api/leads/secteur/rechercher", exigerAdmin, async (req, res) => {
  const cle = String(req.body.categorie || "");
  const categorie = CATEGORIES[cle];
  if (!categorie) return res.status(400).json({ error: "Catégorie inconnue." });

  const departement = req.body.departement ? String(req.body.departement).trim() : null;
  const limite = Math.min(Number(req.body.limite) || 100, 300);

  try {
    const candidats = await rechercherEntreprisesParSecteur(
      { nafCodes: categorie.nafCodes, estAdministration: categorie.estAdministration },
      { departement, limite }
    );
    const connus = new Set([...db.data.entreprises, ...db.data.archives].map((e) => e.siren));
    const nouveaux = candidats.filter((c) => !connus.has(c.siren));
    res.json({ categorie: cle, categorieLabel: categorie.label, total: nouveaux.length, entreprises: nouveaux });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Importe la vague prévisualisée ci-dessus (liste de SIREN déjà filtrée côté
// frontend) et assigne directement la catégorie choisie à chaque fiche créée
// (categorieForcee) — même limite anti-abus que l'import manuel par lot.
// Réservé aux administrateurs (constitution de pipeline, pas qualification
// individuelle) ; `assigneA` optionnel pour distribuer la vague dès l'import.
app.post("/api/leads/secteur/importer", exigerAdmin, async (req, res) => {
  const cle = String(req.body.categorie || "");
  const categorie = CATEGORIES[cle];
  if (!categorie) return res.status(400).json({ error: "Catégorie inconnue." });

  const sirens = Array.isArray(req.body.sirens) ? req.body.sirens : [];
  const lot = String(req.body.lot || "").trim();
  const assigneA = req.body.assigneA || null;
  if (!lot) return res.status(400).json({ error: "Le nom du lot est requis." });
  if (sirens.length === 0) return res.status(400).json({ error: "Aucun SIREN fourni." });
  if (sirens.length > 100) {
    return res.status(400).json({ error: "100 SIREN maximum par vague (limite anti-abus de l'API publique)." });
  }

  // rechercheTelephoneIA : option activée par défaut (voir ImportLot.jsx) —
  // l'agent peut la décocher pour un import purement Sirene, plus rapide.
  const rechercheTelephoneIA = req.body.rechercheTelephoneIA !== false;

  const resultats = [];
  const creeesPourIa = [];
  for (const brut of sirens) {
    const siren = String(brut || "").replace(/\s/g, "");
    if (!siren) continue;
    try {
      const { existant, archive, entreprise } = await creerLeadDepuisSiren(siren, {
        lot,
        categorieForcee: cle,
        assigneA,
        utilisateur: req.utilisateur,
      });
      resultats.push({ siren, statut: existant ? "existant" : archive ? "radiee" : "cree", nom: entreprise?.nom || "(déjà assigné à un autre agent)" });
      if (!existant && !archive && entreprise) creeesPourIa.push(entreprise);
    } catch (e) {
      resultats.push({ siren, statut: "erreur", erreur: e.message });
    }
    // Petite pause polie entre deux appels à l'API publique Sirene.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const enrichissementTelephoneIA = rechercheTelephoneIA && estRechercheIaConfiguree() && creeesPourIa.length > 0;
  res.status(201).json({ lot, categorie: cle, resultats, enrichissementTelephoneIA });

  // Volontairement après res.json ci-dessus et sans await : voir
  // enrichirTelephonesViaIA pour le détail (ne doit pas bloquer la réponse).
  if (enrichissementTelephoneIA) {
    enrichirTelephonesViaIA(creeesPourIa).catch((e) =>
      console.error("[ia] Échec de l'enrichissement téléphone en lot :", e.message)
    );
  }
});

app.patch("/api/entreprises/:id", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

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
    "categorieForcee",
  ];
  for (const champ of champsAutorises) {
    if (champ in req.body) entreprise[champ] = req.body[champ];
  }

  await db.write();
  res.json(enrichir(entreprise));
});

// Assignation d'un dossier à un agent — réservé aux administrateurs (une
// route dédiée plutôt qu'un champ PATCH ouvert : c'est une décision de
// répartition du pipeline, pas une correction de fiche par l'agent qui la
// traite). `utilisateurId: null` retire l'assignation ; le dossier redevient
// alors visible uniquement des admins, en attente de redistribution.
app.post("/api/entreprises/:id/assigner", exigerAdmin, async (req, res) => {
  const entreprise = findEntreprise(req.params.id);
  if (!entreprise) return res.status(404).json({ error: "Entreprise introuvable" });

  const utilisateurId = req.body.utilisateurId || null;
  if (utilisateurId) {
    const cible = trouverUtilisateurParId(utilisateurId);
    if (!cible || cible.statut !== "valide") {
      return res.status(400).json({ error: "Agent introuvable ou compte non validé." });
    }
  }
  entreprise.assigneA = utilisateurId;
  await db.write();
  res.json(enrichir(entreprise));
});

// Assignation en masse de toute une vague (lot) de prospection à un agent —
// réservé aux administrateurs. Le nom du lot arrive encodé dans l'URL (les
// noms de lot contiennent souvent des espaces/tirets).
app.post("/api/lots/:lot/assigner", exigerAdmin, async (req, res) => {
  const lot = req.params.lot; // déjà décodé par Express (routing sur path-to-regexp)
  const utilisateurId = req.body.utilisateurId || null;
  if (utilisateurId) {
    const cible = trouverUtilisateurParId(utilisateurId);
    if (!cible || cible.statut !== "valide") {
      return res.status(400).json({ error: "Agent introuvable ou compte non validé." });
    }
  }
  const cibles = db.data.entreprises.filter((e) => e.lot === lot);
  for (const e of cibles) e.assigneA = utilisateurId;
  await db.write();
  res.json({ lot, nbAssignees: cibles.length, entreprises: cibles.map(enrichir) });
});

// Enregistre une nouvelle issue d'appel (module AGIR) et met à jour le statut
app.post("/api/entreprises/:id/appels", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

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
app.post("/api/entreprises/:id/sortie", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

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
  const archive = SORTIES_ARCHIVANTES.has(sortie);
  if (archive) archiver(entreprise);

  await db.write();
  res.json({ archive, entreprise: enrichir(entreprise) });
});

// Ajoute un commentaire libre (messagerie / historique)
app.post("/api/entreprises/:id/commentaires", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

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
app.post("/api/entreprises/:id/telephone-invalide", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

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

// Recherche IA (Gemini + recherche Google) d'un numéro/contact alternatif ET
// d'une catégorie de secteur suggérée, quand le numéro enregistré a été
// signalé invalide. Optionnelle (GEMINI_API_KEY/GOOGLE_API_KEY) et protégée
// par une session valide même si les autres routes /api/entreprises ne le
// sont pas ici : chaque appel déclenche un appel (potentiellement facturé) à
// l'API Gemini, à ne pas laisser accessible sans authentification.
// Renvoie une PROPOSITION seulement — voir rechercheContact.js : rien n'est
// écrit en base ici, l'agent doit valider via le formulaire existant
// (numéro : POST .../telephone-invalide puis PATCH ; catégorie : PATCH
// categorieForcee) avant que ça n'affecte la fiche.
app.post("/api/entreprises/:id/rechercher-contact", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

  if (!estRechercheIaConfiguree()) {
    return res.status(503).json({ error: "Recherche IA non configurée (renseignez GEMINI_API_KEY)." });
  }

  try {
    const resultat = await rechercherContactAlternatif(entreprise);
    const morceaux = [];
    if (resultat.telephone) {
      morceaux.push(
        `numéro proposé ${resultat.telephone}${resultat.contact ? ` (contact : ${resultat.contact})` : ""} — confiance ${resultat.confiance}${resultat.source ? `, source : ${resultat.source}` : ""}`
      );
    }
    if (resultat.secteurCategorieLabel) {
      morceaux.push(`catégorie suggérée : ${resultat.secteurCategorieLabel}`);
    }
    entreprise.commentaires.unshift({
      id: nanoid(),
      date: new Date().toISOString(),
      auteur: "Assistant IA",
      texte: morceaux.length
        ? `Recherche IA : ${morceaux.join(" ; ")}. À valider avant application.`
        : "Recherche IA : aucune information fiable trouvée.",
    });
    await db.write();
    res.json(resultat);
  } catch (e) {
    console.error(`[ia] Échec de recherche de contact pour ${entreprise.nom} :`, JSON.stringify(detailErreurIa(e)));
    const statutHttp = e.code === "IA_NON_CONFIGUREE" ? 503 : e.code === "TIMEOUT_MANUEL" ? 504 : 502;
    res.status(statutHttp).json({ error: e.message });
  }
});

// Boîte mail connectée (IMAP/SMTP) : indique si elle est configurée, et
// l'adresse du pôle pour l'affichage côté frontend.
app.get("/api/emails/statut", (req, res) => {
  res.json({ configuree: estEnvoiConfigure(), adresse: adresseMailPole(), signature: signatureMail() });
});

// Notification globale (nombre de mails non lus par entreprise), pour
// afficher un badge/pop-up dans le CRM sans avoir à ouvrir chaque fiche —
// limitée aux dossiers visibles par l'utilisateur connecté.
app.get("/api/emails/non-lus", exigerAuth, (req, res) => {
  const parEntreprise = [];
  let total = 0;
  for (const e of db.data.entreprises) {
    if (!estVisiblePar(e, req.utilisateur)) continue;
    const nonLus = (e.emails || []).filter((m) => m.direction === "recu" && !m.lu).length;
    if (nonLus > 0) {
      parEntreprise.push({ id: e.id, nom: e.nom, count: nonLus });
      total += nonLus;
    }
  }
  res.json({ total, parEntreprise });
});

// Marque comme lus tous les mails reçus d'une entreprise (à l'ouverture du fil).
app.post("/api/entreprises/:id/emails/lu", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;
  for (const m of entreprise.emails || []) {
    if (m.direction === "recu") m.lu = true;
  }
  await db.write();
  res.json(enrichir(entreprise));
});

// Envoie un mail réel au contact de l'entreprise (signé Pôle OETH/AGEFIPH) et
// journalise l'envoi dans son fil de messagerie.
app.post("/api/entreprises/:id/emails/envoyer", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
  const entreprise = req.entreprise;

  const { objet, corps } = req.body;
  if (!objet?.trim() || !corps?.trim()) {
    return res.status(400).json({ error: "Objet et corps du mail requis." });
  }
  if (!entreprise.contact?.email) {
    return res.status(400).json({ error: "Aucune adresse mail connue pour ce contact." });
  }

  // Nom d'expéditeur adapté au collecteur réel de l'entreprise (privé →
  // AGEFIPH, public → FIPHFP), sans changer l'adresse mail elle-même.
  const nomExpediteur = determinerCollecteur(entreprise) === "FIPHFP" ? "Pôle FIPHFP" : "Pôle OETH / AGEFIPH";

  try {
    await envoyerMail({ to: entreprise.contact.email, subject: objet, text: corps, fromName: nomExpediteur });
  } catch (e) {
    const statutHttp = e.code === "MAIL_NON_CONFIGURE" ? 503 : 502;
    return res.status(statutHttp).json({ error: e.message });
  }

  entreprise.emails = entreprise.emails || [];
  entreprise.emails.unshift({
    id: nanoid(),
    direction: "envoye",
    de: adresseMailPole(),
    objet,
    corps,
    date: new Date().toISOString(),
    lu: true,
  });

  await db.write();
  res.json(enrichir(entreprise));
});

// Relève périodique de la boîte mail du pôle (aucun effet si MAIL_* non
// configuré dans server/.env — voir mail.js). Chaque mail reçu est rattaché
// à l'entreprise dont l'adresse de contact correspond à l'expéditeur ; les
// autres sont journalisés côté serveur mais ignorés (pas de boîte "non
// triée" pour cette première version).
async function relevePeriodiqueBoiteMail() {
  try {
    await relaverBoiteMail(async (mail) => {
      const entreprise = trouverEntrepriseParEmail(mail.de);
      if (!entreprise) {
        console.log(`Mail reçu de ${mail.de} — aucune entreprise correspondante dans le CRM, ignoré.`);
        return;
      }
      entreprise.emails = entreprise.emails || [];
      entreprise.emails.unshift({
        id: nanoid(),
        direction: "recu",
        de: mail.de,
        objet: mail.objet,
        corps: mail.texte,
        date: mail.date,
        lu: false,
        messageId: mail.messageId,
      });
      await db.write();
    });
  } catch (e) {
    console.error("Erreur lors de la relève de la boîte mail :", e.message);
  }
}

// Envoi et réception (IMAP) sont vérifiés et activés indépendamment — voir
// mail.js pour le détail des noms de variables acceptés. L'envoi via l'API
// Brevo est prioritaire sur le SMTP direct : Render (et la plupart des PaaS)
// bloque le trafic SMTP sortant au niveau réseau, quel que soit le plan.
if (estBrevoConfigure()) {
  console.log(`[mail] Envoi via l'API Brevo activé pour ${adresseMailPole()}.`);
} else if (estSmtpConfigure()) {
  // Vérifie immédiatement l'authentification SMTP au démarrage — le moyen le
  // plus rapide de voir dans les logs Render si le mot de passe OVH est
  // accepté, sans attendre qu'un agent déclenche un envoi.
  verifierConnexionSMTP().then((resultat) => {
    if (resultat.ok) {
      console.log(`[mail] Connexion SMTP vérifiée avec succès pour ${adresseMailPole()}.`);
    } else {
      console.error(
        `[mail] ÉCHEC de connexion SMTP pour ${adresseMailPole()} : ${resultat.raison}` +
          `${resultat.code ? ` [code: ${resultat.code}]` : ""}`
      );
      console.error(
        "[mail] Si l'erreur est un ETIMEDOUT/ECONNREFUSED : l'hébergeur bloque le port SMTP en sortie " +
          "(cas fréquent sur Render, même en payant) — configurez BREVO_API_KEY pour envoyer via API HTTP à la place."
      );
    }
  });
} else {
  console.log(
    "[mail] Envoi non configuré (renseignez BREVO_API_KEY, ou à défaut MAIL_SMTP_HOST/MAIL_HOST + MAIL_USER + MAIL_PASSWORD) — lien magique et mails agents désactivés."
  );
}

if (estImapConfigure()) {
  relevePeriodiqueBoiteMail();
  setInterval(relevePeriodiqueBoiteMail, 60_000);
  console.log("[mail] Boîte de réception connectée : relève automatique toutes les 60 secondes.");
} else {
  console.log("[mail] Réception non configurée (MAIL_IMAP_HOST absent) — pas de relève automatique du courrier entrant.");
}

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
