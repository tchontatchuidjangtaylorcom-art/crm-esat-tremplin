// Page publique "Pilotage handicap" : prise de rendez-vous avec un expert
// (créneaux internes, sans outil tiers type Calendly) et demandes de démo.
// Chaque demande est enregistrée en base puis notifiée par mail à la boîte
// du pôle ; le visiteur reçoit une confirmation si l'envoi est configuré.
import crypto from "crypto";
import db from "./db.js";
import { envoyerMail, estEnvoiConfigure, adresseMailPole, telephonePole } from "./mail.js";
import { enregistrerDemandeSiteSansEchec } from "./leadsSite.js";
import { estJourOuvre as estJourOuvreHorsFeries } from "./presence.js";
import { SITE_URL } from "./seo.js";

// Date/heure de Paris → ISO UTC (gère l'heure d'été / d'hiver).
function isoDepuisParis(date, heure) {
  const supposeUtc = new Date(`${date}T${heure}:00Z`);
  const vuAParis = new Date(supposeUtc.toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).replace(" ", "T") + "Z");
  return new Date(supposeUtc.getTime() - (vuAParis.getTime() - supposeUtc.getTime())).toISOString();
}

// Créneaux proposés (heure de Paris), du lundi au vendredi, 45 minutes.
// Par défaut : horaires des experts, du lundi au vendredi de 8h45 à 18h
// (heure de Paris), un créneau toutes les 45 minutes se terminant au plus
// tard à 18h. Surchargeables via RDV_CRENEAUX="09:30,10:30,14:00".
const DUREE_MINUTES = 45;
export const HORAIRES_EXPERTS = { debut: "08:45", fin: "18:00" };

function creneauxParDefaut() {
  const enMinutes = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
  const liste = [];
  for (let m = enMinutes(HORAIRES_EXPERTS.debut); m + DUREE_MINUTES <= enMinutes(HORAIRES_EXPERTS.fin); m += DUREE_MINUTES) {
    liste.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return liste;
}

const CRENEAUX = (process.env.RDV_CRENEAUX ? process.env.RDV_CRENEAUX.split(",") : creneauxParDefaut())
  .map((c) => c.trim())
  .filter((c) => /^\d{2}:\d{2}$/.test(c));
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

// Signature normalisée des accusés de réception (sans adresse postale).
const signature = () => `— Pôle OETH / AGEFIPH\n✉️ ${adresseMailPole()}${telephonePole() ? `\n📞 ${telephonePole()}` : ""}`;

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

// ---- Rendez-vous demandé depuis un e-mail envoyé à une entreprise ----
//
// Le bouton « Parler à un conseiller » des e-mails envoyés depuis une fiche
// (mise en page officielle, voir emailOfficiel.js) mène à une page publique
// propre à cette fiche (/vitrine/rendez-vous/<jeton>) : le client y choisit un
// créneau dans les horaires du pôle (lundi au vendredi, 9h–17h30, heure de
// Paris, jours fériés exclus) et valide. La fiche passe alors en « RDV » à
// cette date, et l'agent qui suit le dossier est prévenu (alerte dans le CRM +
// e-mail). Le jeton, aléatoire, ne donne accès qu'au nom de l'entreprise.
const RDV_CLIENT = { debut: "09:00", fin: "17:30", pasMinutes: 30, horizonJours: 30, delaiMinutes: 60 };
const MAX_RESERVATIONS_PAR_LIEN = 10;

const enMinutes = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const versHeure = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const CRENEAUX_CLIENT = (() => {
  const liste = [];
  for (let m = enMinutes(RDV_CLIENT.debut); m + RDV_CLIENT.pasMinutes <= enMinutes(RDV_CLIENT.fin); m += RDV_CLIENT.pasMinutes) {
    liste.push(versHeure(m));
  }
  return liste;
})();

// Lien de prise de rendez-vous de la fiche (jeton créé au premier envoi).
// `cree` : le jeton vient d'être ajouté à la fiche (à enregistrer).
export function lienRendezVousClient(entreprise) {
  entreprise.rdvClient = entreprise.rdvClient || {};
  let cree = false;
  if (!entreprise.rdvClient.jeton) {
    entreprise.rdvClient.jeton = crypto.randomBytes(18).toString("base64url");
    cree = true;
  }
  return { url: `${SITE_URL}/vitrine/rendez-vous/${entreprise.rdvClient.jeton}`, cree };
}

// Personne prévenue quand le client réserve : l'agent assigné, à défaut celui
// qui a envoyé l'e-mail.
export function destinataireAlerteRdvClient(entreprise) {
  return entreprise.assigneA || entreprise.rdvClient?.envoyePar || null;
}

function maintenantParis() {
  const [jour, heure] = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).split(" ");
  return { jour, minutes: enMinutes(heure) };
}

// Date d'une fiche ("AAAA-MM-JJTHH:MM", heure de Paris comme saisie dans le
// CRM ; ou ISO UTC pour les anciens RDV du site) → { jour, minutes } à Paris.
function dateRdvParis(valeur) {
  if (!valeur) return null;
  const v = String(valeur);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return { jour: v.slice(0, 10), minutes: enMinutes(v.slice(11, 16)) };
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const [jour, heure] = d.toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).split(" ");
  return { jour, minutes: enMinutes(heure) };
}

// Créneaux libres de l'agent qui suit la fiche : hors RDV qu'il a déjà
// (30 min autour), à partir d'une heure après maintenant.
function disponibilitesClient(entreprise) {
  const agentId = destinataireAlerteRdvClient(entreprise);
  const occupes = [];
  for (const e of db.data.entreprises) {
    if (e.id === entreprise.id || e.statut !== "rdv" || !e.dateRdv) continue;
    const responsable = e.assigneA || e.echeanceProgrammeePar || null;
    if (!agentId || responsable !== agentId) continue;
    const d = dateRdvParis(e.dateRdv);
    if (d) occupes.push(d);
  }
  const { jour: aujourdhui, minutes: maintenant } = maintenantParis();
  const jours = {};
  for (let i = 0; i <= RDV_CLIENT.horizonJours; i++) {
    const iso = ajouterJours(aujourdhui, i);
    if (!estJourOuvreHorsFeries(iso)) continue;
    const libres = CRENEAUX_CLIENT.filter((h) => {
      const m = enMinutes(h);
      if (iso === aujourdhui && m < maintenant + RDV_CLIENT.delaiMinutes) return false;
      return !occupes.some((o) => o.jour === iso && Math.abs(o.minutes - m) < RDV_CLIENT.pasMinutes);
    });
    if (libres.length) jours[iso] = libres;
  }
  return jours;
}

function ficheParJeton(jeton) {
  const j = String(jeton || "");
  if (j.length < 16) return null;
  return db.data.entreprises.find((e) => e.rdvClient?.jeton === j) || null;
}

function rdvClientAVenir(entreprise) {
  const derniere = entreprise.rdvClient?.reservations?.[0];
  if (!derniere || entreprise.statut !== "rdv" || entreprise.dateRdv !== `${derniere.date}T${derniere.heure}`) return null;
  const d = dateRdvParis(entreprise.dateRdv);
  const { jour, minutes } = maintenantParis();
  if (!d || d.jour < jour || (d.jour === jour && d.minutes < minutes)) return null;
  return { date: derniere.date, heure: derniere.heure };
}

export function enregistrerRoutesVitrineRdv(app) {
  app.get("/api/vitrine/rdv-client/:jeton", (req, res) => {
    const entreprise = ficheParJeton(req.params.jeton);
    if (!entreprise) {
      return res.status(404).json({
        error: `Ce lien de rendez-vous n'est plus valide. Contactez-nous à ${adresseMailPole()}${telephonePole() ? ` ou au ${telephonePole()}` : ""}.`,
      });
    }
    res.json({
      entreprise: entreprise.nom || "",
      dureeMinutes: RDV_CLIENT.pasMinutes,
      horaires: { debut: RDV_CLIENT.debut, fin: RDV_CLIENT.fin },
      fuseau: "Europe/Paris",
      jours: disponibilitesClient(entreprise),
      rdvConfirme: rdvClientAVenir(entreprise),
      pole: { email: adresseMailPole(), telephone: telephonePole() },
    });
  });

  app.post("/api/vitrine/rdv-client/:jeton", async (req, res) => {
    const b = req.body || {};
    if (b.siteWeb) return res.json({ ok: true }); // champ piège anti-robots
    const entreprise = ficheParJeton(req.params.jeton);
    if (!entreprise) return res.status(404).json({ error: "Ce lien de rendez-vous n'est plus valide." });
    const date = texte(b.date, 10);
    const heure = texte(b.heure, 5);
    const nomContact = texte(b.nom, 120);
    const telephone = texte(b.telephone, 30);
    const message = texte(b.message, 1000);
    const reservations = entreprise.rdvClient.reservations || [];
    if (reservations.length >= MAX_RESERVATIONS_PAR_LIEN) {
      return res.status(429).json({ error: "Trop de demandes avec ce lien. Merci de nous contacter directement." });
    }
    if (!disponibilitesClient(entreprise)[date]?.includes(heure)) {
      return res.status(409).json({ error: "Ce créneau n'est plus disponible. Merci d'en choisir un autre." });
    }

    const maintenant = new Date().toISOString();
    const dateRdv = `${date}T${heure}`;
    const quand = `${dateLongueFr(date)} à ${heure.replace(":", "h")} (heure de Paris)`;
    const modification = Boolean(rdvClientAVenir(entreprise));
    entreprise.rdvClient.reservations = [{ date, heure, nom: nomContact, telephone, message, dateCreation: maintenant }, ...reservations];
    entreprise.rdvClient.nonVu = true;
    entreprise.statut = "rdv";
    entreprise.dateRdv = dateRdv;
    // Fiche non assignée : l'alerte à l'heure du RDV sonne chez l'agent qui a
    // envoyé l'e-mail (voir /api/echeances).
    if (!entreprise.assigneA && entreprise.rdvClient.envoyePar) entreprise.echeanceProgrammeePar = entreprise.rdvClient.envoyePar;
    entreprise.contact = entreprise.contact || {};
    if (telephone && !entreprise.contact.telephone) entreprise.contact.telephone = telephone;
    const coordonnees = [nomContact, telephone].filter(Boolean).join(" — ");
    entreprise.historiqueAppels = [
      {
        id: crypto.randomUUID(),
        date: maintenant,
        type: "rdv_client",
        issue: "rdv",
        issueLabel: modification ? "RDV modifié par le client (lien e-mail)" : "RDV demandé par le client (lien e-mail)",
        details: [quand, coordonnees].filter(Boolean).join(" — "),
        dateProgrammee: dateRdv,
        dureeSecondes: null,
      },
      ...(entreprise.historiqueAppels || []),
    ];
    entreprise.commentaires = [
      {
        id: crypto.randomUUID(),
        date: maintenant,
        auteur: "Site web",
        texte: [
          `📅 Le client ${modification ? "a modifié sa" : "a confirmé une"} demande de rendez-vous depuis le lien de l'e-mail : ${quand}.`,
          coordonnees ? `Contact : ${coordonnees}` : null,
          message ? `Message : ${message}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
      ...(entreprise.commentaires || []),
    ];
    await db.write();

    let confirmationEnvoyee = false;
    if (estEnvoiConfigure()) {
      const agent = db.data.utilisateurs.find((u) => u.id === destinataireAlerteRdvClient(entreprise));
      const sujet = `📅 ${modification ? "RDV modifié" : "Demande de RDV confirmée"} — ${entreprise.nom} — ${date} ${heure}`;
      const corpsAgent =
        `Le client ${entreprise.nom} ${modification ? "a modifié sa" : "vient de confirmer une"} demande de rendez-vous ` +
        `depuis le lien de votre e-mail.\n\nQuand : ${quand}, ${RDV_CLIENT.pasMinutes} min\n` +
        `Contact : ${coordonnees || "-"}\nMessage : ${message || "(aucun)"}\n\n` +
        `La fiche est passée en « RDV » à cette date : ${SITE_URL}/entreprise/${entreprise.id}`;
      try {
        await envoyerMail({ to: agent?.email || adresseMailPole(), subject: sujet, text: corpsAgent, fromName: "CRM — Rendez-vous client" });
      } catch (e) {
        console.error("[rdv-client] Alerte agent impossible :", e.message);
      }
      if (entreprise.rdvClient.email) {
        try {
          await envoyerMail({
            to: entreprise.rdvClient.email,
            subject: "Votre demande de rendez-vous est bien enregistrée",
            text:
              `Bonjour,\n\nVotre demande de rendez-vous est bien enregistrée : ${quand}.\n` +
              `Un conseiller du Pôle OETH / AGEFIPH vous appellera à cette date${telephone ? ` au ${telephone}` : ""}.\n\n` +
              `Pour modifier ce créneau, utilisez à nouveau le lien reçu par e-mail ou répondez simplement à ce message.\n\n${signature()}`,
            fromName: "Pôle OETH / AGEFIPH",
          });
          confirmationEnvoyee = true;
        } catch (e) {
          console.error("[rdv-client] Confirmation client impossible :", e.message);
        }
      }
    }

    res.json({ ok: true, date, heure, dureeMinutes: RDV_CLIENT.pasMinutes, confirmationEnvoyee });
  });

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

    // Fiche CRM (création ou mise à jour) avec la date du rendez-vous.
    const quandLibelle = `${dateLongueFr(date)} à ${heure.replace(":", "h")} (heure de Paris)`;
    const resultatFiche = await enregistrerDemandeSiteSansEchec({
      type: "rdv",
      prenom,
      nom,
      email,
      telephone,
      entreprise,
      message,
      details: [`Rendez-vous réservé : ${quandLibelle}, ${DUREE_MINUTES} min`],
    });
    if (resultatFiche?.entreprise) {
      resultatFiche.entreprise.dateRdv = isoDepuisParis(date, heure);
      rdv.entrepriseId = resultatFiche.entreprise.id;
      await db.write();
    }

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
        `Pour modifier ou annuler, répondez simplement à ce message${telephonePole() ? ` ou appelez-nous au ${telephonePole()}` : ""}.\n\n${signature()}`,
    });

    res.json({ ok: true, date, heure, dureeMinutes: DUREE_MINUTES });
  });

  // Page Vigilance : une entreprise transmet une sollicitation reçue
  // (appel, e-mail, courrier…) pour la faire vérifier par un conseiller.
  app.post("/api/vitrine/vigilance", async (req, res) => {
    const b = req.body || {};
    if (b.siteWeb) return res.json({ ok: true }); // champ piège anti-robots
    const CANAUX = ["Appel téléphonique", "E-mail", "Courrier", "Visite", "Autre"];
    const signalement = {
      id: crypto.randomUUID(),
      nom: texte(b.nom, 120),
      email: texte(b.email, 160),
      telephone: texte(b.telephone, 30),
      entreprise: texte(b.entreprise, 160),
      canal: CANAUX.includes(b.canal) ? b.canal : "Autre",
      interlocuteur: texte(b.interlocuteur, 200),
      coordonneesInterlocuteur: texte(b.coordonneesInterlocuteur, 200),
      description: texte(b.description, 3000),
      dateCreation: new Date().toISOString(),
    };
    if (!signalement.nom || !emailValide(signalement.email) || !signalement.entreprise || !signalement.description) {
      return res.status(400).json({ error: "Nom, e-mail valide, entreprise et description de la sollicitation sont requis." });
    }
    if (b.consentement !== true) {
      return res.status(400).json({ error: "Merci d'accepter l'utilisation de vos informations pour traiter votre demande." });
    }

    db.data.signalementsVigilance.push(signalement);
    await db.write();

    await enregistrerDemandeSiteSansEchec({
      type: "vigilance",
      nom: signalement.nom,
      email: signalement.email,
      telephone: signalement.telephone,
      entreprise: signalement.entreprise,
      message: signalement.description,
      details: [
        `Canal de la sollicitation : ${signalement.canal}`,
        signalement.interlocuteur ? `Interlocuteur / structure : ${signalement.interlocuteur}` : null,
        signalement.coordonneesInterlocuteur ? `Numéro, e-mail ou site utilisé : ${signalement.coordonneesInterlocuteur}` : null,
      ],
    });

    await notifier({
      sujetPole: `Vigilance — sollicitation à vérifier (${signalement.entreprise})`,
      textePole:
        `Une entreprise demande la vérification d'une sollicitation.\n\n` +
        `Contact : ${signalement.nom} — ${signalement.entreprise}\nE-mail : ${signalement.email}\nTéléphone : ${signalement.telephone || "-"}\n\n` +
        `Canal : ${signalement.canal}\nInterlocuteur / structure : ${signalement.interlocuteur || "-"}\n` +
        `Numéro, e-mail ou site utilisé : ${signalement.coordonneesInterlocuteur || "-"}\n\nDescription :\n${signalement.description}`,
      replyTo: signalement.email,
      destinataireVisiteur: signalement.email,
      sujetVisiteur: "Votre demande de vérification a bien été reçue",
      texteVisiteur:
        `Bonjour ${signalement.nom},\n\nNous avons bien reçu votre demande de vérification. Un conseiller l'examine et revient vers vous rapidement.\n\n` +
        `En attendant, ne donnez suite à aucune demande de paiement liée à cette sollicitation.\n\n${signature()}`,
    });

    res.json({ ok: true });
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

    await enregistrerDemandeSiteSansEchec({
      type: "demo",
      prenom: demande.prenom,
      nom: demande.nom,
      email: demande.email,
      telephone: demande.telephone,
      entreprise: demande.entreprise,
      fonction: demande.fonction,
      message: demande.message,
      details: [`Taille : ${demande.taille}`, `Sujets : ${demande.sujets.join(", ")}`],
    });

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
        `(${demande.sujets.join(", ")}).\n\n${signature()}`,
    });

    res.json({ ok: true });
  });
}
