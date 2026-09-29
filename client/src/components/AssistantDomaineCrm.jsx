import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

function idUnique() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const ACCUEIL_TEXTE =
  "Posez-moi une question sur l'OETH, la contribution, la surcontribution, ESAT Tremplin ou TIH — je réponds à partir des chiffres exacts du CRM (barème, SMIC, seuils), jamais approximés.";

// Bouton flottant rond "Assist", centré en bas de l'écran : il ne recouvre
// ni les panneaux d'outils (argumentaire, script, ESAT…) ancrés à droite, ni
// le chat d'équipe (ChatWidget.jsx, en bas à droite), même ouvert. Contrairement au chat d'équipe, ce n'est pas une messagerie
// entre collègues : chaque question part vers l'IA (repondreQuestionDomaine
// côté serveur), qui répond UNIQUEMENT à partir des chiffres réels injectés
// dans son prompt (voir rechercheContact.js) — jamais une réponse inventée,
// et jamais liée à une entreprise précise (usage général de préparation
// d'appel, contrairement à AssistantContactIA.jsx qui porte sur UNE fiche).
export default function AssistantDomaineCrm() {
  const [ouvert, setOuvert] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [messages, enCours]);

  async function poserQuestion(ev) {
    ev.preventDefault();
    const texte = question.trim();
    if (!texte || enCours) return;
    setMessages((m) => [...m, { id: idUnique(), auteur: "agent", texte }]);
    setQuestion("");
    setEnCours(true);
    setErreur(null);
    try {
      const { reponse } = await api.demanderAssistantDomaine(texte);
      setMessages((m) => [...m, { id: idUnique(), auteur: "assistant", texte: reponse }]);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-2xl flex items-center justify-center transition"
        title="Assistance OETH — questions de connaissance métier"
        aria-label="Ouvrir l'assistance OETH"
      >
        Assist
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[380px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-2rem)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <span className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 flex items-center justify-center">
          🎓
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">Assistance OETH</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Questions de connaissance métier, réponse IA immédiate</p>
        </div>
        <button
          onClick={() => setOuvert(false)}
          aria-label="Fermer"
          className="w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div className="rounded-2xl rounded-bl-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{ACCUEIL_TEXTE}</p>
        </div>
        {messages.map((m) =>
          m.auteur === "agent" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-teal-600 text-white text-sm px-3.5 py-2">{m.texte}</p>
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%] rounded-2xl rounded-bl-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5">
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{m.texte}</p>
            </div>
          )
        )}
        {enCours && (
          <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:120ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:240ms]" />
          </div>
        )}
        {erreur && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-2.5">
            {erreur}
          </p>
        )}
        <div ref={finRef} />
      </div>

      <form onSubmit={poserQuestion} className="flex gap-2 p-3 border-t border-slate-200 dark:border-slate-700">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex : à partir de combien de salariés c'est 500 SMIC ?"
          aria-label="Votre question"
          className="flex-1 min-w-0 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="submit"
          disabled={!question.trim() || enCours}
          aria-label="Envoyer"
          className="w-11 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold disabled:opacity-40"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
