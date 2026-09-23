import { useEffect, useState } from "react";
import { useArgumentaireAgefiph } from "../useArgumentaireAgefiph.js";
import ArgumentaireContenu from "./ArgumentaireContenu.jsx";

// Aide-mémoire agent accessible depuis n'importe quelle page (tableau de bord
// ou fiche entreprise) : reproduit l'affiche du pôle AGEFIPH dans un tiroir
// escamotable à gauche, pour l'avoir sous les yeux pendant un appel.
export default function ArgumentaireDrawer() {
  const [ouvert, setOuvert] = useState(false);
  const { data, erreur } = useArgumentaireAgefiph();

  // La carte contextuelle de la fiche entreprise (lien "Voir tout
  // l'aide-mémoire") ouvre ce même tiroir via cet événement, pour ne pas
  // dupliquer l'état d'ouverture.
  useEffect(() => {
    function onOuvrir() {
      setOuvert(true);
    }
    window.addEventListener("argumentaire:ouvrir", onOuvrir);
    return () => window.removeEventListener("argumentaire:ouvrir", onOuvrir);
  }, []);

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        title="Aide-mémoire AGEFIPH"
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-red-600 text-white text-sm font-medium pl-3 pr-4 py-2.5 shadow-lg hover:bg-red-700 transition"
      >
        <span aria-hidden>📋</span> Argumentaire AGEFIPH
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOuvert(false)} />
          <div className="relative w-full max-w-sm h-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto p-5 space-y-5">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Argumentaire AGEFIPH</h2>
              <button
                onClick={() => setOuvert(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xl leading-none"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
            <ArgumentaireContenu data={data} />
          </div>
        </div>
      )}
    </>
  );
}
