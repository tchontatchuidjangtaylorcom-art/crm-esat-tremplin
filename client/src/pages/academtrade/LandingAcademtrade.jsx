import { Link } from "react-router-dom";
import { BoutonThemeVitrine } from "../../components/vitrine/ThemeVitrine.jsx";

// Page publique de présentation de la formation (voir AcademtradeApp.jsx) —
// phase pédagogique : aucun paiement en ligne branché pour l'instant,
// l'inscription se fait encore par contact direct.
export default function LandingAcademtrade() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      <header className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
        <p className="font-bold text-lg tracking-tight">
          Academ<span className="text-violet-600 dark:text-violet-400">Trade</span>
        </p>
        <div className="flex items-center gap-3">
          <Link
            to="/academtrade/connexion"
            className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            J'ai déjà un compte
          </Link>
          <BoutonThemeVitrine />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        <div className="bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden">
          <div className="h-1.5 bg-violet-600" />
          <div className="px-5 sm:px-10 pt-10 pb-10">
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">Apprenez le trading dans un environnement pédagogique</h1>
            <p className="mt-4 text-slate-600 dark:text-slate-300 max-w-2xl">
              Une formation accompagnée par un gestionnaire de compte dédié, avec un espace personnel pour suivre des positions
              simulées en conditions proches du réel — sans risquer d'argent sur un marché.
            </p>

            <div className="mt-6 rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm px-4 py-3">
              Environnement pédagogique : les positions et le solde affichés dans l'espace personnel sont simulés. Aucun argent
              n'est investi sur un marché financier réel à ce stade.
            </div>

            <ul className="mt-8 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <li>• Un gestionnaire de compte vous accompagne après votre inscription.</li>
              <li>• Un espace personnel sécurisé pour vous entraîner à ouvrir et fermer des positions.</li>
              <li>• Un droit de rétractation de 14 jours, comme pour tout achat à distance.</li>
            </ul>

            <div className="mt-10 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 p-6">
              <p className="text-2xl font-bold">À partir de 250 $</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Les inscriptions se font pour l'instant directement avec notre équipe — contactez-nous pour réserver votre place.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
