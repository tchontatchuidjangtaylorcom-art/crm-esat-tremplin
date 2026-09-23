// Intégration boîte mail réelle (envoi + réception) du Pôle OETH/AGEFIPH.
//
// Envoi et réception sont deux fonctionnalités INDÉPENDANTES : beaucoup de
// configurations ne renseignent que l'envoi — exiger les deux avant
// d'activer quoi que ce soit bloquait le lien magique même quand l'envoi
// seul était parfaitement fonctionnel.
//
// ENVOI — deux méthodes possibles :
//  1. API HTTP Brevo (BREVO_API_KEY) — RECOMMANDÉ sur Render : Render (comme
//     la plupart des hébergeurs PaaS : Railway, Heroku, Fly...) bloque le
//     trafic SMTP sortant (ports 25/465/587) au niveau réseau, quel que soit
//     le plan payant — ce n'est pas une histoire de compte gratuit vs payant,
//     et ça ne se contourne pas en payant. L'API Brevo passe en HTTPS
//     (port 443), jamais bloqué. Utilisée en priorité si configurée.
//  2. SMTP direct (nodemailer) — fonctionne en local/sur un hébergeur qui
//     n'a pas cette restriction, mais échouera systématiquement (ETIMEDOUT)
//     depuis Render. Conservée comme repli pour le développement local.
//
// Noms de variables acceptés (le premier qui existe est utilisé) :
//   Brevo : BREVO_API_KEY
//   SMTP  : MAIL_SMTP_HOST / MAIL_HOST,  MAIL_SMTP_PORT / MAIL_PORT
//   IMAP  : MAIL_IMAP_HOST,              MAIL_IMAP_PORT
//   Commun: MAIL_USER, MAIL_PASSWORD,    MAIL_FROM (optionnel, sinon MAIL_USER)
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { nanoid } from "nanoid";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// ---- Délivrabilité : en-têtes propres + alternative HTML ----
//
// Ce qui suit ne remplace PAS une authentification de domaine correcte
// (SPF/DKIM/DMARC alignés sur le domaine d'envoi) : c'est le facteur qui
// pèse le plus lourd sur l'atterrissage en spam, et il se configure côté
// DNS/fournisseur (Brevo affiche les enregistrements exacts à publier une
// fois BREVO_API_KEY renseignée), pas dans ce fichier. Ici, on soigne ce qui
// relève du code : un Reply-To cohérent, un Message-ID sur le bon domaine,
// un en-tête List-Unsubscribe pour les mails de prospection (attendu par
// Gmail/Yahoo pour tout envoi qui ressemble à du démarchage en nombre), et
// une alternative HTML propre à côté du texte brut plutôt qu'un mail
// texte seul (certains filtres pénalisent aussi bien le "texte seul sans
// HTML" que le "HTML sans repli texte").

// Un en-tête (Subject, nom d'expéditeur…) ne doit jamais contenir de retour
// à la ligne : au mieux ça casse l'affichage, au pire c'est une injection
// d'en-têtes SMTP (ajout d'un destinataire cc/bcc caché, par exemple). Les
// valeurs viennent en partie de champs saisis par l'agent (objet du mail,
// prénom du compte) : on les nettoie systématiquement avant de les poser
// dans un en-tête, plutôt que de compter sur le fait que nodemailer encode
// déjà correctement ces champs.
function nettoyerEntete(valeur) {
  return String(valeur || "").replace(/[\r\n]+/g, " ").trim();
}

function domaineDe(adresse) {
  const m = /@([^>]+)$/.exec(String(adresse || ""));
  return m ? m[1] : "localhost";
}

function echapperHtml(texte) {
  return String(texte)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Génère une alternative HTML minimale à partir du texte brut quand l'appelant
// n'en fournit pas une explicitement : CSS entièrement inline (les clients
// mail ignorent ou suppriment les balises <style>), aucune image, aucun
// pixel de suivi, aucun script — rien qui ressemble à un template marketing
// aux yeux d'un filtre antispam, juste la même lettre proprement formatée.
function texteVersHtml(texte) {
  const paragraphes = String(texte || "")
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 1em 0;">${echapperHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a;">` +
    `${paragraphes}</div>`
  );
}

// En-tête List-Unsubscribe (RFC 2369) — réservé aux mails de prospection
// (voir `listeDiffusion` sur envoyerMail), pas aux mails transactionnels
// individuels (lien de connexion, création de compte) où il n'a pas de sens.
// Le lien mailto fonctionne toujours ; l'URL HTTPS en un clic (List-
// Unsubscribe-Post, RFC 8058) n'est ajoutée que si MAIL_LIST_UNSUBSCRIBE_URL
// est configurée (ce CRM n'héberge pas de page de désinscription par défaut).
function entetesDesinscription(adresseExpediteur) {
  const adresseMailto = `mailto:${adresseExpediteur}?subject=${encodeURIComponent("Désinscription")}`;
  const urlUnClic = process.env.MAIL_LIST_UNSUBSCRIBE_URL;
  const valeurs = urlUnClic ? [`<${urlUnClic}>`, `<${adresseMailto}>`] : [`<${adresseMailto}>`];
  const entetes = { "List-Unsubscribe": valeurs.join(", ") };
  if (urlUnClic) entetes["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  return entetes;
}

function config() {
  return {
    smtpHost: process.env.MAIL_SMTP_HOST || process.env.MAIL_HOST,
    smtpPort: Number(process.env.MAIL_SMTP_PORT || process.env.MAIL_PORT) || 587,
    imapHost: process.env.MAIL_IMAP_HOST,
    imapPort: Number(process.env.MAIL_IMAP_PORT) || 993,
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
  };
}

// Envoi via l'API HTTP Brevo — fonctionne depuis Render (voir note en tête
// de fichier). Prioritaire sur le SMTP direct dès qu'elle est configurée.
export function estBrevoConfigure() {
  return Boolean(process.env.BREVO_API_KEY && config().from);
}

// Envoi via SMTP direct (nodemailer) — repli pour le développement local ;
// échoue systématiquement depuis Render (port bloqué).
export function estSmtpConfigure() {
  const c = config();
  return Boolean(c.smtpHost && c.user && c.password);
}

// Vrai dès qu'une des deux méthodes d'envoi est utilisable — c'est ce que
// l'interface (bandeau de config, page de connexion) doit vérifier, peu
// importe laquelle des deux est réellement active.
export function estEnvoiConfigure() {
  return estBrevoConfigure() || estSmtpConfigure();
}

// Nécessaire en plus pour la relève automatique de la boîte de réception.
export function estImapConfigure() {
  const c = config();
  return Boolean(c.imapHost && c.user && c.password);
}

export function signatureMail() {
  return process.env.MAIL_SIGNATURE || "Pôle OETH / AGEFIPH";
}

export function adresseMailPole() {
  return config().from || null;
}

// Coordonnées réelles du pôle affichées en signature des mails et sur le PDF
// de synthèse joint (voir pdfSynthese.js) — renforcent la crédibilité des
// messages envoyés aux entreprises. Valeurs par défaut = coordonnées
// officielles communiquées par le pôle ; surchageables via .env si besoin.
export function adressePostalePole() {
  return process.env.POLE_ADRESSE || "47 rue Eugène Oudiné, 75013 Paris";
}

export function telephonePole() {
  return process.env.POLE_TELEPHONE || "+33 7 44 12 79 17";
}

// Nodemailer utilise par défaut des délais très longs (jusqu'à plusieurs
// minutes) avant d'abandonner une connexion SMTP qui ne répond pas — ce qui,
// côté utilisateur, se traduit par une requête qui semble "pendue" sans
// jamais afficher d'erreur. On raccourcit volontairement ces délais pour
// échouer vite et logguer la vraie cause (ex: port SMTP bloqué par
// l'hébergeur, host/port erroné, pare-feu). Ajustable via MAIL_TIMEOUT_MS.
const TIMEOUT_MS = Number(process.env.MAIL_TIMEOUT_MS) || 8000;

let transporteur = null;
function getTransporteur() {
  if (!transporteur) {
    const c = config();
    transporteur = nodemailer.createTransport({
      host: c.smtpHost,
      port: c.smtpPort,
      secure: c.smtpPort === 465,
      auth: { user: c.user, pass: c.password },
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
  }
  return transporteur;
}

// Filet de sécurité en plus des timeouts nodemailer ci-dessus : garantit que
// la promesse se résout/rejette dans tous les cas (y compris un blocage
// avant même l'ouverture du socket, que connectionTimeout ne couvre pas
// toujours selon les environnements), pour que la requête HTTP appelante ne
// reste jamais indéfiniment en attente.
function avecTimeout(promesse, ms, message) {
  let idTimer;
  const timeout = new Promise((_, reject) => {
    idTimer = setTimeout(() => {
      const erreur = new Error(message);
      erreur.code = "TIMEOUT_MANUEL";
      reject(erreur);
    }, ms);
  });
  return Promise.race([promesse, timeout]).finally(() => clearTimeout(idTimer));
}

// Extrait tous les champs utiles d'une erreur réseau/SMTP (Node et
// nodemailer ne renseignent jamais tous les mêmes champs selon le type
// d'échec : ECONNREFUSED/ETIMEDOUT portent errno/syscall/address/port, un
// rejet SMTP applicatif porte code/command/response/responseCode).
function detailErreur(e) {
  return {
    message: e.message,
    code: e.code,
    command: e.command,
    responseCode: e.responseCode,
    response: e.response,
    errno: e.errno,
    syscall: e.syscall,
    address: e.address,
    port: e.port,
  };
}

// Vérifie la connexion/authentification SMTP sans envoyer de mail (utile au
// démarrage du serveur pour savoir immédiatement, dans les logs, si le mot
// de passe OVH est accepté).
export async function verifierConnexionSMTP() {
  if (!estSmtpConfigure()) return { ok: false, raison: "non_configure" };
  const c = config();
  try {
    await avecTimeout(
      getTransporteur().verify(),
      TIMEOUT_MS + 2000,
      `Délai de vérification SMTP dépassé (${TIMEOUT_MS + 2000}ms) — ${c.smtpHost}:${c.smtpPort} ne répond pas.`
    );
    return { ok: true };
  } catch (e) {
    const detail = detailErreur(e);
    console.error(`[mail] Échec de vérification SMTP (${c.smtpHost}:${c.smtpPort}) :`, JSON.stringify(detail));
    return { ok: false, raison: e.message, code: e.code, reponse: e.response };
  }
}

// Envoie via l'API HTTP Brevo (https://api.brevo.com). `fetch` est global
// depuis Node 18. Utilise AbortController pour appliquer le même timeout
// court que le chemin SMTP (voir avecTimeout) plutôt que de compter
// uniquement sur celui de `avecTimeout`, au cas où `fetch` lui-même ignore
// le rejet de la promesse "course" et garde la requête réseau ouverte.
async function envoyerViaBrevo({ to, subject, text, html, fromName, replyTo, attachments, entetes }) {
  const c = config();
  const controleur = new AbortController();
  const idAbort = setTimeout(() => controleur.abort(), TIMEOUT_MS);
  let reponse;
  try {
    reponse = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: c.from, name: fromName || signatureMail() },
        to: [{ email: to }],
        replyTo: { email: replyTo || c.from },
        subject,
        textContent: text,
        htmlContent: html,
        ...(entetes && Object.keys(entetes).length ? { headers: entetes } : {}),
        ...(attachments?.length
          ? { attachment: attachments.map((a) => ({ content: a.content.toString("base64"), name: a.filename })) }
          : {}),
      }),
      signal: controleur.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      const erreur = new Error(`Délai d'appel à l'API Brevo dépassé (${TIMEOUT_MS}ms).`);
      erreur.code = "TIMEOUT_MANUEL";
      throw erreur;
    }
    throw e;
  } finally {
    clearTimeout(idAbort);
  }
  const corps = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const erreur = new Error(corps.message || `L'API Brevo a répondu ${reponse.status}.`);
    erreur.code = corps.code || `HTTP_${reponse.status}`;
    erreur.responseCode = reponse.status;
    erreur.response = JSON.stringify(corps);
    throw erreur;
  }
  return { messageId: corps.messageId || null };
}

// Envoie un mail réel au nom de la boîte du pôle. `fromName` personnalise le
// nom d'expéditeur affiché (ex: "Pôle FIPHFP" pour un contact public, "Pôle
// OETH / AGEFIPH" pour le privé) sans changer l'adresse réelle de la boîte.
// `inReplyTo` (Message-ID du mail reçu) garde le fil de discussion dans le
// client mail du destinataire — uniquement pris en compte par le chemin
// SMTP (l'API Brevo transactionnelle ne gère pas l'en-tête In-Reply-To).
// `replyTo` : adresse de réponse, par défaut la même boîte que l'envoi (la
// boîte relevée par IMAP) — surchargeable via MAIL_REPLY_TO si les réponses
// doivent atterrir ailleurs. `html` : alternative HTML explicite ; à défaut,
// générée automatiquement à partir de `text` (voir texteVersHtml ci-dessus).
// `listeDiffusion: true` ajoute l'en-tête List-Unsubscribe — à réserver aux
// mails de prospection envoyés à des entreprises, jamais aux mails
// transactionnels individuels (lien de connexion, création de compte).
export async function envoyerMail({
  to,
  subject,
  text,
  html,
  inReplyTo,
  fromName,
  replyTo,
  attachments,
  listeDiffusion = false,
}) {
  const c = config();
  const sujetPropre = nettoyerEntete(subject);
  const nomExpediteurPropre = fromName ? nettoyerEntete(fromName) : undefined;
  const adresseReponse = nettoyerEntete(replyTo) || process.env.MAIL_REPLY_TO || c.from;
  const contenuHtml = html || texteVersHtml(text);
  const entetesSupplementaires = listeDiffusion ? entetesDesinscription(c.from) : {};

  if (estBrevoConfigure()) {
    console.log(`[mail] Tentative d'envoi (API Brevo) à ${to} (expéditeur ${config().from})…`);
    try {
      const info = await avecTimeout(
        envoyerViaBrevo({
          to,
          subject: sujetPropre,
          text,
          html: contenuHtml,
          fromName: nomExpediteurPropre,
          replyTo: adresseReponse,
          attachments,
          entetes: entetesSupplementaires,
        }),
        TIMEOUT_MS + 2000,
        `Délai d'envoi via l'API Brevo dépassé (${TIMEOUT_MS + 2000}ms).`
      );
      // Brevo répond "OK" (2xx + messageId) dès que le mail est ACCEPTÉ pour
      // traitement — pas dès qu'il est réellement délivré en boîte. Un 2xx
      // ici n'exclut donc pas un blocage/spam en aval (SPF, filtre du
      // destinataire...). Le messageId loggué permet de retrouver le statut
      // réel de délivrance dans Brevo > Transactionnel > Journal des emails.
      console.log(`[mail] Accepté par Brevo pour ${to} (messageId: ${info.messageId}) — vérifiez le statut de délivrance dans Brevo > Transactionnel > Journal des emails.`);
      return info;
    } catch (e) {
      const detail = detailErreur(e);
      console.error(`[mail] ÉCHEC Brevo vers ${to} :`, JSON.stringify(detail));
      throw e;
    }
  }

  if (!estSmtpConfigure()) {
    const erreur = new Error(
      "Envoi de mail non configuré (renseignez BREVO_API_KEY, ou à défaut MAIL_SMTP_HOST/MAIL_HOST + MAIL_USER + MAIL_PASSWORD)."
    );
    erreur.code = "MAIL_NON_CONFIGURE";
    throw erreur;
  }
  console.log(`[mail] Tentative d'envoi (SMTP) à ${to} via ${c.smtpHost}:${c.smtpPort} (utilisateur ${c.user})…`);
  try {
    const info = await avecTimeout(
      getTransporteur().sendMail({
        from: nomExpediteurPropre ? { name: nomExpediteurPropre, address: c.from } : c.from,
        replyTo: adresseReponse,
        to,
        subject: sujetPropre,
        text,
        html: contenuHtml,
        // Sur le domaine d'envoi plutôt que le nom d'hôte local par défaut de
        // nodemailer (souvent un hostname interne type "DESKTOP-XXXX" ou
        // l'hôte Render) : un Message-ID sur un domaine qui n'a rien à voir
        // avec l'expéditeur réel est un signal antispam classique.
        messageId: `<${nanoid()}@${domaineDe(c.from)}>`,
        headers: entetesSupplementaires,
        ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
        ...(attachments?.length
          ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) }
          : {}),
      }),
      TIMEOUT_MS + 2000,
      `Délai d'envoi SMTP dépassé (${TIMEOUT_MS + 2000}ms) — ${c.smtpHost}:${c.smtpPort} ne répond pas ` +
        `(l'hébergeur bloque peut-être ce port en sortie, ou l'hôte/port est incorrect).`
    );
    console.log(`[mail] Envoyé (SMTP) à ${to} via ${c.smtpHost}:${c.smtpPort} (messageId: ${info.messageId}).`);
    return info;
  } catch (e) {
    const detail = detailErreur(e);
    console.error(
      `[mail] ÉCHEC SMTP vers ${to} via ${c.smtpHost}:${c.smtpPort} (utilisateur ${c.user}) :`,
      JSON.stringify(detail)
    );
    throw e;
  }
}

// Relève les messages non lus de la boîte de réception, appelle `onMessage`
// pour chacun, puis le marque comme lu côté serveur mail (pour ne pas le
// retraiter à la prochaine relève). Nécessite MAIL_IMAP_HOST spécifiquement
// (pas de repli sur MAIL_HOST : IMAP et SMTP utilisent rarement le même
// port, et souvent le même host ne suffit pas à distinguer les deux).
export async function relaverBoiteMail(onMessage) {
  if (!estImapConfigure()) return;
  const c = config();
  const client = new ImapFlow({
    host: c.imapHost,
    port: c.imapPort,
    secure: true,
    auth: { user: c.user, pass: c.password },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      for (const uid of uids) {
        const message = await client.fetchOne(uid, { source: true }, { uid: true });
        if (!message?.source) continue;
        const parsed = await simpleParser(message.source);
        await onMessage({
          de: parsed.from?.value?.[0]?.address || "",
          nomExpediteur: parsed.from?.value?.[0]?.name || "",
          objet: parsed.subject || "(sans objet)",
          texte: (parsed.text || "").trim() || "(message sans contenu texte)",
          date: (parsed.date || new Date()).toISOString(),
          messageId: parsed.messageId || null,
        });
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
