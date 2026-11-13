import { api } from "../api.js";
import { useContenuAide } from "../useContenuAide.js";

// Boîte à outils consultée au besoin pendant l'appel (pas un script à lire
// dans l'ordre) — voir server/src/scriptVente.js (OBJECTIONS_CEE).
export default function ObjectionsContenu() {
  const { data, erreur } = useContenuAide("objections-vente", api.getObjectionsVente);

  if (erreur) return <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>;
  if (!data) return <p className="text-sm text-slate-400 dark:text-slate-500">Chargement des objections…</p>;
  if (!data.objections.length) return <p className="text-sm text-slate-400 dark:text-slate-500">Aucune objection enregistrée pour cet espace.</p>;

  return (
    <div className="space-y-3 text-sm">
      {data.objections.map((o, i) => (
        <div key={i} className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 px-3 py-2.5">
          <p className="font-semibold text-rose-800 dark:text-rose-300">{o.objection}</p>
          <p className="mt-1 text-slate-700 dark:text-slate-200 leading-relaxed">{o.reponse}</p>
        </div>
      ))}
    </div>
  );
}
