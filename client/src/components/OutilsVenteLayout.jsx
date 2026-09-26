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

  // Sur mobile, le panneau s'ouvrait auparavant en flux normal SOUS le
  // contenu de la page (colonne empilée, comme sur desktop en plus étroit) :
  // sur une fiche prospect déjà longue, l'agent devait faire défiler très
  // loin pour même s'apercevoir que le panneau s'était ouvert — perçu comme
  // "le bouton ne fait rien". Passe en plein écran superposé (fixed) sous
  // ce seuil, et bloque le défilement de la page en dessous tant qu'il est
  // ouvert, pour un état "ouvert" toujours immédiatement visible.
  useEffect(() => {
    if (!outil || window.innerWidth >= 1024) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [outil]);

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
          <>
            {/* Mobile/tablette : panneau plein écran superposé, toujours
                visible immédiatement quel que soit le défilement en cours. */}
            <div className="lg:hidden fixed inset-0 z-50 bg-white dark:bg-slate-900 overflow-y-auto">
              <PanelOutilsVente outil={outil} onFermer={() => setOutil(null)} />
            </div>
            {/* Desktop : colonne dockée à droite, comme avant. */}
            <aside className="hidden lg:block w-[420px] shrink-0 border-l-2 border-marine-200 dark:border-marine-800/60 bg-white dark:bg-slate-900 overflow-y-auto">
              <PanelOutilsVente outil={outil} onFermer={() => setOutil(null)} />
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
