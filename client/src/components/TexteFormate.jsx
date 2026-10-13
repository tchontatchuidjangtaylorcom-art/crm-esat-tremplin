// Affiche un commentaire comme dans WhatsApp : retours à la ligne conservés,
// *gras*, _italique_, ~barré~, et lignes « 1. … » alignées en liste
// numérotée (le texte qui passe à la ligne reste aligné après le numéro).

// Mise en forme d'une ligne : *gras*, _italique_, ~barré~ (délimiteurs
// collés au texte et en bordure de mot, comme dans WhatsApp — « 3 * 4 » et
// « jean_dupont_rh@… » restent tels quels).
const MOTIF =
  /((?<![\p{L}\p{N}])(?:\*[^\s*](?:[^*\n]*[^\s*])?\*|_[^\s_](?:[^_\n]*[^\s_])?_|~[^\s~](?:[^~\n]*[^\s~])?~)(?![\p{L}\p{N}]))/gu;

function formaterLigne(ligne, cle) {
  const morceaux = ligne.split(MOTIF);
  return morceaux.map((m, i) => {
    if (i % 2 === 0) return m;
    const contenu = m.slice(1, -1);
    if (m[0] === "*") return <strong key={`${cle}-${i}`} className="font-semibold text-slate-800 dark:text-slate-100">{contenu}</strong>;
    if (m[0] === "_") return <em key={`${cle}-${i}`}>{contenu}</em>;
    return <s key={`${cle}-${i}`}>{contenu}</s>;
  });
}

const LIGNE_NUMEROTEE = /^\s*(\d{1,3}[.)])\s+(.*)$/;

export default function TexteFormate({ texte, className = "" }) {
  const lignes = String(texte ?? "").split(/\r?\n/);
  return (
    <div className={`break-words ${className}`}>
      {lignes.map((ligne, i) => {
        const num = ligne.match(LIGNE_NUMEROTEE);
        if (num) {
          return (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 min-w-[1.5rem] text-right tabular-nums">{num[1]}</span>
              <span className="min-w-0">{formaterLigne(num[2], i)}</span>
            </div>
          );
        }
        // Ligne vide : un petit espace, comme un saut de paragraphe.
        if (!ligne.trim()) return <div key={i} className="h-2" />;
        return <div key={i}>{formaterLigne(ligne, i)}</div>;
      })}
    </div>
  );
}
