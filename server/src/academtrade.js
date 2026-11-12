// Routes de l'espace AcademTrade (formation trading) : côté client final
// (compte personnel, séparé du CRM — voir academtradeAuth.js) et côté
// gestionnaire de compte (dans le CRM, réservé à l'espace "academtrade").
//
// Paiement : le branchement Stripe n'est pas encore fait (clés à fournir).
// En attendant, POST /api/academtrade/clients (réservé admin) crée un compte
// directement, pour tester tout le parcours dès maintenant — à retirer ou
// protéger davantage une fois le paiement réellement branché.
import db from "./db.js";
import { estAdmin } from "./auth.js";
import { aAccesEspace } from "./espaces.js";
import {
  compteParJeton,
  creerCompte,
  envoyerLienAcces,
  definirMotDePasse,
  verifierMotDePasse,
  creerCookieSession,
  supprimerCookieSession,
  exigerAuthAcademtrade,
  sansMotDePasse,
} from "./academtradeAuth.js";
import { etatMarche } from "./academtradeMarche.js";
import { positionsDe, soldeDisponible, ouvrirPosition, fermerPosition } from "./academtradePositions.js";
import { retraitsDe, retraitsEnAttente, demanderRetrait, traiterRetrait } from "./academtradeRetraits.js";

function compteAvecSolde(compte) {
  return { ...sansMotDePasse(compte), soldeDisponible: soldeDisponible(compte) };
}

// Réservé aux gestionnaires de compte de l'espace AcademTrade et aux
// administrateurs — jamais aux agents OETH/CEE.
function exigerGestionnaireAcademtrade(exigerAuth) {
  return (req, res, next) =>
    exigerAuth(req, res, () => {
      if (!estAdmin(req.utilisateur) && !aAccesEspace(req.utilisateur, "academtrade")) {
        return res.status(403).json({ error: "Réservé aux gestionnaires de compte AcademTrade." });
      }
      next();
    });
}

export function installerAcademtrade(app, { exigerAuth, exigerAdmin }) {
  const exigerGestionnaire = exigerGestionnaireAcademtrade(exigerAuth);

  // --- Côté client final ------------------------------------------------
  app.get("/api/academtrade/definir-mot-de-passe/:jeton", (req, res) => {
    const compte = compteParJeton(req.params.jeton);
    if (!compte) return res.status(404).json({ error: "Ce lien n'est plus valide." });
    res.json({ email: compte.email, prenom: compte.prenom, dejaConfigure: Boolean(compte.motDePasseHash) });
  });

  app.post("/api/academtrade/definir-mot-de-passe/:jeton", async (req, res) => {
    try {
      const compte = await definirMotDePasse(req.params.jeton, String(req.body?.motDePasse || ""));
      creerCookieSession(res, compte);
      res.json({ ok: true, compte: compteAvecSolde(compte) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/academtrade/connexion", async (req, res) => {
    try {
      const compte = await verifierMotDePasse(String(req.body?.email || ""), String(req.body?.motDePasse || ""));
      creerCookieSession(res, compte);
      res.json({ ok: true, compte: compteAvecSolde(compte) });
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
  });

  app.post("/api/academtrade/deconnexion", (req, res) => {
    supprimerCookieSession(res);
    res.json({ ok: true });
  });

  app.get("/api/academtrade/moi", exigerAuthAcademtrade, (req, res) => {
    res.json(compteAvecSolde(req.compteAcademtrade));
  });

  app.get("/api/academtrade/marche", exigerAuthAcademtrade, (req, res) => {
    res.json(etatMarche());
  });

  app.get("/api/academtrade/positions", exigerAuthAcademtrade, (req, res) => {
    res.json(positionsDe(req.compteAcademtrade.id));
  });

  app.post("/api/academtrade/positions", exigerAuthAcademtrade, async (req, res) => {
    try {
      const position = await ouvrirPosition(req.compteAcademtrade, req.body || {});
      res.status(201).json(position);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/academtrade/positions/:id/fermer", exigerAuthAcademtrade, async (req, res) => {
    try {
      const position = await fermerPosition(req.compteAcademtrade, req.params.id);
      res.json(position);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/academtrade/retraits", exigerAuthAcademtrade, (req, res) => {
    res.json(retraitsDe(req.compteAcademtrade.id));
  });

  app.post("/api/academtrade/retraits", exigerAuthAcademtrade, async (req, res) => {
    try {
      const demande = await demanderRetrait(req.compteAcademtrade, req.body?.montant);
      res.status(201).json(demande);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Côté gestionnaire de compte (CRM, espace academtrade) ------------
  app.get("/api/academtrade/clients", exigerGestionnaire, (req, res) => {
    const retraitsAttente = retraitsEnAttente();
    res.json(
      db.data.comptesAcademtrade.map((c) => ({
        ...compteAvecSolde(c),
        positionsOuvertes: positionsDe(c.id).filter((p) => p.statut === "ouverte").length,
        retraitsEnAttente: retraitsAttente.filter((d) => d.compteId === c.id).length,
      }))
    );
  });

  app.get("/api/academtrade/clients/:id", exigerGestionnaire, (req, res) => {
    const compte = db.data.comptesAcademtrade.find((c) => c.id === req.params.id);
    if (!compte) return res.status(404).json({ error: "Compte introuvable." });
    res.json({ compte: compteAvecSolde(compte), positions: positionsDe(compte.id), retraits: retraitsDe(compte.id) });
  });

  app.post("/api/academtrade/clients/:id/retraits/:retraitId/traiter", exigerGestionnaire, async (req, res) => {
    try {
      const demande = await traiterRetrait(req.params.retraitId, {
        decision: req.body?.decision,
        commentaire: req.body?.commentaire,
        agent: req.utilisateur,
      });
      res.json(demande);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Création directe d'un compte, en attendant le branchement du paiement
  // (Stripe) — réservé admin, à utiliser pour tester le parcours complet.
  app.post("/api/academtrade/clients", exigerAdmin, async (req, res) => {
    try {
      const compte = await creerCompte({
        email: req.body?.email,
        prenom: req.body?.prenom,
        nom: req.body?.nom,
        gestionnaireId: req.body?.gestionnaireId || null,
      });
      const mailEnvoye = await envoyerLienAcces(compte);
      res.status(201).json({ compte: compteAvecSolde(compte), mailEnvoye });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}
