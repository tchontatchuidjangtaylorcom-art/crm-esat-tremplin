// Espaces de travail : un seul CRM, plusieurs projets (OETH / AGEFIPH, CEE —
// économies d'énergie, et d'autres plus tard, selon les entreprises qui
// confient des appels au pôle). Chaque fiche appartient à UN espace ; chaque
// compte a la liste des espaces auxquels il a accès :
//  - les administrateurs voient tous les espaces ;
//  - un agent interne peut en avoir plusieurs et passe de l'un à l'autre en
//    un clic (sélecteur en haut du CRM) ;
//  - un agent externe n'a que le sien et ne voit même pas que les autres
//    existent.
// L'espace affiché est envoyé par le navigateur dans l'en-tête X-Espace de
// chaque requête /api ; le serveur le vérifie (un espace non autorisé est
// remplacé par le premier espace autorisé) et ne renvoie que les fiches de
// cet espace. estVisiblePar (index.js) refuse en plus toute fiche d'un
// espace auquel le compte n'a pas accès — même en tapant son adresse.
//
// Fiches existantes, sans champ `espace` : elles sont dans l'espace OETH.
import { AsyncLocalStorage } from "node:async_hooks";
import db from "./db.js";
import { estAdmin } from "./auth.js";

export const ESPACE_PAR_DEFAUT = "oeth";

// Identifiants réservés : routes de premier niveau qui ne sont PAS des portes
// d'entrée d'espace (voir CrmApp.jsx, la route générique /:espaceCible) —
// un nouvel espace ne peut pas voler l'une de ces adresses. Les pages du CRM
// authentifié à un seul segment (chat, mes-kpis…) sont réservées pour la même
// raison : ce sont de vraies routes statiques, toujours prioritaires sur
// ":espaceCible" côté client, donc un espace prenant l'un de ces noms n'aurait
// tout simplement aucune porte d'entrée accessible.
const IDENTIFIANTS_RESERVES = [
  "connexion",
  "admin",
  "vitrine",
  "api",
  "chat",
  "mes-kpis",
  "kpis-equipe",
  "mon-equipe",
  "supervision",
  "campagnes",
  "boite-mail",
];

// Couleurs disponibles pour un espace (voir aussi COULEURS dans
// SelecteurEspace.jsx, côté client — les deux listes doivent rester en
// phase). Seules des teintes Tailwind standard, sans retouche de config.
export const COULEURS_ESPACE = ["marine", "emerald", "orange", "violet", "rose", "sky", "amber", "teal"];

const ESPACES_INITIAUX = [
  {
    id: "oeth",
    nom: "OETH / AGEFIPH",
    court: "OETH",
    description: "Obligation d'emploi des travailleurs handicapés : entreprises de 20 salariés et plus.",
    couleur: "marine",
    modules: ["oeth"],
    actif: true,
  },
  {
    id: "cee",
    nom: "CEE — Économies d'énergie",
    court: "CEE",
    description:
      "Certificats d'Économies d'Énergie : pompes à chaleur, isolation et équipements financés par les primes CEE, pour le compte d'un partenaire.",
    couleur: "emerald",
    modules: [],
    actif: true,
  },
];

// Contexte de la requête en cours (pour connaître l'espace là où on n'a pas
// `req` sous la main, ex. création d'une fiche depuis un SIREN, y compris en
// arrière-plan après la réponse).
const contexte = new AsyncLocalStorage();

export function listeEspaces() {
  if (!Array.isArray(db.data.espaces) || db.data.espaces.length === 0) {
    db.data.espaces = ESPACES_INITIAUX.map((e) => ({ ...e }));
  }
  // Espaces ajoutés au code après la création de la base.
  for (const e of ESPACES_INITIAUX) {
    if (!db.data.espaces.some((x) => x.id === e.id)) db.data.espaces.push({ ...e });
  }
  return db.data.espaces.filter((e) => e.actif !== false);
}

export const espaceDe = (entreprise) => entreprise?.espace || ESPACE_PAR_DEFAUT;

// Boîte mail propre à un espace (ex : domaine dédié "Eco Smart France" pour
// CEE, séparé de l'adresse partagée du Pôle OETH) — même esprit que `mail`
// sur une équipe (equipes.js, mailDeEquipe) : reste `undefined` tant que
// l'espace n'a pas sa propre boîte, et retombe alors sur la boîte partagée
// par défaut (variables d'environnement, voir mail.js). Priorité à la boîte
// de l'équipe de la fiche si elle en a une propre : voir mailDeFiche dans
// equipes.js, qui enchaîne équipe puis espace puis boîte partagée.
export function mailDeEspace(espaceId) {
  return listeEspaces().find((e) => e.id === espaceId)?.mail || undefined;
}

// Vrai seulement si l'espace a sa PROPRE boîte IMAP distincte (comme
// equipeABoitePropre dans equipes.js) — sinon la relève automatique
// relèverait deux fois la même boîte partagée.
export function espaceABoitePropre(espace) {
  return Boolean(espace?.mail?.imapHost || espace?.mail?.user);
}

// Jamais le MOT DE PASSE de la boîte mail dans une réponse API (même
// principe que equipeSansSecrets dans equipes.js).
export function espaceSansSecrets(espace) {
  return {
    ...espace,
    mail: espace.mail
      ? {
          configuree: true,
          user: espace.mail.user || null,
          from: espace.mail.from || null,
          replyTo: espace.mail.replyTo || null,
          smtpHost: espace.mail.smtpHost || null,
          smtpPort: espace.mail.smtpPort || null,
          imapHost: espace.mail.imapHost || null,
          imapPort: espace.mail.imapPort || null,
        }
      : null,
  };
}

// Identifiants des espaces ouverts à ce compte.
export function espacesAutorises(utilisateur) {
  const ids = listeEspaces().map((e) => e.id);
  if (!utilisateur) return [];
  if (estAdmin(utilisateur)) return ids;
  const choisis = Array.isArray(utilisateur.espaces) && utilisateur.espaces.length ? utilisateur.espaces : [ESPACE_PAR_DEFAUT];
  return choisis.filter((id) => ids.includes(id));
}

export function aAccesEspace(utilisateur, espaceId) {
  return espacesAutorises(utilisateur).includes(espaceId);
}

// Espace demandé par le navigateur, s'il est autorisé ; sinon le premier
// espace autorisé du compte.
export function espaceDeRequete(req) {
  const autorises = espacesAutorises(req?.utilisateur);
  const demande = String(req?.get?.("x-espace") || req?.query?.espace || "").trim();
  if (autorises.includes(demande)) return demande;
  return autorises[0] || ESPACE_PAR_DEFAUT;
}

// Espace de la requête en cours (hors requête : l'espace par défaut).
export function espaceCourant() {
  const req = contexte.getStore();
  return req ? espaceDeRequete(req) : ESPACE_PAR_DEFAUT;
}

export function installerEspaces(app, { exigerAuth, exigerAdmin }) {
  // Avant toutes les routes /api : mémorise la requête pour espaceCourant().
  app.use("/api", (req, res, next) => contexte.run(req, next));

  // Espaces ouverts au compte connecté, et celui affiché.
  app.get("/api/espaces", exigerAuth, (req, res) => {
    const autorises = espacesAutorises(req.utilisateur);
    res.json({
      espaces: listeEspaces().filter((e) => autorises.includes(e.id)).map(espaceSansSecrets),
      courant: espaceDeRequete(req),
    });
  });

  // Tous les espaces (administration des accès) — y compris les désactivés
  // (tableau BRUT, pas listeEspaces() qui les masque) : l'écran d'admin doit
  // pouvoir les réafficher avec leur badge "Désactivé" et les réactiver.
  app.get("/api/espaces/tous", exigerAdmin, (req, res) => {
    listeEspaces(); // initialise db.data.espaces si besoin.
    res.json(db.data.espaces.map(espaceSansSecrets));
  });

  // Porte d'entrée publique d'un espace (voir CrmApp.jsx, route générique
  // /:espaceCible et Connexion.jsx) — accessible SANS connexion, donc
  // volontairement minimal : jamais la boîte mail (`mail`), jamais les
  // modules. Un espace désactivé (actif: false) n'a plus de porte : il
  // n'apparaît pas dans listeEspaces() et retombe donc ici sur un 404,
  // exactement comme un identifiant inconnu.
  app.get("/api/espaces/porte/:id", (req, res) => {
    const espace = listeEspaces().find((e) => e.id === req.params.id);
    if (!espace) return res.status(404).json({ error: "Espace introuvable." });
    res.json({ id: espace.id, nom: espace.nom, court: espace.court, couleur: espace.couleur });
  });

  // Création d'un espace depuis l'administration — c'est ce qui permet au
  // fondateur d'ouvrir une nouvelle ligne d'activité (un nouveau client) sans
  // développeur ni nouveau déploiement : même app, même base, juste un espace
  // de plus, avec sa propre porte d'entrée sur /<id> (voir CrmApp.jsx).
  app.post("/api/espaces", exigerAdmin, async (req, res) => {
    const id = String(req.body.id || "")
      .trim()
      .toLowerCase();
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(id)) {
      return res
        .status(400)
        .json({ error: "Identifiant d'espace invalide (lettres minuscules, chiffres, tirets, doit commencer par une lettre)." });
    }
    // Vérifié sur le tableau BRUT (y compris les espaces désactivés) : un
    // identifiant ne doit jamais pouvoir être réutilisé, même par un espace
    // qu'on a remis en service entre-temps.
    listeEspaces(); // initialise db.data.espaces si besoin.
    const existeDeja = db.data.espaces.some((e) => e.id === id);
    if (existeDeja || IDENTIFIANTS_RESERVES.includes(id)) {
      return res.status(409).json({ error: "Cet identifiant est déjà utilisé ou réservé." });
    }
    const nom = String(req.body.nom || "").trim();
    if (!nom) return res.status(400).json({ error: "Le nom de l'espace est obligatoire." });
    const couleur = String(req.body.couleur || "").trim();
    if (!COULEURS_ESPACE.includes(couleur)) return res.status(400).json({ error: "Couleur inconnue." });
    const espace = {
      id,
      nom,
      court: String(req.body.court || "").trim() || nom,
      description: String(req.body.description || "").trim(),
      couleur,
      modules: [],
      actif: true,
      mail: null,
    };
    db.data.espaces.push(espace);
    await db.write();
    res.status(201).json(espaceSansSecrets(espace));
  });

  // Modification d'un espace existant — jamais son `id` : les fiches et les
  // portes d'entrée le référencent déjà, le renommer les orphelinerait.
  app.put("/api/espaces/:id", exigerAdmin, async (req, res) => {
    listeEspaces(); // initialise db.data.espaces si besoin.
    // Tableau BRUT : un espace désactivé doit rester modifiable (ne serait-ce
    // que pour le réactiver via `actif: true`).
    const espace = db.data.espaces.find((e) => e.id === req.params.id);
    if (!espace) return res.status(404).json({ error: "Espace introuvable." });
    if (req.body.couleur !== undefined) {
      const couleur = String(req.body.couleur || "").trim();
      if (!COULEURS_ESPACE.includes(couleur)) return res.status(400).json({ error: "Couleur inconnue." });
      espace.couleur = couleur;
    }
    if (req.body.nom !== undefined) {
      const nom = String(req.body.nom || "").trim();
      if (!nom) return res.status(400).json({ error: "Le nom de l'espace est obligatoire." });
      espace.nom = nom;
    }
    if (req.body.court !== undefined) espace.court = String(req.body.court || "").trim() || espace.nom;
    if (req.body.description !== undefined) espace.description = String(req.body.description || "").trim();
    if (req.body.actif !== undefined) espace.actif = Boolean(req.body.actif);
    await db.write();
    res.json(espaceSansSecrets(espace));
  });

  // Boîte mail propre à un espace (ex : domaine CEE dédié) — même esprit que
  // PUT /api/equipes/:id/mail dans equipes.js : `mail: null` retire
  // ENTIÈREMENT la boîte propre (l'espace retombe sur la boîte partagée) ;
  // sinon un champ non renvoyé GARDE sa valeur précédente (le mot de passe
  // n'étant jamais renvoyé par l'API, le formulaire d'administration ne peut
  // de toute façon pas le réafficher pour le renvoyer tel quel).
  app.put("/api/espaces/:id/mail", exigerAdmin, async (req, res) => {
    const espace = listeEspaces().find((e) => e.id === req.params.id);
    if (!espace) return res.status(404).json({ error: "Espace introuvable." });
    const m = req.body.mail;
    if (!m) {
      espace.mail = null;
    } else {
      const avant = espace.mail || {};
      espace.mail = {
        smtpHost: String(m.smtpHost || "").trim() || avant.smtpHost || null,
        smtpPort: Number(m.smtpPort) || avant.smtpPort || null,
        imapHost: String(m.imapHost || "").trim() || avant.imapHost || null,
        imapPort: Number(m.imapPort) || avant.imapPort || null,
        user: String(m.user || "").trim() || avant.user || null,
        password: String(m.password || "").trim() || avant.password || null,
        from: String(m.from || "").trim() || avant.from || null,
        replyTo: String(m.replyTo || "").trim() || avant.replyTo || null,
      };
    }
    await db.write();
    res.json(espaceSansSecrets(espace));
  });

  // Suppression d'un espace — seulement s'il n'est référencé nulle part
  // (aucune fiche, aucune équipe, aucun compte) : jamais le risque
  // d'orpheliner des données en cassant un espace déjà utilisé. Un espace qui
  // a servi, même une fois, doit être désactivé (PUT .../actif:false)
  // plutôt que supprimé.
  app.delete("/api/espaces/:id", exigerAdmin, async (req, res) => {
    listeEspaces(); // initialise db.data.espaces si besoin.
    const index = db.data.espaces.findIndex((e) => e.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Espace introuvable." });
    const id = req.params.id;
    const ficheReference = [...db.data.entreprises, ...db.data.archives].some((e) => espaceDe(e) === id);
    const equipeReference = (db.data.equipes || []).some((eq) => eq.espace === id);
    const compteReference = (db.data.utilisateurs || []).some((u) => Array.isArray(u.espaces) && u.espaces.includes(id));
    if (ficheReference || equipeReference || compteReference) {
      return res.status(409).json({
        error: "Cet espace est déjà utilisé (fiche, équipe ou compte) et ne peut pas être supprimé — désactivez-le plutôt.",
      });
    }
    db.data.espaces.splice(index, 1);
    await db.write();
    res.json({ ok: true });
  });

  // Espaces d'un compte (Gestion des accès). Les administrateurs ont
  // toujours accès à tout ; pour un agent, au moins un espace.
  app.put("/api/utilisateurs/:id/espaces", exigerAdmin, async (req, res) => {
    const utilisateur = db.data.utilisateurs.find((u) => u.id === req.params.id);
    if (!utilisateur) return res.status(404).json({ error: "Compte introuvable." });
    const ids = listeEspaces().map((e) => e.id);
    const espaces = [...new Set((Array.isArray(req.body.espaces) ? req.body.espaces : []).filter((id) => ids.includes(id)))];
    if (espaces.length === 0) return res.status(400).json({ error: "Choisissez au moins un espace." });
    utilisateur.espaces = espaces;
    await db.write();
    res.json({ id: utilisateur.id, espaces });
  });
}
