import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useSupervision } from "../SupervisionContext.jsx";

// Bandeau "Mode Manager" : rappelle en permanence qu'un admin consulte le
// pipeline d'un agent plutôt que le sien (évite toute confusion — ex. assigner
// un dossier en pensant agir sur son propre compte), avec un résumé de ses
// alertes (non-lus, leads, RDV) sans exposer le contenu de ses conversations.
export default function BanniereSupervision() {
  const { agentSupervise, setAgentSupervise } = useSupervision();
  const [notifs, setNotifs] = useState(null);

  useEffect(() => {
    if (!agentSupervise) {
      setNotifs(null);
      return;
    }
    let annule = false;
    api
      .getNotifications(agentSupervise.id)
      .then((d) => !annule && setNotifs(d))
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [agentSupervise]);

  if (!agentSupervise) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-amber-800 dark:text-amber-300">
          👁 Mode Manager — vous visualisez le compte de {agentSupervise.prenom || agentSupervise.email}
        </span>
        {notifs && (
          <span className="text-amber-700 dark:text-amber-400 text-xs">
            {notifs.messagesNonLus} message{notifs.messagesNonLus > 1 ? "s" : ""} non lu
            {notifs.messagesNonLus > 1 ? "s" : ""} · {notifs.nouveauxLeads.length} nouveau
            {notifs.nouveauxLeads.length > 1 ? "x" : ""} lead{notifs.nouveauxLeads.length > 1 ? "s" : ""} ·{" "}
            {notifs.rdvAVenir.length} RDV à venir · {notifs.fichesPotentielles?.length || 0} fiche
            {(notifs.fichesPotentielles?.length || 0) > 1 ? "s" : ""} potentielle
            {(notifs.fichesPotentielles?.length || 0) > 1 ? "s" : ""} en attente
          </span>
        )}
      </div>
      <button
        onClick={() => setAgentSupervise(null)}
        className="text-xs font-medium text-amber-800 dark:text-amber-300 border border-amber-400 dark:border-amber-700 rounded-full px-3 py-1 hover:bg-amber-100 dark:hover:bg-amber-900/50"
      >
        Quitter le mode supervision
      </button>
    </div>
  );
}
