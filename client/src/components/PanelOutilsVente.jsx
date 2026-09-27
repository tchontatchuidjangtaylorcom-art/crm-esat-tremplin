import { useEffect } from "react";
import { api } from "../api.js";
import { useContenuAide } from "../useContenuAide.js";
import ArgumentaireContenu from "./ArgumentaireContenu.jsx";
import ScriptVenteContenu from "./ScriptVenteContenu.jsx";
import ModelesMailsContenu from "./ModelesMailsContenu.jsx";

const TITRES = {
  argumentaire: "Argumentaire AGEFIPH",
  script: "Script de vente",
  mails: "Modèles de mails",
};

function PanelArgumentaire() {
  const { data, erreur } = useContenuAide("argumentaire-agefiph", api.getArgumentaireAgefiph);
  if (erreur) return <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>;
  return <ArgumentaireContenu data={data} />;
}

// Panneau latéral docké (jamais de fond assombri par-dessus l'écran) : la
// page appelante (voir OutilsVenteLayout) rétrécit pour lui laisser la
// place, la fiche client et les boutons d'appel restent visibles à côté.
// En-tête collant (titre + bouton ✕ bien visible en haut à droite) : même
// en plein écran sur mobile et après défilement, on peut toujours fermer le
// panneau pour revenir au CRM. La touche Échap ferme aussi le panneau.
export default function PanelOutilsVente({ outil, onFermer }) {
  useEffect(() => {
    const onTouche = (e) => e.key === "Escape" && onFermer();
    document.addEventListener("keydown", onTouche);
    return () => document.removeEventListener("keydown", onTouche);
  }, [onFermer]);

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{TITRES[outil]}</h2>
        <button
          type="button"
          onClick={onFermer}
          title="Fermer et revenir au CRM"
          aria-label="Fermer le panneau et revenir au CRM"
          className="shrink-0 w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5">
        {outil === "argumentaire" && <PanelArgumentaire />}
        {outil === "script" && <ScriptVenteContenu />}
        {outil === "mails" && <ModelesMailsContenu />}
      </div>
    </div>
  );
}
