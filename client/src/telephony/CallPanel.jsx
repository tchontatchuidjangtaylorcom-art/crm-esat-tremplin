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
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{appel.entreprise.nom}</p>
          <p className="text-xs text-slate-300">{appel.entreprise.contact?.telephone}</p>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/10">
          {appel.statut === "connecting" && "Connexion…"}
          {appel.statut === "active" && `En appel — ${formatDuree(dureeAffichee)}`}
          {appel.statut === "ended" && `Terminé — ${formatDuree(dureeFinale)}`}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {(appel.statut === "connecting" || appel.statut === "active") && (
          <>
            <p className="text-sm text-slate-500">
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

        {appel.statut === "ended" && (
          <>
            <p className="text-sm font-medium text-slate-700">
              Appel terminé — sélectionnez l'issue pour enregistrer l'historique.
            </p>

            {erreur && <p className="text-sm text-red-600">{erreur}</p>}

            <select
              value={issueChoisie}
              onChange={(e) => setIssueChoisie(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            )}

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Détails (facultatif)"
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <button
              onClick={valider}
              disabled={!issueChoisie || enregistrement}
              className="w-full rounded-lg bg-slate-900 text-white text-sm font-medium py-2 disabled:opacity-40"
            >
              Enregistrer l'issue et fermer
            </button>
            <button
              onClick={fermerSansEnregistrer}
              disabled={enregistrement}
              className="w-full text-xs text-slate-400 hover:text-slate-600 py-1"
            >
              Fermer sans enregistrer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
