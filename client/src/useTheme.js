import { useEffect, useState } from "react";

const CLE_STOCKAGE = "crm-theme";

function themeInitial() {
  try {
    const stocke = localStorage.getItem(CLE_STOCKAGE);
    if (stocke === "clair" || stocke === "sombre") return stocke;
  } catch {
    // localStorage indisponible (navigation privée, etc.) : on ignore.
  }
  const prefereSombre = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefereSombre ? "sombre" : "clair";
}

// Bascule clair/sombre pour tout le CRM : ajoute/retire la classe "dark" sur
// <html> (pilotée par `darkMode: "class"` dans tailwind.config.js) et retient
// le choix de l'agent d'une session à l'autre.
export function useTheme() {
  const [theme, setTheme] = useState(themeInitial);

  useEffect(() => {
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

  return { theme, basculer };
}
