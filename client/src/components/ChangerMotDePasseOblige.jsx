import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

// Écran plein, bloquant : affiché à la place du CRM tant que le compte a un
// mot de passe provisoire (doitChangerMotDePasse, voir creerUtilisateurParAdmin
// côté serveur et RequireAuth.jsx qui monte ce composant). Une fois le mot de
// passe changé, on rafraîchit la session (useAuth().rafraichir) : le flag
// retombe et le CRM normal s'affiche.
export default function ChangerMotDePasseOblige() {
  const { rafraichir } = useAuth();
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  const tropCourt = motDePasse.length > 0 && motDePasse.length < 8;
  const neCorrespondentPas = confirmation.length > 0 && motDePasse !== confirmation;

  async function soumettre(ev) {
    ev.preventDefault();
    if (motDePasse.length < 8 || motDePasse !== confirmation) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.changerMonMotDePasse(motDePasse);
      await rafraichir();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bandeau-tricolore">
          <span className="bg-marine-800" />
          <span className="bg-white" />
          <span className="bg-red-700" />
        </div>
        <div className="p-8 space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Choisissez votre mot de passe</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Votre compte a un mot de passe provisoire — définissez le vôtre pour continuer.
            </p>
          </div>

          {erreur && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3">
              {erreur}
            </p>
          )}

          <form onSubmit={soumettre} className="space-y-3">
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Nouveau mot de passe
              <input
                type="password"
                autoComplete="new-password"
                autoFocus
                required
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder="Au moins 8 caractères"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Confirmez-le
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
            {tropCourt && <p className="text-xs text-amber-600 dark:text-amber-400">Au moins 8 caractères.</p>}
            {neCorrespondentPas && <p className="text-xs text-amber-600 dark:text-amber-400">Les deux mots de passe ne correspondent pas.</p>}

            <button
              type="submit"
              disabled={enCours || motDePasse.length < 8 || motDePasse !== confirmation}
              className="w-full rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 dark:text-marine-900 text-white text-sm font-medium py-2.5 disabled:opacity-40 transition"
            >
              {enCours ? "Enregistrement…" : "Continuer"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
