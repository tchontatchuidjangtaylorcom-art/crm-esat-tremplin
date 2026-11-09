// Équipes (bureaux) : sous-découpage À L'INTÉRIEUR d'un espace (voir
// espaces.js), orthogonal à la ligne d'activité OETH/CEE — un bureau
// physique (Cameroun, Paris...) avec son propre manager, ses propres
// agents, et son propre stock de fiches, sans jamais voir celui d'un autre
// bureau. Demande du fondateur (2026-11-07) : plusieurs bureaux, chacun
// avec un manager qui ne voit que les clients de sa propre équipe.
//
// Chaque fiche porte un `equipeId` (comme elle porte déjà un `espace`),
// posé à la création (voir creerLeadDepuisSiren dans index.js). Chaque
// compte porte un `equipeId` optionnel : l'équipe à laquelle il appartient.
// Un compte de rôle "manager" voit alors TOUTES les fiches de sa propre
// équipe (pas seulement celles qui lui sont assignées), comme un
// administrateur mais limité à son équipe — voir estVisibleParEquipe,
// branché dans estVisiblePar (index.js).
//
// Boîte mail par équipe : `mail` reste `null` tant que l'équipe n'a pas sa
// propre boîte — elle utilise alors la boîte partagée par défaut (variables
// d'environnement, voir mail.js), exactement le comportement d'aujourd'hui.
// Une fois renseigné, `mail` contient les identifiants de LA boîte réelle de
// ce bureau (ex: Paris), jamais exposés en clair après enregistrement (voir
// sansMotDePasseMail ci-dessous) — à saisir depuis l'écran d'administration
// du CRM, jamais dans un message ou un chat (voir mail.js pour le détail des
// champs attendus : smtpHost/smtpPort, imapHost/imapPort, user, password,
// from, replyTo).
import { nanoid } from "nanoid";
import db from "./db.js";
import { estAdmin } from "./auth.js";
import { espaceDe, mailDeEspace } from "./espaces.js";

export function listeEquipes() {
  if (!Array.isArray(db.data.equipes)) db.data.equipes = [];
  return db.data.equipes;
}

export function equipeParId(id) {
  if (!id) return null;
  return listeEquipes().find((e) => e.id === id) || null;
}

// Config mail propre d'une équipe (ou undefined si elle n'en a pas / id
// inconnu) — à passer directement en `mailEquipe` aux fonctions de mail.js
// (envoyerMail, relaverBoiteMail...), qui restent indépendantes du concept
// d'équipe pour éviter un import circulaire (auth.js importe déjà mail.js).
export function mailDeEquipe(equipeId) {
  return equipeParId(equipeId)?.mail || undefined;
}

// Boîte à utiliser pour l'envoi/la réception des mails d'une fiche donnée :
// celle de son équipe si elle en a une propre, sinon celle de son espace
// (OETH/CEE — domaine dédié, voir espaces.js, mailDeEspace), sinon undefined
// (boîte partagée par défaut, variables d'environnement — voir mail.js).
export function mailDeFiche(entreprise) {
  return mailDeEquipe(entreprise.equipeId) || mailDeEspace(espaceDe(entreprise));
}

// Vrai seulement si l'équipe a sa PROPRE boîte IMAP distincte (hôte ou
// identifiant renseigné) — pas juste une adresse d'expédition personnalisée
// (`from`/`replyTo` seuls, façon alias OVH) sur la boîte partagée : sinon la
// relève automatique (index.js) relèverait deux fois la même boîte.
export function equipeABoitePropre(equipe) {
  return Boolean(equipe?.mail?.imapHost || equipe?.mail?.user);
}

export function estManager(utilisateur) {
  return utilisateur?.role === "manager";
}

// Jamais le MOT DE PASSE de la boîte mail dans une réponse API — le reste
// (hôtes, ports, identifiant, adresses) n'est pas un secret et doit rester
// visible pour que l'écran d'administration puisse préremplir le formulaire
// sans l'écraser à chaque enregistrement (voir la fusion dans la route PUT
// .../mail ci-dessous : un champ non renvoyé garde sa valeur précédente).
export function equipeSansSecrets(equipe) {
  return {
    ...equipe,
    mail: equipe.mail
      ? {
          configuree: true,
          user: equipe.mail.user || null,
          from: equipe.mail.from || null,
          replyTo: equipe.mail.replyTo || null,
          smtpHost: equipe.mail.smtpHost || null,
          smtpPort: equipe.mail.smtpPort || null,
          imapHost: equipe.mail.imapHost || null,
          imapPort: equipe.mail.imapPort || null,
        }
      : null,
  };
}

// Une fiche appartenant à l'équipe du manager connecté : visible en plus de
// ce que l'agent voit déjà (ses propres fiches assignées, etc. — voir
// estVisiblePar dans index.js, qui appelle cette fonction en plus de ses
// propres règles).
export function estVisibleParEquipe(entreprise, utilisateur) {
  return Boolean(estManager(utilisateur) && utilisateur.equipeId && entreprise.equipeId === utilisateur.equipeId);
}

// Équipe à poser sur une fiche à sa création : celle de l'agent auquel elle
// est assignée d'emblée, sinon celle du compte qui la crée (import, recherche
// ponctuelle) — jamais écrasée ensuite (une fiche garde son équipe d'origine,
// comme elle garde déjà son espace d'origine).
export function equipeDeCreation({ assigneA, utilisateur } = {}) {
  const agent =
    (assigneA && db.data.utilisateurs.find((u) => u.id === assigneA)) || utilisateur || null;
  return agent?.equipeId || null;
}

export function installerEquipes(app, { exigerAdmin }) {
  app.get("/api/equipes", exigerAdmin, (req, res) => {
    res.json(listeEquipes().map(equipeSansSecrets));
  });

  app.post("/api/equipes", exigerAdmin, async (req, res) => {
    const nom = String(req.body.nom || "").trim();
    if (!nom) return res.status(400).json({ error: "Le nom de l'équipe est obligatoire." });
    const espace = String(req.body.espace || "").trim() || "oeth";
    const equipe = {
      id: nanoid(),
      nom,
      espace,
      managerId: req.body.managerId || null,
      actif: true,
      mail: null,
      dateCreation: new Date().toISOString(),
    };
    listeEquipes().push(equipe);
    await db.write();
    res.status(201).json(equipeSansSecrets(equipe));
  });

  app.put("/api/equipes/:id", exigerAdmin, async (req, res) => {
    const equipe = equipeParId(req.params.id);
    if (!equipe) return res.status(404).json({ error: "Équipe introuvable." });
    if (req.body.nom !== undefined) equipe.nom = String(req.body.nom || "").trim() || equipe.nom;
    if (req.body.espace !== undefined) equipe.espace = String(req.body.espace || "").trim() || equipe.espace;
    if (req.body.managerId !== undefined) equipe.managerId = req.body.managerId || null;
    if (req.body.actif !== undefined) equipe.actif = Boolean(req.body.actif);
    await db.write();
    res.json(equipeSansSecrets(equipe));
  });

  // Boîte mail propre à l'équipe — route séparée (champs sensibles),
  // appelée depuis l'écran d'administration uniquement. `mail: null` dans le
  // corps retire ENTIÈREMENT la boîte propre (l'équipe retombe sur la boîte
  // partagée) — pour le reste, un champ non renvoyé (ou vide) GARDE sa
  // valeur précédente plutôt que d'être effacé : le mot de passe n'étant
  // jamais renvoyé par l'API (voir equipeSansSecrets), le formulaire
  // d'administration ne peut de toute façon pas le réafficher pour le
  // renvoyer tel quel à chaque enregistrement.
  app.put("/api/equipes/:id/mail", exigerAdmin, async (req, res) => {
    const equipe = equipeParId(req.params.id);
    if (!equipe) return res.status(404).json({ error: "Équipe introuvable." });
    const m = req.body.mail;
    if (!m) {
      equipe.mail = null;
    } else {
      const avant = equipe.mail || {};
      equipe.mail = {
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
    res.json(equipeSansSecrets(equipe));
  });

  // Équipe d'un compte (écran "Gestion des accès"), même esprit que
  // PUT /api/utilisateurs/:id/espaces dans espaces.js.
  app.put("/api/utilisateurs/:id/equipe", exigerAdmin, async (req, res) => {
    const utilisateur = db.data.utilisateurs.find((u) => u.id === req.params.id);
    if (!utilisateur) return res.status(404).json({ error: "Compte introuvable." });
    const equipeId = req.body.equipeId || null;
    if (equipeId && !equipeParId(equipeId)) return res.status(400).json({ error: "Équipe inconnue." });
    utilisateur.equipeId = equipeId;
    await db.write();
    res.json({ id: utilisateur.id, equipeId });
  });
}
