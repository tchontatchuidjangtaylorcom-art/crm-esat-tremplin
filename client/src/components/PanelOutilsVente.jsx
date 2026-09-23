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
export default function PanelOutilsVente({ outil, onFermer }) {
  return (
    <div className="p-5">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{TITRES[outil]}</h2>
        <button
          onClick={onFermer}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xl leading-none"
          aria-label="Fermer le panneau"
        >
          ×
        </button>
      </div>

      {outil === "argumentaire" && <PanelArgumentaire />}
      {outil === "script" && <ScriptVenteContenu />}
      {outil === "mails" && <ModelesMailsContenu />}
    </div>
  );
}
