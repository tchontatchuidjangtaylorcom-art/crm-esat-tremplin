import { STATUTS } from "../constants.js";

export default function StatCard({ statut, count, active, onClick }) {
  const info = STATUTS[statut] || { label: statut };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition
        ${
          active
            ? "border-slate-900 dark:border-slate-100 shadow-md bg-white dark:bg-slate-800"
            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-sm"
        }`}
    >
      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${info.badge}`}>
        {info.label}
      </span>
      <span className="text-base font-bold text-slate-800 dark:text-slate-100">{count}</span>
    </button>
  );
}
