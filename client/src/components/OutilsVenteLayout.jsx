import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import BarreOutilsVente from "./BarreOutilsVente.jsx";
import PanelOutilsVente from "./PanelOutilsVente.jsx";

// Enveloppe l'ensemble de l'application (tableau de bord ET fiche
// entreprise) : la barre d'outils reste accessible partout, et le panneau
// choisi s'ouvre en colonne docquée à droite — la page principale rétrécit
// pour lui faire de la place au lieu d'être recouverte par une modale.
export default function OutilsVenteLayout({ children }) {
  const location = useLocation();
  // Sur une fiche entreprise, l'argumentaire s'ouvre par défaut (chaque fiche
  // est chargée dans un nouvel onglet, donc cet état initial ne s'applique
  // qu'une fois, au premier rendu de cet onglet — il ne force jamais la
  // réouverture si l'agent ferme le panneau ou choisit un autre outil).
  const [outil, setOutil] = useState(() =>
    location.pathname.startsWith("/entreprise/") ? "argumentaire" : null
  );

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
      <div className="bandeau-tricolore">
        <span className="bg-marine-800" />
        <span className="bg-white" />
        <span className="bg-red-700" />
      </div>
      <BarreOutilsVente outilActif={outil} onSelect={selectionner} />
      <div className="flex flex-1 flex-col lg:flex-row items-stretch">
        <div className="flex-1 min-w-0">{children}</div>
        {outil && (
          <aside className="w-full lg:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l-2 border-marine-200 dark:border-marine-800/60 bg-white dark:bg-slate-900 overflow-y-auto">
            <PanelOutilsVente outil={outil} onFermer={() => setOutil(null)} />
          </aside>
        )}
      </div>
    </div>
  );
}
