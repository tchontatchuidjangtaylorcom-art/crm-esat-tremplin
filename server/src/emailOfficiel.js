// Mise en page "officielle" des e-mails envoyés aux entreprises depuis le CRM
// (bandeau du pôle, titre, message de l'agent personnalisé au nom de
// l'entreprise, récapitulatif chiffré contribution / surcontribution, boutons
// "Faire ma simulation" et "Parler à un conseiller", informations de
// sécurité, mentions). Même esprit que les e-mails transactionnels bancaires :
// sobre et sérieux, SANS usurper d'autorité — aucun emblème de l'État, aucun
// terme de type "avis" ou "notification", et le rappel explicite que seule
// l'URSSAF (ou la MSA) déclare et recouvre la contribution (voir la même
// règle dans pdfSynthese.js et modelesMails.js).
//
// HTML d'e-mail : tableaux et styles en ligne uniquement (Gmail, Outlook et
// les clients mobiles ignorent les feuilles de style et les mises en page
// modernes).
import { SITE_URL } from "./seo.js";

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

function montant(n) {
  return `${Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;
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

function ligne(libelle, valeur, fort = false) {
  return `<tr>
    <td style="padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:${GRIS};">${libelle}</td>
    <td align="right" style="padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:${fort ? "700" : "600"};">${valeur}</td>
  </tr>`;
}

function bouton(href, texte, plein) {
  return `<a href="${echapper(href)}" style="display:inline-block;margin:6px 6px 0 0;padding:12px 22px;border-radius:6px;font-size:14px;font-weight:700;text-decoration:none;${
    plein ? `background:${BLEU};color:#ffffff;border:1px solid ${BLEU};` : `background:#ffffff;color:${BLEU};border:1px solid ${BLEU};`
  }">${texte}</a>`;
}

// `entreprise` : fiche ; `oeth` : calculerObligationOeth(entreprise) ;
// `corps` : texte rédigé par l'agent ; `poleInfo` : { email, telephone }.
export function genererEmailOfficielHtml({ entreprise, oeth, corps, poleInfo }) {
  const nom = echapper(entreprise.nom || "votre entreprise");
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
  const effectif = Number(entreprise.effectif) || 0;
  const smic = oeth.tauxHoraireSmic;
  const avecDeficit = oeth.assujetti && oeth.deficit > 0;
  const aucunBeneficiaire = !Number(oeth.beneficiairesRecrutes);
  const coefClassique = effectif <= 249 ? 400 : effectif <= 749 ? 500 : 600;
  const contribution = Math.round(oeth.deficit * coefClassique * smic);
  const surcontribution = Math.round(oeth.deficit * 1500 * smic);
  const lienSimulation = `${SITE_URL}/vitrine#simulateur`;
  const lienConseiller = `mailto:${poleInfo.email}?subject=${encodeURIComponent(`Analyse OETH — ${entreprise.nom || ""}`)}`;

  const recap = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;">
      ${ligne("Effectif retenu (à confirmer)", `${effectif.toLocaleString("fr-FR")} salariés`)}
      ${ligne("Obligation d'emploi (6 %)", `${oeth.unitesRequises} bénéficiaire${oeth.unitesRequises > 1 ? "s" : ""}`)}
      ${ligne(
        aucunBeneficiaire
          ? `Bénéficiaires déjà employés<br><span style="font-size:11px;color:${GRIS_CLAIR};">Vous en avez recruté entre-temps ? Même un seul fait baisser les montants.</span>`
          : "Bénéficiaires déjà employés",
        aucunBeneficiaire ? "0 (à confirmer)" : `${oeth.beneficiairesRecrutes}`
      )}
      ${ligne("Unités manquantes", `${oeth.deficit}`, true)}
    </table>`;

  // 0 bénéficiaire déclaré : c'est ce chiffre qui fait basculer vers la
  // surcontribution — on le dit clairement, avec la porte de sortie simple.
  const alerteSurcontribution =
    avecDeficit && aucunBeneficiaire
      ? `
    <div style="margin:10px 0 8px;padding:12px 14px;background:#fff7ed;border:1px solid #fdba74;border-left:4px solid #ea580c;border-radius:6px;">
      <div style="font-size:13px;font-weight:700;color:#9a3412;">Avec 0 bénéficiaire déclaré, c'est la surcontribution qui risque de s'appliquer.</div>
      <div style="font-size:12px;line-height:1.55;color:#7c2d12;margin-top:4px;">
        Elle peut être évitée : un seul bénéficiaire employé, une sous-traitance d'au moins 600 × SMIC auprès d'une
        EA / d'un ESAT / d'un TIH, ou un accord agréé suffit à revenir à la contribution classique. Un conseiller peut vous
        aider à vérifier votre situation et à choisir la solution la plus simple — l'échange est gratuit.
      </div>
    </div>`
      : "";

  const comparatif = avecDeficit
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 6px;border-collapse:separate;border-spacing:0;">
      <tr>
        <td width="50%" valign="top" style="padding:14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px 0 0 6px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${BLEU};">Contribution estimée</div>
          <div style="font-size:22px;font-weight:700;color:${BLEU};margin-top:6px;">${montant(contribution)}</div>
          <div style="font-size:12px;color:${GRIS_CLAIR};margin-top:4px;">${oeth.deficit} × ${coefClassique} h × SMIC</div>
        </td>
        <td width="50%" valign="top" style="padding:14px;background:#fffbeb;border:1px solid #fcd34d;border-left:0;border-radius:0 6px 6px 0;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#92400e;">Surcontribution possible</div>
          <div style="font-size:22px;font-weight:700;color:#92400e;margin-top:6px;">${montant(surcontribution)}</div>
          <div style="font-size:12px;color:#92400e;margin-top:4px;">${oeth.deficit} × 1 500 h × SMIC</div>
        </td>
      </tr>
    </table>
    ${alerteSurcontribution}
    <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${GRIS_CLAIR};">
      La surcontribution s'applique si, sur les 4 dernières années, aucune action n'a été menée (aucun bénéficiaire employé,
      pas de sous-traitance EA / ESAT / TIH d'au moins 600 × SMIC, pas d'accord agréé). Montants avant déductions éventuelles.
    </p>`
    : `<p style="margin:10px 0 6px;font-size:14px;font-weight:700;color:#15803d;">D'après ces informations, votre quota est atteint : aucune contribution n'est due.</p>`;

  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pôle OETH / AGEFIPH</title></head>
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
    <img src="${SITE_URL}/logo-192.png" width="52" height="52" alt="" style="display:block;border:0;border-radius:10px;margin:0 auto 10px;">
    <div style="font-size:22px;font-weight:700;color:${BLEU};">Pôle OETH / AGEFIPH</div>
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

    <div style="margin:22px 0 0;padding:16px 18px;border:1px solid #e2e8f0;border-radius:8px;">
      <div style="font-size:13px;font-weight:700;color:${BLEU};margin-bottom:4px;">Récapitulatif — ${nom}</div>
      ${recap}
      ${comparatif}
      <p style="margin:6px 0 0;font-size:12px;font-style:italic;color:${GRIS_CLAIR};">
        Estimation établie à partir des informations dont nous disposons à ce jour, détaillée dans la synthèse PDF jointe.
        Un échange avec vous nous permettra de la confirmer et de la mettre à jour.
      </p>
    </div>

    <div style="margin:24px 0 8px;text-align:center;">
      ${bouton(lienSimulation, "Faire ma simulation gratuite", true)}
      ${bouton(lienConseiller, "Parler à un conseiller", false)}
    </div>
    <p style="margin:6px 0 22px;text-align:center;font-size:12px;color:${GRIS_CLAIR};">
      ${echapper(poleInfo.email)} · ${echapper(poleInfo.telephone)}
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
      Ce message et sa pièce jointe sont une estimation informative établie par le Pôle OETH / AGEFIPH à partir des informations
      communiquées par l'entreprise. Ils ne constituent ni une notification officielle de l'URSSAF, ni un avis de recouvrement,
      ni un document émanant de l'AGEFIPH ; seule l'URSSAF est compétente pour notifier et recouvrer la contribution OETH.
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
