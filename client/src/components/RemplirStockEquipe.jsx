import { useEffect, useState } from "react";
import { TAILLES_EFFECTIF } from "../taillesEffectif.js";

const champ =
  "mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm";

async function appel(url, options) {
  const res = await fetch(url, options);
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Erreur HTTP ${res.status}`);
  return d;
}

// « Remplir le stock de l'équipe » (voir server/src/stockEquipe.js) : génère
// d'un coup jusqu'à 5 000 fiches réparties sur tous les secteurs, dans la
// taille choisie, sans recherche Claude (les agents cherchent les numéros).
// Ensuite : « Distribuer des fiches » pour en donner à chacun.
export default function RemplirStockEquipe({ onImporte }) {
  const [total, setTotal] = useState(1000);
  const [taille, setTaille] = useState("20-249");
  const [territoire, setTerritoire] = useState("metropole");
  const [avecPublic, setAvecPublic] = useState(true);
  const [etat, setEtat] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    appel("/api/equipe/stock/statut").then(setEtat).catch(() => {});
  }, []);

  useEffect(() => {
    if (!etat?.enCours) return;
    const id = setInterval(() => {
      appel("/api/equipe/stock/statut")
        .then((e) => {
          setEtat(e);
          if (!e.enCours) onImporte?.();
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat?.enCours]);

  async function lancer(ev) {
    ev.preventDefault();
    const n = Math.min(Math.max(1, Number(total) || 0), 5000);
    if (!window.confirm(`Générer ${n} nouvelles fiches (${TAILLES_EFFECTIF.find((t) => t.cle === taille)?.label}) sur tous les secteurs ?\nSans recherche Claude : les fiches arrivent sans numéro.`)) return;
    setErreur(null);
    try {
      setEtat(
        await appel("/api/equipe/stock/generer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ total: n, taille, territoire, avecPublic }),
        })
      );
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Génère d'un coup un stock de fiches réparties sur <strong>tous les secteurs</strong> (EHPAD, nettoyage, informatique, sécurité…),
        sans recherche Claude (aucun coût) : les fiches arrivent <strong>sans numéro</strong>, les agents le trouvent avec les liens Google /
        PagesJaunes de la fiche. Ensuite, utilisez « Distribuer des fiches » (jusqu'à 200 par personne).
      </p>
      <form onSubmit={lancer} className="flex flex-wrap items-end gap-3">
        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Nombre de fiches (max 5 000)
          <input type="number" min="1" max="5000" value={total} onChange={(e) => setTotal(e.target.value)} className={`${champ} w-28`} />
        </label>
        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Taille des entreprises
          <select value={taille} onChange={(e) => setTaille(e.target.value)} className={champ}>
            {TAILLES_EFFECTIF.map((t) => (
              <option key={t.cle} value={t.cle}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Territoire
          <select value={territoire} onChange={(e) => setTerritoire(e.target.value)} className={champ}>
            <option value="metropole">France métropolitaine</option>
            <option value="">Métropole + outre-mer</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 pb-2">
          <input type="checkbox" checked={avecPublic} onChange={(e) => setAvecPublic(e.target.checked)} />
          Inclure les mairies / services publics
        </label>
        <button
          type="submit"
          disabled={etat?.enCours}
          className="rounded-lg bg-marine-700 hover:bg-marine-800 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
        >
          {etat?.enCours ? "Génération en cours…" : "🚀 Remplir le stock"}
        </button>
      </form>
      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
      {etat?.demarre && (
        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
          <p className={etat.enCours ? "" : "text-emerald-700 dark:text-emerald-400 font-medium"}>
            {etat.enCours ? "⏳ " : "✓ "}
            {etat.crees} / {etat.total} fiches créées ({etat.taille})
            {etat.enCours && etat.secteurEnCours ? ` — en cours : ${etat.secteurEnCours}` : ""}
            {etat.erreurs ? ` · ${etat.erreurs} erreur(s)` : ""}
          </p>
          {etat.enCours && (
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-marine-600" style={{ width: `${Math.min(100, (etat.crees / Math.max(1, etat.total)) * 100)}%` }} />
            </div>
          )}
          {etat.message && <p className="text-xs text-amber-700 dark:text-amber-400">{etat.message}</p>}
          {Object.keys(etat.parSecteur || {}).length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer">Détail par secteur</summary>
              <ul className="mt-1 ml-4 list-disc text-slate-500 dark:text-slate-400">
                {Object.entries(etat.parSecteur).map(([s, n]) => (
                  <li key={s}>
                    {s} : {n}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
