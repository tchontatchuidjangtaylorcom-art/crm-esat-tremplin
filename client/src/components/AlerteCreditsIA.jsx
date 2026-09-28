import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { estAdmin } from "../roles.js";
import BoutonRechargeCredits from "./BoutonRechargeCredits.jsx";

// Bandeau global affiché dès qu'une fonction IA échoue faute de crédit sur
// l'API Claude (événement "ia:credits-epuises" émis par api.js). Seul un
// admin a accès au compte Anthropic : un agent est invité à le prévenir.
export default function AlerteCreditsIA() {
  const { utilisateur } = useAuth();
  const [alerte, setAlerte] = useState(null);

  useEffect(() => {
    function onCreditsEpuises(ev) {
      setAlerte(ev.detail);
    }
    window.addEventListener("ia:credits-epuises", onCreditsEpuises);
    return () => window.removeEventListener("ia:credits-epuises", onCreditsEpuises);
  }, []);

  if (!alerte) return null;
  const estAdminConnecte = estAdmin(utilisateur);

  return (
    <div
      role="alert"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] w-[min(760px,calc(100vw-1.5rem))] rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 shadow-2xl px-4 py-3 flex flex-wrap items-center gap-3"
    >
      <span className="text-xl" aria-hidden>
        ⚠️
      </span>
      <div className="flex-1 min-w-[220px]">
        <p className="text-sm font-semibold text-red-800 dark:text-red-300">{alerte.message}</p>
        <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
          {estAdminConnecte
            ? "Rechargez le compte Anthropic (activez aussi le « rechargement automatique » pour ne plus être bloqué), puis relancez l'action."
            : "Prévenez votre administrateur : lui seul peut recharger le compte."}
        </p>
      </div>
      {estAdminConnecte && <BoutonRechargeCredits lien={alerte.lien} />}
      <button
        onClick={() => setAlerte(null)}
        title="Fermer"
        className="text-red-400 hover:text-red-700 dark:hover:text-red-200 text-lg leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}
