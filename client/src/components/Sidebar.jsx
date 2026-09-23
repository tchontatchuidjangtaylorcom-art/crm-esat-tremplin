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
}) {
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
            <button onClick={() => onFiltreLot("")} className={itemClasse(filtreLot === "")}>
              <span>Toutes les vagues</span>
            </button>
            {lots.map((l) => (
              <button key={l} onClick={() => onFiltreLot(l)} className={itemClasse(filtreLot === l)}>
                <span className="truncate">{l}</span>
                <span className="text-xs opacity-70 shrink-0">{compteursLot[l] || 0}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
    </aside>
  );
}
