import { useState } from "react";
import { useChat } from "./ChatContext.jsx";
import ConversationList from "./ConversationList.jsx";
import MessageThread from "./MessageThread.jsx";

// Widget flottant en bas à droite, visible sur toutes les pages (monté une
// fois dans App.jsx, comme le CallPanel de la téléphonie). Volontairement
// compact : la page /chat dédiée (lien "Plein écran") reste l'endroit pour
// une session de discussion prolongée.
export default function ChatWidget() {
  const { canaux, totalNonLus } = useChat();
  const [ouvert, setOuvert] = useState(false);
  const [canalActifId, setCanalActifId] = useState(null);

  const canalActif = canaux.find((c) => c.id === canalActifId) || null;

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-2xl flex items-center justify-center text-2xl hover:scale-105 transition"
        title="Chat interne"
      >
        💬
        {totalNonLus > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-xs font-bold border-2 border-white dark:border-slate-950">
            {totalNonLus > 99 ? "99+" : totalNonLus}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[420px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-2rem)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl flex overflow-hidden">
      <div className="w-40 shrink-0 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="flex items-center justify-between px-2 py-2 border-b border-slate-200 dark:border-slate-700">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Chat</span>
          <a href="/chat" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline" title="Ouvrir en plein écran">
            ⤢
          </a>
        </div>
        <div className="flex-1 min-h-0">
          <ConversationList canalActifId={canalActifId} onSelect={setCanalActifId} compact />
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-end px-2 py-1.5 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setOuvert(false)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm px-1.5"
            title="Réduire"
          >
            ✕
          </button>
        </div>
        <MessageThread canalId={canalActifId} nomCanal={canalActif?.nom} />
      </div>
    </div>
  );
}
