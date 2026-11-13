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
const VERT = "#15803d";
const ARDOISE = "#334155";
const VIOLET = "#7c3aed"; // Espace AcademTrade (formation trading) — même violet que l'interface (couleur "violet" dans espaces.js).

// Habillage du mail de création de compte CRM (voir genererEmailCreationCompteHtml
// ci-dessous) selon l'espace du nouveau compte (voir espaces.js) : garde le
// logo et le bleu du Pôle OETH pour l'espace historique, bascule sur le vert
// "Eco Smart France" pour CEE, et retombe sur un habillage neutre (couleur
// ardoise, pas de logo) pour tout espace créé depuis l'administration —
// jamais la marque OETH par défaut pour un compte qui n'en relève pas.
const THEMES_COMPTE_PAR_ESPACE = {
  cee: { couleur: VERT, marque: "Eco Smart France", logo: null },
  oeth: { couleur: BLEU, marque: "Pôle OETH / AGEFIPH", logo: true },
  academtrade: { couleur: VIOLET, marque: "AcademTrade", logo: null },
};
function themeCompte(espace) {
  if (espace?.id && THEMES_COMPTE_PAR_ESPACE[espace.id]) return THEMES_COMPTE_PAR_ESPACE[espace.id];
  if (espace) return { couleur: ARDOISE, marque: espace.nom || espace.court || "CRM", logo: null };
  return THEMES_COMPTE_PAR_ESPACE.oeth;
}

// Nom de marque à utiliser comme expéditeur/objet des mails de compte
// (auth.js) hors de cette mise en page HTML elle-même — garde les deux en
// phase sans dupliquer la logique de thème.
export function marqueCompte(espace) {
  return themeCompte(espace).marque;
}

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

function bouton(href, texte, plein, couleur = BLEU) {
  return `<a href="${echapper(href)}" style="display:inline-block;margin:6px 6px 0 0;padding:12px 22px;border-radius:6px;font-size:14px;font-weight:700;text-decoration:none;${
    plein ? `background:${couleur};color:#ffffff;border:1px solid ${couleur};` : `background:#ffffff;color:${couleur};border:1px solid ${couleur};`
  }">${texte}</a>`;
}

// `entreprise` : fiche ; `corps` : texte rédigé par l'agent ; `poleInfo` :
// { email, telephone } ; `lienRendezVous` : page de prise de rendez-vous de
// la fiche (à défaut, le bouton ouvre un e-mail au pôle) ; `avecPdf` : la
// synthèse PDF est jointe (optionnelle, cochée par l'agent).
// `lienDossier` : page « Confirmer ma fiche » du client (voir ficheClient.js).
// `lienDesinscription` : lien « ne plus recevoir nos e-mails » (campagnes).
export function genererEmailOfficielHtml({
  entreprise,
  corps,
  poleInfo,
  lienRendezVous = null,
  avecPdf = false,
  lienDossier = null,
  lienDesinscription = null,
}) {
  const nom = echapper(entreprise.nom || "votre entreprise");
  const publicFiphfp = determinerCollecteur(entreprise) === "FIPHFP";
  const nomPole = publicFiphfp ? "Pôle FIPHFP" : "Pôle OETH / AGEFIPH";
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
        ${
          publicFiphfp
            ? "▸ Pour un employeur public, la contribution est versée <strong>uniquement au FIPHFP</strong>, lors de la déclaration annuelle de l'obligation d'emploi."
            : "▸ La contribution OETH se déclare dans votre DSN et se règle <strong>uniquement auprès de l'URSSAF</strong> (ou de la MSA)."
        }
      </p>
      <p style="margin:0 0 6px;font-size:12px;line-height:1.55;color:${GRIS};">
        ▸ Le ${nomPole} ne vous demandera <strong>jamais</strong> de paiement, ni vos codes d'accès ou coordonnées bancaires.
      </p>
      <p style="margin:0;font-size:12px;line-height:1.55;color:${GRIS};">
        ▸ En cas de doute sur une sollicitation : <a href="${SITE_URL}/vitrine/vigilance" style="color:${BLEU};">${SITE_URL.replace(/^https?:\/\//, "")}/vitrine/vigilance</a>
      </p>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;background:#f1f5f9;">
    <p style="margin:0;font-size:11px;line-height:1.5;color:${GRIS_CLAIR};">
      ${avecPdf ? "Ce message et sa pièce jointe sont" : "Ce message est"} une information du ${nomPole}. ${avecPdf ? "Ils ne constituent" : "Il ne constitue"}
      ${
        publicFiphfp
          ? "ni une notification officielle du FIPHFP, ni un appel de contribution, ni un document émanant du FIPHFP."
          : "ni une notification officielle de l'URSSAF, ni un avis de recouvrement, ni un document émanant de l'AGEFIPH ; seule l'URSSAF est compétente pour notifier et recouvrer la contribution OETH."
      }
      Si vous avez reçu ce message par erreur, merci de nous en informer à ${echapper(poleInfo.email)}.
    </p>
    ${
      lienDesinscription
        ? `<p style="margin:6px 0 0;font-size:11px;color:${GRIS_CLAIR};">Vous ne souhaitez plus recevoir nos e-mails ? <a href="${echapper(lienDesinscription)}" style="color:${GRIS_CLAIR};text-decoration:underline;">Se désinscrire</a></p>`
        : ""
    }
    <p style="margin:6px 0 0;font-size:10px;color:#94a3b8;">Réf. ${reference}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// Mail de création de compte envoyé par un admin (voir creerUtilisateurParAdmin
// dans auth.js) : même bandeau/logo que genererEmailOfficielHtml ci-dessus,
// mais contenu dédié aux identifiants de connexion plutôt qu'au message libre
// d'un agent à une entreprise.
export function genererEmailCreationCompteHtml({ utilisateur, appUrl, motDePasseProvisoire, dureeLienMinutes, espace = null }) {
  const prenom = echapper(utilisateur.prenom || "");
  const nomAffiche = echapper([utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") || utilisateur.email);
  const theme = themeCompte(espace);
  const marque = echapper(theme.marque);

  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${marque}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:680px;max-width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

  <tr><td style="padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td height="6" style="height:6px;background:${theme.couleur};font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <tr><td align="center" style="padding:22px 24px 16px;">
    ${theme.logo ? `<img src="${SITE_URL}/logo-oeth.png" width="56" height="56" alt="${marque}" style="display:block;border:0;border-radius:50%;margin:0 auto 10px;">` : ""}
    <div style="font-size:22px;font-weight:700;color:${theme.couleur};">${marque}</div>
  </td></tr>

  <tr><td align="center" style="background:${theme.couleur};padding:20px 24px;">
    <div style="font-size:19px;font-weight:700;color:#ffffff;line-height:1.35;">Bienvenue${prenom ? ` ${prenom}` : ""} !</div>
    <div style="font-size:13px;color:#dbeafe;margin-top:4px;">Votre accès au CRM vient d'être créé</div>
  </td></tr>

  <tr><td style="padding:28px 32px 8px;">
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${GRIS};">Bonjour ${prenom || nomAffiche},</p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${GRIS};">Un accès au CRM vient d'être créé pour vous. Voici vos identifiants de connexion :</p>

    <div style="padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid ${theme.couleur};border-radius:6px;margin:0 0 18px;">
      <p style="margin:0 0 8px;font-size:13px;color:${GRIS};"><strong>E-mail :</strong> ${echapper(utilisateur.email)}</p>
      <p style="margin:0;font-size:13px;color:${GRIS};"><strong>Mot de passe provisoire :</strong> <span style="font-family:'Courier New',monospace;background:#e2e8f0;padding:2px 6px;border-radius:4px;">${echapper(motDePasseProvisoire)}</span></p>
    </div>

    <div style="padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;margin:0 0 22px;">
      <p style="margin:0;font-size:12px;line-height:1.55;color:#92400e;"><strong>Important :</strong> il vous sera demandé de choisir votre propre mot de passe à la première connexion.</p>
    </div>

    <div style="text-align:center;margin:0 0 8px;">
      ${bouton(appUrl, "Se connecter au CRM", true, theme.couleur)}
    </div>
    <p style="margin:10px 0 22px;text-align:center;font-size:12px;color:${GRIS_CLAIR};">
      Vous pouvez aussi vous rendre sur ${echapper(appUrl)} et indiquer cette adresse mail pour recevoir un lien de connexion valable ${dureeLienMinutes} minutes.
    </p>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;background:#f1f5f9;">
    <p style="margin:0;font-size:11px;line-height:1.5;color:${GRIS_CLAIR};">Si vous n'attendiez pas ce message, vous pouvez l'ignorer en toute sécurité.</p>
    <p style="margin:6px 0 0;font-size:11px;color:${GRIS_CLAIR};">Message automatique — merci de ne pas y répondre directement.</p>
    <p style="margin:6px 0 0;font-size:11px;color:${GRIS_CLAIR};">${marque}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// Petite mise en page partagée par les deux mails ci-dessous (lien de
// connexion / confirmation d'accès) : juste un bandeau de marque, un message
// et un bouton — pas d'identifiants à afficher, contrairement à
// genererEmailCreationCompteHtml ci-dessus.
function emailAccesSimpleHtml({ titre, sousTitre, paragraphesHtml, lienBouton, texteBouton, pied, espace }) {
  const theme = themeCompte(espace);
  const marque = echapper(theme.marque);
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${marque}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:680px;max-width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

  <tr><td style="padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td height="6" style="height:6px;background:${theme.couleur};font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <tr><td align="center" style="padding:22px 24px 16px;">
    ${theme.logo ? `<img src="${SITE_URL}/logo-oeth.png" width="56" height="56" alt="${marque}" style="display:block;border:0;border-radius:50%;margin:0 auto 10px;">` : ""}
    <div style="font-size:22px;font-weight:700;color:${theme.couleur};">${marque}</div>
  </td></tr>

  <tr><td align="center" style="background:${theme.couleur};padding:20px 24px;">
    <div style="font-size:19px;font-weight:700;color:#ffffff;line-height:1.35;">${echapper(titre)}</div>
    ${sousTitre ? `<div style="font-size:13px;color:#dbeafe;margin-top:4px;">${echapper(sousTitre)}</div>` : ""}
  </td></tr>

  <tr><td style="padding:28px 32px 8px;">
    ${paragraphesHtml}
    <div style="text-align:center;margin:0 0 8px;">
      ${bouton(lienBouton, texteBouton, true, theme.couleur)}
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;background:#f1f5f9;">
    <p style="margin:0;font-size:11px;line-height:1.5;color:${GRIS_CLAIR};">${pied || "Si vous n'attendiez pas ce message, vous pouvez l'ignorer en toute sécurité."}</p>
    <p style="margin:6px 0 0;font-size:11px;color:${GRIS_CLAIR};">Message automatique — merci de ne pas y répondre directement.</p>
    <p style="margin:6px 0 0;font-size:11px;color:${GRIS_CLAIR};">${marque}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// Mail du lien magique (voir envoyerLienMagique dans auth.js) : envoyé à
// chaque connexion sans mot de passe. `espace` : voir themeCompte ci-dessus —
// absent ou ambigu (compte à plusieurs espaces) retombe sur l'habillage OETH.
export function genererEmailLienConnexionHtml({ lien, dureeLienMinutes, espace = null }) {
  return emailAccesSimpleHtml({
    titre: "Votre lien de connexion",
    sousTitre: `Valable ${dureeLienMinutes} minutes`,
    paragraphesHtml: `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${GRIS};">Bonjour,<br><br>Cliquez sur le bouton ci-dessous pour vous connecter au CRM.</p>`,
    lienBouton: lien,
    texteBouton: "Se connecter",
    pied: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.",
    espace,
  });
}

// Mail de confirmation quand un admin valide une demande d'accès en attente
// (voir envoyerConfirmationAcces dans auth.js) — pas encore de jeton à ce
// stade, juste où aller en demander un.
export function genererEmailConfirmationAccesHtml({ utilisateur, appUrl, dureeLienMinutes, espace = null }) {
  const prenom = echapper(utilisateur.prenom || "");
  return emailAccesSimpleHtml({
    titre: `Votre accès a été validé${prenom ? `, ${prenom} !` : " !"}`,
    sousTitre: null,
    paragraphesHtml: `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${GRIS};">Votre demande d'accès au CRM vient d'être validée par l'administrateur.<br><br>Pour vous connecter, indiquez votre adresse mail sur la page de connexion : vous recevrez un lien valable ${dureeLienMinutes} minutes.</p>`,
    lienBouton: appUrl,
    texteBouton: "Se connecter au CRM",
    espace,
  });
}

// Mail « votre espace AcademTrade est prêt » (voir envoyerLienAcces dans
// academtradeAuth.js) — même mise en page que les mails d'accès CRM
// ci-dessus, habillage violet dédié (voir THEMES_COMPTE_PAR_ESPACE). Rappel
// pédagogique encadré : le client ne doit jamais croire qu'un argent réel
// est engagé à ce stade.
export function genererEmailAcademtradeAccesHtml({ compte, lien }) {
  const prenom = echapper(compte.prenom || "");
  return emailAccesSimpleHtml({
    titre: "Votre espace AcademTrade est prêt",
    sousTitre: "Formation trading",
    paragraphesHtml: `
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${GRIS};">Bonjour${prenom ? ` ${prenom}` : ""},<br><br>Votre paiement est confirmé, votre espace personnel AcademTrade vous attend. Choisissez votre mot de passe pour y accéder :</p>
      <div style="padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;margin:0 0 22px;">
        <p style="margin:0;font-size:12px;line-height:1.55;color:#92400e;"><strong>Rappel :</strong> nous sommes dans la phase pédagogique de la formation — les positions et le solde affichés dans votre espace sont simulés, aucun argent réel n'est investi sur un marché à ce stade.</p>
      </div>`,
    lienBouton: lien,
    texteBouton: "Choisir mon mot de passe",
    espace: { id: "academtrade" },
  });
}

// Même mise en page « officielle » que ci-dessus, pour l'espace CEE (voir
// espaces.js) : bandeau Eco Smart France au lieu du pôle OETH/AGEFIPH, pas de
// bouton de calcul de contribution (pas de simulateur CEE dans le CRM pour
// l'instant — seulement la prise de rendez-vous), pas de synthèse PDF, et des
// mentions propres au dispositif CEE. Ne JAMAIS écrire « mandataire CEE » ici
// tant que ce statut n'est pas confirmé pour Eco Smart France (voir
// scriptVente.js, SECTIONS_CEE).
export function genererEmailOfficielHtmlCee({ entreprise, corps, poleInfo, lienRendezVous = null, lienDesinscription = null }) {
  const nom = echapper(entreprise.nom || "votre exploitation");
  const maintenant = new Date();
  const reference = `CEE-${maintenant.getTime().toString(36).toUpperCase()}`;
  const dateEnvoi = maintenant.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });
  const lienConseiller =
    lienRendezVous || `mailto:${poleInfo.email}?subject=${encodeURIComponent(`Rendez-vous CEE — ${entreprise.nom || ""}`)}`;

  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Eco Smart France</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:680px;max-width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

  <tr><td style="padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td height="6" style="height:6px;background:${VERT};font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <tr><td align="center" style="padding:22px 24px 16px;">
    <div style="font-size:22px;font-weight:700;color:${VERT};">Eco Smart France</div>
    <div style="font-size:12px;color:${GRIS_CLAIR};margin-top:4px;">Certificats d'Économies d'Énergie (CEE)</div>
  </td></tr>

  <tr><td align="center" style="background:${VERT};padding:20px 24px;">
    <div style="font-size:19px;font-weight:700;color:#ffffff;line-height:1.35;">Votre dossier CEE</div>
    <div style="font-size:14px;color:#dcfce7;margin-top:4px;">${nom}</div>
    <div style="font-size:11px;color:#86efac;margin-top:8px;">Réf. ${reference} · envoyé le ${dateEnvoi}</div>
  </td></tr>

  <tr><td style="padding:28px 32px 8px;">
    ${commenceParSalutation(corps) ? "" : `<p style="margin:0 0 16px;font-size:14px;font-weight:700;color:${VERT};">Madame, Monsieur,</p>`}
    ${paragraphes(corps)}

    <div style="margin:24px 0 8px;text-align:center;">
      ${bouton(lienConseiller, "Parler à un conseiller", true, VERT)}
    </div>
    <p style="margin:6px 0 22px;text-align:center;font-size:12px;color:${GRIS_CLAIR};">
      ${lienRendezVous ? "Choisissez votre créneau, du lundi au vendredi de 9 h à 17 h 30.<br>" : ""}${echapper(poleInfo.email)} · ${echapper(poleInfo.telephone)}
    </p>
  </td></tr>

  <tr><td style="padding:0 32px 24px;">
    <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <div style="font-size:13px;font-weight:700;color:#b91c1c;margin-bottom:6px;">Informations importantes</div>
      <p style="margin:0 0 6px;font-size:12px;line-height:1.55;color:${GRIS};">
        ▸ Les Certificats d'Économies d'Énergie (CEE) sont financés par les fournisseurs d'énergie soumis à une obligation d'économies d'énergie — pas par un organisme public.
      </p>
      <p style="margin:0 0 6px;font-size:12px;line-height:1.55;color:${GRIS};">
        ▸ Eco Smart France ne vous demandera <strong>jamais</strong> de paiement, ni vos codes d'accès ou coordonnées bancaires.
      </p>
      <p style="margin:0;font-size:12px;line-height:1.55;color:${GRIS};">
        ▸ Ce message n'est ni un document officiel d'un organisme public, ni une obligation d'accepter une offre.
      </p>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;background:#f1f5f9;">
    <p style="margin:0;font-size:11px;line-height:1.5;color:${GRIS_CLAIR};">
      Ce message est une information d'Eco Smart France. Il ne constitue ni une notification officielle, ni un document émanant d'un organisme public. Si vous avez reçu ce message par erreur, merci de nous en informer à ${echapper(poleInfo.email)}.
    </p>
    ${
      lienDesinscription
        ? `<p style="margin:6px 0 0;font-size:11px;color:${GRIS_CLAIR};">Vous ne souhaitez plus recevoir nos e-mails ? <a href="${echapper(lienDesinscription)}" style="color:${GRIS_CLAIR};text-decoration:underline;">Se désinscrire</a></p>`
        : ""
    }
    <p style="margin:6px 0 0;font-size:10px;color:#94a3b8;">Réf. ${reference}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
