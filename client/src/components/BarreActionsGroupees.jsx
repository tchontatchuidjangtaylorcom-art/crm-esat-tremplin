import { useState } from "react";
import { STATUTS } from "../constants.js";

// Barre d'action qui apparaît dès qu'une ou plusieurs entreprises sont
// cochées dans le tableau — assignation et changement de statut en masse,
// pour ne pas avoir à rouvrir chaque fiche une par une. L'assignation reste
// réservée aux administrateurs (même règle que l'assignation individuelle) ;
// le changement de statut est ouvert à tout agent, limité à sa propre
// sélection visible côté serveur.
export default function BarreActionsGroupees({
  nbSelectionnes,
  nbFiltre,
  estAdmin,
  agents,
  onAssigner,
  onChangerStatut,
  onSelectionnerToutFiltre,
  onViderSelection,
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  if (nbSelectionnes === 0) return null;

  async function executer(action) {
    setEnCours(true);
    setErreur(null);
    try {
      await action();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-marine-300 dark:border-marine-700 bg-marine-50 dark:bg-marine-950/40 px-4 py-2.5 text-sm">
      <span className="font-semibold text-marine-800 dark:text-marine-300 whitespace-nowrap">
        {nbSelectionnes} sélectionnée{nbSelectionnes > 1 ? "s" : ""}
      </span>

      {nbSelectionnes < nbFiltre && (
        <button
          onClick={onSelectionnerToutFiltre}
          disabled={enCours}
          className="text-xs text-marine-700 dark:text-marine-300 hover:underline disabled:opacity-40"
        >
          Sélectionner les {nbFiltre} résultats filtrés
        </button>
      )}

      <button
        onClick={onViderSelection}
        disabled={enCours}
        className="text-xs text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-40"
      >
        Tout désélectionner
      </button>

      <div className="flex-1" />

      {estAdmin && (
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          Assigner à
          <select
            defaultValue=""
            disabled={enCours}
            onChange={(ev) => {
              const valeur = ev.target.value;
              ev.target.value = "";
              if (!valeur) return;
              executer(() => onAssigner(valeur === "aucun" ? null : valeur));
            }}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-xs disabled:opacity-40"
          >
            <option value="" disabled>
              Choisir un agent…
            </option>
            <option value="aucun">Retirer l'assignation</option>
            {agents?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.prenom || a.email} {a.role === "admin" ? "(admin)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        Changer le statut
        <select
          defaultValue=""
          disabled={enCours}
          onChange={(ev) => {
            const valeur = ev.target.value;
            ev.target.value = "";
            if (!valeur) return;
            if (
              ["conforme", "refus", "mort"].includes(valeur) &&
              !window.confirm(
                `Passer ${nbSelectionnes} dossier${nbSelectionnes > 1 ? "s" : ""} au statut "${STATUTS[valeur].label}" ? ` +
                  `Ce statut archive automatiquement le${nbSelectionnes > 1 ? "s" : ""} dossier${nbSelectionnes > 1 ? "s" : ""} (hors pipeline actif).`
              )
            ) {
              return;
            }
            executer(() => onChangerStatut(valeur));
          }}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-xs disabled:opacity-40"
        >
          <option value="" disabled>
            Choisir un statut…
          </option>
          {Object.entries(STATUTS).map(([cle, info]) => (
            <option key={cle} value={cle}>
              {info.label}
            </option>
          ))}
        </select>
      </label>

      {enCours && <span className="text-xs text-slate-400 dark:text-slate-500">Traitement…</span>}
      {erreur && <span className="text-xs text-red-600 dark:text-red-400">{erreur}</span>}
    </div>
  );
}
