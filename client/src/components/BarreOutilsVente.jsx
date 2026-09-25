// Charte de couleurs exacte demandée : Argumentaire (vert), Script de vente
// (marron), Modèles de mails (orange) — conservée comme repère de couleur
// (les agents s'y réfèrent déjà à l'oral), mais en accent discret (pastille +
// liseré) plutôt qu'en aplat saturé plein écran, pour rester sobre. Un seul
// outil actif à la fois — un nouveau clic sur le même bouton referme le panneau.
const OUTILS = [
  {
    cle: "argumentaire",
    label: "Argumentaire AGEFIPH",
    pastille: "bg-emerald-600",
    actif: "border-emerald-600 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40",
  },
  {
    cle: "script",
    label: "Script de vente",
    pastille: "bg-[#8B5E34]",
    actif: "border-[#8B5E34] text-[#6b4527] dark:text-[#c99b6f] bg-[#8B5E34]/10",
  },
  {
    cle: "mails",
    label: "Modèles de mails",
    pastille: "bg-orange-500",
    actif: "border-orange-500 text-orange-800 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30",
  },
];

export default function BarreOutilsVente({ outilActif, onSelect }) {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        {OUTILS.map((o) => {
          const actif = outilActif === o.cle;
          return (
            <button
              key={o.cle}
              onClick={() => onSelect(o.cle)}
              aria-pressed={actif}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                actif
                  ? o.actif
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span aria-hidden className={`w-2 h-2 rounded-full shrink-0 ${o.pastille}`} />
              {o.label}
            </button>
          );
        })}
      </div>

      {/* Landing page publique — totalement indépendante du CRM (pas de session
          partagée, pas d'habillage) : ouverte dans un nouvel onglet pour ne pas
          faire perdre le contexte de travail de l'agent. */}
      <a
        href="/vitrine"
        target="_blank"
        rel="noopener noreferrer"
        title="Ouvrir la landing page publique OETH"
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-marine-400 hover:text-marine-700 dark:hover:text-marine-300 px-3 py-1.5 text-sm font-medium transition"
      >
        Landing page
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5M18 6l-8.25 8.25M6 10.5v6a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15" />
        </svg>
      </a>
    </div>
  );
}
