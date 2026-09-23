// Génère le rapport PDF téléchargeable depuis une fiche entreprise (bouton
// "Télécharger le rapport PDF") — document sobre aux couleurs du pôle,
// reprenant les indicateurs OETH ET le suivi de prospection (statut,
// historique d'appels/commentaires/mails).
//
// Volontairement un fichier DISTINCT de pdfSynthese.js (le PDF joint
// automatiquement aux mails envoyés au prospect) : celui-là expose un suivi
// interne (issues d'appel, notes internes, historique de relance) qui n'a
// rien à faire dans un document envoyé au prospect lui-même — mélanger les
// deux risquerait de partager des notes internes ("NRP x3", "argumentaire à
// pousser sur X") avec l'entreprise démarchée. Ce rapport-ci est pensé pour
// l'agent/l'admin : impression, archivage, ou envoi à un partenaire du pôle.
import PDFDocument from "pdfkit";

const BLEU = "#1e3a8a";
const BLEU_CLAIR = "#eff6ff";
const GRIS_TEXTE = "#334155";
const GRIS_CLAIR = "#64748b";
const VERT = "#15803d";
const ROUGE = "#b91c1c";
const VIOLET = "#7c3aed";

const LIBELLES_STATUT = {
  nouveau: "Nouveau",
  a_relancer: "À relancer",
  nrp: "NRP (non répondant)",
  me_rappelle: "Le contact doit rappeler",
  a_rappeler: "À rappeler",
  rdv: "Rendez-vous",
  mail: "Relance par mail",
  autre: "Autre",
  fiche: "Fiche → atelier",
  fiche_one_shot: "Fiche one-shot → atelier",
  conforme: "Conforme — dossier réglé",
  refus: "Refus (dossier clos)",
  mort: "Mort (dossier clos)",
};

function formatMontant(n) {
  const entier = Math.round(n || 0);
  const avecEspaces = entier.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${avecEspaces} €`;
}

function formatDateFr(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateHeureFr(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Fusionne appels, commentaires et mails en une seule chronologie, la plus
// récente en tête — même logique que le fil d'activité côté client
// (EntrepriseDetail.jsx), reconstruite ici côté serveur pour le PDF.
function construireHistorique(entreprise) {
  const appels = (entreprise.historiqueAppels || []).map((h) => ({
    date: h.date,
    titre: h.issueLabel || h.issue || "Appel",
    detail: h.details || null,
  }));
  const commentaires = (entreprise.commentaires || []).map((c) => ({
    date: c.date,
    titre: `Note — ${c.auteur || "Agent"}`,
    detail: c.texte,
  }));
  return [...appels, ...commentaires].sort((a, b) => new Date(b.date) - new Date(a.date));
}

// `entreprise` : fiche complète (brute + calculs). `oeth` : résultat de
// calculerObligationOeth(). `categorie` : classifierSecteur() de l'entreprise.
// `poleInfo` : { email, telephone, adressePostale }. `genereParNom` : agent
// qui télécharge le rapport (affiché en pied de page).
export function genererRapportPdf({ entreprise, oeth, categorie, poleInfo, genereParNom }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const largeurPage = doc.page.width;
    const largeurUtile = largeurPage - 100;
    const margeBas = 70;

    // Ajoute une nouvelle page avec le même bandeau/en-tête que la première,
    // pour que l'historique puisse s'étaler sur plusieurs pages proprement.
    function nouvellePage() {
      doc.addPage();
      dessinerBandeau();
      return 60;
    }

    function dessinerBandeau() {
      const tiers = largeurPage / 3;
      doc.rect(0, 0, tiers, 8).fill("#0055A4");
      doc.rect(tiers, 0, tiers, 8).fill("#FFFFFF");
      doc.rect(tiers * 2, 0, tiers, 8).fill("#EF4135");
    }

    // Vérifie l'espace restant avant d'écrire un bloc de `hauteur` px ;
    // change de page si nécessaire, en renvoyant la position Y à utiliser.
    function assurerEspace(yCourant, hauteur) {
      if (yCourant + hauteur > doc.page.height - margeBas) {
        return nouvellePage();
      }
      return yCourant;
    }

    dessinerBandeau();

    // En-tête pôle.
    doc.fillColor(BLEU).font("Helvetica-Bold").fontSize(18).text("Pôle OETH / AGEFIPH", 50, 32);
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
    doc.moveTo(50, 90).lineTo(largeurPage - 50, 90).strokeColor("#cbd5e1").lineWidth(1).stroke();

    // Titre du document.
    doc
      .fillColor(BLEU)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Rapport de suivi — Prospection & Obligation d'Emploi (OETH)", 50, 108, { width: largeurUtile });
    doc
      .fillColor(GRIS_CLAIR)
      .font("Helvetica")
      .fontSize(8.5)
      .text(`Document généré le ${formatDateFr(new Date().toISOString())}`, 50, doc.y + 4);

    // Bloc identité entreprise.
    let y = doc.y + 16;
    const hauteurBloc = 82;
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
    doc.text(
      `SIRET : ${entreprise.siret || "-"}    ·    Secteur : ${categorie?.label || "-"}` +
        (entreprise.secteurActivite ? ` (${entreprise.secteurActivite})` : ""),
      65,
      y + 42,
      { width: largeurUtile - 30 }
    );
    doc.text(
      `Forme juridique : ${entreprise.formeJuridique || "-"}    ·    Collecteur : ${
        entreprise.secteurPublic ? "FIPHFP" : "AGEFIPH"
      }`,
      65,
      y + 57,
      { width: largeurUtile - 30 }
    );

    // Statut de prospection actuel.
    y = y + hauteurBloc + 16;
    doc.roundedRect(50, y, largeurUtile, 46, 4).fill("#faf5ff");
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(VIOLET).text("Statut de prospection", 65, y + 8);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#1e293b")
      .text(LIBELLES_STATUT[entreprise.statut] || entreprise.statut || "-", 65, y + 22);
    const infosComplement = [
      entreprise.lot ? `Vague : ${entreprise.lot}` : null,
      entreprise.dateRappel ? `Rappel prévu : ${formatDateFr(entreprise.dateRappel)}` : null,
      entreprise.dateRdv ? `RDV : ${formatDateFr(entreprise.dateRdv)}` : null,
    ]
      .filter(Boolean)
      .join("    ·    ");
    if (infosComplement) {
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(GRIS_CLAIR)
        .text(infosComplement, 65 + 200, y + 22, { width: largeurUtile - 230, align: "right" });
    }

    // Tableau des indicateurs OETH.
    y += 46 + 20;
    const statutOethLabel = oeth.conforme
      ? "Conforme"
      : oeth.assujetti
        ? "Non conforme — contribution due"
        : "Non assujetti";
    const statutOethCouleur = oeth.conforme ? VERT : oeth.assujetti ? ROUGE : GRIS_TEXTE;

    doc.font("Helvetica-Bold").fontSize(10).fillColor(BLEU).text("Indicateurs OETH", 50, y);
    y += 18;

    const lignes = [
      ["Effectif déclaré", `${entreprise.effectif ?? "-"} salarié(s)`],
      ["Seuil d'assujettissement OETH", `${oeth.seuilAssujettissement} salariés`],
      ["Unités bénéficiaires requises (6 %)", `${oeth.unitesRequises}`],
      ["Travailleurs handicapés déjà employés", `${oeth.beneficiairesRecrutes}`],
      ["Déficit d'unités bénéficiaires", `${oeth.deficit}`],
    ];
    const largeurCol1 = largeurUtile * 0.62;
    for (const [libelle, valeur] of lignes) {
      doc.font("Helvetica").fontSize(9.5).fillColor(GRIS_TEXTE).text(libelle, 50, y, { width: largeurCol1 });
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor("#1e293b")
        .text(valeur, 50 + largeurCol1, y, { width: largeurUtile - largeurCol1, align: "right" });
      y += 16;
      doc.moveTo(50, y - 4).lineTo(largeurPage - 50, y - 4).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
    }

    y += 8;
    doc.roundedRect(50, y, largeurUtile, 54, 4).fill("#f8fafc");
    doc.font("Helvetica-Bold").fontSize(10).fillColor(statutOethCouleur).text(`Statut : ${statutOethLabel}`, 65, y + 10);
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(BLEU)
      .text(`Montant estimé de la contribution : ${formatMontant(oeth.montantEstime)}`, 65, y + 28, {
        width: largeurUtile - 30,
      });

    y += 54 + 26;

    // Historique de prospection (appels, notes, mails) — limité aux 25
    // entrées les plus récentes pour garder un document synthétique et
    // exploitable en présentation, pas un export brut de toute la base.
    const MAX_ENTREES = 25;
    const historique = construireHistorique(entreprise).slice(0, MAX_ENTREES);

    y = assurerEspace(y, 30);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BLEU).text("Historique de prospection", 50, y);
    y += 6;
    if (entreprise.contact?.nom && entreprise.contact.nom !== "-") {
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(GRIS_CLAIR)
        .text(
          `Contact : ${entreprise.contact.nom}${entreprise.contact.fonction && entreprise.contact.fonction !== "-" ? ` (${entreprise.contact.fonction})` : ""}`,
          largeurUtile - 200 + 50,
          y,
          { width: 200, align: "right" }
        );
    }
    y += 16;

    if (historique.length === 0) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor(GRIS_CLAIR).text("Aucun historique enregistré à ce jour.", 50, y);
      y += 16;
    }

    for (const entree of historique) {
      const detail = (entree.detail || "").slice(0, 220);
      const hauteurEstimee = 30 + (detail ? Math.ceil(detail.length / 95) * 11 : 0);
      y = assurerEspace(y, hauteurEstimee);

      doc.font("Helvetica-Bold").fontSize(9).fillColor("#1e293b").text(entree.titre, 50, y, { width: largeurUtile - 130 });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(GRIS_CLAIR)
        .text(formatDateHeureFr(entree.date), largeurPage - 180, y, { width: 130, align: "right" });
      y += 13;
      if (detail) {
        doc.font("Helvetica").fontSize(8.5).fillColor(GRIS_TEXTE).text(detail, 50, y, { width: largeurUtile });
        y = doc.y + 6;
      } else {
        y += 6;
      }
      doc.moveTo(50, y).lineTo(largeurPage - 50, y).strokeColor("#f1f5f9").lineWidth(0.5).stroke();
      y += 10;
    }

    // Disclaimer.
    y = assurerEspace(y, 40);
    doc
      .font("Helvetica-Oblique")
      .fontSize(7.5)
      .fillColor(GRIS_CLAIR)
      .text(
        "Rapport de suivi interne du Pôle OETH/AGEFIPH. Les montants indiqués sont une estimation informative établie à partir des " +
          "effectifs déclarés ; ils ne constituent ni une notification officielle de l'URSSAF, ni un document émanant de l'AGEFIPH.",
        50,
        y,
        { width: largeurUtile }
      );

    // Pied de page sur la dernière page.
    const yPied = doc.page.height - 55;
    doc.moveTo(50, yPied).lineTo(largeurPage - 50, yPied).strokeColor("#cbd5e1").lineWidth(1).stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(GRIS_CLAIR)
      .text(
        `Généré par ${genereParNom || "Pôle OETH / AGEFIPH"} · ${poleInfo.email} · ${poleInfo.telephone}`,
        50,
        yPied + 10
      );

    doc.end();
  });
}
