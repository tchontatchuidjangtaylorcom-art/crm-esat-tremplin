// Campagnes d'e-mails (super-administrateur) : envoi d'un même modèle à des
// centaines ou des milliers de fiches, au rythme d'une boîte d'envoi saine.
//
//  - Montée en charge automatique : un domaine qui passe d'un coup de 0 à
//    des milliers d'e-mails par jour est classé « spammeur » par Gmail /
//    Outlook — et ensuite même les e-mails envoyés à la main par les agents
//    tombent en spam. Le plafond quotidien augmente donc par paliers à partir
//    du premier jour d'envoi (voir PALIERS), jusqu'au plafond choisi.
//  - Envois étalés sur les heures de bureau (lundi–vendredi, 9 h–17 h, heure
//    de Paris), jamais en rafale.
//  - Désinscription en un clic : lien propre à chaque destinataire (dans le
//    mail ET dans l'en-tête List-Unsubscribe attendu par Gmail/Yahoo). Une
//    adresse désinscrite n'est plus jamais contactée par une campagne, et
//    l'envoi manuel depuis une fiche est bloqué (voir estDesinscrit).
//  - Chaque envoi est noté sur la fiche (fil de messagerie + commentaire)
//    pour que l'agent voie que l'entreprise a reçu le mail ; le statut de
//    la fiche ne change pas (elle reste à appeler).
import crypto from "crypto";
import dns from "dns/promises";
import { nanoid } from "nanoid";
import db from "./db.js";
import { envoyerMail, adresseMailPole, telephonePole, estEnvoiConfigure } from "./mail.js";
import { genererEmailOfficielHtml } from "./emailOfficiel.js";
import { lienRendezVousClient } from "./vitrineRdv.js";
import { lienFicheClient } from "./ficheClient.js";
import { classifierSecteur, determinerCollecteur } from "./secteurs.js";
import { tailleEffectif, dansTaille } from "./taillesEffectif.js";
import { SITE_URL } from "./seo.js";

const SECRET = process.env.SESSION_SECRET || "dev-secret-non-securise-a-changer-en-production";
const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERVALLE_MS = 20 * 1000;
const HEURE_DEBUT = 9;
const HEURE_FIN = 17;

// Plafond quotidien selon l'ancienneté des envois (jours depuis le premier
// envoi de campagne) : 4 semaines de montée, puis le plafond choisi.
const PALIERS = [
  { jusquAuJour: 7, plafond: 200 },
  { jusquAuJour: 14, plafond: 500 },
  { jusquAuJour: 21, plafond: 1000 },
  { jusquAuJour: 28, plafond: 2000 },
];
// 2 000/jour × ~22 jours ouvrés ≈ 44 000/mois : tient dans le forfait Resend
// Pro (50 000 e-mails/mois) avec la marge des mails envoyés à la main.
export const PLAFOND_MAX_DEFAUT = 2000;

// Sous-domaine d'envoi dédié aux campagnes (ex. CAMPAGNES_FROM=
// contact@info.oeth-fiph.fr, domaine vérifié dans Resend) : si les
// campagnes abîment la réputation d'envoi, celle de oeth-fiph.fr (mails
// des agents) reste intacte. À défaut, MAIL_FROM.
const EXPEDITEUR_CAMPAGNES = (process.env.CAMPAGNES_FROM || "").trim() || undefined;

// Domaine capable de recevoir du courrier (enregistrement MX) : une adresse
// sur un domaine sans MX revient en erreur (« bounce »), et trop d'erreurs
// font classer l'expéditeur en spam. Vérification DNS gratuite, mise en cache.
const cacheMx = new Map();
export async function domaineRecoitMail(email) {
  const domaine = normaliser(email).split("@")[1];
  if (!domaine) return false;
  if (cacheMx.has(domaine)) return cacheMx.get(domaine);
  let ok;
  try {
    ok = (await dns.resolveMx(domaine)).some((m) => m.exchange);
  } catch (e) {
    // Domaine inexistant / sans MX : refusé ; panne DNS passagère : accepté.
    ok = !["ENOTFOUND", "ENODATA", "NXDOMAIN"].includes(e.code);
  }
  cacheMx.set(domaine, ok);
  return ok;
}

// Fiches visées par défaut : celles que personne n'a encore réussi à
// joindre. Jamais les Clients Potentiels / RDV (déjà en relation avec un
// agent) ni les dossiers archivés.
export const STATUTS_CIBLABLES = {
  nouveau: "Nouveau",
  nrp: "NRP 1",
  nrp2: "NRP 2",
  a_relancer: "À relancer",
  pdn: "PDN (pas de numéro)",
  anglais: "Anglais",
  numero_invalide: "Numéro invalide",
  mail: "Mail",
  me_rappelle: "Me rappelle",
  pas_interesse: "Pas intéressé",
  autre: "Autre",
};
const STATUTS_PAR_DEFAUT = ["nouveau", "nrp", "nrp2", "a_relancer", "pdn", "numero_invalide"];

function donnees() {
  db.data.campagnes = db.data.campagnes || [];
  db.data.desinscriptions = db.data.desinscriptions || [];
  db.data.reglagesCampagnes = db.data.reglagesCampagnes || { plafondMax: PLAFOND_MAX_DEFAUT, premierEnvoi: null };
  return db.data;
}

const normaliser = (email) => String(email || "").trim().toLowerCase();

// ---- Désinscription ----

function signer(email) {
  return crypto.createHmac("sha256", SECRET).update(`desinscription:${normaliser(email)}`).digest("base64url").slice(0, 22);
}

export function lienDesinscription(email) {
  const e = Buffer.from(normaliser(email)).toString("base64url");
  return `${SITE_URL}/api/vitrine/desinscription/${e}.${signer(email)}`;
}

function emailDuJeton(jeton) {
  const [e, sig] = String(jeton || "").split(".");
  if (!e || !sig) return null;
  let email;
  try {
    email = Buffer.from(e, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const attendu = signer(email);
  if (sig.length !== attendu.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(attendu))) return null;
  return EMAIL_VALIDE.test(email) ? email : null;
}

export function estDesinscrit(email) {
  const n = normaliser(email);
  return Boolean(n) && donnees().desinscriptions.some((d) => d.email === n);
}

function desinscrire(email, source) {
  const n = normaliser(email);
  if (!n || estDesinscrit(n)) return false;
  donnees().desinscriptions.push({ email: n, date: new Date().toISOString(), source });
  // Trace sur la ou les fiches concernées, pour que l'agent le sache.
  for (const e of db.data.entreprises) {
    if (normaliser(e.contact?.email) !== n) continue;
    e.commentaires = Array.isArray(e.commentaires) ? e.commentaires : [];
    e.commentaires.unshift({
      id: nanoid(),
      date: new Date().toISOString(),
      auteur: "Système",
      texte: `🚫 ${n} s'est désinscrit des e-mails du pôle : ne plus lui écrire (le téléphone reste possible).`,
    });
  }
  return true;
}

// Désinscription demandée autrement que par le lien (réponse « Désinscription »
// au mailto de l'en-tête List-Unsubscribe, voir boiteMail.js).
export function estDesinscritOuDesinscrire(email, source) {
  desinscrire(email, source);
  return estDesinscrit(email);
}

// ---- Rythme d'envoi ----

function heureParis(maintenant = new Date()) {
  const parties = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(maintenant);
  const v = (t) => parties.find((p) => p.type === t)?.value;
  return {
    jour: `${v("year")}-${v("month")}-${v("day")}`,
    semaine: v("weekday"),
    minutes: Number(v("hour")) * 60 + Number(v("minute")),
  };
}

function plafondDuJour(maintenant = new Date()) {
  const { plafondMax, premierEnvoi } = donnees().reglagesCampagnes;
  const max = Math.max(50, Number(plafondMax) || PLAFOND_MAX_DEFAUT);
  if (!premierEnvoi) return { plafond: Math.min(PALIERS[0].plafond, max), jourDeMontee: 1 };
  const jourDeMontee = Math.floor((maintenant - new Date(premierEnvoi)) / 86400000) + 1;
  const palier = PALIERS.find((p) => jourDeMontee <= p.jusquAuJour);
  return { plafond: Math.min(palier ? palier.plafond : max, max), jourDeMontee };
}

function envoyesLeJour(jour) {
  let n = 0;
  for (const c of donnees().campagnes) for (const env of c.envois || []) if (env.statut === "envoye" && env.jour === jour) n++;
  return n;
}

export function etatEnvoi(maintenant = new Date()) {
  const h = heureParis(maintenant);
  const ouvre = !["sam.", "dim."].includes(h.semaine) && h.minutes >= HEURE_DEBUT * 60 && h.minutes < HEURE_FIN * 60;
  const { plafond, jourDeMontee } = plafondDuJour(maintenant);
  return {
    plafondDuJour: plafond,
    envoyesAujourdhui: envoyesLeJour(h.jour),
    jourDeMontee,
    plafondMax: donnees().reglagesCampagnes.plafondMax,
    premierEnvoi: donnees().reglagesCampagnes.premierEnvoi,
    horaireOuvert: ouvre,
    horaires: `du lundi au vendredi, ${HEURE_DEBUT} h – ${HEURE_FIN} h (heure de Paris)`,
    paliers: PALIERS,
    nbDesinscriptions: donnees().desinscriptions.length,
    envoiConfigure: estEnvoiConfigure(),
    expediteur: EXPEDITEUR_CAMPAGNES || adresseMailPole(),
    sousDomaine: Boolean(EXPEDITEUR_CAMPAGNES),
  };
}

// ---- Ciblage ----

// Fiches qui correspondent aux critères (statut, secteur, vague, privé /
// public, taille), avec ou sans e-mail — aussi utilisé par la recherche
// d'e-mails en lot (emailsEnLot.js).
export function fichesSelon(filtres = {}) {
  const statuts = Array.isArray(filtres.statuts) && filtres.statuts.length ? filtres.statuts : STATUTS_PAR_DEFAUT;
  const taille = tailleEffectif(filtres.taille);
  return db.data.entreprises.filter((e) => {
    if (!statuts.includes(e.statut)) return false;
    if (filtres.categorie) {
      const cle = classifierSecteur(e.secteurActivite, { secteurPublic: e.secteurPublic, categorieForcee: e.categorieForcee }).cle;
      if (cle !== filtres.categorie) return false;
    }
    if (filtres.lot && e.lot !== filtres.lot) return false;
    if (filtres.collecteur && determinerCollecteur(e) !== filtres.collecteur) return false;
    return !taille || dansTaille(e, taille);
  });
}

function ciblesPour(filtres = {}) {
  const exclusions = { sansEmail: 0, desinscrits: 0, dejaRecu: 0 };
  const recuParCampagne = new Set();
  // Une fiche ne reçoit pas deux fois la même campagne, ni une campagne si
  // elle en a reçu une il y a moins de `delaiJours` jours.
  const delaiJours = Number.isFinite(Number(filtres.delaiJours)) ? Number(filtres.delaiJours) : 30;
  const limite = Date.now() - delaiJours * 86400000;
  for (const c of donnees().campagnes) {
    for (const env of c.envois || []) {
      if (env.statut === "envoye" && new Date(env.date).getTime() >= limite) recuParCampagne.add(env.entrepriseId);
    }
    if (c.statut === "en_cours" || c.statut === "en_pause") for (const id of c.file || []) recuParCampagne.add(id);
  }
  const cibles = [];
  for (const e of fichesSelon(filtres)) {
    const email = String(e.contact?.email || "").trim();
    if (!EMAIL_VALIDE.test(email)) {
      exclusions.sansEmail++;
      continue;
    }
    if (estDesinscrit(email)) {
      exclusions.desinscrits++;
      continue;
    }
    if (recuParCampagne.has(e.id)) {
      exclusions.dejaRecu++;
      continue;
    }
    cibles.push(e);
  }
  // Les plus grosses contributions d'abord.
  cibles.sort((a, b) => (Number(b.effectif) || 0) - (Number(a.effectif) || 0));
  return { cibles, exclusions };
}

// ---- Contenu ----

function signature(entreprise) {
  const pole = determinerCollecteur(entreprise) === "FIPHFP" ? "Pôle FIPHFP" : "Pôle OETH / AGEFIPH";
  return `— ${pole}\n✉️ ${adresseMailPole()}\n📞 ${telephonePole()}`;
}

export function remplirTexte(texte, entreprise) {
  const annee = new Date().getFullYear();
  return String(texte || "")
    .replaceAll("{{SIGNATURE}}", signature(entreprise))
    .replaceAll("{{ENTREPRISE}}", entreprise.nom || "votre entreprise")
    .replaceAll("{{ANNEE_SUIVANTE}}", String(annee + 1))
    .replaceAll("{{ANNEE}}", String(annee));
}

async function envoyerA(campagne, entreprise, destinataire) {
  const objet = remplirTexte(campagne.objet, entreprise);
  const corps = remplirTexte(campagne.corps, entreprise);
  const desinscription = lienDesinscription(destinataire);
  let html;
  let texte = `${corps}\n\n—\nVous ne souhaitez plus recevoir nos e-mails ? ${desinscription}`;
  if (campagne.formatOfficiel) {
    const rdv = lienRendezVousClient(entreprise);
    const dossier = lienFicheClient(entreprise);
    // Rendez-vous pris depuis ce mail sur une fiche sans agent : prévenir
    // la personne qui a lancé la campagne.
    if (!entreprise.rdvClient.envoyePar) entreprise.rdvClient.envoyePar = campagne.creePar;
    entreprise.rdvClient.email = entreprise.rdvClient.email || destinataire;
    html = genererEmailOfficielHtml({
      entreprise,
      corps,
      poleInfo: { email: adresseMailPole(), telephone: telephonePole() },
      lienRendezVous: rdv.url,
      lienDossier: dossier.url,
      lienDesinscription: desinscription,
    });
    texte =
      `${corps}\n\nCalculer ma contribution et mettre à jour mon dossier OETH : ${dossier.url}` +
      `\nVous préférez en parler de vive voix ? Choisir un créneau avec un conseiller : ${rdv.url}` +
      `\n\n—\nVous ne souhaitez plus recevoir nos e-mails ? ${desinscription}`;
  }
  await envoyerMail({
    to: destinataire,
    subject: objet,
    text: texte,
    html,
    fromName: determinerCollecteur(entreprise) === "FIPHFP" ? "Pôle FIPHFP" : "Pôle OETH / AGEFIPH",
    listeDiffusion: true,
    urlDesinscription: desinscription,
    fromAdresse: EXPEDITEUR_CAMPAGNES,
  });
  const date = new Date().toISOString();
  entreprise.emails = entreprise.emails || [];
  entreprise.emails.unshift({ id: nanoid(), direction: "envoye", de: adresseMailPole(), a: destinataire, objet, corps, date, lu: true, campagneId: campagne.id });
  entreprise.commentaires = Array.isArray(entreprise.commentaires) ? entreprise.commentaires : [];
  entreprise.commentaires.unshift({
    id: nanoid(),
    date,
    auteur: "Système",
    texte: `📨 E-mail de la campagne « ${campagne.nom} » envoyé à ${destinataire} (objet : ${objet}).`,
  });
}

// ---- Moteur : un passage toutes les 20 s ----

let passageEnCours = false;
export async function passageCampagnes(maintenant = new Date()) {
  if (passageEnCours) return 0;
  passageEnCours = true;
  try {
    const d = donnees();
    const actives = d.campagnes.filter((c) => c.statut === "en_cours");
    if (!actives.length || !estEnvoiConfigure()) return 0;
    const h = heureParis(maintenant);
    const etat = etatEnvoi(maintenant);
    if (!etat.horaireOuvert) return 0;
    // Étalement : à mi-journée, pas plus de la moitié du plafond envoyée.
    const fraction = Math.min(1, (h.minutes - HEURE_DEBUT * 60 + 1) / ((HEURE_FIN - HEURE_DEBUT) * 60));
    const autorises = Math.ceil(etat.plafondDuJour * fraction) - etat.envoyesAujourdhui;
    // Au plus 3 envois par passage (20 s) : ~540/heure au maximum.
    let aEnvoyer = Math.min(3, autorises);
    let envoyes = 0;
    while (aEnvoyer > 0) {
      const campagne = actives.find((c) => c.statut === "en_cours" && (c.file || []).length);
      if (!campagne) break;
      const id = campagne.file.shift();
      const entreprise = db.data.entreprises.find((e) => e.id === id);
      const destinataire = String(entreprise?.contact?.email || "").trim();
      const base = { entrepriseId: id, nom: entreprise?.nom || "?", email: destinataire, date: new Date().toISOString(), jour: h.jour };
      campagne.envois = campagne.envois || [];
      // Revérifié au moment d'envoyer : la fiche a pu changer depuis le lancement.
      if (!entreprise || !EMAIL_VALIDE.test(destinataire) || estDesinscrit(destinataire) || ["fiche", "fiche_one_shot", "rdv"].includes(entreprise.statut)) {
        campagne.envois.push({ ...base, statut: "ignore", erreur: !entreprise ? "Fiche archivée ou supprimée" : estDesinscrit(destinataire) ? "Désinscrit" : !EMAIL_VALIDE.test(destinataire) ? "Plus d'e-mail" : "Déjà en relation (CP / RDV)" });
        continue;
      }
      if (!(await domaineRecoitMail(destinataire))) {
        campagne.envois.push({ ...base, statut: "ignore", erreur: "Domaine sans serveur de messagerie (adresse invalide)" });
        continue;
      }
      try {
        if (!d.reglagesCampagnes.premierEnvoi) d.reglagesCampagnes.premierEnvoi = maintenant.toISOString();
        await envoyerA(campagne, entreprise, destinataire);
        campagne.envois.push({ ...base, statut: "envoye" });
        campagne.erreursConsecutives = 0;
        envoyes++;
        aEnvoyer--;
      } catch (e) {
        campagne.envois.push({ ...base, statut: "erreur", erreur: String(e.message || e).slice(0, 200) });
        campagne.erreursConsecutives = (campagne.erreursConsecutives || 0) + 1;
        // Problème d'envoi général (clé Resend, quota atteint…) : pause pour
        // ne pas vider la file en erreurs.
        if (campagne.erreursConsecutives >= 5) {
          campagne.statut = "en_pause";
          campagne.motifPause = `Mise en pause automatique après 5 erreurs d'envoi de suite (dernière : ${String(e.message || e).slice(0, 160)}).`;
        }
        aEnvoyer--;
      }
    }
    for (const c of actives) {
      if (c.statut === "en_cours" && !(c.file || []).length) {
        c.statut = "terminee";
        c.dateFin = new Date().toISOString();
      }
    }
    await db.write();
    return envoyes;
  } finally {
    passageEnCours = false;
  }
}

export function demarrerCampagnes() {
  setInterval(() => {
    passageCampagnes().catch((e) => console.error("[campagnes]", e.message));
  }, INTERVALLE_MS).unref?.();
}

// ---- Routes ----

function resumer(c) {
  const envois = c.envois || [];
  const compte = (s) => envois.filter((e) => e.statut === s).length;
  return {
    id: c.id,
    nom: c.nom,
    statut: c.statut,
    motifPause: c.motifPause || null,
    objet: c.objet,
    formatOfficiel: c.formatOfficiel,
    filtres: c.filtres,
    dateCreation: c.dateCreation,
    dateFin: c.dateFin || null,
    total: c.total,
    envoyes: compte("envoye"),
    erreurs: compte("erreur"),
    ignores: compte("ignore"),
    restants: (c.file || []).length,
    derniersEnvois: envois.slice(-8).reverse(),
  };
}

function pageSimple(titre, message, formulaire = "") {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titre}</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;color:#1e293b;">
<div style="max-width:520px;margin:48px auto;padding:28px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
<h1 style="font-size:20px;margin:0 0 12px;">${titre}</h1><p style="line-height:1.55;margin:0 0 16px;">${message}</p>${formulaire}
</div></body></html>`;
}

export function enregistrerRoutesCampagnes(app, { exigerSuperAdmin }) {
  // Désinscription (publique) : GET affiche la confirmation, POST désinscrit
  // (aussi utilisé tel quel par le bouton « Se désinscrire » de Gmail, RFC 8058).
  app.get("/api/vitrine/desinscription/:jeton", (req, res) => {
    const email = emailDuJeton(req.params.jeton);
    res.set("X-Robots-Tag", "noindex");
    if (!email) return res.status(400).type("html").send(pageSimple("Lien invalide", "Ce lien de désinscription n'est pas valide."));
    if (estDesinscrit(email)) {
      return res.type("html").send(pageSimple("Désinscription confirmée", `L'adresse <strong>${email}</strong> ne recevra plus nos e-mails.`));
    }
    res.type("html").send(
      pageSimple(
        "Ne plus recevoir nos e-mails",
        `Confirmez-vous que l'adresse <strong>${email}</strong> ne doit plus recevoir d'e-mails du pôle ?`,
        `<form method="post"><button type="submit" style="padding:12px 20px;border:0;border-radius:8px;background:#1e3a5f;color:#fff;font-size:15px;font-weight:bold;cursor:pointer;">Me désinscrire</button></form>`
      )
    );
  });
  app.post("/api/vitrine/desinscription/:jeton", async (req, res) => {
    const email = emailDuJeton(req.params.jeton);
    if (!email) return res.status(400).type("html").send(pageSimple("Lien invalide", "Ce lien de désinscription n'est pas valide."));
    if (desinscrire(email, "lien")) await db.write();
    res.type("html").send(pageSimple("Désinscription confirmée", `L'adresse <strong>${email}</strong> ne recevra plus nos e-mails.`));
  });

  app.get("/api/campagnes", exigerSuperAdmin, (req, res) => {
    const d = donnees();
    res.json({
      campagnes: [...d.campagnes].reverse().map(resumer),
      etat: etatEnvoi(),
      statutsCiblables: STATUTS_CIBLABLES,
      statutsParDefaut: STATUTS_PAR_DEFAUT,
    });
  });

  app.post("/api/campagnes/apercu", exigerSuperAdmin, (req, res) => {
    const { cibles, exclusions } = ciblesPour(req.body.filtres || {});
    const etat = etatEnvoi();
    res.json({
      nombre: cibles.length,
      exclusions,
      exemples: cibles.slice(0, 5).map((e) => ({ id: e.id, nom: e.nom, email: e.contact?.email, effectif: e.effectif })),
      joursEstimes: Math.ceil(cibles.length / Math.max(1, etat.plafondDuJour)),
    });
  });

  app.post("/api/campagnes/test", exigerSuperAdmin, async (req, res) => {
    const { objet, corps, formatOfficiel = true, entrepriseId } = req.body;
    if (!objet?.trim() || !corps?.trim()) return res.status(400).json({ error: "Objet et texte requis." });
    // Aperçu réel sur une fiche de la cible (ou une fiche fictive), envoyé
    // au super-administrateur — rien n'est noté sur la fiche.
    const vraie = entrepriseId && db.data.entreprises.find((e) => e.id === entrepriseId);
    const entreprise = vraie ? JSON.parse(JSON.stringify(vraie)) : { id: "apercu", nom: "Entreprise Exemple", effectif: 80, contact: {} };
    try {
      await envoyerA({ id: "test", nom: "TEST", objet: `[TEST] ${objet}`, corps, formatOfficiel, creePar: req.utilisateur.id }, entreprise, req.utilisateur.email);
    } catch (e) {
      return res.status(502).json({ error: e.message });
    }
    res.json({ ok: true, destinataire: req.utilisateur.email });
  });

  app.post("/api/campagnes", exigerSuperAdmin, async (req, res) => {
    const { nom, objet, corps, formatOfficiel = true, filtres = {} } = req.body;
    if (!String(nom || "").trim()) return res.status(400).json({ error: "Donnez un nom à la campagne." });
    if (!objet?.trim() || !corps?.trim()) return res.status(400).json({ error: "Objet et texte du mail requis." });
    if (!estEnvoiConfigure()) return res.status(503).json({ error: "L'envoi d'e-mails n'est pas configuré (clé Resend)." });
    const { cibles } = ciblesPour(filtres);
    if (!cibles.length) return res.status(400).json({ error: "Aucune fiche ne correspond à ces critères." });
    const campagne = {
      id: nanoid(),
      nom: String(nom).trim().slice(0, 120),
      statut: "en_cours",
      objet: objet.trim(),
      corps,
      formatOfficiel: Boolean(formatOfficiel),
      filtres,
      creePar: req.utilisateur.id,
      dateCreation: new Date().toISOString(),
      total: cibles.length,
      file: cibles.map((e) => e.id),
      envois: [],
    };
    donnees().campagnes.push(campagne);
    await db.write();
    res.json(resumer(campagne));
  });

  app.post("/api/campagnes/:id/:action", exigerSuperAdmin, async (req, res) => {
    const c = donnees().campagnes.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: "Campagne introuvable." });
    const { action } = req.params;
    if (action === "pause" && c.statut === "en_cours") c.statut = "en_pause";
    else if (action === "reprendre" && c.statut === "en_pause") {
      c.statut = c.file.length ? "en_cours" : "terminee";
      c.motifPause = null;
      c.erreursConsecutives = 0;
    } else if (action === "annuler" && (c.statut === "en_cours" || c.statut === "en_pause")) {
      c.statut = "annulee";
      c.dateFin = new Date().toISOString();
      c.file = [];
    } else return res.status(400).json({ error: "Action impossible dans l'état actuel de la campagne." });
    await db.write();
    res.json(resumer(c));
  });

  app.post("/api/campagnes-reglages", exigerSuperAdmin, async (req, res) => {
    const plafond = Math.round(Number(req.body.plafondMax));
    if (!Number.isFinite(plafond) || plafond < 50 || plafond > 20000) {
      return res.status(400).json({ error: "Plafond entre 50 et 20 000 e-mails par jour." });
    }
    donnees().reglagesCampagnes.plafondMax = plafond;
    await db.write();
    res.json(etatEnvoi());
  });
}
