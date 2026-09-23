import { useEffect, useState } from "react";
import BarreOutilsVente from "./BarreOutilsVente.jsx";
import PanelOutilsVente from "./PanelOutilsVente.jsx";

// Enveloppe l'ensemble de l'application (tableau de bord ET fiche
// entreprise) : la barre d'outils reste accessible partout, et le panneau
// choisi s'ouvre en colonne docquée à droite — la page principale rétrécit
// pour lui faire de la place au lieu d'être recouverte par une modale.
export default function OutilsVenteLayout({ children }) {
  const [outil, setOutil] = useState(null);

  // Permet à n'importe quel composant (ex: la fiche entreprise) d'ouvrir un
  // panneau sans dépendre directement de cet état, via un simple événement —
  // même logique déjà utilisée pour synchroniser les mises à jour d'entreprise.
  useEffect(() => {
    function onOuvrir(ev) {
      setOutil(ev.detail);
    }
    window.addEventListener("outils-vente:ouvrir", onOuvrir);
    return () => window.removeEventListener("outils-vente:ouvrir", onOuvrir);
  }, []);

  function selectionner(cle) {
    setOutil((actuel) => (actuel === cle ? null : cle));
  }

  return (
    <div className="min-h-screen flex flex-col">
      <BarreOutilsVente outilActif={outil} onSelect={selectionner} />
      <div className="flex flex-1 flex-col lg:flex-row items-stretch">
        <div className="flex-1 min-w-0">{children}</div>
        {outil && (
          <aside className="w-full lg:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-y-auto">
            <PanelOutilsVente outil={outil} onFermer={() => setOutil(null)} />
          </aside>
        )}
      </div>
    </div>
  );
}
