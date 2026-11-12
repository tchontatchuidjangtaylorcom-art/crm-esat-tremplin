import { useEffect, useRef } from "react";
import { useThemeVitrine } from "../vitrine/ThemeVitrine.jsx";

// Graphique TradingView (widget public, gratuit, aucune clé requise) —
// affiche les vraies valeurs de marché pour le confort visuel du client ;
// l'exécution des positions simulées, elle, reste calculée côté serveur sur
// le marché interne (voir academtradeMarche.js). Le script doit être recréé
// à chaque changement de symbole : le widget ne réagit pas à un simple
// changement de prop.
export default function WidgetGraphiqueTradingView({ symbole, hauteur = 420 }) {
  const conteneur = useRef(null);
  const { theme } = useThemeVitrine();

  useEffect(() => {
    if (!conteneur.current || !symbole) return;
    conteneur.current.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.text = JSON.stringify({
      autosize: true,
      symbol: symbole,
      interval: "15",
      timezone: "Europe/Paris",
      theme: theme === "sombre" ? "dark" : "light",
      style: "1",
      locale: "fr",
      allow_symbol_change: false,
      hide_side_toolbar: true,
      support_host: "https://www.tradingview.com",
    });
    conteneur.current.appendChild(widget);
    conteneur.current.appendChild(script);
  }, [symbole, theme]);

  return <div ref={conteneur} className="tradingview-widget-container" style={{ height: hauteur, width: "100%" }} />;
}
