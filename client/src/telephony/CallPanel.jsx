import { useEffect, useState } from "react";
import { useTelephonie } from "./CallContext.jsx";
import { ISSUES_FIN_APPEL, formatDuree } from "../constants.js";

export default function CallPanel() {
  const { appel, raccrocher, fermer, enregistrerIssue } = useTelephonie();
  const [dureeAffichee, setDureeAffichee] = useState(0);
  const [issueChoisie, setIssueChoisie] = useState("");
  const [date, setDate] = useState("");
  const [details, setDetails] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState(null);

  // Chronomètre pendant que l'appel est actif.
  useEffect(() => {
    if (!appel || appel.statut !== "active") return;
    const id = setInterval(() => setDureeAffichee(Math.round((Date.now() - appel.debut) / 1000)), 500);
    return () => clearInterval(id);
  }, [appel?.statut, appel?.debut]);

  useEffect(() => {
    if (!appel) {
      setIssueChoisie("");
      setDate("");
      setDetails("");
      setErreur(null);
      setDureeAffichee(0);
    }
  }, [appel]);

  if (!appel) return null;

  const infoIssue = ISSUES_FIN_APPEL.find((i) => i.value === issueChoisie);
  const dureeFinale = appel.fin ? Math.round((appel.fin - appel.debut) / 1000) : dureeAffichee;

  async function valider() {
    if (!issueChoisie) return;
    if (infoIssue?.needsDate && !date) {
      setErreur("Merci de choisir une date pour cette issue.");
      return;
    }
    setEnregistrement(true);
    setErreur(null);
    try {
      await enregistrerIssue({ kind: infoIssue.kind, value: issueChoisie, date: date || null, details: details || null });
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  function fermerSansEnregistrer() {
    if (window.confirm("Fermer sans enregistrer l'issue de cet appel ? L'historique ne sera pas mis à jour.")) {
      fermer();
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl overflow-hidden">
      <div className="bg-slate-900 dark:bg-slate-950 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{appel.entreprise.nom}</p>
          <p className="text-xs text-slate-300">{appel.entreprise.contact?.telephone}</p>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/10">
          {appel.statut === "connecting" && "Composition…"}
          {appel.statut === "active" && `En appel — ${formatDuree(dureeAffichee)}`}
          {appel.statut === "ended" && !appel.sansReponse && `Terminé — ${formatDuree(dureeFinale)}`}
          {appel.statut === "ended" && appel.sansReponse && "Sans réponse"}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {(appel.statut === "connecting" || appel.statut === "active") && (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {appel.statut === "connecting"
                ? "Établissement de l'appel (module VoIP simulé — à connecter à Twilio / Aircall / SIP)…"
                : "Appel en cours."}
            </p>
            <button
              onClick={raccrocher}
              className="w-full rounded-lg bg-red-600 text-white text-sm font-medium py-2"
            >
              Raccrocher
            </button>
          </>
        )}

        {appel.statut === "ended" && appel.sansReponse && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Aucune réponse — NRP enregistré automatiquement, passage au prospect suivant…
          </p>
        )}

        {appel.statut === "ended" && !appel.sansReponse && (
          <>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Appel terminé — sélectionnez l'issue pour enregistrer l'historique.
            </p>

            {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}

            <select
              value={issueChoisie}
              onChange={(e) => setIssueChoisie(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              autoFocus
            >
              <option value="">Sélectionner une issue…</option>
              <optgroup label="Nouvelle issue d'appel">
                {ISSUES_FIN_APPEL.filter((i) => i.kind === "appel").map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Sortie du dossier">
                {ISSUES_FIN_APPEL.filter((i) => i.kind === "sortie").map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
            </select>

            {infoIssue?.needsDate && (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              />
            )}

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Détails (facultatif)"
              rows={2}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />

            <button
              onClick={valider}
              disabled={!issueChoisie || enregistrement}
              className="w-full rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium py-2 disabled:opacity-40"
            >
              Enregistrer l'issue et fermer
            </button>
            <button
              onClick={fermerSansEnregistrer}
              disabled={enregistrement}
              className="w-full text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 py-1"
            >
              Fermer sans enregistrer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
