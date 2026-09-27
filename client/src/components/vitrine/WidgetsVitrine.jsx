import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { VIGILANCE } from "./contenuVigilance.js";

const CLE_VIGILANCE_VUE = "vitrine-vigilance-vue";

function lireStockage(cle) {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}
function ecrireStockage(cle, valeur) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    // stockage indisponible : aucune conséquence fonctionnelle
  }
}

// Boutons flottants des pages publiques (/vitrine…). Colonne en bas à
// droite : Vigilance (rouge) — puis Actualité et FAQ au-dessus dans les
// étapes suivantes. Un seul panneau ouvert à la fois ; rien ne s'ouvre tout
// seul : un simple point pulsé signale la vigilance tant qu'elle n'a pas été
// consultée.
export default function WidgetsVitrine() {
  const { pathname } = useLocation();
  const [ouvert, setOuvert] = useState(null); // null | "vigilance"
  const [vigilanceVue, setVigilanceVue] = useState(() => lireStockage(CLE_VIGILANCE_VUE) === "1");

  // Fermeture au changement de page et à la touche Échap.
  useEffect(() => setOuvert(null), [pathname]);
  useEffect(() => {
    const onTouche = (e) => e.key === "Escape" && setOuvert(null);
    document.addEventListener("keydown", onTouche);
    return () => document.removeEventListener("keydown", onTouche);
  }, []);

  if (!pathname.startsWith("/vitrine")) return null;

  function basculer(nom) {
    setOuvert((o) => (o === nom ? null : nom));
    if (nom === "vigilance" && !vigilanceVue) {
      setVigilanceVue(true);
      ecrireStockage(CLE_VIGILANCE_VUE, "1");
    }
  }

  return (
    <div className="fixed right-0 bottom-24 sm:bottom-8 z-[60] flex flex-col items-end gap-2 pointer-events-none">
      {ouvert === "vigilance" ? (
        <PanneauCarrousel
          cartes={VIGILANCE}
          etiquette="Vigilance"
          icone="!"
          theme={THEMES.vigilance}
          onFermer={() => setOuvert(null)}
        />
      ) : (
        <Onglet
          etiquette="Vigilance"
          icone="!"
          theme={THEMES.vigilance}
          pulse={!vigilanceVue}
          onClick={() => basculer("vigilance")}
        />
      )}
    </div>
  );
}

export const THEMES = {
  vigilance: {
    onglet: "bg-red-700 hover:bg-red-600 text-white border-red-500/60",
    panneau: "bg-red-700 text-white border-red-500/60",
    bande: "bg-red-800/80",
    pastille: "bg-white/15 border-white/30",
    bouton: "bg-amber-200 text-red-900 hover:bg-amber-100",
    fleche: "border-white/30 hover:bg-white/15",
    pulse: "bg-amber-300",
  },
};

// Onglet replié, collé au bord droit de l'écran.
function Onglet({ etiquette, icone, theme, pulse, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ouvrir : ${etiquette}`}
      className={`pointer-events-auto relative flex flex-col items-center justify-center gap-1 w-[68px] py-3 rounded-l-2xl border border-r-0 shadow-2xl transition ${theme.onglet}`}
    >
      {pulse && (
        <span className="absolute -top-1 -left-1 flex h-3 w-3">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${theme.pulse}`} />
          <span className={`relative inline-flex h-3 w-3 rounded-full ${theme.pulse}`} />
        </span>
      )}
      <span className={`w-7 h-7 rounded-lg border flex items-center justify-center text-sm font-bold ${theme.pastille}`}>{icone}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider">{etiquette}</span>
    </button>
  );
}

// Panneau déplié : une carte à la fois, navigation ‹ n / N ›.
export function PanneauCarrousel({ cartes, etiquette, icone, theme, onFermer }) {
  const [index, setIndex] = useState(0);
  const carte = cartes[index];
  const total = cartes.length;

  return (
    <div
      role="dialog"
      aria-label={etiquette}
      className={`pointer-events-auto mr-3 w-[380px] max-w-[calc(100vw-1.5rem)] rounded-2xl border shadow-2xl overflow-hidden flex ${theme.panneau}`}
    >
      <div className={`shrink-0 w-[72px] flex flex-col items-center justify-center gap-1.5 ${theme.bande}`}>
        <span className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold ${theme.pastille}`}>{icone}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider">{etiquette}</span>
      </div>
      <div className="flex-1 min-w-0 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold leading-snug">{carte.titre}</p>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center text-xs ${theme.fleche}`}
          >
            ✕
          </button>
        </div>
        <p className="text-[13px] leading-relaxed mt-1.5 opacity-95">{carte.texte}</p>
        {carte.action &&
          (carte.action.href ? (
            <a
              href={carte.action.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-block mt-3 rounded-md text-xs font-bold px-3 py-1.5 transition ${theme.bouton}`}
            >
              {carte.action.label}
            </a>
          ) : (
            <Link
              to={carte.action.to}
              onClick={onFermer}
              className={`inline-block mt-3 rounded-md text-xs font-bold px-3 py-1.5 transition ${theme.bouton}`}
            >
              {carte.action.label}
            </Link>
          ))}
        <div className="flex items-center justify-between mt-3">
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + total) % total)}
            aria-label="Précédent"
            className={`w-7 h-7 rounded-md border flex items-center justify-center text-sm ${theme.fleche}`}
          >
            ‹
          </button>
          <span className="text-xs font-semibold tabular-nums">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % total)}
            aria-label="Suivant"
            className={`w-7 h-7 rounded-md border flex items-center justify-center text-sm ${theme.fleche}`}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
