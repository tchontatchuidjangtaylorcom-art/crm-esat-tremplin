// Charte de couleurs exacte demandée : Argumentaire (vert), Script de vente
// (marron), Modèles de mails (orange). Un seul outil actif à la fois — un
// nouveau clic sur le même bouton referme le panneau.
const OUTILS = [
  { cle: "argumentaire", label: "Argumentaire AGEFIPH", icone: "🖊️", classe: "bg-emerald-600 hover:bg-emerald-700" },
  { cle: "script", label: "Script de vente", icone: "🖥️", classe: "bg-[#8B5E34] hover:bg-[#734b29]" },
  { cle: "mails", label: "Modèles de mails", icone: "✉️", classe: "bg-orange-500 hover:bg-orange-600" },
];

export default function BarreOutilsVente({ outilActif, onSelect }) {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mr-1">
        Aide à la vente
      </span>
      {OUTILS.map((o) => {
        const actif = outilActif === o.cle;
        return (
          <button
            key={o.cle}
            onClick={() => onSelect(o.cle)}
            aria-pressed={actif}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition ${o.classe} ${
              actif ? "ring-2 ring-offset-1 ring-slate-900 dark:ring-offset-slate-950 dark:ring-white" : ""
            }`}
          >
            <span aria-hidden>{o.icone}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
