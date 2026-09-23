import { api } from "../api.js";
import { useContenuAide } from "../useContenuAide.js";
import { useIdentiteActuelle } from "../identite.js";

// Trame d'appel type (ouverture → clôture), à garder sous les yeux pendant
// l'appel. Chaque ligne est soit une instruction pour l'agent (italique,
// couleur distincte, non lue au prospect), soit un texte à lire verbatim
// (encadré, bien visible) — le "[Prénom]" y est remplacé par l'agent connecté
// pour que ce soit directement pitchable mot pour mot.
export default function ScriptVenteContenu() {
  const { data, erreur } = useContenuAide("script-vente", api.getScriptVente);
  const { prenom } = useIdentiteActuelle();

  if (erreur) return <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>;
  if (!data) return <p className="text-sm text-slate-400 dark:text-slate-500">Chargement du script…</p>;

  function personnaliser(texte) {
    return texte.replaceAll("[Prénom]", prenom);
  }

  return (
    <div className="space-y-5 text-sm">
      <p className="text-xs text-slate-400 dark:text-slate-500 italic">
        Script personnalisé pour {prenom} — prêt à être lu tel quel.
      </p>
      {data.sections.map((s) => (
        <div key={s.titre}>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">{s.titre}</h3>
          <div className="space-y-2">
            {s.lignes.map((l, i) =>
              l.type === "instruction" ? (
                <p key={i} className="text-xs italic text-amber-700 dark:text-amber-400 flex gap-1.5">
                  <span aria-hidden>🎯</span>
                  <span>{personnaliser(l.texte)}</span>
                </p>
              ) : (
                <p
                  key={i}
                  className="text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-900 border-l-2 border-purple-300 dark:border-purple-800 rounded-r-md px-3 py-2"
                >
                  {personnaliser(l.texte)}
                </p>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
