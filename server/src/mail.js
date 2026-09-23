// Intégration boîte mail réelle (IMAP/SMTP générique) du Pôle OETH/AGEFIPH.
// Entièrement optionnelle : si les variables MAIL_* ne sont pas renseignées
// dans server/.env, la fonctionnalité reste désactivée sans casser le reste
// de l'application (voir estMailConfigure()).
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

function config() {
  return {
    imapHost: process.env.MAIL_IMAP_HOST,
    imapPort: Number(process.env.MAIL_IMAP_PORT) || 993,
    smtpHost: process.env.MAIL_SMTP_HOST,
    smtpPort: Number(process.env.MAIL_SMTP_PORT) || 587,
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
  };
}

export function estMailConfigure() {
  const c = config();
  return Boolean(c.imapHost && c.smtpHost && c.user && c.password);
}

export function signatureMail() {
  return process.env.MAIL_SIGNATURE || "Pôle OETH / AGEFIPH";
}

export function adresseMailPole() {
  return config().user || null;
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

// Envoie un mail réel au nom de la boîte du pôle. `fromName` personnalise le
// nom d'expéditeur affiché (ex: "Pôle FIPHFP" pour un contact public, "Pôle
// OETH / AGEFIPH" pour le privé) sans changer l'adresse réelle de la boîte.
// `inReplyTo` (Message-ID du mail reçu) garde le fil de discussion dans le
// client mail du destinataire.
export async function envoyerMail({ to, subject, text, inReplyTo, fromName }) {
  if (!estMailConfigure()) {
    const erreur = new Error("Boîte mail non configurée (variables MAIL_* absentes de server/.env).");
    erreur.code = "MAIL_NON_CONFIGURE";
    throw erreur;
  }
  const c = config();
  await getTransporteur().sendMail({
    from: fromName ? { name: fromName, address: c.user } : c.user,
    to,
    subject,
    text,
    ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
  });
}

// Relève les messages non lus de la boîte de réception, appelle `onMessage`
// pour chacun, puis le marque comme lu côté serveur mail (pour ne pas le
// retraiter à la prochaine relève).
export async function relaverBoiteMail(onMessage) {
  if (!estMailConfigure()) return;
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
