// Extraction des entreprises à importer depuis un fichier ou un texte collé :
// SIREN / SIRET (9 ou 14 chiffres, espaces tolérés) en priorité, sinon nom
// d'entreprise (retrouvé ensuite dans le répertoire Sirene côté serveur).
// Formats : Excel (.xlsx, .xls), OpenDocument (.ods), CSV, texte, Word
// (.docx). Les bibliothèques de lecture ne sont chargées qu'à l'usage.

const MOTIF_NUMERO = /(?<!\d)(\d{3}\s?\d{3}\s?\d{3}(?:\s?\d{5})?)(?!\d)/;
// En-têtes de colonne probables pour le nom d'entreprise.
const ENTETE_NOM = /raison|soci[eé]t[eé]|entreprise|d[eé]nomination|nom|company|client|structure/i;
const ENTETE_A_IGNORER = /^(siren|siret|nom|raison sociale|soci[eé]t[eé]|entreprise|d[eé]nomination|company|t[eé]l[eé]phone|email|adresse|ville|code postal|cp)$/i;

function nettoyer(texte) {
  return String(texte ?? "").replace(/\s+/g, " ").trim();
}

// Une ligne (texte ou cellules) → { siren } ou { nom } ou null.
function depuisValeurs(valeurs, indexColonneNom = -1) {
  for (const v of valeurs) {
    const m = String(v ?? "").match(MOTIF_NUMERO);
    if (m) return { siren: m[1].replace(/\s/g, "") };
  }
  const candidats = indexColonneNom >= 0 ? [valeurs[indexColonneNom]] : valeurs;
  for (const v of candidats) {
    const t = nettoyer(v);
    if (t.length >= 2 && t.length <= 120 && /[a-zA-ZÀ-ÿ]/.test(t) && !ENTETE_A_IGNORER.test(t) && !/@/.test(t)) {
      return { nom: t };
    }
  }
  return null;
}

function dedoublonner(entrees) {
  const vus = new Set();
  return entrees.filter((e) => {
    const cle = e.siren ? `s:${e.siren.slice(0, 9)}` : `n:${e.nom.toLowerCase()}`;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

export function extraireDepuisTexte(texte) {
  return dedoublonner(
    String(texte || "")
      .split(/\r?\n/)
      .map((ligne) => depuisValeurs(ligne.split(/[;\t|]/)))
      .filter(Boolean)
  );
}

function extraireDepuisLignes(lignes) {
  // Repère la colonne "raison sociale / entreprise" dans la première ligne.
  const entete = (lignes[0] || []).map((c) => String(c ?? ""));
  const indexColonneNom = entete.findIndex((c) => ENTETE_NOM.test(c) && !/siren|siret/i.test(c));
  const debut = indexColonneNom >= 0 ? 1 : 0;
  return dedoublonner(lignes.slice(debut).map((l) => depuisValeurs(l, indexColonneNom)).filter(Boolean));
}

export async function extraireDepuisFichier(fichier) {
  const nom = fichier.name.toLowerCase();
  if (/\.(xlsx|xlsm|xls|ods)$/.test(nom)) {
    const XLSX = await import("xlsx");
    const classeur = XLSX.read(await fichier.arrayBuffer(), { type: "array" });
    const lignes = classeur.SheetNames.flatMap((f) =>
      XLSX.utils.sheet_to_json(classeur.Sheets[f], { header: 1, raw: false, defval: "" })
    );
    return extraireDepuisLignes(lignes);
  }
  if (/\.csv$/.test(nom)) {
    const XLSX = await import("xlsx");
    const classeur = XLSX.read(await fichier.text(), { type: "string" });
    const feuille = classeur.Sheets[classeur.SheetNames[0]];
    return extraireDepuisLignes(XLSX.utils.sheet_to_json(feuille, { header: 1, raw: false, defval: "" }));
  }
  if (/\.docx$/.test(nom)) {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await fichier.arrayBuffer());
    const xml = (await zip.file("word/document.xml")?.async("string")) || "";
    // Paragraphes et lignes de tableau → une ligne ; cellules → séparateur.
    const texte = xml
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"');
    return extraireDepuisTexte(texte);
  }
  if (/\.(txt|tsv|text)$/.test(nom) || fichier.type.startsWith("text/")) {
    return extraireDepuisTexte(await fichier.text());
  }
  throw new Error("Format non pris en charge : utilisez Excel (.xlsx, .xls), .ods, .csv, .txt ou Word (.docx).");
}
