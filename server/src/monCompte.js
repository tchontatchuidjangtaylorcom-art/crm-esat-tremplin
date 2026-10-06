// « Mon compte » : chaque utilisateur (agent, superviseur, administrateur)
// modifie lui-même son nom, son adresse e-mail de connexion et son mot de
// passe — en cliquant sur son nom en haut du CRM (voir MonCompte.jsx).
// Sécurité : si le compte a déjà un mot de passe, il est demandé pour
// changer l'e-mail ou le mot de passe (une session laissée ouverte ne suffit
// pas à prendre le contrôle du compte).
import bcrypt from "bcryptjs";
import db from "./db.js";
import { definirMotDePasse, trouverUtilisateurParEmail } from "./auth.js";

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function verifierActuel(utilisateur, motDePasse) {
  if (!utilisateur.motDePasseHash) return true; // compte sans mot de passe (lien magique)
  return bcrypt.compare(String(motDePasse || ""), utilisateur.motDePasseHash);
}

export function enregistrerRoutesMonCompte(app, { exigerAuth }) {
  app.get("/api/moi/compte", exigerAuth, (req, res) => {
    const u = req.utilisateur;
    res.json({ email: u.email, prenom: u.prenom || "", nom: u.nom || "", role: u.role, aMotDePasse: Boolean(u.motDePasseHash) });
  });

  app.post("/api/moi/profil", exigerAuth, async (req, res) => {
    const u = req.utilisateur;
    const prenom = String(req.body.prenom ?? u.prenom ?? "").trim().slice(0, 60);
    const nom = String(req.body.nom ?? u.nom ?? "").trim().slice(0, 60);
    if (!prenom) return res.status(400).json({ error: "Le prénom est obligatoire." });
    u.prenom = prenom;
    u.nom = nom;
    await db.write();
    res.json({ ok: true, prenom, nom });
  });

  app.post("/api/moi/email", exigerAuth, async (req, res) => {
    const u = req.utilisateur;
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!EMAIL_VALIDE.test(email) || email.length > 200) return res.status(400).json({ error: "Adresse e-mail invalide." });
    if (email === u.email) return res.json({ ok: true, email });
    const existant = trouverUtilisateurParEmail(email);
    if (existant && existant.id !== u.id) return res.status(409).json({ error: "Cette adresse est déjà utilisée par un autre compte." });
    if (!(await verifierActuel(u, req.body.motDePasse))) return res.status(403).json({ error: "Mot de passe actuel incorrect." });
    const ancien = u.email;
    u.email = email;
    await db.write();
    console.log(`[compte] ${ancien} → ${email} (changé par l'utilisateur).`);
    res.json({ ok: true, email });
  });

  app.post("/api/moi/mot-de-passe", exigerAuth, async (req, res) => {
    const u = req.utilisateur;
    const nouveau = String(req.body.nouveau || "");
    if (!(await verifierActuel(u, req.body.actuel))) return res.status(403).json({ error: "Mot de passe actuel incorrect." });
    if (!nouveau) return res.status(400).json({ error: "Saisissez le nouveau mot de passe." });
    try {
      await definirMotDePasse(u.id, nouveau);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}
