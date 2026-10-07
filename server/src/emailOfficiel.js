// Mise en page "officielle" des e-mails envoyés aux entreprises depuis le CRM
// (bandeau du pôle, titre, message de l'agent personnalisé au nom de
// l'entreprise, bouton "Parler à un conseiller", informations de sécurité,
// mentions). Depuis octobre 2026, plus aucun montant (contribution /
// surcontribution) ni bouton "Faire ma simulation" : les chiffres sont
// présentés par le conseiller au téléphone. Le bouton "Parler à un
// conseiller" ouvre la page publique de prise de rendez-vous propre à la
// fiche (voir vitrineRdv.js) : le client choisit un créneau et l'agent qui
// suit le dossier est prévenu. Même esprit que les e-mails transactionnels bancaires :
// sobre et sérieux, SANS usurper d'autorité — aucun emblème de l'État, aucun
// terme de type "avis" ou "notification", et le rappel explicite que seule
// l'URSSAF (ou la MSA) déclare et recouvre la contribution (voir la même
// règle dans pdfSynthese.js et modelesMails.js).
//
// HTML d'e-mail : tableaux et styles en ligne uniquement (Gmail, Outlook et
// les clients mobiles ignorent les feuilles de style et les mises en page
// modernes).
import { determinerCollecteur } from "./secteurs.js";
import { SITE_URL } from "./seo.js";
import { exerciceParDefaut } from "./oeth.js";

const BLEU = "#1e3a8a";
const GRIS = "#475569";
const GRIS_CLAIR = "#64748b";

function echapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Message de l'agent : paragraphes séparés par une ligne vide, retours à la
// ligne conservés, liens et adresses laissés en texte.
function paragraphes(corps) {
  return String(corps || "")
    .trim()
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${GRIS};">${liensCliquables(echapper(p)).replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

// Adresses web du message (ex. lien du simulateur) rendues cliquables.
function liensCliquables(texteEchappe) {
  return texteEchappe.replace(
    /https?:\/\/[^\s<]+[^\s<.,;:!?)]/g,
    (url) => `<a href="${url}" style="color:${BLEU};font-weight:600;">${url}</a>`
  );
}

// Le message de l'agent commence souvent par sa propre salutation
// ("Bonjour,") : on n'ajoute alors pas "Madame, Monsieur," en double.
function commenceParSalutation(corps) {
  return /^\s*(bonjour|bonsoir|madame|monsieur|cher|chère)/i.test(String(corps || ""));
}

function bouton(href, texte, plein) {
  return `<a href="${echapper(href)}" style="display:inline-block;margin:6px 6px 0 0;padding:12px 22px;border-radius:6px;font-size:14px;font-weight:700;text-decoration:none;${
    plein ? `background:${BLEU};color:#ffffff;border:1px solid ${BLEU};` : `background:#ffffff;color:${BLEU};border:1px solid ${BLEU};`
  }">${texte}</a>`;
}

// `entreprise` : fiche ; `corps` : texte rédigé par l'agent ; `poleInfo` :
// { email, telephone } ; `lienRendezVous` : page de prise de rendez-vous de
// la fiche (à défaut, le bouton ouvre un e-mail au pôle) ; `avecPdf` : la
// synthèse PDF est jointe (optionnelle, cochée par l'agent).
// `lienDossier` : page « Confirmer ma fiche » du client (voir ficheClient.js).
export function genererEmailOfficielHtml({ entreprise, corps, poleInfo, lienRendezVous = null, avecPdf = false, lienDossier = null }) {
  const nom = echapper(entreprise.nom || "votre entreprise");
  const nomPole = determinerCollecteur(entreprise) === "FIPHFP" ? "Pôle FIPHFP" : "Pôle OETH / AGEFIPH";
  // Référence unique à chaque envoi : Gmail replie derrière "•••" tout
  // contenu identique à un message précédent du même fil (ex. une relance
  // après un premier e-mail) — une ligne qui change à chaque envoi l'en empêche.
  const maintenant = new Date();
  const reference = `OETH-${maintenant.getTime().toString(36).toUpperCase()}`;
  const dateEnvoi = maintenant.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });
  const lienConseiller =
    lienRendezVous || `mailto:${poleInfo.email}?subject=${encodeURIComponent(`Rendez-vous OETH — ${entreprise.nom || ""}`)}`;

  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${nomPole}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:680px;max-width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

  <tr><td style="padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td height="6" style="height:6px;background:#0055A4;font-size:0;line-height:0;">&nbsp;</td>
      <td height="6" style="height:6px;background:#ffffff;font-size:0;line-height:0;border-bottom:1px solid #e2e8f0;">&nbsp;</td>
      <td height="6" style="height:6px;background:#EF4135;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <tr><td align="center" style="padding:22px 24px 16px;">
    <img src="${SITE_URL}/logo-oeth.png" width="56" height="56" alt="Pôle OETH" style="display:block;border:0;border-radius:50%;margin:0 auto 10px;">
    <div style="font-size:22px;font-weight:700;color:${BLEU};">${nomPole}</div>
    <div style="font-size:12px;color:${GRIS_CLAIR};margin-top:4px;">Mission d'accompagnement à l'obligation d'emploi des travailleurs handicapés</div>
  </td></tr>

  <tr><td align="center" style="background:${BLEU};padding:20px 24px;">
    <div style="font-size:19px;font-weight:700;color:#ffffff;line-height:1.35;">Votre situation OETH</div>
    <div style="font-size:14px;color:#dbeafe;margin-top:4px;">${nom}</div>
    <div style="font-size:11px;color:#93c5fd;margin-top:8px;">Réf. ${reference} · envoyé le ${dateEnvoi}</div>
  </td></tr>

  <tr><td style="padding:28px 32px 8px;">
    ${commenceParSalutation(corps) ? "" : `<p style="margin:0 0 16px;font-size:14px;font-weight:700;color:${BLEU};">Madame, Monsieur,</p>`}
    ${paragraphes(corps)}

    <div style="margin:24px 0 8px;text-align:center;">
      ${lienDossier ? bouton(lienDossier, `Calculer ma contribution ${exerciceParDefaut()}`, true) : bouton(lienConseiller, "Parler à un conseiller", true)}
    </div>
    ${
      // Un seul bouton (le dossier : calcul + mise à jour, puis choix du
      // créneau) ; parler directement à un conseiller reste possible par un
      // simple lien, plus discret.
      lienDossier
        ? `<p style="margin:10px 0 0;text-align:center;font-size:13px;color:${GRIS};">Vous préférez en parler de vive voix ? <a href="${echapper(lienConseiller)}" style="color:${BLEU};font-weight:700;">Choisir un créneau avec un conseiller</a></p>`
        : ""
    }
    <p style="margin:6px 0 22px;text-align:center;font-size:12px;color:${GRIS_CLAIR};">
      ${lienDossier ? "" : lienRendezVous ? "Choisissez votre créneau, du lundi au vendredi de 9 h à 17 h 30.<br>" : ""}${echapper(poleInfo.email)} · ${echapper(poleInfo.telephone)}
    </p>
  </td></tr>

  <tr><td style="padding:0 32px 24px;">
    <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <div style="font-size:13px;font-weight:700;color:#b91c1c;margin-bottom:6px;">Informations importantes</div>
      <p style="margin:0 0 6px;font-size:12px;line-height:1.55;color:${GRIS};">
        ▸ La contribution OETH se déclare dans votre DSN et se règle <strong>uniquement auprès de l'URSSAF</strong> (ou de la MSA).
      </p>
      <p style="margin:0 0 6px;font-size:12px;line-height:1.55;color:${GRIS};">
        ▸ Le Pôle OETH / AGEFIPH ne vous demandera <strong>jamais</strong> de paiement, ni vos codes d'accès ou coordonnées bancaires.
      </p>
      <p style="margin:0;font-size:12px;line-height:1.55;color:${GRIS};">
        ▸ En cas de doute sur une sollicitation : <a href="${SITE_URL}/vitrine/vigilance" style="color:${BLEU};">${SITE_URL.replace(/^https?:\/\//, "")}/vitrine/vigilance</a>
      </p>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;background:#f1f5f9;">
    <p style="margin:0;font-size:11px;line-height:1.5;color:${GRIS_CLAIR};">
      ${avecPdf ? "Ce message et sa pièce jointe sont" : "Ce message est"} une information du Pôle OETH / AGEFIPH. ${avecPdf ? "Ils ne constituent" : "Il ne constitue"}
      ni une notification officielle de l'URSSAF, ni un avis de recouvrement, ni un document émanant de l'AGEFIPH ; seule
      l'URSSAF est compétente pour notifier et recouvrer la contribution OETH.
      Si vous avez reçu ce message par erreur, merci de nous en informer à ${echapper(poleInfo.email)}.
    </p>
    <p style="margin:6px 0 0;font-size:10px;color:#94a3b8;">Réf. ${reference}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
