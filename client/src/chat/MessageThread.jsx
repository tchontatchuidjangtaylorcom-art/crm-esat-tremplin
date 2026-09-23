import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useChat } from "./ChatContext.jsx";
import { useAuth } from "../AuthContext.jsx";
import { formatDateHeure } from "../constants.js";

const INTERVALLE_POLLING_MS = 5000;

// Fil de messages d'un canal : sondage rapproché tant qu'il est ouvert
// (l'utilisateur regarde activement cette conversation), marque le canal lu
// à l'ouverture et à chaque nouveau message reçu pendant que la fenêtre est
// affichée.
export default function MessageThread({ canalId, nomCanal }) {
  const { marquerLu } = useChat();
  const { utilisateur } = useAuth();
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const finRef = useRef(null);

  useEffect(() => {
    if (!canalId) return;
    let annule = false;

    function charger() {
      api
        .listMessagesChat(canalId)
        .then((liste) => {
          if (annule) return;
          setMessages(liste);
          marquerLu(canalId);
        })
        .catch((e) => !annule && setErreur(e.message));
    }

    charger();
    const id = setInterval(charger, INTERVALLE_POLLING_MS);
    return () => {
      annule = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalId]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function envoyer(ev) {
    ev.preventDefault();
    if (!texte.trim()) return;
    setEnvoi(true);
    try {
      const message = await api.envoyerMessageChat(canalId, texte.trim());
      setMessages((prev) => [...prev, message]);
      setTexte("");
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (!canalId) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Sélectionnez une conversation.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {nomCanal && (
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 font-semibold text-sm text-slate-800 dark:text-slate-100">
          {nomCanal}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m) => {
          const deMoi = m.auteurId === utilisateur?.id;
          return (
            <div key={m.id} className={`flex ${deMoi ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-3 py-1.5 text-sm ${
                  deMoi
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                }`}
              >
                {!deMoi && <p className="text-[11px] font-semibold opacity-70 mb-0.5">{m.auteurNom}</p>}
                <p className="whitespace-pre-wrap break-words">{m.texte}</p>
                <p className={`text-[10px] mt-0.5 ${deMoi ? "text-slate-300" : "text-slate-400 dark:text-slate-500"}`}>
                  {formatDateHeure(m.date)}
                </p>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <p className="text-sm text-slate-400 text-center mt-4">Aucun message pour l'instant.</p>}
        <div ref={finRef} />
      </div>

      {erreur && <p className="px-3 text-xs text-red-600 dark:text-red-400">{erreur}</p>}

      <form onSubmit={envoyer} className="flex gap-2 p-2.5 border-t border-slate-200 dark:border-slate-700">
        <input
          type="text"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Écrire un message…"
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={envoi || !texte.trim()}
          className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium px-3 disabled:opacity-40"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
