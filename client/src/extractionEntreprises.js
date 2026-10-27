// Extraction des entreprises à importer depuis un fichier ou un texte collé :
// SIREN / SIRET (9 ou 14 chiffres, espaces tolérés) en priorité, sinon nom
// d'entreprise (retrouvé ensuite dans le répertoire Sirene côté serveur).
// Formats : Excel (.xlsx, .xls), OpenDocument (.ods), CSV, texte, Word
// (.docx). Les bibliothèques de lecture ne sont chargées qu'à l'usage.

const MOTIF_NUMERO = /(?<!\d)(\d{3}\s?\d{3}\s?\d{3}(?:\s?\d{5})?)(?!\d)/;
// En-têtes de colonne probables pour le nom d'entreprise.
const ENTETE_NOM = /raison|soci[eé]t[eé]|entreprise|d[eé]nomination|nom|company|client|structure/i;
const ENTETE_A_IGNORER = /^(siren|siret|nom|raison sociale|soci[eé]t[eé]|entreprise|d[eé]nomination|company|t[eé]l[eé]phone|email|adresse|ville|code postal|cp)$/i;

// Colonnes de contact optionnelles (exports type Kompass/Societeinfo…) :
// reprises TELLES QUELLES si présentes, pour éviter une recherche IA inutile
// (coût) sur une fiche dont le fichier source donne déjà le téléphone/e-mail —
// voir server/src/importFichier.js, qui ne met en file que les fiches
// encore incomplètes après application de ces colonnes. "dirigeant"/"direct"
// est préféré à un e-mail générique de standard quand les deux existent.
// Pas d'ancrage "^" : les en-têtes réels varient ("Téléphone" aussi bien que
// "Numéro de téléphone") — testé contre un vrai export Kompass, un ancrage en
// début de chaîne ratait "Numéro de téléphone".
const ENTETE_EMAIL = /e-?mail/i;
const ENTETE_EMAIL_DIRECT = /dirigeant|direct/i;
const ENTETE_TELEPHONE = /t[eé]l[eé]phone|\bphone\b/i;
const ENTETE_PRENOM = /^pr[eé]nom\b/i;
// Match EXACT (pas juste un préfixe) : "Nom" tout court désigne le contact,
// mais "Nom de l'entreprise"/"Nom du contact" commencent aussi par "Nom" —
// un préfixe captait à tort la colonne société (même bug constaté en test).
const ENTETE_CONTACT_NOM = /^nom$/i;
const ENTETE_FONCTION = /^fonction\b/i;

function nettoyer(texte) {
  return String(texte ?? "").replace(/\s+/g, " ").trim();
}

// Repère les colonnes de contact dans la ligne d'en-têtes — index à -1 si
// absentes (fichier sans ces colonnes, ou texte collé sans en-tête).
function colonnesContact(entete) {
  if (!entete) return {};
  // E-mail : deux colonnes possibles (direct dirigeant + générique société) —
  // les DEUX index sont gardés, `depuisValeurs` essaie le direct en premier
  // ligne par ligne (un export peut avoir le direct vide sur une ligne mais
  // rempli sur une autre, et inversement pour le générique).
  let iEmailDirect = -1;
  let iEmailGeneral = -1;
  let iTelephone = -1;
  let iPrenom = -1;
  let iNomContact = -1;
  let iFonction = -1;
  for (let i = 0; i < entete.length; i++) {
    const c = String(entete[i] ?? "");
    if (ENTETE_EMAIL.test(c)) {
      if (ENTETE_EMAIL_DIRECT.test(c)) {
        if (iEmailDirect === -1) iEmailDirect = i;
      } else if (iEmailGeneral === -1) {
        iEmailGeneral = i;
      }
    }
    if (iTelephone === -1 && ENTETE_TELEPHONE.test(c)) iTelephone = i;
    if (iPrenom === -1 && ENTETE_PRENOM.test(c)) iPrenom = i;
    if (iNomContact === -1 && ENTETE_CONTACT_NOM.test(c)) iNomContact = i;
    if (iFonction === -1 && ENTETE_FONCTION.test(c)) iFonction = i;
  }
  return { iEmailDirect, iEmailGeneral, iTelephone, iPrenom, iNomContact, iFonction };
}

// Une ligne (texte ou cellules) → { siren } ou { nom } ou null, avec en plus
// email/telephone/contactNom/contactFonction quand les colonnes existent.
function depuisValeurs(valeurs, indexColonneNom = -1, colonnes = {}) {
  let base = null;
  for (const v of valeurs) {
    const m = String(v ?? "").match(MOTIF_NUMERO);
    if (m) {
      base = { siren: m[1].replace(/\s/g, "") };
      break;
    }
  }
  if (!base) {
    const candidats = indexColonneNom >= 0 ? [valeurs[indexColonneNom]] : valeurs;
    for (const v of candidats) {
      const t = nettoyer(v);
      if (t.length >= 2 && t.length <= 120 && /[a-zA-ZÀ-ÿ]/.test(t) && !ENTETE_A_IGNORER.test(t) && !/@/.test(t)) {
        base = { nom: t };
        break;
      }
    }
  }
  if (!base) return null;

  const champ = (i, max = 180) => {
    if (i == null || i < 0) return null;
    const t = nettoyer(valeurs[i]);
    return t && t.length <= max ? t : null;
  };
  const email = champ(colonnes.iEmailDirect) || champ(colonnes.iEmailGeneral);
  const telephone = champ(colonnes.iTelephone, 40);
  const prenom = champ(colonnes.iPrenom, 60);
  // N'extrait le "Nom" comme contact que si un prénom l'accompagne — sinon
  // c'est très probablement la colonne "Nom de l'entreprise" déjà utilisée
  // ci-dessus pour `base`, pas une personne.
  const nomContact = prenom ? champ(colonnes.iNomContact, 60) : null;
  const fonction = champ(colonnes.iFonction, 80);
  if (email && /@/.test(email)) base.email = email;
  if (telephone) base.telephone = telephone;
  if (prenom || nomContact) base.contactNom = [prenom, nomContact].filter(Boolean).join(" ");
  if (fonction) base.contactFonction = fonction;
  return base;
}

// Un export de contacts (type Kompass) liste souvent plusieurs personnes par
// entreprise : on garde une ligne par entreprise, mais en préférant celle qui
// a un e-mail renseigné plutôt que la toute première rencontrée (ex : le
// contact "Président" sans e-mail avant le "DRH" qui en a un).
function dedoublonner(entrees) {
  const parCle = new Map();
  for (const e of entrees) {
    const cle = e.siren ? `s:${e.siren.slice(0, 9)}` : `n:${e.nom.toLowerCase()}`;
    const existant = parCle.get(cle);
    if (!existant || (!existant.email && e.email)) parCle.set(cle, e);
  }
  return [...parCle.values()];
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
  const colonnes = debut > 0 ? colonnesContact(entete) : {};
  return dedoublonner(lignes.slice(debut).map((l) => depuisValeurs(l, indexColonneNom, colonnes)).filter(Boolean));
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
