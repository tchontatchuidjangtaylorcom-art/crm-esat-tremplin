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

function ouiNonTexte(v) {
  return v === true ? "Oui" : v === false ? "Non" : "Non renseigné";
}

function formatNombre(n) {
  const v = Math.round((n || 0) * 100) / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
}

// PDF téléchargé depuis le simulateur public de la vitrine : reprend les
// saisies du visiteur et le résultat de simulerContributionOeth(). Même
// habillage et même disclaimer que la synthèse CRM ci-dessus — estimation
// indicative, jamais un document officiel.
export function genererSimulationPdf({ saisie, simulation, nomEntreprise, poleInfo }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const largeurPage = doc.page.width;
    const largeurUtile = largeurPage - 100;
    const s = simulation;

    const tiers = largeurPage / 3;
    doc.rect(0, 0, tiers, 8).fill("#0055A4");
    doc.rect(tiers, 0, tiers, 8).fill("#FFFFFF");
    doc.rect(tiers * 2, 0, tiers, 8).fill("#EF4135");

    doc.fillColor(BLEU).font("Helvetica-Bold").fontSize(18).text("Pôle OETH / AGEFIPH", 50, 32);
    doc
      .fillColor(GRIS_CLAIR)
      .font("Helvetica")
      .fontSize(8.5)
      .text(`${poleInfo.adressePostale}\n${poleInfo.email}  ·  ${poleInfo.telephone}`, largeurPage - 250, 32, {
        width: 200,
        align: "right",
      });
    doc.moveTo(50, 80).lineTo(largeurPage - 50, 80).strokeColor("#cbd5e1").lineWidth(1).stroke();

    doc
      .fillColor(BLEU)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(`Simulation OETH / DOETH — exercice ${saisie.annee} — synthèse indicative`, 50, 96, { width: largeurUtile });
    doc
      .fillColor(GRIS_CLAIR)
      .font("Helvetica")
      .fontSize(8.5)
      .text(
        `${nomEntreprise ? `${nomEntreprise} · ` : ""}Établie le ${formatDateFr(new Date().toISOString())} · SMIC horaire retenu : ${formatNombre(s.smicHoraire)} €`,
        50,
        doc.y + 4
      );

    // Montant mis en avant.
    let y = doc.y + 14;
    doc.roundedRect(50, y, largeurUtile, 56, 4).fill(BLEU_CLAIR);
    doc.font("Helvetica").fontSize(9).fillColor(GRIS_TEXTE).text("Contribution indicative après déductions", 65, y + 10);
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(s.contributionNette > 0 ? ROUGE : VERT)
      .text(formatMontant(s.contributionNette), 65, y + 26);
    y += 56 + 18;

    // Saut de page si la section ne tient plus au-dessus du pied de page.
    const assurerPlace = (hauteur) => {
      if (y + hauteur > doc.page.height - 115) {
        doc.addPage();
        y = 50;
      }
    };

    const section = (titre, lignes) => {
      assurerPlace(18 + lignes.length * 16);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(BLEU).text(titre, 50, y);
      y += 18;
      const col1 = largeurUtile * 0.62;
      for (const [libelle, valeur] of lignes) {
        doc.font("Helvetica").fontSize(9.5).fillColor(GRIS_TEXTE).text(libelle, 50, y, { width: col1 });
        doc
          .font("Helvetica-Bold")
          .fontSize(9.5)
          .fillColor("#1e293b")
          .text(valeur, 50 + col1, y, { width: largeurUtile - col1, align: "right" });
        y += 16;
        doc.moveTo(50, y - 4).lineTo(largeurPage - 50, y - 4).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
      }
      y += 12;
    };

    section("Données saisies", [
      ["Effectif d'assujettissement", formatNombre(s.effectif)],
      ["BOETH déclarés (effectif moyen annuel)", formatNombre(s.boeth)],
      ["Coût main-d'œuvre sous-traitance EA / ESAT / TIH (HT)", formatMontant(saisie.coutMainOeuvreSousTraitance)],
      ["Salariés ECAP", formatNombre(saisie.nbEcap)],
      ["Dépenses déductibles (HT, total 062 + 063 + 064 + 072)", formatMontant(saisie.depensesDeductibles)],
      [
        "Concerné par la surcontribution (réponse directe)",
        saisie.surcontributionDeclaree === null ? "Déterminé par le simulateur" : ouiNonTexte(saisie.surcontributionDeclaree),
      ],
      ["BOETH employé au cours des 4 dernières années", ouiNonTexte(saisie.aEmployeBoeth4Ans)],
      ...(saisie.aEmployeBoeth4Ans !== null
        ? [
            [
              "Sous-traitance EA / ESAT / TIH >= 600 x SMIC sur 4 ans",
              saisie.sousTraitance4Ans === true && saisie.montantSousTraitance4Ans > 0
                ? `Oui (${formatMontant(saisie.montantSousTraitance4Ans)})`
                : ouiNonTexte(saisie.sousTraitance4Ans),
            ],
            ["Accord agréé applicable", ouiNonTexte(saisie.accordAgree)],
          ]
        : []),
    ]);

    section("Résultat", [
      ["Quota légal (6 %, arrondi inférieur)", formatNombre(s.quota)],
      ["Unités manquantes", formatNombre(s.manque)],
      ["Taux d'emploi direct", `${formatNombre(s.tauxEmploi)} %`],
      ["Coefficient appliqué", s.coefficient ? `${s.coefficient} × SMIC horaire` : "-"],
      ["Contribution brute", formatMontant(s.contributionBrute)],
      [`Déduction sous-traitance (30 %, plafond ${s.deductions.tauxPlafondSousTraitance} %)`, formatMontant(s.deductions.sousTraitance)],
      ["Déduction ECAP (17 × SMIC par salarié)", formatMontant(s.deductions.ecap)],
      ["Autres dépenses retenues (plafond 10 %)", formatMontant(s.deductions.depenses)],
      ["Total des déductions", formatMontant(s.deductions.total)],
      ["Base réglementaire maximale (1 500 × SMIC)", formatMontant(s.baseMaximale)],
      ["Économie estimée vs base maximale", formatMontant(s.economie)],
    ]);

    // Récapitulatif par code DSN (bloc Cotisation établissement S21.G00.82).
    section("Récapitulatif indicatif par code DSN (S21.G00.82)", [
      ["060 - Déduction ECAP", formatMontant(s.deductions.ecap)],
      ["061 - Sous-traitance EA / ESAT / TIH / EPS", formatMontant(s.deductions.sousTraitance)],
      ["062 - Accessibilité (dépense HT)", formatMontant(saisie.depAccessibilite)],
      ["063 - Maintien et reconversion (dépense HT)", formatMontant(saisie.depMaintien)],
      ["064 - Accompagnement, formation, sensibilisation (dépense HT)", formatMontant(saisie.depAccompagnement)],
      ["072 - Partenariats associatifs (dépense HT)", formatMontant(saisie.depPartenariats)],
      ["065 - Contribution brute avant déductions", formatMontant(s.contributionBrute)],
      ["066 - Contribution nette avant écrêtement", formatMontant(s.contributionNette)],
      ["067 - Contribution nette après écrêtement (= 066)", formatMontant(s.contributionNette)],
      ["068 - Contribution réelle due", formatMontant(s.contributionNette)],
    ]);

    if (s.surcontribution) {
      assurerPlace(40);
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(ROUGE)
        .text(
          "Surcontribution : aucune action minimale renseignée (aucun BOETH sur 4 ans, sous-traitance inférieure à 600 × SMIC, pas d'accord agréé) — " +
            "coefficient de 1 500 × SMIC par unité manquante.",
          50,
          y,
          { width: largeurUtile }
        );
      y = doc.y + 12;
    }

    assurerPlace(50);
    doc
      .font("Helvetica-Oblique")
      .fontSize(8)
      .fillColor(GRIS_CLAIR)
      .text(
        "Estimation indicative établie à partir des seules données saisies, selon les règles de droit commun (réforme 2020). " +
          "Elle ne tient pas compte d'un éventuel accord agréé ni de situations particulières et ne constitue ni une notification de l'URSSAF " +
          "ni un document émanant de l'AGEFIPH. La déclaration s'effectue via la DSN ; seule l'URSSAF est compétente pour calculer et recouvrer la contribution.",
        50,
        y,
        { width: largeurUtile }
      );

    if (doc.y > doc.page.height - 105) doc.addPage();
    const yPied = doc.page.height - 90;
    doc.moveTo(50, yPied).lineTo(largeurPage - 50, yPied).strokeColor("#cbd5e1").lineWidth(1).stroke();
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(GRIS_TEXTE).text("— Pôle OETH / AGEFIPH", 50, yPied + 10);
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(GRIS_CLAIR)
      .text(`${poleInfo.email}  ·  ${poleInfo.telephone}  ·  ${poleInfo.adressePostale}`, 50, yPied + 24);

    doc.end();
  });
}
