import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { usePresence } from "../PresenceContext.jsx";
import { useFicheOuverte } from "../ficheOuverte.js";
import { declencherPointeurAssistant } from "../assistantActions.js";

function idUnique() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const ACCUEIL_TEXTE =
  "Posez-moi une question sur l'OETH (contribution, surcontribution, ESAT Tremplin, TIH) ou sur l'utilisation du CRM — \"comment j'envoie un mail ?\", \"comment je retrouve un numéro ?\" — je réponds à partir des chiffres exacts du CRM et je peux pointer directement l'endroit concerné.";

// Clé d'action renvoyée par le serveur (voir ACTIONS_ASSISTANT dans
// rechercheContact.js) → où elle s'applique (une fiche ouverte, le tableau
// de bord, ou n'importe quelle page) et comment la déclencher. "ouvrirOutil"
// réutilise l'événement "outils-vente:ouvrir" déjà écouté par
// OutilsVenteLayout.jsx ; les autres sont pointées via assistantActions.js,
// chaque composant concerné écoutant sa propre clé.
const ACTIONS = {
  ecrire_mail: { page: "fiche" },
  recherche_numero: { page: "fiche" },
  statut: { page: "fiche" },
  historique: { page: "fiche" },
  pdf: { page: "fiche" },
  argumentaire: { page: null, ouvrirOutil: "argumentaire" },
  script_appel: { page: null, ouvrirOutil: "script" },
  modeles_mails: { page: null, ouvrirOutil: "mails" },
  esat_tremplin: { page: null, ouvrirOutil: "esat" },
  recherche_entreprise: { page: "dashboard" },
};

// Bouton flottant rond "Assist", en bas à gauche de l'écran : il ne recouvre
// ni les panneaux d'outils (argumentaire, script, ESAT…) ancrés à droite, ni
// le chat d'équipe (ChatWidget.jsx, en bas à droite), même ouvert. Contrairement au chat d'équipe, ce n'est pas une messagerie
// entre collègues : chaque question part vers l'IA (repondreQuestionDomaine
// côté serveur), qui répond à partir des chiffres réels injectés dans son
// prompt (voir rechercheContact.js) — jamais une réponse inventée — et peut
// en plus désigner une action pour pointer/ouvrir directement la bonne zone
// de l'interface, contrairement à AssistantContactIA.jsx qui porte sur UNE
// fiche précise.
function AssistantDomaineCrm() {
  const [ouvert, setOuvert] = useState(false);
  // Le bandeau "Chrono en pause" (PresenceContext) occupe aussi le coin bas
  // gauche : on remonte alors le bouton juste au-dessus.
  const { enPause } = usePresence();
  const bas = enPause ? "bottom-16" : "bottom-4";
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const finRef = useRef(null);
  const ficheOuverte = useFicheOuverte();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [messages, enCours]);

  // Exécute l'action désignée par l'IA : navigue d'abord si elle ne
  // s'applique pas à la page actuelle, puis ouvre le panneau d'outils
  // concerné ou pointe (scroll + halo) l'élément concerné.
  function executerAction(cle) {
    const config = ACTIONS[cle];
    if (!config) return;
    if (config.page === "fiche" && !ficheOuverte) return; // sécurité : le serveur ne devrait déjà pas la renvoyer
    const changeDePage = config.page === "dashboard" && location.pathname !== "/";
    if (changeDePage) navigate("/");

    const declencher = () => {
      if (config.ouvrirOutil) window.dispatchEvent(new CustomEvent("outils-vente:ouvrir", { detail: config.ouvrirOutil }));
      else declencherPointeurAssistant(cle);
    };
    // Laisse la page de destination se monter avant de pointer dessus.
    if (changeDePage) setTimeout(declencher, 300);
    else declencher();
  }

  async function poserQuestion(ev) {
    ev.preventDefault();
    const texte = question.trim();
    if (!texte || enCours) return;
    setMessages((m) => [...m, { id: idUnique(), auteur: "agent", texte }]);
    setQuestion("");
    setEnCours(true);
    setErreur(null);
    try {
      const { reponse, action } = await api.demanderAssistantDomaine(texte, {
        ficheOuverte: Boolean(ficheOuverte),
        statutFiche: ficheOuverte?.statut || null,
      });
      setMessages((m) => [...m, { id: idUnique(), auteur: "assistant", texte: reponse }]);
      if (action) executerAction(action);
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
        className={`fixed ${bas} left-4 z-40 w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-2xl flex items-center justify-center transition`}
        title="Assistance — connaissance métier OETH et aide à l'utilisation du CRM"
        aria-label="Ouvrir l'assistance"
      >
        Assist
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 w-[380px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-2rem)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <span className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 flex items-center justify-center">
          🎓
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">Assistance</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">OETH et utilisation du CRM, réponse IA immédiate</p>
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
          placeholder="Ex : comment j'envoie un mail ? / à partir de combien de salariés c'est 500 SMIC ?"
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

// Fonction IA (payante) : réservée aux administrateurs.
// Visible de tous (agents compris) : le serveur plafonne les questions des
// agents à 30 par jour (voir /api/assistant-domaine).
export default AssistantDomaineCrm;
