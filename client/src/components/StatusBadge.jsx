import { STATUTS } from "../constants.js";

export default function StatusBadge({ statut }) {
  const info = STATUTS[statut] || { label: statut, badge: "bg-gray-100 text-gray-700 border border-gray-300" };
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${info.badge}`}>
      {info.label}
    </span>
  );
}
