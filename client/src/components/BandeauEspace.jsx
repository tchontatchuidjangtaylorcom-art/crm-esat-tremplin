import { useEspaces } from "../espace.js";

// Présentation de l'espace affiché, en haut du tableau de bord — sauf pour
// l'espace OETH, que toute l'équipe connaît déjà.
export default function BandeauEspace({ nbFiches = null }) {
  const { espace, estOeth } = useEspaces();
  if (!espace || estOeth) return null;
  return (
    <div className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-800 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Espace de travail</p>
      <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{espace.nom}</p>
      {espace.description && <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{espace.description}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
        Ici, seules les fiches de cet espace apparaissent
        {nbFiches !== null ? ` (${nbFiches} fiche${nbFiches > 1 ? "s" : ""})` : ""}. Les statuts, l'attribution aux agents,
        les rappels, le chat et les KPI fonctionnent comme dans le reste du CRM.
      </p>
    </div>
  );
}
