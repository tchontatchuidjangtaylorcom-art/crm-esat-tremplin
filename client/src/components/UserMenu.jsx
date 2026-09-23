// Widget de profil + bascule clair/sombre, en haut à droite du tableau de
// bord — reproduit le repère visuel du CRM de référence (agent connecté
// après validation de son compte par l'admin). L'authentification réelle
// (inscription, validation admin, sessions) n'est pas encore branchée ici :
// ces informations sont pour l'instant celles de l'agent de démonstration,
// en attendant la prochaine étape.
export default function UserMenu({ theme, onBasculerTheme }) {
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
          PT
        </div>
        <div className="leading-tight text-left hidden sm:block">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Philippe Tchams</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Télépro · BUREAU HAYAT&amp;CO</p>
        </div>
      </div>

      <button
        title="Authentification à venir — bouton de démonstration"
        className="text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition whitespace-nowrap"
      >
        Se déconnecter
      </button>
    </div>
  );
}
