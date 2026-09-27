import { useEffect, useState } from "react";
import { api } from "../api.js";

// Demande de leads en libre-service (agents) : attribue des fiches non
// assignées du secteur choisi, puis génère le complément depuis Sirene en
// arrière-plan s'il en manque (voir /api/leads/demande côté serveur). Évite
// qu'un agent reste sans fiches quand aucun manager n'est disponible.
export default function DemandeLeads({ categories, onMaj }) {
  const [etat, setEtat] = useState(null);
  const [categorie, setCategorie] = useState("");
  const [departement, setDepartement] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    api.getDemandeLeads().then(setEtat).catch(() => {});
  }, []);

  // Suivi de la génération en arrière-plan.
  useEffect(() => {
    if (!etat?.enCours) return;
    const id = setInterval(async () => {
      try {
        const e = await api.getDemandeLeads();
        setEtat(e);
        onMaj?.();
      } catch {
        // Tick manqué, on retente au prochain intervalle.
      }
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat?.enCours]);

  async function demander(ev) {
    ev.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const e = await api.demanderLeads(categorie, departement.trim());
      setEtat(e);
      onMaj?.();
    } catch (e) {
      setErreur(e.message);
      api.getDemandeLeads().then(setEtat).catch(() => {});
    } finally {
      setEnvoi(false);
    }
  }

  if (!etat) return null;

  const choisissables = (categories || []).filter((c) => c.value !== "autre");
  const bloque = !etat.peutDemander || etat.enCours || envoi;

  return (
    <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-4 py-3">
      <form onSubmit={demander} className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Besoin de nouvelles fiches ?</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {etat.peutDemander
              ? `Recevez ${etat.taille} fiches du secteur de votre choix — générées automatiquement s'il n'en reste plus.`
              : `Encore ${etat.nouveauxNonTraites} fiches « Nouveau » à traiter : nouvelle demande possible sous ${etat.seuil}.`}
          </p>
        </div>

        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Secteur
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            disabled={bloque}
            className="mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 px-3 py-2 disabled:opacity-50"
          >
            <option value="">Tous secteurs (fiches existantes)</option>
            {choisissables.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Département (facultatif)
          <input
            value={departement}
            onChange={(e) => setDepartement(e.target.value)}
            disabled={bloque}
            placeholder="ex : 75"
            maxLength={3}
            className="mt-1 block w-28 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 px-3 py-2 disabled:opacity-50"
          />
        </label>

        <button
          type="submit"
          disabled={bloque}
          className="rounded-lg bg-marine-600 hover:bg-marine-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-40 whitespace-nowrap"
        >
          {etat.enCours || envoi ? "Préparation…" : `Demander ${etat.taille} fiches`}
        </button>
      </form>

      {(etat.enCours || etat.termine) && (
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
          {etat.enCours ? "⏳ " : "✓ "}
          {etat.attribues} fiche{etat.attribues > 1 ? "s" : ""} attribuée{etat.attribues > 1 ? "s" : ""}
          {etat.aGenerer > 0 &&
            ` + ${etat.generes} / ${etat.aGenerer} nouvelle${etat.aGenerer > 1 ? "s" : ""} fiche${
              etat.aGenerer > 1 ? "s" : ""
            } générée${etat.aGenerer > 1 ? "s" : ""}${etat.categorieLabel ? ` (${etat.categorieLabel})` : ""}`}
          {etat.enCours
            ? "…"
            : ". Les numéros sont recherchés automatiquement ; s'il en manque, utilisez « Rechercher sur Google » sur la fiche."}
        </p>
      )}
      {etat.message && <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">{etat.message}</p>}
      {etat.erreur && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{etat.erreur}</p>}
      {erreur && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{erreur}</p>}
    </div>
  );
}
