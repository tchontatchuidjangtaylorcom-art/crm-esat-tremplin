// Mission de contrôle et de suivi : le jour d'un rendez-vous, le client
// reçoit un e-mail lui demandant de confirmer que l'échange a bien eu lieu
// avec le conseiller, et d'en laisser un court récapitulatif — une trace
// indépendante du compte-rendu du conseiller/superviseur, qui remonte
// toujours à l'AGENT PRINCIPAL (celui qui a obtenu le rendez-vous), jamais au
// superviseur qui a mené l'entretien. Relances automatiques tant que le
// client n'a pas répondu (1 fois par jour, 3 fois au plus), puis alerte à
// l'agent pour qu'il reprenne la main.
//
// Même principe de lien personnel que « Confirmer ma fiche » (ficheClient.js)
// et « RDV client » (vitrineRdv.js) : jeton aléatoire, sans connexion, accès
// limité au strict nécessaire.
import crypto from "crypto";
import { nanoid } from "nanoid";
import db from "./db.js";
import { envoyerMail, estEnvoiConfigure, adresseMailPole, telephonePole } from "./mail.js";
import { SITE_URL } from "./seo.js";

const MAX_ENVOIS = 3; // 1 e-mail par jour pendant 3 jours, puis on arrête et on alerte l'agent.
const INTERVALLE_MS = 60 * 60 * 1000; // passage toutes les heures, comme recyclageNrp.js

function echapper(t) {
  return String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function emailClient(entreprise) {
  const c = entreprise.contact || {};
  if (c.email) return c.email;
  const alt = (c.emailsAlternatifs || []).find((a) => a.email);
  return alt ? alt.email : null;
}

// Date d'une fiche ("AAAA-MM-JJTHH:MM", heure de Paris) en clair.
function quandEnClair(valeur) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(valeur || ""));
  if (!m) return null;
  const jour = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${jour} à ${m[4]}h${m[5]}`;
}

// Date du jour à Paris (YYYY-MM-DD), indépendante du fuseau du serveur.
function aujourdhuiParis() {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

const signature = () => `— Pôle OETH / AGEFIPH\n✉️ ${adresseMailPole()}${telephonePole() ? `\n📞 ${telephonePole()}` : ""}`;

function parJeton(jeton) {
  const j = String(jeton || "");
  if (j.length < 16) return null;
  return db.data.entreprises.find((e) => e.controleEchange?.jeton === j) || null;
}

// Lien personnel de confirmation (jeton créé une fois pour la fiche, réutilisé
// pour chaque rendez-vous ultérieur).
function lienControleEchange(entreprise) {
  entreprise.controleEchange = entreprise.controleEchange || {};
  if (!entreprise.controleEchange.jeton) entreprise.controleEchange.jeton = crypto.randomBytes(18).toString("base64url");
  return `${SITE_URL}/vitrine/confirmer-echange/${entreprise.controleEchange.jeton}`;
}

// Appelée dès qu'une fiche passe (ou repasse, à une nouvelle date) en RDV —
// que ce soit un agent qui pose la date depuis le CRM, ou le client qui
// choisit son créneau depuis le lien « Parler à un conseiller ». Prépare le
// suivi (sans rien envoyer) : à appeler AVANT `db.write()`, le suivi est
// persisté avec le reste des changements de la fiche.
// Renvoie { url, nouveau } — `nouveau` dit s'il y a un nouveau rendez-vous à
// confirmer (donc si un e-mail de confirmation doit être envoyé) ; `url` vaut
// `null` si la fiche n'a pas d'adresse e-mail connue (rien de prévu dans ce cas).
export function preparerControleEchange(entreprise) {
  const email = emailClient(entreprise);
  if (!email) return { url: null, nouveau: false };
  const url = lienControleEchange(entreprise);
  const c = entreprise.controleEchange;
  if (c.dateRdv === entreprise.dateRdv) return { url, nouveau: false };
  c.dateRdv = entreprise.dateRdv;
  // Snapshot de l'agent principal au moment du rendez-vous : reste le bon
  // destinataire même si la fiche est réattribuée plus tard.
  c.agentPrincipal = entreprise.assigneA || entreprise.echeanceProgrammeePar || null;
  c.statut = "en_attente"; // en_attente | confirme | non_contacte | sans_reponse
  c.envois = 0;
  c.dernierEnvoi = null;
  c.dateReponse = null;
  c.recap = null;
  c.nonVu = false;
  c.vuPar = [];
  return { url, nouveau: true };
}

// E-mail 1 — confirmation du rendez-vous, envoyée côté agent (quand c'est lui
// qui pose la date depuis le CRM). Côté client auto-réservé, la confirmation
// existante de vitrineRdv.js est complétée d'un paragraphe équivalent plutôt
// que doublée par un second e-mail.
export async function envoyerConfirmationRdv(entreprise) {
  const email = emailClient(entreprise);
  if (!email || !estEnvoiConfigure()) return false;
  const quand = quandEnClair(entreprise.dateRdv);
  const texte =
    `Bonjour,\n\n` +
    `Nous confirmons votre rendez-vous téléphonique du ${quand} avec un conseiller du Pôle OETH / AGEFIPH, pour faire ` +
    `le point sur votre situation vis-à-vis de l'obligation d'emploi des travailleurs handicapés (OETH) et les ` +
    `dispositifs possibles (ESAT Tremplin, TIH…).\n\n` +
    `Un conseiller vous contactera au numéro que vous nous avez communiqué.\n\n` +
    `${phraseAnnonceSuivi()}\n\n${signature()}`;
  try {
    await envoyerMail({ to: email, subject: "Confirmation de votre rendez-vous — Pôle OETH/AGEFIPH", text: texte, fromName: "Pôle OETH / AGEFIPH" });
    return true;
  } catch (e) {
    console.error(`[controle-rdv] E-mail de confirmation impossible pour ${entreprise.nom} :`, e.message);
    return false;
  }
}

// Phrase à ajouter à toute confirmation de RDV (y compris celle déjà envoyée
// par vitrineRdv.js lors d'une auto-réservation) pour annoncer l'e-mail de
// suivi du jour J, sans effrayer le client — ton neutre, jamais "contrôle".
export function phraseAnnonceSuivi() {
  return (
    `Le jour du rendez-vous, nous vous enverrons un court message pour confirmer que l'échange a bien eu lieu — merci ` +
    `d'y répondre en un clic, cela nous permet d'assurer un bon suivi de votre dossier.`
  );
}

function corpsMail2(entreprise, c) {
  const quand = quandEnClair(c.dateRdv);
  const url = lienControleEchange(entreprise);
  const relance = c.envois > 0;
  const intro = relance
    ? `Nous revenons vers vous : avez-vous pu échanger avec notre conseiller du Pôle OETH / AGEFIPH, au sujet de votre rendez-vous du ${quand} ?`
    : `Un conseiller du Pôle OETH / AGEFIPH devait vous contacter aujourd'hui dans le cadre de votre rendez-vous du ${quand}.\n\nAvez-vous pu échanger avec lui ?`;
  const texte =
    `Bonjour,\n\n${intro}\n\nMerci de nous le confirmer en un clic :\n\n${url}\n\n` +
    `Message automatique envoyé pour assurer un bon suivi de votre dossier. Vous ne recevrez plus de rappel une fois ` +
    `votre réponse enregistrée.\n\n${signature()}`;
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1e293b;max-width:600px">` +
    `<p>Bonjour,</p><p>${echapper(intro).replace(/\n\n/g, "</p><p>")}</p>` +
    `<p style="margin:28px 0"><a href="${echapper(url)}" style="background:#1e3a8a;color:#fff;text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:bold;display:inline-block">Répondre en un clic</a></p>` +
    `<p style="font-size:12px;color:#64748b">Message automatique envoyé pour assurer un bon suivi de votre dossier. Vous ne recevrez plus de rappel une fois votre réponse enregistrée.</p>` +
    `<p>${echapper(adresseMailPole())}${telephonePole() ? ` · ${echapper(telephonePole())}` : ""}</p></div>`;
  return { texte, html };
}

async function envoyerMail2(entreprise, c) {
  const email = emailClient(entreprise);
  if (!email || !estEnvoiConfigure()) return false;
  const { texte, html } = corpsMail2(entreprise, c);
  try {
    await envoyerMail({
      to: email,
      subject: "Avez-vous pu échanger avec notre conseiller aujourd'hui ?",
      text: texte,
      html,
      fromName: "Pôle OETH / AGEFIPH",
    });
    return true;
  } catch (e) {
    console.error(`[controle-rdv] E-mail de suivi impossible pour ${entreprise.nom} :`, e.message);
    return false;
  }
}

function agentPrincipalDe(c) {
  return c.agentPrincipal ? db.data.utilisateurs.find((u) => u.id === c.agentPrincipal) : null;
}

// Alerte à l'agent principal — jamais au superviseur — à chaque réponse ou
// absence de réponse : c'est tout l'intérêt de la mission de contrôle et de
// suivi (vérification indépendante du compte-rendu du superviseur).
async function alerterAgent(entreprise, c, { sujet, texte }) {
  const agent = agentPrincipalDe(c);
  if (!agent?.email || !estEnvoiConfigure()) return;
  try {
    await envoyerMail({ to: agent.email, subject: sujet, text: texte, fromName: "CRM — Mission de contrôle et de suivi" });
  } catch (e) {
    console.error(`[controle-rdv] Alerte agent impossible pour ${entreprise.nom} :`, e.message);
  }
}

// Passage périodique : envoie l'e-mail 2 (ou une relance) à chaque fiche dont
// le rendez-vous est aujourd'hui ou avant, tant que le client n'a pas
// répondu — au plus MAX_ENVOIS fois, puis bascule en "sans_reponse" et
// alerte l'agent qu'il doit reprendre la main.
export async function passageControleRdv(maintenant = Date.now()) {
  const aujourdhui = aujourdhuiParis();
  let modifiees = 0;
  for (const entreprise of db.data.entreprises) {
    const c = entreprise.controleEchange;
    if (!c || c.statut !== "en_attente") continue;
    const jourRdv = String(c.dateRdv || "").slice(0, 10);
    if (!jourRdv || jourRdv > aujourdhui) continue; // le rendez-vous n'a pas encore eu lieu

    if (c.envois >= MAX_ENVOIS) {
      c.statut = "sans_reponse";
      c.nonVu = true;
      c.vuPar = [];
      modifiees++;
      await alerterAgent(entreprise, c, {
        sujet: `⚠️ Mission de contrôle — ${entreprise.nom} n'a pas répondu après ${MAX_ENVOIS} relances`,
        texte:
          `${entreprise.nom} n'a pas répondu à nos relances pour confirmer l'échange du ${quandEnClair(c.dateRdv)}. ` +
          `Pensez à le recontacter directement.\n\nFiche : ${SITE_URL}/entreprise/${entreprise.id}`,
      });
      continue;
    }
    if (c.envois > 0 && maintenant - new Date(c.dernierEnvoi).getTime() < 24 * 3600 * 1000) continue; // pas avant demain

    if (await envoyerMail2(entreprise, c)) {
      c.envois += 1;
      c.dernierEnvoi = new Date(maintenant).toISOString();
      modifiees++;
    }
  }
  if (modifiees > 0) await db.write();
  return modifiees;
}

export function demarrerControleRdv() {
  const passage = async () => {
    try {
      await passageControleRdv();
    } catch (e) {
      console.error("[controle-rdv]", e.message);
    }
  };
  setTimeout(passage, 45_000);
  setInterval(passage, INTERVALLE_MS);
}

export function enregistrerRoutesControleRdv(app) {
  app.get("/api/vitrine/confirmer-echange/:jeton", (req, res) => {
    const entreprise = parJeton(req.params.jeton);
    if (!entreprise) {
      return res.status(404).json({
        error: `Ce lien n'est plus valide. Contactez-nous à ${adresseMailPole()}${telephonePole() ? ` ou au ${telephonePole()}` : ""}.`,
      });
    }
    const c = entreprise.controleEchange;
    res.json({
      entreprise: entreprise.nom || "",
      date: quandEnClair(c.dateRdv),
      statut: c.statut,
      pole: { email: adresseMailPole(), telephone: telephonePole() },
    });
  });

  app.post("/api/vitrine/confirmer-echange/:jeton", async (req, res) => {
    const b = req.body || {};
    if (b.siteWeb) return res.json({ ok: true }); // champ piège anti-robots
    const entreprise = parJeton(req.params.jeton);
    if (!entreprise) return res.status(404).json({ error: "Ce lien n'est plus valide." });
    const c = entreprise.controleEchange;
    if (c.statut !== "en_attente") return res.json({ ok: true, dejaRepondu: true, statut: c.statut });

    const echange = b.echange === "oui" ? "oui" : b.echange === "non" ? "non" : null;
    if (!echange) return res.status(400).json({ error: "Réponse invalide." });
    const recap = String(b.recap || "").trim().slice(0, 1000);
    if (echange === "oui" && recap.length < 5) {
      return res.status(400).json({ error: "Merci d'indiquer quelques mots sur ce qui a été convenu lors de l'échange." });
    }

    const maintenant = new Date().toISOString();
    const quand = quandEnClair(c.dateRdv);
    c.statut = echange === "oui" ? "confirme" : "non_contacte";
    c.dateReponse = maintenant;
    c.recap = echange === "oui" ? recap : null;
    c.nonVu = true;
    c.vuPar = [];

    entreprise.commentaires = Array.isArray(entreprise.commentaires) ? entreprise.commentaires : [];
    entreprise.commentaires.unshift({
      id: nanoid(),
      date: maintenant,
      auteur: "Client",
      texte:
        echange === "oui"
          ? `✅ Mission de contrôle et de suivi — le client confirme avoir échangé avec un conseiller le ${quand}. Récapitulatif du client : ${recap}`
          : `⚠️ Mission de contrôle et de suivi — le client indique ne PAS avoir été contacté le ${quand} alors qu'un rendez-vous était prévu.`,
    });
    await db.write();

    await alerterAgent(entreprise, c, {
      sujet:
        echange === "oui"
          ? `✅ Mission de contrôle — ${entreprise.nom} confirme son échange`
          : `⚠️ Mission de contrôle — ${entreprise.nom} indique n'avoir PAS été contacté`,
      texte:
        echange === "oui"
          ? `${entreprise.nom} confirme avoir échangé avec un conseiller le ${quand}.\n\nRécapitulatif donné par le client :\n${recap}\n\nFiche : ${SITE_URL}/entreprise/${entreprise.id}`
          : `${entreprise.nom} indique ne PAS avoir été contacté le ${quand}, alors qu'un rendez-vous était prévu avec un conseiller.\n\nÀ vérifier rapidement.\n\nFiche : ${SITE_URL}/entreprise/${entreprise.id}`,
    });

    res.json({ ok: true });
  });
}

// Notifications (cloche) : UNIQUEMENT l'agent principal (snapshot au moment
// du rendez-vous) et les administrateurs — jamais le superviseur, c'est tout
// l'intérêt de cette vérification indépendante.
export function controlesEchangePour(utilisateur, estAdmin) {
  return db.data.entreprises
    .filter((e) => {
      const c = e.controleEchange;
      if (!c?.nonVu || (c.vuPar || []).includes(utilisateur.id)) return false;
      return estAdmin(utilisateur) || c.agentPrincipal === utilisateur.id;
    })
    .map((e) => {
      const c = e.controleEchange;
      return { id: e.id, nom: e.nom, statut: c.statut, dateRdv: c.dateRdv, dateReponse: c.dateReponse, recap: c.recap };
    })
    .sort((a, b) => new Date(b.dateReponse || b.dateRdv || 0) - new Date(a.dateReponse || a.dateRdv || 0));
}

export function marquerControleEchangeVu(entreprise, utilisateur) {
  const c = entreprise.controleEchange;
  if (!c?.nonVu || (c.vuPar || []).includes(utilisateur.id)) return false;
  c.vuPar = [...(c.vuPar || []), utilisateur.id];
  return true;
}
