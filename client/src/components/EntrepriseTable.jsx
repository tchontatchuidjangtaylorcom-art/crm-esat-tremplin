import { useEffect, useRef, useState } from "react";
import StatusBadge from "./StatusBadge.jsx";
import { formatMontant, formatDateHeure } from "../constants.js";
import BoutonAppel from "../telephony/BoutonAppel.jsx";
import { diffuserEntrepriseArchivee } from "../telephony/CallContext.jsx";
import { api } from "../api.js";

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

function EcheanceCell({ entreprise }) {
  const echeance = entreprise.dateRdv || entreprise.dateRappel;
  if (!echeance) return <span className="text-slate-300 dark:text-slate-600">-</span>;
  return (
    <span className="text-xs whitespace-nowrap">
      {entreprise.dateRdv ? "RDV : " : "Rappel : "}
      <strong>{formatDateHeure(echeance)}</strong>
    </span>
  );
}

// Bouton de sortie rapide "Mort" directement depuis la liste — sans avoir à
// passer par un appel ou ouvrir la fiche. Réutilise le même événement DOM que
// le module AGIR (voir CallContext) pour que le tableau de bord retire
// immédiatement la ligne, exactement comme après une sortie via le CallPanel.
function BoutonMarquerMort({ entreprise }) {
  const [enCours, setEnCours] = useState(false);

  async function marquerMort(ev) {
    ev.stopPropagation();
    if (!window.confirm(`Marquer « ${entreprise.nom} » comme mort et retirer du flux actif ?`)) return;
    setEnCours(true);
    try {
      const { entreprise: updated } = await api.enregistrerSortie(entreprise.id, {
        sortie: "mort",
        details: "Sortie rapide depuis le tableau de bord.",
      });
      diffuserEntrepriseArchivee(updated);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <button
      onClick={marquerMort}
      disabled={enCours}
      title="Marquer mort (archive le dossier, hors pipeline actif)"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-700 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-red-950 dark:hover:text-red-400 transition disabled:opacity-40"
    >
      ✕
    </button>
  );
}

// Case à cocher de l'en-tête : coche/décoche toutes les lignes affichées
// (la page courante) et passe à l'état "indéterminé" (trait, ni coché ni
// vide) quand certaines lignes seulement sont sélectionnées — signal visuel
// standard pour "sélection partielle" qu'un simple `checked` ne rend pas.
function CaseTout({ etat, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = etat === "partiel";
  }, [etat]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={etat === "tout"}
      onChange={onChange}
      className="rounded border-slate-300"
      aria-label="Tout sélectionner"
    />
  );
}

export default function EntrepriseTable({
  entreprises,
  estAdmin,
  agents,
  onAssigner,
  selection,
  onToggleSelection,
  onToggleSelectionTout,
}) {
  const nbColonnes = (estAdmin ? 11 : 10) + 1;
  const nbCochees = entreprises.filter((e) => selection.has(e.id)).length;
  const etatToutCoche = entreprises.length > 0 && nbCochees === entreprises.length ? "tout" : nbCochees > 0 ? "partiel" : "aucun";

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
            <th className="px-3 py-2 text-left w-8">
              <CaseTout etat={etatToutCoche} onChange={() => onToggleSelectionTout(entreprises.map((e) => e.id))} />
            </th>
            <th className="px-3 py-2 text-left">Société</th>
            <th className="px-3 py-2 text-left">Statut</th>
            <th className="px-3 py-2 text-left">Échéance</th>
            <th className="px-3 py-2 text-left">Secteur</th>
            <th className="px-3 py-2 text-left">Obligation OETH</th>
            <th className="px-3 py-2 text-left">Montant estimé</th>
            <th className="px-3 py-2 text-left">Contact</th>
            <th className="px-3 py-2 text-left">CP</th>
            <th className="px-3 py-2 text-left">Commentaire récent</th>
            {estAdmin && <th className="px-3 py-2 text-left">Assigné à</th>}
            <th className="px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {entreprises.map((e) => {
            const dernierCommentaire = e.commentaires?.[0]?.texte;
            const coche = selection.has(e.id);
            return (
              <tr
                key={e.id}
                className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${coche ? "bg-marine-50 dark:bg-marine-950/30" : ""}`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={coche}
                    onChange={() => onToggleSelection(e.id)}
                    className="rounded border-slate-300"
                    aria-label={`Sélectionner ${e.nom}`}
                  />
                </td>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                  <a
                    href={`/entreprise/${e.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline hover:text-marine-700 dark:hover:text-marine-300"
                    title="Ouvrir la fiche dans un nouvel onglet"
                  >
                    {e.nom}
                  </a>
                  <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                    {e.effectif} sal. · {e.categorie?.label}
                    {e.lot ? ` · ${e.lot}` : ""}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge statut={e.statut} />
                </td>
                <td className="px-3 py-2">
                  <EcheanceCell entreprise={e} />
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{e.secteurActivite}</td>
                <td className="px-3 py-2">
                  <OethCell oeth={e.oeth} />
                </td>
                <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                  {e.oeth?.assujetti ? formatMontant(e.oeth.montantEstime) : "-"}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {e.contact?.nom && e.contact.nom !== "-" && <span className="block">{e.contact.nom}</span>}
                  <BoutonAppel entreprise={e} variant="lien" />
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{e.codePostal}</td>
                <td
                  className="px-3 py-2 text-slate-500 dark:text-slate-400 max-w-[220px] truncate"
                  title={dernierCommentaire}
                >
                  {dernierCommentaire || "-"}
                </td>
                {estAdmin && (
                  <td className="px-3 py-2">
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
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <BoutonAppel entreprise={e} variant="icone" />
                    <BoutonMarquerMort entreprise={e} />
                  </div>
                </td>
              </tr>
            );
          })}
          {entreprises.length === 0 && (
            <tr>
              <td colSpan={nbColonnes} className="px-3 py-8 text-center text-slate-400 dark:text-slate-500">
                Aucune entreprise pour ce filtre.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
