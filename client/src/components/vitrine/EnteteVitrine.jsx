import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";

// Liens de la navigation vitrine : "Notre démarche" est une page à part
// (récit immersif), les autres sont des ancres de la page principale —
// préfixées par /vitrine pour fonctionner aussi depuis /vitrine/notre-demarche.
const LIENS_NAV = [
  { label: "Simulateur OETH", to: "/vitrine#simulateur" },
  { label: "Notre démarche", to: "/vitrine/notre-demarche" },
  { label: "Impact", to: "/vitrine#impact" },
  { label: "Ressources", to: "/vitrine#ressources" },
  { label: "Contact", to: "/vitrine#contact" },
];

// Navigation commune aux pages vitrine. Transparente tout en haut de page
// (les deux pages s'ouvrent sur un fond noir), puis voile sombre flouté dès
// qu'on défile, et fond clair uniquement quand `clair` est vrai (sections
// claires de la page principale).
export default function EnteteVitrine({ clair = false, onSimuler }) {
  const [defile, setDefile] = useState(false);

  useEffect(() => {
    function onScroll() {
      setDefile(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fond = clair
    ? "bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800"
    : defile
      ? "bg-black/70 backdrop-blur border-b border-white/10"
      : "bg-transparent";

  const boutonClasses = `rounded-full text-xs font-semibold px-5 py-2.5 transition ${
    clair ? "bg-marine-800 text-white hover:bg-marine-900" : "bg-white text-marine-900 hover:bg-marine-100"
  }`;

  return (
    <header className={`fixed top-0 inset-x-0 z-40 transition-colors duration-300 ${fond}`}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link
          to="/vitrine"
          className={`text-sm font-semibold tracking-tight transition-colors shrink-0 ${clair ? "text-slate-900 dark:text-white" : "text-white"}`}
        >
          Pôle OETH <span className={clair ? "text-marine-500" : "text-white/50"}>/</span> AGEFIPH
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {LIENS_NAV.map((lien) => (
            <NavLink
              key={lien.to}
              to={lien.to}
              end
              className={({ isActive }) => {
                const actif = isActive && !lien.to.includes("#");
                return `text-xs font-medium tracking-wide transition ${
                  clair
                    ? actif
                      ? "text-marine-700 dark:text-marine-300"
                      : "text-slate-600 dark:text-slate-300 hover:text-marine-700 dark:hover:text-marine-300"
                    : actif
                      ? "text-white"
                      : "text-white/70 hover:text-white"
                }`;
              }}
            >
              {lien.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/connexion"
            title="Portail sécurisé (agents)"
            className={`hidden sm:flex items-center gap-1.5 text-xs font-medium transition ${
              clair ? "text-slate-500 dark:text-slate-400 hover:text-marine-700 dark:hover:text-marine-300" : "text-white/60 hover:text-white"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Portail sécurisé
          </Link>
          {onSimuler ? (
            <button onClick={onSimuler} className={boutonClasses}>
              Simuler ma contribution
            </button>
          ) : (
            <Link to="/vitrine#simulateur" className={boutonClasses}>
              Simuler ma contribution
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
