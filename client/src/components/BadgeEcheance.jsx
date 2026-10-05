import { useState } from "react";
import { api } from "../api.js";
import { formatDateHeure } from "../constants.js";
import ChampDateHeure from "./ChampDateHeure.jsx";
import { diffuserEntrepriseMaj } from "../telephony/CallContext.jsx";
import { useAuth } from "../AuthContext.jsx";

// Badge "📅 RDV : …" / "☎️ Rappel : …" de la fiche : un clic permet de
// déplacer l'échéance (ex. "rappelez-moi demain à 10h"). La nouvelle date est
// enregistrée sur la fiche, notée dans l'historique, et l'alerte sonnera à
// la nouvelle heure.
export default function BadgeEcheance({ entreprise, onMaj }) {
  const estRdv = Boolean(entreprise.dateRdv);
  const dateActuelle = entreprise.dateRdv || entreprise.dateRappel;
  const [ouvert, setOuvert] = useState(false);
  const [date, setDate] = useState("");
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const { utilisateur } = useAuth();

  if (!dateActuelle) return null;

  function ouvrir() {
    setDate(String(dateActuelle).slice(0, 16));
    setMotif("");
    setErreur(null);
    setOuvert(true);
  }

  async function enregistrer(ev) {
    ev.preventDefault();
    if (!date) return setErreur("Choisissez une date et une heure (ex : demain 10h).");
    setEnCours(true);
    setErreur(null);
    try {
      const quand = new Date(date).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
      const details = `${estRdv ? "RDV" : "Rappel"} déplacé au ${quand}${motif.trim() ? ` — ${motif.trim()}` : ""}.`;
      let maj;
      if (entreprise.statut === "rdv" || entreprise.statut === "a_rappeler") {
        // Même route que les issues d'appel : statut conservé, date mise à
        // jour, ligne dans l'historique des appels.
        maj = await api.enregistrerAppel(entreprise.id, { issue: entreprise.statut, date, details, report: true });
      } else {
        // Autres statuts (ex. Client Potentiel) : seule la date bouge.
        await api.patchEntreprise(entreprise.id, estRdv ? { dateRdv: date } : { dateRappel: date });
        maj = await api.ajouterCommentaire(entreprise.id, {
          texte: details,
          auteur: utilisateur?.prenom || utilisateur?.email || "Agent",
        });
      }
      onMaj?.(maj);
      diffuserEntrepriseMaj(maj);
      setOuvert(false);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        title="Changer la date"
        className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-full px-2.5 py-1 whitespace-nowrap hover:bg-red-100 dark:hover:bg-red-900/50"
      >
        {estRdv ? "📅 RDV :" : "☎️ Rappel :"} {formatDateHeure(dateActuelle)} <span aria-hidden>✎</span>
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setOuvert(false)}>
          <form
            onSubmit={enregistrer}
            onClick={(ev) => ev.stopPropagation()}
            className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-3 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {estRdv ? "Déplacer le rendez-vous" : "Déplacer le rappel"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {entreprise.nom} — actuellement {formatDateHeure(dateActuelle)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setOuvert(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={enCours}
                  className="rounded-lg bg-marine-700 hover:bg-marine-800 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  {enCours ? "…" : "Enregistrer"}
                </button>
              </div>
            </div>
            <ChampDateHeure value={date} onChange={setDate} autoFocus libelleDate="Nouvelle date" />
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Motif (facultatif)
              <input
                type="text"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="ex : RH disponible demain matin"
                className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              />
            </label>
            {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
          </form>
        </div>
      )}
    </>
  );
}
