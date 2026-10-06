import { useEffect, useState } from "react";
import { api } from "../api.js";

// Rendre des fiches au pool général : symétrique de "Demander des fiches"
// (DemandeLeads.jsx) — un agent qui ne va pas travailler (congé, absence)
// rend ses fiches non traitées plutôt que de les garder sur lui sans y
// toucher ; elles redeviennent disponibles pour n'importe qui (remises en
// Nouveau, voir /api/leads/rendre). N'affiche rien s'il n'a aucune fiche
// rendable. `pourAgent` : { id, prenom } — un administrateur en Mode Manager
// rend des fiches pour l'agent consulté.
export default function RendreLeads({ onMaj, pourAgent = null }) {
  const pourAgentId = pourAgent?.id || null;
  const [parStatut, setParStatut] = useState(null);
  const [statut, setStatut] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);

  function charger() {
    api
      .getRendreLeads(pourAgentId)
      .then((e) => {
        setParStatut(e.parStatut);
        setStatut((actuel) => (e.parStatut.some((s) => s.statut === actuel) ? actuel : e.parStatut[0]?.statut || ""));
      })
      .catch(() => {});
  }

  useEffect(() => {
    setResultat(null);
    setErreur(null);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pourAgentId]);

  async function rendre(ev) {
    ev.preventDefault();
    const choix = parStatut.find((s) => s.statut === statut);
    if (!choix) return;
    if (
      !window.confirm(
        `Rendre ${choix.total} fiche${choix.total > 1 ? "s" : ""} « ${choix.label} »${
          pourAgent ? ` de ${pourAgent.prenom || "cet agent"}` : ""
        } au pool général ? Elles seront remises en Nouveau, sans agent, et n'importe qui pourra les demander.`
      )
    ) {
      return;
    }
    setEnvoi(true);
    setErreur(null);
    setResultat(null);
    try {
      const r = await api.rendreLeads(statut, pourAgentId);
      setResultat(r);
      charger();
      onMaj?.();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (!parStatut || parStatut.length === 0) return null;

  return (
    <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-4 py-3">
      <form onSubmit={rendre} className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {pourAgent ? `Rendre des fiches de ${pourAgent.prenom || "cet agent"}` : "Indisponible ? Rendez vos fiches non traitées"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Elles redeviennent disponibles pour n'importe qui (remises en Nouveau, sans agent).
          </p>
        </div>

        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Statut à rendre
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
            disabled={envoi}
            className="mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 px-3 py-2 disabled:opacity-50"
          >
            {parStatut.map((s) => (
              <option key={s.statut} value={s.statut}>
                {s.label} ({s.total})
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={envoi}
          className="rounded-lg border border-marine-600 text-marine-700 dark:text-marine-300 hover:bg-marine-50 dark:hover:bg-marine-950/40 text-sm font-medium px-4 py-2 disabled:opacity-40 whitespace-nowrap"
        >
          {envoi ? "Envoi…" : `Rendre ${parStatut.find((s) => s.statut === statut)?.total || 0} fiches`}
        </button>
      </form>

      {resultat && (
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
          ✓ {resultat.rendues} fiche{resultat.rendues > 1 ? "s" : ""} « {resultat.statut} » rendue{resultat.rendues > 1 ? "s" : ""} au pool général.
        </p>
      )}
      {erreur && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{erreur}</p>}
    </div>
  );
}
