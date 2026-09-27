import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BoutonThemeVitrine } from "./ThemeVitrine.jsx";

// Liens de la navigation vitrine : "Notre démarche" est une page à part
// (récit immersif), les autres sont des ancres de la page principale —
// préfixées par /vitrine pour fonctionner aussi depuis /vitrine/notre-demarche.
const LIENS_NAV = [
  { label: "Simulateur OETH", to: "/vitrine#simulateur" },
  { label: "Notre démarche", to: "/vitrine/notre-demarche" },
  { label: "Impact", to: "/vitrine#impact" },
  { label: "Ressources", to: "/vitrine#ressources" },
  { label: "Vigilance", to: "/vitrine/vigilance" },
  { label: "FAQ", to: "/vitrine/faq" },
  { label: "Contact", to: "/vitrine#contact" },
];

function IconeCadenas() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

// Section de la page principale actuellement à l'écran (défilement) : la
// dernière dont le haut a dépassé le bas de l'en-tête.
const SECTIONS_ACCUEIL = ["simulateur", "impact", "ressources", "contact"];
function useSectionActive(actif) {
  const [section, setSection] = useState(null);
  useEffect(() => {
    if (!actif) return undefined;
    function calculer() {
      let courante = null;
      for (const id of SECTIONS_ACCUEIL) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) courante = id;
      }
      // Tout en bas de page : le pied de page (contact) est la section active.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) courante = "contact";
      setSection(courante);
    }
    calculer();
    window.addEventListener("scroll", calculer, { passive: true });
    return () => window.removeEventListener("scroll", calculer);
  }, [actif]);
  return actif ? section : null;
}

// Navigation commune aux pages vitrine. Transparente tout en haut de page,
// puis voile flouté (clair ou sombre selon le thème du site, voir
// ThemeVitrine.jsx) dès qu'on défile.
export default function EnteteVitrine({ onSimuler }) {
  const [defile, setDefile] = useState(false);
  const { pathname, hash } = useLocation();
  const sectionActive = useSectionActive(pathname === "/vitrine");
  const [menuOuvert, setMenuOuvert] = useState(false);

  // Menu mobile refermé à chaque changement de page ou d'ancre, et avec Échap.
  useEffect(() => setMenuOuvert(false), [pathname, hash]);
  useEffect(() => {
    if (!menuOuvert) return undefined;
    const onTouche = (e) => e.key === "Escape" && setMenuOuvert(false);
    document.addEventListener("keydown", onTouche);
    return () => document.removeEventListener("keydown", onTouche);
  }, [menuOuvert]);

  useEffect(() => {
    function onScroll() {
      setDefile(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fond = defile
    ? "bg-white/85 dark:bg-black/70 backdrop-blur border-b border-slate-900/10 dark:border-white/10"
    : "bg-transparent";

  const boutonClasses =
    "rounded-full text-xs font-semibold px-5 py-2.5 transition bg-marine-800 text-white hover:bg-marine-900 dark:bg-white dark:text-marine-900 dark:hover:bg-marine-100";

  const boutonSimuler = (classe) =>
    onSimuler ? (
      <button onClick={onSimuler} className={classe}>
        Simuler ma contribution
      </button>
    ) : (
      <Link to="/vitrine#simulateur" className={classe}>
        Simuler ma contribution
      </Link>
    );

  const estActif = (lien) => {
    const [chemin, ancre] = lien.to.split("#");
    return ancre ? pathname === chemin && sectionActive === ancre : pathname === chemin;
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-40 transition-colors duration-300 ${
        menuOuvert ? "bg-white dark:bg-black border-b border-slate-900/10 dark:border-white/10" : fond
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 lg:py-4 flex items-center justify-between gap-3 lg:gap-4">
        <Link
          to="/vitrine"
          className="text-[13px] sm:text-sm font-semibold tracking-tight transition-colors min-w-0 text-slate-900 dark:text-white"
        >
          Pôle OETH <span className="text-marine-500 dark:text-white/50">/</span> AGEFIPH{" "}
          <span className="text-marine-500 dark:text-white/50">/</span> FIPHFP
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {LIENS_NAV.map((lien) => {
            // Page courante (liens de page) ou section visible (ancres de
            // /vitrine) : pastille bordée pour situer le visiteur.
            const actif = estActif(lien);
            return (
              <Link
                key={lien.to}
                to={lien.to}
                aria-current={actif ? "page" : undefined}
                className={`text-xs font-medium tracking-wide whitespace-nowrap rounded-full border px-3 py-1.5 transition ${
                  actif
                    ? "border-marine-500/60 bg-marine-500/10 text-marine-800 dark:border-white/40 dark:bg-white/10 dark:text-white"
                    : "border-transparent text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white"
                }`}
              >
                {lien.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 lg:gap-3 shrink-0">
          <BoutonThemeVitrine />
          <Link
            to="/connexion"
            title="Portail sécurisé (agents)"
            className="hidden lg:flex items-center gap-1.5 text-xs font-medium transition text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white"
          >
            <IconeCadenas />
            Portail sécurisé
          </Link>
          <span className="hidden lg:inline-flex">{boutonSimuler(boutonClasses)}</span>

          {/* Mobile / tablette : menu ☰ regroupant les liens masqués. */}
          <button
            type="button"
            onClick={() => setMenuOuvert((o) => !o)}
            aria-expanded={menuOuvert}
            aria-controls="menu-vitrine-mobile"
            aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            className="lg:hidden w-10 h-10 rounded-full border border-slate-900/15 dark:border-white/20 flex items-center justify-center text-slate-800 dark:text-white hover:bg-slate-900/5 dark:hover:bg-white/10 transition"
          >
            {menuOuvert ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile / tablette : bouton principal centré sous le nom du site. */}
      {!menuOuvert && (
        <div className="lg:hidden flex justify-center px-4 pb-2.5 -mt-0.5">
          {boutonSimuler("rounded-full text-sm font-semibold px-6 py-2 transition bg-marine-800 text-white hover:bg-marine-900 dark:bg-white dark:text-marine-900 dark:hover:bg-marine-100 shadow-lg")}
        </div>
      )}

      {/* Menu déroulant mobile. */}
      {menuOuvert && (
        <nav id="menu-vitrine-mobile" className="lg:hidden max-h-[calc(100vh-4rem)] overflow-y-auto px-4 pb-5">
          <ul className="space-y-1">
            {LIENS_NAV.map((lien) => {
              const actif = estActif(lien);
              return (
                <li key={lien.to}>
                  <Link
                    to={lien.to}
                    onClick={() => setMenuOuvert(false)}
                    aria-current={actif ? "page" : undefined}
                    className={`block rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      actif
                        ? "border-marine-500/60 bg-marine-500/10 text-marine-800 dark:border-white/40 dark:bg-white/10 dark:text-white"
                        : "border-transparent text-slate-700 hover:bg-slate-900/5 dark:text-white/80 dark:hover:bg-white/10"
                    }`}
                  >
                    {lien.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 pt-3 border-t border-slate-900/10 dark:border-white/10 flex flex-col gap-2">
            <span className="flex justify-center" onClick={() => setMenuOuvert(false)}>
              {boutonSimuler("w-full text-center rounded-full text-sm font-semibold px-6 py-3 transition bg-marine-800 text-white dark:bg-white dark:text-marine-900")}
            </span>
            <Link
              to="/connexion"
              onClick={() => setMenuOuvert(false)}
              className="flex items-center justify-center gap-1.5 rounded-full border border-slate-900/15 dark:border-white/20 px-6 py-3 text-sm font-medium text-slate-600 dark:text-white/70"
            >
              <IconeCadenas />
              Portail sécurisé
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
