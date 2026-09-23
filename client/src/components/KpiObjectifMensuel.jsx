// Indicateur de performance : nombre de fiches qualifiées (statut "fiche",
// "fiche one-shot" ou "conforme") obtenues ce mois-ci, face à un objectif de
// prospection cible — valorise le potentiel du pipeline en un coup d'œil.
export default function KpiObjectifMensuel({ valeur, min, max }) {
  const pourcentage = Math.min(100, Math.round((valeur / min) * 100));
  const atteint = valeur >= min;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-2.5 flex items-center gap-4 mb-4">
      <span className="text-xl" aria-hidden>
        🎯
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Objectif du mois — fiches qualifiées
          </span>
          <span className={`text-sm font-bold ${atteint ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-200"}`}>
            {valeur} / {min}-{max}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${atteint ? "bg-green-500" : "bg-orange-400"}`}
            style={{ width: `${pourcentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
