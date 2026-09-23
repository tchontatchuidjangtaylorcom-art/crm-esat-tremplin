// Intégration boîte mail réelle (IMAP/SMTP générique) du Pôle OETH/AGEFIPH.
//
// Envoi (SMTP) et réception (IMAP) sont deux fonctionnalités INDÉPENDANTES :
// beaucoup de fournisseurs (et pas mal de configurations types "juste
// envoyer un mail transactionnel") ne renseignent que le SMTP — exiger les
// deux avant d'activer quoi que ce soit bloquait l'envoi (lien magique,
// mails agents) même quand le SMTP seul était parfaitement fonctionnel.
//
// Noms de variables acceptés (le premier qui existe est utilisé) :
//   SMTP  : MAIL_SMTP_HOST / MAIL_HOST,  MAIL_SMTP_PORT / MAIL_PORT
//   IMAP  : MAIL_IMAP_HOST,              MAIL_IMAP_PORT
//   Commun: MAIL_USER, MAIL_PASSWORD,    MAIL_FROM (optionnel, sinon MAIL_USER)
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

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

// Suffisant pour envoyer (lien magique, mails agents depuis une fiche).
export function estSmtpConfigure() {
  const c = config();
  return Boolean(c.smtpHost && c.user && c.password);
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

let transporteur = null;
function getTransporteur() {
  if (!transporteur) {
    const c = config();
    transporteur = nodemailer.createTransport({
      host: c.smtpHost,
      port: c.smtpPort,
      secure: c.smtpPort === 465,
      auth: { user: c.user, pass: c.password },
    });
  }
  return transporteur;
}

// Vérifie la connexion/authentification SMTP sans envoyer de mail (utile au
// démarrage du serveur pour savoir immédiatement, dans les logs, si le mot
// de passe OVH est accepté).
export async function verifierConnexionSMTP() {
  if (!estSmtpConfigure()) return { ok: false, raison: "non_configure" };
  try {
    await getTransporteur().verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, raison: e.message, code: e.code, reponse: e.response };
  }
}

// Envoie un mail réel au nom de la boîte du pôle. `fromName` personnalise le
// nom d'expéditeur affiché (ex: "Pôle FIPHFP" pour un contact public, "Pôle
// OETH / AGEFIPH" pour le privé) sans changer l'adresse réelle de la boîte.
// `inReplyTo` (Message-ID du mail reçu) garde le fil de discussion dans le
// client mail du destinataire.
export async function envoyerMail({ to, subject, text, inReplyTo, fromName }) {
  if (!estSmtpConfigure()) {
    const erreur = new Error(
      "Envoi de mail non configuré (renseignez MAIL_SMTP_HOST ou MAIL_HOST, MAIL_USER, MAIL_PASSWORD)."
    );
    erreur.code = "MAIL_NON_CONFIGURE";
    throw erreur;
  }
  const c = config();
  try {
    const info = await getTransporteur().sendMail({
      from: fromName ? { name: fromName, address: c.from } : c.from,
      to,
      subject,
      text,
      ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
    });
    console.log(`[mail] Envoyé à ${to} via ${c.smtpHost}:${c.smtpPort} (messageId: ${info.messageId}).`);
    return info;
  } catch (e) {
    console.error(
      `[mail] ÉCHEC SMTP vers ${to} via ${c.smtpHost}:${c.smtpPort} (utilisateur ${c.user}) — ${e.message}` +
        `${e.code ? ` [code: ${e.code}]` : ""}${e.responseCode ? ` [SMTP ${e.responseCode}]` : ""}`
    );
    if (e.response) console.error(`[mail] Réponse du serveur SMTP : ${e.response}`);
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
