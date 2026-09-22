import { STATUTS } from "../constants.js";

export default function StatCard({ statut, count, active, onClick }) {
  const info = STATUTS[statut] || { label: statut };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-xl border p-3 min-w-[110px] text-left transition
        ${active ? "border-slate-900 shadow-md bg-white" : "border-slate-200 bg-white hover:shadow-sm"}`}
    >
      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${info.badge}`}>
        {info.label}
      </span>
      <span className="text-2xl font-bold text-slate-800">{count}</span>
    </button>
  );
}
