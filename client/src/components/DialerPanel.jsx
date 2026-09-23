import { useState } from "react";
import { useDialer } from "../telephony/DialerContext.jsx";
import { STATUTS } from "../constants.js";

const SEGMENTS_DISPONIBLES = ["nouveau", "nrp"];

function Stat({ label, valeur, classe }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${classe}`}>{valeur}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
    </div>
  );
}

// Power Dialer : cible les profils "Nouveau"/"NRP" parmi les entreprises
// actuellement filtrées (secteur/lot/recherche), enchaîne les appels sans
// réponse automatiquement, et met le contrôle à l'agent dès qu'un prospect
// décroche (voir DialerContext pour la machine à états complète).
export default function DialerPanel({ entreprises }) {
  const { actif, enPause, file, dernierAppele, stats, demarrer, arreter, reprendre } = useDialer();
  const [segments, setSegments] = useState(SEGMENTS_DISPONIBLES);
  const [ouvert, setOuvert] = useState(false);

  const cibles = entreprises.filter((e) => segments.includes(e.statut) && e.contact?.telephone);
  const sessionTerminee = !actif && stats.appels > 0;
  const enSonnerie = actif && !enPause;

  function basculerSegment(s) {
    setSegments((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <div className="mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between"
      >
        <span>
          📞 Power Dialer
          {actif && (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-normal">
              {enPause ? "en pause" : "composition en cours"} — {file.length} restant{file.length > 1 ? "s" : ""}
            </span>
          )}
          {sessionTerminee && (
            <span className="ml-2 text-slate-500 dark:text-slate-400 font-normal">— session terminée</span>
          )}
        </span>
        <span className="text-slate-400 dark:text-slate-500">{ouvert ? "▲" : "▼"}</span>
      </button>

      {ouvert && (
        <div className="px-4 pb-4 space-y-4">
          <div className="flex flex-wrap gap-4">
            {SEGMENTS_DISPONIBLES.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={segments.includes(s)}
                  onChange={() => basculerSegment(s)}
                  disabled={actif}
                  className="rounded border-slate-300"
                />
                {STATUTS[s]?.label}
              </label>
            ))}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {cibles.length} prospect{cibles.length > 1 ? "s" : ""} avec un numéro, dans la liste filtrée actuelle
            (secteur / lot / recherche).
          </p>

          {sessionTerminee && (
            <div className="grid grid-cols-4 gap-2 pb-1">
              <Stat label="Appels" valeur={stats.appels} classe="text-slate-700 dark:text-slate-200" />
              <Stat label="Décrochés" valeur={stats.decroches} classe="text-emerald-600 dark:text-emerald-400" />
              <Stat label="Sans réponse" valeur={stats.sansReponse} classe="text-orange-600 dark:text-orange-400" />
              <Stat label="RDV générés" valeur={stats.rdv} classe="text-blue-600 dark:text-blue-400" />
            </div>
          )}

          {!actif && (
            <button
              onClick={() => demarrer(cibles)}
              disabled={cibles.length === 0}
              className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium px-4 py-2 disabled:opacity-40"
            >
              {sessionTerminee ? "Démarrer une nouvelle session" : "Démarrer le Power Dialer"} ({cibles.length})
            </button>
          )}

          {actif && (
            <div className="flex flex-wrap items-center gap-3">
              {enPause ? (
                <button
                  onClick={reprendre}
                  className="rounded-lg bg-emerald-600 text-white text-sm font-medium px-4 py-2"
                >
                  Appeler le suivant
                </button>
              ) : (
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {enSonnerie ? "Composition en cours…" : ""}
                </span>
              )}
              <button
                onClick={arreter}
                className="rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium px-4 py-2"
              >
                Arrêter le Power Dialer
              </button>
              {dernierAppele && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Dernier composé : {dernierAppele.nom}
                </span>
              )}
            </div>
          )}

          {actif && (
            <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <Stat label="Appels" valeur={stats.appels} classe="text-slate-700 dark:text-slate-200" />
              <Stat label="Décrochés" valeur={stats.decroches} classe="text-emerald-600 dark:text-emerald-400" />
              <Stat label="Sans réponse" valeur={stats.sansReponse} classe="text-orange-600 dark:text-orange-400" />
              <Stat label="RDV générés" valeur={stats.rdv} classe="text-blue-600 dark:text-blue-400" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
