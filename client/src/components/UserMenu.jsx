import { AGENT_ACTUEL } from "../agent.js";
import { useUtilisateurConnecte } from "../useUtilisateurConnecte.js";
import { api } from "../api.js";

// Widget de profil + bascule clair/sombre, en haut à droite du tableau de
// bord. Affiche la vraie session (lien magique / Google) si une connexion
// est active ; sinon replie sur l'identité de démonstration (agent.js),
// tant que l'authentification n'est pas encore obligatoire sur le reste du
// CRM (voir server/src/index.js).
export default function UserMenu({ theme, onBasculerTheme }) {
  const { utilisateur } = useUtilisateurConnecte();

  const identite = utilisateur
    ? {
        prenom: utilisateur.prenom || utilisateur.email.split("@")[0],
        nom: utilisateur.nom || "",
        role: utilisateur.role === "admin" ? "Administrateur" : "Télépro",
        bureau: utilisateur.email,
      }
    : AGENT_ACTUEL;

  const initiales = `${identite.prenom?.[0] || "?"}${identite.nom?.[0] || ""}`.toUpperCase();

  async function deconnecter() {
    if (!utilisateur) return; // rien à faire pour la session de démonstration
    await api.deconnexion().catch(() => {});
    window.location.href = "/connexion";
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBasculerTheme}
        title={theme === "sombre" ? "Passer en mode clair" : "Passer en mode sombre"}
        className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition"
      >
        {theme === "sombre" ? "☀️" : "🌙"}
      </button>

      <div className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center text-xs font-bold shrink-0">
          {initiales}
        </div>
        <div className="leading-tight text-left hidden sm:block">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {identite.prenom} {identite.nom}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {identite.role} · {identite.bureau}
          </p>
        </div>
      </div>

      <button
        onClick={deconnecter}
        title={utilisateur ? "Se déconnecter" : "Session de démonstration — authentification pas encore obligatoire"}
        className="text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition whitespace-nowrap"
      >
        Se déconnecter
      </button>
    </div>
  );
}
