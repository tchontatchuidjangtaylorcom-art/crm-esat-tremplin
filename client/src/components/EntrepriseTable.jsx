import StatusBadge from "./StatusBadge.jsx";
import { formatMontant, formatDate } from "../constants.js";
import BoutonAppel from "../telephony/BoutonAppel.jsx";

function OethCell({ oeth }) {
  if (!oeth?.assujetti) {
    return <span className="text-xs text-slate-400 italic">Non assujetti (&lt; 20 sal.)</span>;
  }
  if (oeth.conforme) {
    return <span className="text-xs font-medium text-green-700">Conforme (0 UB manquante)</span>;
  }
  return (
    <div>
      <span className={`text-xs font-semibold ${oeth.surcontribution ? "text-red-700" : "text-orange-700"}`}>
        {oeth.deficit} UB manquante{oeth.deficit > 1 ? "s" : ""} / {oeth.unitesRequises}
      </span>
      {oeth.surcontribution && <span className="block text-[11px] text-red-500">Surcontribution (0 recruté)</span>}
    </div>
  );
}

export default function EntrepriseTable({ entreprises, estAdmin, agents, onAssigner }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
            <th className="px-4 py-3 text-left">Société</th>
            <th className="px-4 py-3 text-left">Statut</th>
            <th className="px-4 py-3 text-left">Secteur</th>
            <th className="px-4 py-3 text-left">Effectif</th>
            <th className="px-4 py-3 text-left">Obligation OETH</th>
            <th className="px-4 py-3 text-left">Montant estimé</th>
            <th className="px-4 py-3 text-left">Contact</th>
            <th className="px-4 py-3 text-left">CP</th>
            <th className="px-4 py-3 text-left">Commentaire récent</th>
            {estAdmin && <th className="px-4 py-3 text-left">Assigné à</th>}
            <th className="px-4 py-3 text-left">Appel</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {entreprises.map((e) => {
            const dernierCommentaire = e.commentaires?.[0]?.texte;
            return (
              <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                  <a
                    href={`/entreprise/${e.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline hover:text-blue-700 dark:hover:text-blue-400"
                    title="Ouvrir la fiche dans un nouvel onglet"
                  >
                    {e.nom}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge statut={e.statut} />
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {e.secteurActivite}
                  <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                    {e.categorie?.label}
                    {e.lot ? ` · ${e.lot}` : ""}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.effectif}</td>
                <td className="px-4 py-3">
                  <OethCell oeth={e.oeth} />
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                  {e.oeth?.assujetti ? formatMontant(e.oeth.montantEstime) : "-"}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {e.contact?.nom && e.contact.nom !== "-" && <span className="block">{e.contact.nom}</span>}
                  <BoutonAppel entreprise={e} variant="lien" />
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.codePostal}</td>
                <td
                  className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[220px] truncate"
                  title={dernierCommentaire}
                >
                  {dernierCommentaire || "-"}
                </td>
                {estAdmin && (
                  <td className="px-4 py-3">
                    <select
                      value={e.assigneA || ""}
                      onChange={(ev) => onAssigner?.(e.id, ev.target.value || null)}
                      className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs px-2 py-1"
                    >
                      <option value="">Non assigné</option>
                      {agents?.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.prenom || a.email}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="px-4 py-3">
                  <BoutonAppel entreprise={e} variant="icone" />
                </td>
              </tr>
            );
          })}
          {entreprises.length === 0 && (
            <tr>
              <td colSpan={estAdmin ? 11 : 10} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                Aucune entreprise pour ce filtre.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
