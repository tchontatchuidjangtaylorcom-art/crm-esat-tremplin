import { useEffect, useRef } from "react";
import { useThemeVitrine } from "../vitrine/ThemeVitrine.jsx";

// Fil d'actualités de marché (widget TradingView public et gratuit) — même
// principe de recréation du script que WidgetGraphiqueTradingView.jsx.
export default function WidgetActualitesTradingView({ hauteur = 400 }) {
  const conteneur = useRef(null);
  const { theme } = useThemeVitrine();

  useEffect(() => {
    if (!conteneur.current) return;
    conteneur.current.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
    script.async = true;
    script.text = JSON.stringify({
      feedMode: "all_symbols",
      isTransparent: false,
      displayMode: "regular",
      width: "100%",
      height: "100%",
      colorTheme: theme === "sombre" ? "dark" : "light",
      locale: "fr",
    });
    conteneur.current.appendChild(widget);
    conteneur.current.appendChild(script);
  }, [theme]);

  return <div ref={conteneur} className="tradingview-widget-container" style={{ height: hauteur, width: "100%" }} />;
}
