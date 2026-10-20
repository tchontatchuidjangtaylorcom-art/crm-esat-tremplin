import { useEffect, useRef, useState } from "react";
import { changerEspace, useEspaces } from "../espace.js";

const COULEURS = {
  marine: "bg-marine-600",
  emerald: "bg-emerald-600",
  orange: "bg-orange-500",
  violet: "bg-violet-600",
};

// Sélecteur d'espace de travail, en haut du CRM : un clic pour passer de
// l'espace OETH à l'espace CEE (et aux suivants). Un compte qui n'a qu'un
// espace voit juste son nom, sans menu.
export default function SelecteurEspace() {
  const { espaces, espace, charge } = useEspaces();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    const fermer = (e) => !ref.current?.contains(e.target) && setOuvert(false);
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [ouvert]);

  if (!charge || !espace) return null;
  const pastille = (e) => <span aria-hidden className={`w-2.5 h-2.5 rounded-full shrink-0 ${COULEURS[e.couleur] || COULEURS.marine}`} />;

  if (espaces.length < 2) {
    return (
      <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
        {pastille(espace)}
        <span className="sm:hidden">{espace.court || espace.nom}</span>
        <span className="hidden sm:inline">{espace.nom}</span>
      </span>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        title="Changer d'espace de travail"
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        {pastille(espace)}
        <span className="sm:hidden">{espace.court || espace.nom}</span>
        <span className="hidden sm:inline">{espace.nom}</span>
        <span aria-hidden className="text-slate-400">▾</span>
      </button>
      {ouvert && (
        <div className="absolute left-0 mt-1.5 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl overflow-hidden z-50">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Espaces de travail</p>
          {espaces.map((e) => {
            const actif = e.id === espace.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => (actif ? setOuvert(false) : changerEspace(e.id))}
                className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 ${
                  actif ? "bg-slate-100 dark:bg-slate-700/60" : "hover:bg-slate-50 dark:hover:bg-slate-700/40"
                }`}
              >
                <span className="mt-1">{pastille(e)}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {e.nom} {actif && <span className="text-xs font-normal text-slate-400">(affiché)</span>}
                  </span>
                  {e.description && <span className="block text-xs text-slate-500 dark:text-slate-400">{e.description}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
