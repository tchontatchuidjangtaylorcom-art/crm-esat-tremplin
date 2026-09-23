import { api } from "../api.js";
import { useContenuAide } from "../useContenuAide.js";

// Trame d'appel type (ouverture → clôture), à garder sous les yeux pendant
// l'appel. Contenu chargé depuis le serveur, mis en cache par useContenuAide.
export default function ScriptVenteContenu() {
  const { data, erreur } = useContenuAide("script-vente", api.getScriptVente);

  if (erreur) return <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>;
  if (!data) return <p className="text-sm text-slate-400 dark:text-slate-500">Chargement du script…</p>;

  return (
    <div className="space-y-5 text-sm">
      {data.sections.map((s) => (
        <div key={s.titre}>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1.5">{s.titre}</h3>
          <div className="space-y-1.5">
            {s.lignes.map((l, i) => (
              <p key={i} className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {l}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
