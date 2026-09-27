import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { VIGILANCE } from "./contenuVigilance.js";
import { ACTUALITES } from "./contenuActualites.js";
import { FAQ } from "./contenuFaq.js";
import AssistantOeth from "./AssistantOeth.jsx";

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

export const THEMES = {
  vigilance: {
    onglet: "bg-red-700 hover:bg-red-600 text-white border-red-500/60",
    panneau: "bg-red-700 text-white border-red-500/60",
    bande: "bg-red-800/80",
    pastille: "bg-slate-900/15 dark:bg-white/15 border-slate-900/30 dark:border-white/30",
    bouton: "bg-amber-200 text-red-900 hover:bg-amber-100",
    fleche: "border-slate-900/30 dark:border-white/30 hover:bg-slate-900/15 dark:hover:bg-white/15",
    pulse: "bg-amber-300",
  },
  actualite: {
    onglet: "bg-amber-400 hover:bg-amber-300 text-amber-950 border-amber-200/70",
    panneau: "bg-[#f6e7cf] text-amber-950 border-amber-300",
    bande: "bg-amber-300/60",
    pastille: "bg-slate-900/50 dark:bg-white/50 border-amber-500/40",
    bouton: "bg-amber-700 text-white hover:bg-amber-600",
    fleche: "border-amber-700/30 hover:bg-amber-200",
    pulse: "bg-amber-600",
  },
  faq: {
    onglet: "bg-teal-500 hover:bg-teal-400 text-marine-950 border-teal-200/70",
    panneau: "bg-white dark:bg-marine-950 text-slate-900 dark:text-white border-teal-400/40",
    bande: "bg-teal-500/20",
    pastille: "bg-teal-400/20 border-teal-300/40",
    bouton: "bg-teal-400 text-marine-950 hover:bg-teal-300",
    fleche: "border-slate-900/20 dark:border-white/20 hover:bg-slate-900/10 dark:hover:bg-white/10",
    pulse: "bg-teal-300",
  },
};

// Boutons flottants des pages publiques (/vitrine…) :
//  - à droite, de haut en bas : FAQ, Actualité (orange), Vigilance (rouge) ;
//  - à gauche : Assistance (assistant automatique, voir AssistantOeth).
// Un seul panneau ouvert à la fois ; rien ne s'ouvre tout seul (un point
// pulsé signale la vigilance tant qu'elle n'a pas été consultée).
export default function WidgetsVitrine() {
  const { pathname } = useLocation();
  const [ouvert, setOuvert] = useState(null); // null | "faq" | "actualite" | "vigilance" | "assistance"
  const [vigilanceVue, setVigilanceVue] = useState(() => lireStockage(CLE_VIGILANCE_VUE) === "1");

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
  const fermer = () => setOuvert(null);

  const DROITE = [
    { nom: "faq", etiquette: "FAQ", icone: "?" },
    { nom: "actualite", etiquette: "Actualité", icone: "i" },
    { nom: "vigilance", etiquette: "Vigilance", icone: "!" },
  ];

  return (
    <>
      <div className="fixed right-0 bottom-24 sm:bottom-8 z-[60] flex flex-col items-end gap-2 pointer-events-none">
        {DROITE.map((w) => {
          const theme = THEMES[w.nom];
          if (ouvert !== w.nom) {
            return (
              // La FAQ est détachée un peu plus haut que Actualité / Vigilance.
              <div key={w.nom} className={w.nom === "faq" ? "mb-8" : ""}>
                <Onglet
                  etiquette={w.etiquette}
                  icone={w.icone}
                  theme={theme}
                  pulse={w.nom === "vigilance" && !vigilanceVue}
                  onClick={() => basculer(w.nom)}
                />
              </div>
            );
          }
          if (w.nom === "faq")
            return (
              <div key={w.nom} className="mb-8">
                <PanneauFaq theme={theme} onFermer={fermer} />
              </div>
            );
          return (
            <PanneauCarrousel
              key={w.nom}
              cartes={w.nom === "vigilance" ? VIGILANCE : ACTUALITES}
              etiquette={w.etiquette}
              icone={w.icone}
              theme={theme}
              lienTout={w.nom === "vigilance" ? { label: "Voir la page Vigilance", to: "/vitrine/vigilance" } : { label: "Toutes les actualités", to: "/vitrine/actualites" }}
              onFermer={fermer}
            />
          );
        })}
      </div>

      <AssistantOeth ouvert={ouvert === "assistance"} onBasculer={() => basculer("assistance")} onFermer={fermer} />
    </>
  );
}

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

function BandeLaterale({ etiquette, icone, theme }) {
  return (
    <div className={`shrink-0 w-[72px] flex flex-col items-center justify-center gap-1.5 ${theme.bande}`}>
      <span className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold ${theme.pastille}`}>{icone}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-center px-1">{etiquette}</span>
    </div>
  );
}

function BoutonFermer({ theme, onFermer }) {
  return (
    <button
      type="button"
      onClick={onFermer}
      aria-label="Fermer"
      className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center text-xs ${theme.fleche}`}
    >
      ✕
    </button>
  );
}

function Action({ action, theme, onFermer }) {
  const classe = `inline-block mt-3 rounded-md text-xs font-bold px-3 py-1.5 transition ${theme.bouton}`;
  return action.href ? (
    <a href={action.href} target="_blank" rel="noopener noreferrer" className={classe}>
      {action.label}
    </a>
  ) : (
    <Link to={action.to} onClick={onFermer} className={classe}>
      {action.label}
    </Link>
  );
}

// Panneau déplié : une carte à la fois, navigation ‹ n / N ›.
export function PanneauCarrousel({ cartes, etiquette, icone, theme, lienTout, onFermer }) {
  const [index, setIndex] = useState(0);
  const carte = cartes[index];
  const total = cartes.length;

  return (
    <div
      role="dialog"
      aria-label={etiquette}
      className={`pointer-events-auto mr-3 w-[380px] max-w-[calc(100vw-1.5rem)] rounded-2xl border shadow-2xl overflow-hidden flex ${theme.panneau}`}
    >
      <BandeLaterale etiquette={etiquette} icone={icone} theme={theme} />
      <div className="flex-1 min-w-0 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold leading-snug">{carte.titre}</p>
          <BoutonFermer theme={theme} onFermer={onFermer} />
        </div>
        <p className="text-[13px] leading-relaxed mt-1.5 opacity-95">{carte.texte}</p>
        {carte.action && <Action action={carte.action} theme={theme} onFermer={onFermer} />}
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
        {lienTout && (
          <Link to={lienTout.to} onClick={onFermer} className="block text-center text-[11px] font-semibold underline-offset-2 hover:underline mt-2 opacity-80">
            {lienTout.label} →
          </Link>
        )}
      </div>
    </div>
  );
}

// Panneau FAQ : questions les plus posées, dépliables, et lien vers la page.
function PanneauFaq({ theme, onFermer }) {
  const [deplie, setDeplie] = useState(null);
  const populaires = FAQ.filter((q) => q.populaire);

  return (
    <div
      role="dialog"
      aria-label="FAQ"
      className={`pointer-events-auto mr-3 w-[400px] max-w-[calc(100vw-1.5rem)] rounded-2xl border shadow-2xl overflow-hidden flex ${theme.panneau}`}
    >
      <BandeLaterale etiquette="FAQ" icone="?" theme={theme} />
      <div className="flex-1 min-w-0 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold leading-snug">Questions fréquentes</p>
          <BoutonFermer theme={theme} onFermer={onFermer} />
        </div>
        <div className="mt-2 max-h-[46vh] overflow-y-auto divide-y divide-slate-900/10 dark:divide-white/10 pr-1">
          {populaires.map((q) => (
            <div key={q.id} className="py-2">
              <button
                type="button"
                onClick={() => setDeplie((d) => (d === q.id ? null : q.id))}
                aria-expanded={deplie === q.id}
                className="w-full text-left text-[13px] font-semibold flex justify-between gap-2 hover:text-teal-800 dark:hover:text-teal-200"
              >
                {q.question}
                <span className="text-teal-700 dark:text-teal-300">{deplie === q.id ? "−" : "+"}</span>
              </button>
              {deplie === q.id && <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1.5">{q.reponse}</p>}
            </div>
          ))}
        </div>
        <Link
          to="/vitrine/faq"
          onClick={onFermer}
          className={`block text-center rounded-md text-xs font-bold px-3 py-2 mt-3 transition ${theme.bouton}`}
        >
          Voir toute la FAQ ({FAQ.length} questions)
        </Link>
      </div>
    </div>
  );
}
