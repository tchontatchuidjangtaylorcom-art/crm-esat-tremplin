import { useEffect, useState } from "react";
import { api } from "../api.js";
import { BoutonThemeVitrine } from "../components/vitrine/ThemeVitrine.jsx";

const CLASSE_INPUT =
  "w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-marine-400";

// « Recevoir mon lien » (/vitrine/mon-dossier) : le client qui a perdu le lien
// de sa fiche tape son e-mail ; s'il est connu, le lien lui est envoyé par
// mail (jamais affiché ici — voir POST /api/vitrine/lien-dossier).
export default function MonLienDossier() {
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    document.title = "Recevoir mon lien — Pôle OETH";
  }, []);

  async function envoyer(ev) {
    ev.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api.recevoirLienDossier(email.trim());
      setFait(true);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white">
      <header className="max-w-xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/logo-oeth.png" alt="Logo Pôle OETH" width="40" height="40" className="w-10 h-10 rounded-full" />
          <p className="font-bold leading-tight">Pôle OETH</p>
        </div>
        <BoutonThemeVitrine />
      </header>
      <main className="max-w-xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-white dark:bg-marine-950 border border-slate-900/10 dark:border-white/10 rounded-2xl shadow-xl px-5 sm:px-8 py-7">
          <h1 className="text-2xl font-bold">Recevoir mon lien</h1>
          {fait ? (
            <p className="mt-4 text-sm text-slate-700 dark:text-slate-200">
              ✓ Si cette adresse correspond à un dossier suivi par nos conseillers, vous allez recevoir votre lien personnel par e-mail
              dans quelques instants. Pensez à vérifier vos courriers indésirables.
            </p>
          ) : (
            <form onSubmit={envoyer} className="mt-4 space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Indiquez l'adresse e-mail à laquelle votre conseiller vous a écrit : nous vous renvoyons le lien pour vérifier et confirmer
                les informations de votre entreprise.
              </p>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre.adresse@entreprise.fr"
                className={CLASSE_INPUT}
              />
              {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
              <button
                type="submit"
                disabled={envoi}
                className="w-full rounded-xl bg-marine-700 hover:bg-marine-800 text-white font-semibold py-3 disabled:opacity-50"
              >
                {envoi ? "Envoi…" : "M'envoyer mon lien"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
