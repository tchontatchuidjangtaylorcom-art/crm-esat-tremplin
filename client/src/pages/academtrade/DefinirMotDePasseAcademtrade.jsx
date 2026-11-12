import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api.js";
import { BoutonThemeVitrine } from "../../components/vitrine/ThemeVitrine.jsx";

// Ouverte depuis le lien personnel envoyé après inscription (voir
// academtradeAuth.js, envoyerLienAcces) — choix du mot de passe à la première
// visite, puis connexion automatique.
export default function DefinirMotDePasseAcademtrade() {
  const { jeton } = useParams();
  const navigate = useNavigate();
  const [infos, setInfos] = useState(null);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    api.academtradeInfosJeton(jeton).then(setInfos).catch((e) => setErreurChargement(e.message));
  }, [jeton]);

  async function valider(ev) {
    ev.preventDefault();
    if (motDePasse.length < 8) {
      setErreur("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await api.academtradeDefinirMotDePasse(jeton, motDePasse);
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

          {erreurChargement && <p className="text-sm text-red-600 dark:text-red-400 mt-4">{erreurChargement}</p>}
          {!infos && !erreurChargement && <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">Chargement…</p>}

          {infos && (
            <>
              <h1 className="text-xl font-bold mt-2">Bienvenue{infos.prenom ? ` ${infos.prenom}` : ""}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">Choisissez votre mot de passe pour accéder à votre espace.</p>
              <form onSubmit={valider} className="mt-6 space-y-3">
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Nouveau mot de passe"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  className="w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Confirmez le mot de passe"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
                <button
                  type="submit"
                  disabled={envoi}
                  className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold py-3 transition disabled:opacity-40"
                >
                  {envoi ? "Validation…" : "Accéder à mon espace"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
