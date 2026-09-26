// Page publique "Pilotage handicap" : prise de rendez-vous avec un expert
// (créneaux internes, sans outil tiers type Calendly) et demandes de démo.
// Chaque demande est enregistrée en base puis notifiée par mail à la boîte
// du pôle ; le visiteur reçoit une confirmation si l'envoi est configuré.
import crypto from "crypto";
import db from "./db.js";
import { envoyerMail, estEnvoiConfigure, adresseMailPole, telephonePole } from "./mail.js";

// Créneaux proposés (heure de Paris), du lundi au vendredi, 45 minutes.
// Surchargeables via RDV_CRENEAUX="09:30,10:30,14:00" sans toucher au code.
const CRENEAUX = (process.env.RDV_CRENEAUX || "09:30,10:30,11:30,14:00,15:00,16:00")
  .split(",")
  .map((c) => c.trim())
  .filter((c) => /^\d{2}:\d{2}$/.test(c));
const DUREE_MINUTES = 45;
const HORIZON_JOURS = 45; // réservable jusqu'à ~6 semaines à l'avance

const FONCTIONS = ["DRH / RRH", "Référent handicap", "Chargé(e) de mission handicap", "Dirigeant(e)", "Paie / comptabilité", "Autre"];
const TAILLES = ["20 à 49 salariés", "50 à 249 salariés", "250 à 999 salariés", "1 000 salariés et plus"];
const SUJETS = [
  "Pilotage de la politique handicap",
  "Préparation DOETH et DSN",
  "Accompagnement à la RQTH",
  "Maintien dans l'emploi",
  "Achats inclusifs (EA / ESAT / TIH)",
  "Sensibilisation et formation",
];

// Date du jour à Paris (YYYY-MM-DD), indépendante du fuseau du serveur.
function aujourdhuiParis() {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

function ajouterJours(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function estJourOuvre(iso) {
  const jour = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return jour !== 0 && jour !== 6;
}

// Jours réservables : à partir du lendemain, jours ouvrés, dans l'horizon.
function joursReservables() {
  const debut = ajouterJours(aujourdhuiParis(), 1);
  const jours = [];
  for (let i = 0; i < HORIZON_JOURS; i++) {
    const iso = ajouterJours(debut, i);
    if (estJourOuvre(iso)) jours.push(iso);
  }
  return jours;
}

function creneauxLibres(dateIso) {
  const pris = new Set(
    (db.data.rendezVousVitrine || []).filter((r) => r.date === dateIso && r.statut !== "annule").map((r) => r.heure)
  );
  return CRENEAUX.filter((h) => !pris.has(h));
}

const texte = (v, max = 200) => String(v || "").trim().slice(0, max);
const emailValide = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function dateLongueFr(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function notifier({ sujetPole, textePole, replyTo, destinataireVisiteur, sujetVisiteur, texteVisiteur }) {
  if (!estEnvoiConfigure()) return;
  try {
    await envoyerMail({ to: adresseMailPole(), subject: sujetPole, text: textePole, replyTo, fromName: "Site — Pilotage handicap" });
  } catch (e) {
    console.error("[vitrine] Notification pôle impossible :", e.message);
  }
  if (destinataireVisiteur) {
    try {
      await envoyerMail({ to: destinataireVisiteur, subject: sujetVisiteur, text: texteVisiteur, fromName: "Pôle OETH / AGEFIPH" });
    } catch (e) {
      console.error("[vitrine] Confirmation visiteur impossible :", e.message);
    }
  }
}

export function enregistrerRoutesVitrineRdv(app) {
  // Référentiels du formulaire de démo (listes fermées, validées côté serveur).
  app.get("/api/vitrine/demo/options", (req, res) => {
    res.json({ fonctions: FONCTIONS, tailles: TAILLES, sujets: SUJETS });
  });

  // Disponibilités : { dureeMinutes, jours: { "2026-09-28": ["09:30", ...] } }.
  app.get("/api/vitrine/rdv/disponibilites", (req, res) => {
    const jours = {};
    for (const iso of joursReservables()) {
      const libres = creneauxLibres(iso);
      if (libres.length) jours[iso] = libres;
    }
    res.json({ dureeMinutes: DUREE_MINUTES, fuseau: "Europe/Paris", jours });
  });

  app.post("/api/vitrine/rdv", async (req, res) => {
    const b = req.body || {};
    if (b.siteWeb) return res.json({ ok: true }); // champ piège anti-robots
    const date = texte(b.date, 10);
    const heure = texte(b.heure, 5);
    const prenom = texte(b.prenom, 80);
    const nom = texte(b.nom, 80);
    const email = texte(b.email, 160);
    const telephone = texte(b.telephone, 30);
    const entreprise = texte(b.entreprise, 160);
    const message = texte(b.message, 2000);

    if (!prenom || !nom || !emailValide(email) || !entreprise) {
      return res.status(400).json({ error: "Prénom, nom, e-mail professionnel valide et entreprise sont requis." });
    }
    if (!joursReservables().includes(date) || !CRENEAUX.includes(heure)) {
      return res.status(400).json({ error: "Ce créneau n'est pas réservable." });
    }
    if (!creneauxLibres(date).includes(heure)) {
      return res.status(409).json({ error: "Ce créneau vient d'être réservé. Merci d'en choisir un autre." });
    }

    const rdv = {
      id: crypto.randomUUID(),
      date,
      heure,
      dureeMinutes: DUREE_MINUTES,
      prenom,
      nom,
      email,
      telephone,
      entreprise,
      message,
      statut: "confirme",
      dateCreation: new Date().toISOString(),
    };
    db.data.rendezVousVitrine.push(rdv);
    await db.write();

    const quand = `${dateLongueFr(date)} à ${heure.replace(":", "h")} (heure de Paris, ${DUREE_MINUTES} min)`;
    await notifier({
      sujetPole: `Nouveau rendez-vous expert — ${entreprise} — ${date} ${heure}`,
      textePole:
        `Nouveau rendez-vous pris depuis la page Pilotage handicap.\n\n` +
        `Quand : ${quand}\nNom : ${prenom} ${nom}\nEntreprise : ${entreprise}\nE-mail : ${email}\n` +
        `Téléphone : ${telephone || "-"}\n\nMessage :\n${message || "(aucun message)"}`,
      replyTo: email,
      destinataireVisiteur: email,
      sujetVisiteur: "Votre rendez-vous avec un expert est confirmé",
      texteVisiteur:
        `Bonjour ${prenom},\n\nVotre rendez-vous est bien enregistré : ${quand}.\n` +
        `Un expert vous contactera à cette date (par téléphone ou visioconférence, les informations de connexion vous seront communiquées).\n\n` +
        `Pour modifier ou annuler, répondez simplement à ce message${telephonePole() ? ` ou appelez-nous au ${telephonePole()}` : ""}.\n\n— Pôle OETH / AGEFIPH`,
    });

    res.json({ ok: true, date, heure, dureeMinutes: DUREE_MINUTES });
  });

  app.post("/api/vitrine/demo", async (req, res) => {
    const b = req.body || {};
    if (b.siteWeb) return res.json({ ok: true }); // champ piège anti-robots
    const demande = {
      id: crypto.randomUUID(),
      prenom: texte(b.prenom, 80),
      nom: texte(b.nom, 80),
      email: texte(b.email, 160),
      telephone: texte(b.telephone, 30),
      entreprise: texte(b.entreprise, 160),
      fonction: FONCTIONS.includes(b.fonction) ? b.fonction : "",
      taille: TAILLES.includes(b.taille) ? b.taille : "",
      sujets: Array.isArray(b.sujets) ? b.sujets.filter((x) => SUJETS.includes(x)) : [],
      message: texte(b.message, 2000),
      dateCreation: new Date().toISOString(),
    };
    if (
      !demande.prenom ||
      !demande.nom ||
      !emailValide(demande.email) ||
      !demande.telephone ||
      !demande.entreprise ||
      !demande.fonction ||
      !demande.taille ||
      demande.sujets.length === 0
    ) {
      return res.status(400).json({ error: "Merci de compléter tous les champs obligatoires." });
    }
    if (b.consentement !== true) {
      return res.status(400).json({ error: "Merci d'accepter l'utilisation de vos informations pour traiter votre demande." });
    }

    db.data.demandesDemo.push(demande);
    await db.write();

    await notifier({
      sujetPole: `Demande de démo — ${demande.entreprise} (${demande.taille})`,
      textePole:
        `Nouvelle demande de démo depuis la page Pilotage handicap.\n\n` +
        `Nom : ${demande.prenom} ${demande.nom}\nFonction : ${demande.fonction}\nEntreprise : ${demande.entreprise}\n` +
        `Taille : ${demande.taille}\nE-mail : ${demande.email}\nTéléphone : ${demande.telephone}\n` +
        `Sujets : ${demande.sujets.join(", ")}\n\nMessage :\n${demande.message || "(aucun message)"}`,
      replyTo: demande.email,
      destinataireVisiteur: demande.email,
      sujetVisiteur: "Nous avons bien reçu votre demande de démo",
      texteVisiteur:
        `Bonjour ${demande.prenom},\n\nMerci pour votre demande. Un expert revient vers vous rapidement pour organiser la démonstration ` +
        `(${demande.sujets.join(", ")}).\n\n— Pôle OETH / AGEFIPH`,
    });

    res.json({ ok: true });
  });
}
