// Journal d'activité et supervision (super-administrateur) : qui a fait quoi
// dans le CRM, sur quelle fiche, depuis son compte ou depuis le compte d'un
// agent (Mode Manager), avec une alerte quand une action profite à son
// auteur (fiche d'un autre agent qu'il s'attribue, qualification en CP d'une
// fiche qui n'est pas la sienne…). Le super-administrateur y lit aussi les
// conversations du chat interne — en lecture seule, chaque lecture étant
// elle-même inscrite au journal, et les utilisateurs en sont informés dans
// le chat (voir Chat.jsx).
//
// Toute requête d'écriture (POST/PATCH/PUT/DELETE) réussie d'un utilisateur
// connecté est journalisée par un middleware unique, sauf le bruit de fond
// (présence, lecture du chat, comptage d'appels…). Seuls des champs choisis
// sont retenus, jamais un mot de passe ni le contenu d'un mail.
import { nanoid } from "nanoid";
import db from "./db.js";

const MAX_ENTREES = 20000;

// Bruit de fond, jamais journalisé.
const EXCLUS = [
  /^\/auth\//,
  /^\/presence\//,
  /^\/chat\//,
  /^\/notifications/,
  /^\/ia\/corriger-texte/,
  /\/appel-compte$/,
  /\/recherche-numeros$/,
  /^\/entreprises\/[^/]+\/emails\/lu$/,
  /^\/vitrine\//,
  /^\/assistant-domaine/,
  /\/(question-contact-ia|dictee-ia|generer-email)$/,
  /^\/leads\/secteur\/rechercher/,
];

const ACTIONS = [
  [/^POST \/entreprises\/[^/]+\/appels$/, "Issue d'appel"],
  [/^POST \/entreprises\/[^/]+\/assigner$/, "Attribution d'une fiche"],
  [/^POST \/entreprises\/assigner-groupe$/, "Attribution groupée"],
  [/^POST \/entreprises\/statut-groupe$/, "Changement de statut groupé"],
  [/^POST \/lots\/.+\/assigner$/, "Attribution d'une vague"],
  [/^POST \/equipe\/distribuer$/, "Distribution de fiches"],
  [/^POST \/leads\/demande/, "Demande de fiches"],
  [/^POST \/entreprises\/[^/]+\/emails\/envoyer$/, "Envoi d'un mail"],
  [/^POST \/entreprises\/[^/]+\/commentaires$/, "Commentaire"],
  [/^POST \/entreprises\/[^/]+\/fiche-prospection$/, "Fiche de suivi (CP)"],
  [/^POST \/entreprises\/[^/]+\/sortie$/, "Sortie de dossier"],
  [/^POST \/entreprises\/[^/]+\/telephone-invalide$/, "Numéro signalé invalide"],
  [/^POST \/entreprises\/[^/]+\/(rechercher-contact|contact-rh-auto)$/, "Recherche de contact (IA)"],
  [/^PATCH \/entreprises\/[^/]+$/, "Modification de la fiche"],
  [/^DELETE \/entreprises\//, "Suppression"],
  [/^POST \/utilisateurs\/[^/]+\/valider$/, "Validation d'un compte"],
  [/^POST \/utilisateurs\/[^/]+\/refuser$/, "Refus d'un compte"],
  [/^DELETE \/utilisateurs\//, "Suppression d'un compte"],
  [/^(PATCH|PUT|POST) \/utilisateurs/, "Gestion des comptes"],
  [/^POST \/leads\//, "Import / génération de fiches"],
  [/^(PUT|POST) \/(argumentaire-agefiph|script-vente|modeles-mails)/, "Contenus partagés"],
];

function libelleAction(methode, chemin) {
  const cle = `${methode} ${chemin}`;
  return ACTIONS.find(([re]) => re.test(cle))?.[1] || cle;
}

export function journaliser(entree) {
  const journal = (db.data.journalAudit ||= []);
  journal.push({ id: nanoid(), date: new Date().toISOString(), ...entree });
  if (journal.length > MAX_ENTREES) journal.splice(0, journal.length - MAX_ENTREES);
}

export function installerJournal(app, { trouverUtilisateurParId, estAdmin, libelleStatut }) {
  const nomDe = (id) => {
    const u = id && trouverUtilisateurParId(id);
    return u ? u.prenom || u.email : null;
  };
  const ficheParId = (id) =>
    db.data.entreprises.find((e) => e.id === id) || db.data.archives.find((e) => e.id === id) || null;
  // Consultations en Mode Manager : une ligne par admin et par agent toutes
  // les 30 minutes, pas une par requête.
  const dernieresConsultations = new Map();

  app.use("/api", (req, res, next) => {
    const ecriture = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
    const consultation = !ecriture && req.query?.commeAgentId;
    if ((!ecriture && !consultation) || EXCLUS.some((re) => re.test(req.path))) return next();

    // Chemin relatif à /api, lu maintenant : Express le remet en absolu une
    // fois la requête routée.
    const chemin = req.path.replace(/\/+$/, "");
    const idFiche = /^\/entreprises\/([^/]+)/.exec(chemin)?.[1];
    const ficheAvant = idFiche ? ficheParId(idFiche) : null;
    const avant = ficheAvant ? { statut: ficheAvant.statut, assigneA: ficheAvant.assigneA || null } : null;
    const corps = req.body || {};

    res.on("finish", () => {
      const u = req.utilisateur;
      if (!u || res.statusCode >= 400) return;

      if (consultation) {
        const cle = `${u.id}:${req.query.commeAgentId}`;
        const derniere = dernieresConsultations.get(cle) || 0;
        if (Date.now() - derniere < 30 * 60 * 1000) return;
        dernieresConsultations.set(cle, Date.now());
        journaliser({
          utilisateurId: u.id,
          nom: u.prenom || u.email,
          role: u.role,
          action: "Consultation du compte d'un agent",
          details: `A ouvert le compte de ${nomDe(req.query.commeAgentId) || "?"} (Mode Manager).`,
          modeManager: { id: req.query.commeAgentId, nom: nomDe(req.query.commeAgentId) },
        });
        db.write().catch(() => {});
        return;
      }

      const details = [];
      const alertes = [];
      const fiche = idFiche ? ficheParId(idFiche) : null;
      const libelle = (s) => libelleStatut?.(s) || s;

      if (avant && fiche) {
        if (avant.statut !== fiche.statut) details.push(`Statut : ${libelle(avant.statut)} → ${libelle(fiche.statut)}`);
        if (avant.assigneA !== (fiche.assigneA || null)) {
          details.push(`Agent : ${nomDe(avant.assigneA) || "personne"} → ${nomDe(fiche.assigneA) || "personne"}`);
          if (fiche.assigneA === u.id && avant.assigneA && avant.assigneA !== u.id) {
            alertes.push(`S'est attribué une fiche de ${nomDe(avant.assigneA)}`);
          }
        }
        if (
          ["fiche", "fiche_one_shot", "rdv"].includes(fiche.statut) &&
          avant.statut !== fiche.statut &&
          avant.assigneA &&
          avant.assigneA !== u.id
        ) {
          alertes.push(`A passé en « ${libelle(fiche.statut)} » une fiche de ${nomDe(avant.assigneA)}`);
        }
      }
      if (Array.isArray(corps.ids)) details.push(`${corps.ids.length} fiche(s)`);
      if (corps.utilisateurId !== undefined && !avant) details.push(`Vers : ${nomDe(corps.utilisateurId) || "personne"}`);
      if (corps.utilisateurId && corps.utilisateurId === u.id && !avant) alertes.push("S'est attribué des fiches");
      if (corps.statut && !avant) details.push(`Statut : ${libelle(corps.statut)}`);
      if (corps.issue && !details.some((d) => d.startsWith("Statut"))) details.push(`Issue : ${libelle(corps.issue)}`);
      if (corps.parPersonne) details.push(`${corps.parPersonne} par personne`);
      if (Array.isArray(corps.membres) && corps.membres.length) details.push(`Pour : ${corps.membres.map(nomDe).join(", ")}`);
      if (corps.role) details.push(`Rôle : ${corps.role}`);
      if (corps.objet) details.push(`Objet : ${String(corps.objet).slice(0, 120)}`);
      if (corps.texte && /commentaires$/.test(chemin)) details.push(String(corps.texte).slice(0, 160));

      const idAgentConsulte = req.get("x-mode-manager");
      const modeManager = idAgentConsulte && estAdmin(u) ? { id: idAgentConsulte, nom: nomDe(idAgentConsulte) } : null;

      journaliser({
        utilisateurId: u.id,
        nom: u.prenom || u.email,
        role: u.role,
        action: libelleAction(req.method, chemin),
        entrepriseId: fiche?.id || null,
        entrepriseNom: fiche?.nom || null,
        details: details.join(" · ") || null,
        alerte: alertes.join(" · ") || null,
        modeManager,
      });
      db.write().catch(() => {});
    });
    next();
  });
}

export function enregistrerRoutesSupervision(app, { exigerSuperAdmin, trouverUtilisateurParId }) {
  const nomDe = (id) => {
    const u = id && trouverUtilisateurParId(id);
    return u ? u.prenom || u.email : "?";
  };

  app.get("/api/supervision/journal", exigerSuperAdmin, (req, res) => {
    const { utilisateurId, alertes, modeManager, q } = req.query;
    const limite = Math.min(Number(req.query.limite) || 300, 2000);
    const recherche = String(q || "").trim().toLowerCase();
    const lignes = [];
    const journal = db.data.journalAudit || [];
    for (let i = journal.length - 1; i >= 0 && lignes.length < limite; i--) {
      const e = journal[i];
      if (utilisateurId && e.utilisateurId !== utilisateurId) continue;
      if (alertes === "1" && !e.alerte) continue;
      if (modeManager === "1" && !e.modeManager) continue;
      if (recherche && !`${e.nom} ${e.action} ${e.entrepriseNom || ""} ${e.details || ""} ${e.alerte || ""}`.toLowerCase().includes(recherche))
        continue;
      lignes.push(e);
    }
    res.json(lignes);
  });

  // Toutes les conversations (général, groupes, privés), en lecture seule.
  app.get("/api/supervision/conversations", exigerSuperAdmin, (req, res) => {
    const parCanal = new Map();
    for (const m of db.data.messages) {
      const s = parCanal.get(m.canalId) || { nb: 0, dernier: null };
      s.nb += 1;
      if (!s.dernier || m.date > s.dernier.date) s.dernier = m;
      parCanal.set(m.canalId, s);
    }
    const liste = db.data.canaux.map((c) => {
      const s = parCanal.get(c.id) || { nb: 0, dernier: null };
      const membres = c.type === "general" ? null : (c.membres || []).map(nomDe);
      return {
        id: c.id,
        type: c.type,
        nom: c.type === "prive" ? membres.join(" ↔ ") : c.nom,
        membres,
        nbMessages: s.nb,
        dernierMessage: s.dernier ? { texte: s.dernier.texte, date: s.dernier.date, auteur: nomDe(s.dernier.auteurId) } : null,
      };
    });
    liste.sort((a, b) => (b.dernierMessage?.date || "").localeCompare(a.dernierMessage?.date || ""));
    res.json(liste);
  });

  app.get("/api/supervision/conversations/:id/messages", exigerSuperAdmin, async (req, res) => {
    const canal = db.data.canaux.find((c) => c.id === req.params.id);
    if (!canal) return res.status(404).json({ error: "Conversation introuvable." });
    const messages = db.data.messages
      .filter((m) => m.canalId === canal.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((m) => ({ id: m.id, texte: m.texte, date: m.date, auteurId: m.auteurId, auteurNom: nomDe(m.auteurId) }));
    // La lecture elle-même est tracée (hors canal général, déjà public).
    if (canal.type !== "general") {
      journaliser({
        utilisateurId: req.utilisateur.id,
        nom: req.utilisateur.prenom || req.utilisateur.email,
        role: req.utilisateur.role,
        action: "Lecture d'une conversation",
        details: canal.type === "prive" ? (canal.membres || []).map(nomDe).join(" ↔ ") : `Groupe « ${canal.nom} »`,
      });
      await db.write();
    }
    res.json(messages);
  });
}
