import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useIdentiteActuelle } from "../identite.js";
import { useSupervision } from "../SupervisionContext.jsx";
import { api } from "../api.js";
import NotificationCenter from "./NotificationCenter.jsx";

// Widget de profil + bascule clair/sombre, en haut à droite du tableau de
// bord. L'accès à cette page exige déjà une session valide (RequireAuth),
// donc l'identité vient normalement toujours de la session réelle ; le repli
// sur l'identité de démonstration (agent.js, via useIdentiteActuelle) ne sert
// que de filet de sécurité.
export default function UserMenu({ theme, onBasculerTheme }) {
  const { utilisateur } = useAuth();
  const identite = useIdentiteActuelle();
  const { agentSupervise, setAgentSupervise } = useSupervision();
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    if (utilisateur?.role !== "admin") return;
    api
      .listUtilisateurs()
      .then((liste) => setAgents(liste.filter((u) => u.statut === "valide" && u.id !== utilisateur.id)))
      .catch(() => {});
  }, [utilisateur]);

  const initiales = `${identite.prenom?.[0] || "?"}${identite.nom?.[0] || ""}`.toUpperCase();

  async function deconnecter() {
    await api.deconnexion().catch(() => {});
    window.location.href = "/connexion";
  }

  function choisirAgentSupervise(id) {
    if (!id) {
      setAgentSupervise(null);
      return;
    }
    const agent = agents.find((a) => a.id === id);
    if (agent) setAgentSupervise({ id: agent.id, prenom: agent.prenom, email: agent.email });
  }

  return (
    <div className="flex items-center gap-3">
      {utilisateur?.role === "admin" && (
        <>
          <select
            value={agentSupervise?.id || ""}
            onChange={(e) => choisirAgentSupervise(e.target.value)}
            title="Mode Manager : consulter le tableau de bord d'un agent"
            className="text-sm rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 max-w-[180px]"
          >
            <option value="">Voir le compte de…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.prenom || a.email}
              </option>
            ))}
          </select>

          <Link
            to="/admin/utilisateurs"
            title="Gérer les accès agents/administrateurs"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            Gestion des accès
          </Link>
        </>
      )}

      <NotificationCenter />

      <button
        onClick={onBasculerTheme}
        title={theme === "sombre" ? "Passer en mode clair" : "Passer en mode sombre"}
        className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition"
      >
        {theme === "sombre" ? "☀️" : "🌙"}
      </button>

      <div className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-marine-800 dark:bg-marine-200 text-white dark:text-marine-900 flex items-center justify-center text-xs font-bold">
            {initiales}
          </div>
          <span
            title="En ligne"
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800"
          />
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
        title="Se déconnecter"
        className="text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition whitespace-nowrap"
      >
        Se déconnecter
      </button>
    </div>
  );
}
