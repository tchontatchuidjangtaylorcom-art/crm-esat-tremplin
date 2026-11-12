import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { BoutonThemeVitrine } from "../../components/vitrine/ThemeVitrine.jsx";

export default function ConnexionAcademtrade() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function connecter(ev) {
    ev.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api.academtradeConnexion(email.trim(), motDePasse);
      navigate("/academtrade/espace");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-center p-4">
      <div className="absolute top-5 right-5">
        <BoutonThemeVitrine />
      </div>
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="h-1.5 bg-violet-600" />
        <div className="p-7">
          <p className="font-bold text-lg tracking-tight mb-1">
            Academ<span className="text-violet-600 dark:text-violet-400">Trade</span>
          </p>
          <h1 className="text-xl font-bold">Connexion à votre espace</h1>
          <form onSubmit={connecter} className="mt-6 space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Adresse e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Mot de passe"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
            <button
              type="submit"
              disabled={envoi}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold py-3 transition disabled:opacity-40"
            >
              {envoi ? "Connexion…" : "Se connecter"}
            </button>
          </form>
          <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
            Pas encore de compte ? Votre accès vous est envoyé par e-mail après votre inscription à la formation.
          </p>
        </div>
      </div>
    </div>
  );
}
