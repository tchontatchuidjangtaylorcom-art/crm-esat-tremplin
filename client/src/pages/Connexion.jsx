import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";

// Connexion sans mot de passe : lien magique par mail, ou Google si
// configuré côté serveur (bouton masqué sinon). Le premier compte jamais
// créé devient automatiquement administrateur (voir server/src/auth.js).
export default function Connexion() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(
    searchParams.get("erreur") === "lien_invalide"
      ? "Ce lien de connexion est invalide ou a expiré. Redemandez-en un ci-dessous."
      : null
  );
  const [config, setConfig] = useState(null);

  useEffect(() => {
    api
      .getAuthConfig()
      .then(setConfig)
      .catch(() => setConfig({ googleConfigure: false }));
  }, []);

  // Charge le SDK Google Identity Services uniquement si une connexion
  // Google est réellement configurée côté serveur.
  useEffect(() => {
    if (!config?.googleConfigure || !config.googleClientId) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async (reponse) => {
          try {
            const resultat = await api.connexionGoogle(reponse.credential);
            if (resultat.statut === "en_attente") {
              setMessage(resultat.message);
            } else {
              window.location.href = "/";
            }
          } catch (e) {
            setErreur(e.message);
          }
        },
      });
      const cible = document.getElementById("bouton-google");
      if (cible) window.google.accounts.id.renderButton(cible, { theme: "outline", size: "large", width: 280 });
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [config]);

  async function soumettre(ev) {
    ev.preventDefault();
    if (!email.trim()) return;
    setEnvoiEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await api.demanderLien(email.trim());
      setMessage(resultat.message);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">CRM OETH / AGEFIPH</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Connexion sans mot de passe</p>
        </div>

        {erreur && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3">
            {erreur}
          </p>
        )}
        {message && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3">
            {message}
          </p>
        )}

        <form onSubmit={soumettre} className="space-y-3">
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Adresse mail professionnelle
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@exemple.fr"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={envoiEnCours || !email.trim()}
            className="w-full rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium py-2.5 disabled:opacity-40"
          >
            {envoiEnCours ? "Envoi…" : "Recevoir un lien de connexion"}
          </button>
        </form>

        {config?.googleConfigure && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs text-slate-400 dark:text-slate-500">ou</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>
            <div id="bouton-google" className="flex justify-center" />
          </>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
          Premier accès ? Votre demande sera transmise à l'administrateur pour validation.
        </p>
      </div>
    </div>
  );
}
