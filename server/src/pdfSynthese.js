// Génère un PDF de synthèse OETH joint automatiquement aux mails envoyés
// depuis les modèles (voir index.js, route /entreprises/:id/emails/envoyer).
//
// Ce document est une ESTIMATION INFORMATIVE établie par le pôle à partir des
// effectifs déclarés par l'entreprise elle-même — il ne remplace pas et ne
// prétend pas être une notification officielle de l'URSSAF ou de l'AGEFIPH
// (voir le disclaimer en pied de page). Le bandeau tricolore en tête est un
// simple repère visuel "France" pour la crédibilité institutionnelle du
// document ; volontairement, aucun emblème de l'État (Marianne, "RF",
// bloc-marque ministériel) n'est utilisé, le pôle n'étant pas un service de
// l'État — voir la note en tête de modelesMails.js sur le retrait des
// mécanismes de fausse autorité déjà identifiés dans ce projet.
import PDFDocument from "pdfkit";

const BLEU = "#1e3a8a";
const BLEU_CLAIR = "#eff6ff";
const GRIS_TEXTE = "#334155";
const GRIS_CLAIR = "#64748b";
const VERT = "#15803d";
const ROUGE = "#b91c1c";

// N'utilise pas `toLocaleString("fr-FR")` : ses séparateurs de milliers sont
// des espaces insécables fines (U+202F), absentes de l'encodage WinAnsi des
// polices de base PDFKit (Helvetica...) et rendues comme un caractère cassé.
function formatMontant(n) {
  const entier = Math.round(n || 0);
  const avecEspaces = entier.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${avecEspaces} €`;
}

function formatDateFr(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

// `entreprise` : fiche brute (nom, adresse, effectif...). `oeth` : résultat
// de calculerObligationOeth() pour cette entreprise. `poleInfo` : { email,
// telephone, adressePostale }. Signature de pied de page normalisée et
// uniforme (identité générale du pôle uniquement) — jamais de nom d'agent
// individuel, même logique que client/src/mailSignature.js côté mail.
export function genererSynthesePdf({ entreprise, oeth, poleInfo }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const largeurPage = doc.page.width;
    const largeurUtile = largeurPage - 100;

    // Bandeau tricolore (repère visuel, voir note en tête de fichier).
    const tiers = largeurPage / 3;
    doc.rect(0, 0, tiers, 8).fill("#0055A4");
    doc.rect(tiers, 0, tiers, 8).fill("#FFFFFF");
    doc.rect(tiers * 2, 0, tiers, 8).fill("#EF4135");

    // En-tête pôle.
    doc
      .fillColor(BLEU)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("Pôle OETH / AGEFIPH", 50, 32);
    doc
      .fillColor(GRIS_CLAIR)
      .font("Helvetica")
      .fontSize(8.5)
      .text("Mission d'accompagnement à l'obligation d'emploi des travailleurs handicapés", 50, 54, { width: 300 });

    doc
      .fillColor(GRIS_CLAIR)
      .font("Helvetica")
      .fontSize(8.5)
      .text(`${poleInfo.adressePostale}\n${poleInfo.email}  ·  ${poleInfo.telephone}`, largeurPage - 250, 32, {
        width: 200,
        align: "right",
      });

    doc
      .moveTo(50, 90)
      .lineTo(largeurPage - 50, 90)
      .strokeColor("#cbd5e1")
      .lineWidth(1)
      .stroke();

    // Titre du document.
    doc
      .fillColor(BLEU)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Synthèse de situation — Obligation d'Emploi des Travailleurs Handicapés (OETH)", 50, 108, {
        width: largeurUtile,
      });
    doc
      .fillColor(GRIS_CLAIR)
      .font("Helvetica")
      .fontSize(8.5)
      .text(`Document établi le ${formatDateFr(new Date().toISOString())}`, 50, doc.y + 4);

    // Bloc entreprise destinataire.
    let y = doc.y + 16;
    const hauteurBloc = 66;
    doc.roundedRect(50, y, largeurUtile, hauteurBloc, 4).fill(BLEU_CLAIR);
    doc
      .fillColor("#1e293b")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(entreprise.nom || "Entreprise", 65, y + 10, { width: largeurUtile - 30 });
    const adresseLigne = [entreprise.adresse, [entreprise.codePostal, entreprise.ville].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(" — ");
    doc
      .fillColor(GRIS_TEXTE)
      .font("Helvetica")
      .fontSize(9)
      .text(adresseLigne || "Adresse non renseignée", 65, y + 27, { width: largeurUtile - 30 });
    if (entreprise.siret) {
      doc.text(`SIRET : ${entreprise.siret}`, 65, y + 42);
    }

    // Tableau des indicateurs OETH.
    y = y + hauteurBloc + 24;
    const statutLabel = oeth.conforme ? "Conforme" : oeth.assujetti ? "Non conforme — contribution due" : "Non assujetti";
    const statutCouleur = oeth.conforme ? VERT : oeth.assujetti ? ROUGE : GRIS_TEXTE;

    const lignes = [
      ["Effectif déclaré", `${entreprise.effectif ?? "-"} salarié(s)`],
      ["Seuil d'assujettissement OETH", `${oeth.seuilAssujettissement} salariés`],
      ["Unités bénéficiaires requises (6 %)", `${oeth.unitesRequises}`],
      ["Travailleurs handicapés déjà employés", `${oeth.beneficiairesRecrutes}`],
      ["Déficit d'unités bénéficiaires", `${oeth.deficit}`],
    ];

    doc.font("Helvetica-Bold").fontSize(10).fillColor(BLEU).text("Indicateurs", 50, y);
    y += 18;

    const largeurCol1 = largeurUtile * 0.62;
    for (const [libelle, valeur] of lignes) {
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(GRIS_TEXTE)
        .text(libelle, 50, y, { width: largeurCol1 });
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor("#1e293b")
        .text(valeur, 50 + largeurCol1, y, { width: largeurUtile - largeurCol1, align: "right" });
      y += 16;
      doc
        .moveTo(50, y - 4)
        .lineTo(largeurPage - 50, y - 4)
        .strokeColor("#e2e8f0")
        .lineWidth(0.5)
        .stroke();
    }

    // Statut + montant, mis en avant.
    y += 8;
    doc.roundedRect(50, y, largeurUtile, 54, 4).fill("#f8fafc");
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(statutCouleur)
      .text(`Statut : ${statutLabel}`, 65, y + 10);
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(BLEU)
      .text(`Montant estimé de la contribution : ${formatMontant(oeth.montantEstime)}`, 65, y + 28, {
        width: largeurUtile - 30,
      });

    y += 54 + 20;

    // Disclaimer — évite toute confusion avec un document officiel URSSAF/AGEFIPH.
    doc
      .font("Helvetica-Oblique")
      .fontSize(8)
      .fillColor(GRIS_CLAIR)
      .text(
        "Ce document est une estimation informative établie par le Pôle OETH/AGEFIPH à partir des effectifs déclarés par l'entreprise. " +
          "Il ne constitue ni une notification officielle de l'URSSAF, ni un avis de recouvrement, ni un document émanant de l'AGEFIPH ; " +
          "seule l'URSSAF est compétente pour notifier et recouvrer la contribution OETH.",
        50,
        y,
        { width: largeurUtile }
      );

    // Pied de page — signature normalisée du pôle (pas de nom d'agent).
    const yPied = doc.page.height - 90;
    doc
      .moveTo(50, yPied)
      .lineTo(largeurPage - 50, yPied)
      .strokeColor("#cbd5e1")
      .lineWidth(1)
      .stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(GRIS_TEXTE)
      .text("— Pôle OETH / AGEFIPH", 50, yPied + 10);
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(GRIS_CLAIR)
      .text(`${poleInfo.email}  ·  ${poleInfo.telephone}  ·  ${poleInfo.adressePostale}`, 50, yPied + 24);

    doc.end();
  });
}
