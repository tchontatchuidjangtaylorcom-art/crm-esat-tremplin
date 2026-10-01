import { useState } from "react";

// Distribution en un clic : N fiches non assignées à chaque membre de
// l'équipe (voir server/src/distributionEquipe.js), pour lancer une session
// de travail sans assigner les fiches une à une.
export default function DistributionEquipe({ onDistribue }) {
  const [parPersonne, setParPersonne] = useState(1);
  const [inclureAdmins, setInclureAdmins] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);

  async function distribuer() {
    const n = Math.max(1, Number(parPersonne) || 1);
    if (
      !window.confirm(
        `Donner ${n} fiche${n > 1 ? "s" : ""} non assignée${n > 1 ? "s" : ""} à chaque membre de l'équipe${
          inclureAdmins ? " (administrateurs compris)" : ""
        } ?`
      )
    )
      return;
    setEnCours(true);
    setErreur(null);
    setResultat(null);
    try {
      const res = await fetch("/api/equipe/distribuer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parPersonne: n, inclureAdmins }),
      });
      const donnees = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(donnees.error || `Erreur HTTP ${res.status}`);
      setResultat(donnees);
      onDistribue?.();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mr-auto">👥 Distribuer des fiches à toute l'équipe</p>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          Fiches par personne
          <input
            type="number"
            min="1"
            max="50"
            value={parPersonne}
            onChange={(e) => setParPersonne(e.target.value)}
            className="w-16 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={inclureAdmins} onChange={(e) => setInclureAdmins(e.target.checked)} />
          Administrateurs compris
        </label>
        <button
          type="button"
          onClick={distribuer}
          disabled={enCours}
          className="rounded-lg bg-marine-700 hover:bg-marine-800 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
        >
          {enCours ? "Distribution…" : "Distribuer à tout le monde"}
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Fiches « Nouveau » non assignées, en priorité 20 salariés et plus avec un numéro. Chacun reçoit une fiche avant que
        quiconque n'en reçoive une deuxième.
      </p>
      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
      {resultat && (
        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
          <p className="text-emerald-700 dark:text-emerald-400 font-medium">
            ✓ {resultat.total} fiche{resultat.total > 1 ? "s" : ""} distribuée{resultat.total > 1 ? "s" : ""} à{" "}
            {resultat.repartition.length} personne{resultat.repartition.length > 1 ? "s" : ""}.
          </p>
          {resultat.manque > 0 && (
            <p className="text-amber-600 dark:text-amber-400 text-xs">
              Pas assez de fiches libres : il en manquait {resultat.manque}. Importez ou générez une vague, puis relancez.
            </p>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer">Détail par personne</summary>
            <ul className="mt-1 ml-4 list-disc text-slate-500 dark:text-slate-400">
              {resultat.repartition.map((r) => (
                <li key={r.id}>
                  {r.nom} : {r.fiches.length ? r.fiches.join(", ") : "aucune fiche (plus de fiches libres)"}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
