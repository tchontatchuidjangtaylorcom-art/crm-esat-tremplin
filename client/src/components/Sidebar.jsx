import { useState } from "react";

function itemClasse(actif) {
  return `w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm text-left transition ${
    actif
      ? "bg-marine-800 dark:bg-marine-100 text-white dark:text-marine-900 font-medium"
      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
  }`;
}

// Navigation par secteur d'activité + gestion des vagues (lots) de
// prospection, en barre latérale fixe à gauche — remplace les anciens
// sélecteurs déroulants du haut de page pour filtrer/gérer les lots plus
// naturellement pendant une session de prospection.
export default function Sidebar({
  categories,
  compteursCategorie,
  filtreCategorie,
  onFiltreCategorie,
  lots,
  compteursLot,
  filtreLot,
  onFiltreLot,
  vaguesParSecteur = [],
  onFiltreVague,
}) {
  // Secteurs dépliés dans « Vagues de prospection » (le secteur filtré est
  // toujours déplié, pour voir où l'on se trouve).
  const [ouverts, setOuverts] = useState(() => new Set());
  const estOuvert = (cle) => ouverts.has(cle) || filtreCategorie === cle;
  function basculer(cle) {
    setOuverts((precedent) => {
      const suivant = new Set(precedent);
      if (estOuvert(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });
  }

  return (
    <aside className="w-64 shrink-0 space-y-6 lg:sticky lg:top-6 lg:self-start">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2 px-1">
          Secteurs
        </h2>
        <nav className="space-y-0.5">
          <button onClick={() => onFiltreCategorie("")} className={itemClasse(filtreCategorie === "")}>
            <span>Tous les secteurs</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.value}
              onClick={() => onFiltreCategorie(c.value)}
              className={itemClasse(filtreCategorie === c.value)}
            >
              <span className="truncate">{c.label}</span>
              <span className="text-xs opacity-70 shrink-0">{compteursCategorie[c.value] || 0}</span>
            </button>
          ))}
        </nav>
      </div>

      {lots.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2 px-1">
            Vagues de prospection
          </h2>
          <nav className="space-y-0.5">
            <button
              onClick={() => (onFiltreVague ? onFiltreVague("", "") : onFiltreLot(""))}
              className={itemClasse(filtreLot === "" && (!onFiltreVague || filtreCategorie === ""))}
            >
              <span>Toutes les vagues</span>
            </button>
            {/* Regroupées par secteur réel des fiches : un clic sur le secteur
                affiche toutes ses vagues et les déplie ; un clic sur une vague
                (ex. « Sécurité 2 ») filtre ce secteur ET cette vague. */}
            {vaguesParSecteur.map((groupe) => {
              const ouvert = estOuvert(groupe.cle);
              return (
                <div key={groupe.cle}>
                  <button
                    onClick={() => {
                      basculer(groupe.cle);
                      onFiltreVague?.(groupe.cle, "");
                    }}
                    aria-expanded={ouvert}
                    className={itemClasse(filtreCategorie === groupe.cle && filtreLot === "")}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        className={`w-3 h-3 shrink-0 transition-transform ${ouvert ? "rotate-90" : ""}`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                      <span className="truncate">{groupe.label}</span>
                    </span>
                    <span className="text-xs opacity-70 shrink-0">
                      {groupe.lots.length > 1 ? `${groupe.lots.length} vagues · ` : ""}
                      {groupe.total}
                    </span>
                  </button>
                  {ouvert && (
                    <div className="ml-4 pl-2 border-l border-slate-200 dark:border-slate-700 space-y-0.5 mt-0.5 mb-1">
                      {groupe.lots.map(({ lot, nombre }) => (
                        <button
                          key={lot}
                          onClick={() => onFiltreVague?.(groupe.cle, lot)}
                          className={itemClasse(filtreCategorie === groupe.cle && filtreLot === lot)}
                          title={lot}
                        >
                          <span className="truncate">{lot}</span>
                          <span className="text-xs opacity-70 shrink-0">{nombre}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      )}
    </aside>
  );
}
