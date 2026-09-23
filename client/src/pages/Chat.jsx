import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useChat } from "../chat/ChatContext.jsx";
import ConversationList from "../chat/ConversationList.jsx";
import MessageThread from "../chat/MessageThread.jsx";

// Version plein écran du chat interne — même état partagé (ChatContext) que
// le widget flottant : ouvrir une conversation ici la marque lue partout.
export default function Chat() {
  const { canaux } = useChat();
  const location = useLocation();
  // Ouverture directe depuis le centre de notifications (voir
  // NotificationCenter.jsx, navigate("/chat", { state: { canalId } })).
  const [canalActifId, setCanalActifId] = useState(location.state?.canalId || null);
  const canalActif = canaux.find((c) => c.id === canalActifId) || null;

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        &larr; Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-3 mb-6">Chat interne</h1>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm flex h-[70vh] min-h-[420px] overflow-hidden">
        <div className="w-72 shrink-0 border-r border-slate-200 dark:border-slate-700">
          <ConversationList canalActifId={canalActifId} onSelect={setCanalActifId} />
        </div>
        <div className="flex-1 min-w-0">
          <MessageThread canalId={canalActifId} nomCanal={canalActif?.nom} />
        </div>
      </div>
    </div>
  );
}
