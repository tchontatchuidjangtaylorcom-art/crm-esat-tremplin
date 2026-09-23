import { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

// Connexion principalement sans mot de passe : lien magique par mail, ou
// Google si configuré côté serveur (bouton masqué sinon). Un mot de passe
// reste possible par compte, à la discrétion de l'admin (voir
// server/src/auth.js) : si le champ mot de passe est rempli ici, on tente
// une connexion directe ; laissé vide, le comportement habituel (lien
// magique) s'applique — inchangé pour tous les comptes qui n'ont pas de mot
// de passe défini. Le premier compte jamais créé devient automatiquement
// administrateur.
export default function Connexion() {
  const { utilisateur, chargement } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
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
      if (motDePasse) {
        // Mot de passe renseigné → connexion directe (compte avec mot de
        // passe défini par l'admin) ; sinon on retombe sur le lien magique.
        await api.connexionMotDePasse(email.trim(), motDePasse);
        window.location.href = "/";
        return;
      }
      const resultat = await api.demanderLien(email.trim());
      setMessage(resultat.message);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  if (!chargement && utilisateur) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">CRM OETH / AGEFIPH</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Lien de connexion ou mot de passe</p>
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
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Mot de passe (si votre compte en a un — sinon laissez vide)
            <div className="mt-1 relative">
              <input
                type={motDePasseVisible ? "text" : "password"}
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder="Laisser vide pour recevoir un lien"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setMotDePasseVisible((v) => !v)}
                tabIndex={-1}
                title={motDePasseVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {motDePasseVisible ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.5a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          <button
            type="submit"
            disabled={envoiEnCours || !email.trim()}
            className="w-full rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium py-2.5 disabled:opacity-40"
          >
            {envoiEnCours ? "Connexion…" : motDePasse ? "Se connecter" : "Recevoir un lien de connexion"}
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
