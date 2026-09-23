import { useState } from "react";
import { useDialer } from "../telephony/DialerContext.jsx";
import { useTelephonie } from "../telephony/CallContext.jsx";
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

// Bascule Manuel / Auto-dialer : les deux modes de téléphonie de l'équipe
// (voir CallContext). Changer de mode arrête une session Power Dialer en
// cours, pour ne jamais laisser l'enchaînement automatique actif alors que
// l'agent est repassé en appel manuel.
function BasculeMode({ mode, setMode, actif, arreter }) {
  function choisir(m) {
    if (m === mode) return;
    if (actif) arreter();
    setMode(m);
  }

  return (
    <div
      onClick={(ev) => ev.stopPropagation()}
      className="inline-flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden text-xs font-medium"
    >
      <button
        onClick={() => choisir("manuel")}
        className={`px-3 py-1.5 ${mode === "manuel" ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
      >
        📱 Manuel / Assisté
      </button>
      <button
        onClick={() => choisir("auto")}
        className={`px-3 py-1.5 ${mode === "auto" ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
      >
        🤖 Auto-dialer (SIP)
      </button>
    </div>
  );
}

// Panneau de téléphonie : bascule entre deux modes distincts (voir cahier des
// charges) —
//  - Manuel / Assisté : les numéros affichés sur les fiches sont de simples
//    liens tel: (téléphone perso/pro de l'agent, Phone Link, FaceTime…),
//    lancés instantanément au clic, sans dépendance VoIP.
//  - Auto-dialer (SIP) : Power Dialer complet, cible les profils
//    "Nouveau"/"NRP" parmi les entreprises actuellement filtrées, enchaîne
//    les appels sans réponse automatiquement, et met le contrôle à l'agent
//    dès qu'un prospect décroche (voir DialerContext pour la machine à
//    états complète). Sert de banc de test pour une passerelle SIP réelle
//    (voir telephony/provider.js) sans dépendre d'un fournisseur particulier.
export default function DialerPanel({ entreprises }) {
  const { actif, enPause, file, dernierAppele, stats, demarrer, arreter, reprendre } = useDialer();
  const { mode, setMode } = useTelephonie();
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
        className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between gap-3"
      >
        <span className="flex-1">
          ☎️ Téléphonie
          {mode === "auto" && actif && (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-normal">
              {enPause ? "en pause" : "composition en cours"} — {file.length} restant{file.length > 1 ? "s" : ""}
            </span>
          )}
          {mode === "auto" && sessionTerminee && (
            <span className="ml-2 text-slate-500 dark:text-slate-400 font-normal">— session terminée</span>
          )}
        </span>
        <BasculeMode mode={mode} setMode={setMode} actif={actif} arreter={arreter} />
        <span className="text-slate-400 dark:text-slate-500">{ouvert ? "▲" : "▼"}</span>
      </button>

      {ouvert && mode === "manuel" && (
        <div className="px-4 pb-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Mode manuel / assisté : cliquez sur un numéro de téléphone dans les fiches pour lancer l'appel
            instantanément depuis votre téléphone (Phone Link, FaceTime, softphone par défaut…). Aucun enchaînement
            automatique — passez en mode <strong>Auto-dialer (SIP)</strong> pour tester le Power Dialer.
          </p>
        </div>
      )}

      {ouvert && mode === "auto" && (
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
