import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { Outlet } from "react-router-dom";

// Thème du site vitrine, indépendant de celui du CRM : sombre ("bleu") par
// défaut, bascule clair (blanc & bleu) au choix du visiteur, mémorisée.
// S'appuie sur la classe "dark" de <html> (darkMode: "class" dans
// tailwind.config.js), comme le CRM : chaque couleur du site a sa variante
// claire par défaut et sa variante `dark:` d'origine.
const CLE_STOCKAGE = "vitrine-theme";

const ThemeVitrineContext = createContext({ theme: "sombre", basculer: () => {} });

function themeInitial() {
  // ?theme=clair|sombre dans l'URL : lien direct vers un mode donné.
  const force = new URLSearchParams(window.location.search).get("theme");
  if (force === "clair" || force === "sombre") return force;
  try {
    const stocke = localStorage.getItem(CLE_STOCKAGE);
    if (stocke === "clair" || stocke === "sombre") return stocke;
  } catch {
    // localStorage indisponible (navigation privée, etc.) : thème par défaut.
  }
  return "sombre";
}

// Route "mise en page" enveloppant toutes les pages /vitrine/*.
export function ThemeVitrineLayout() {
  const [theme, setTheme] = useState(themeInitial);

  // Rend la classe <html> telle qu'elle était en quittant le site vitrine
  // (page de connexion, CRM), qui gèrent leur propre thème.
  useEffect(() => {
    const avant = document.documentElement.classList.contains("dark");
    return () => document.documentElement.classList.toggle("dark", avant);
  }, []);

  // useLayoutEffect : appliqué avant l'affichage, pas de flash du mauvais thème.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "sombre");
    try {
      localStorage.setItem(CLE_STOCKAGE, theme);
    } catch {
      // Rien à faire si le stockage local est indisponible.
    }
  }, [theme]);

  function basculer() {
    setTheme((t) => (t === "sombre" ? "clair" : "sombre"));
  }

  return (
    <ThemeVitrineContext.Provider value={{ theme, basculer }}>
      <Outlet />
    </ThemeVitrineContext.Provider>
  );
}

export function useThemeVitrine() {
  return useContext(ThemeVitrineContext);
}

// Bouton soleil/lune du site vitrine.
export function BoutonThemeVitrine({ className = "" }) {
  const { theme, basculer } = useThemeVitrine();
  const sombre = theme === "sombre";
  return (
    <button
      type="button"
      onClick={basculer}
      title={sombre ? "Passer en mode clair" : "Passer en mode sombre"}
      aria-label={sombre ? "Passer en mode clair" : "Passer en mode sombre"}
      className={`flex items-center justify-center w-9 h-9 rounded-full border transition border-slate-900/15 text-slate-600 hover:text-slate-900 hover:bg-slate-900/5 dark:border-white/15 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10 ${className}`}
    >
      {sombre ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
    </button>
  );
}
