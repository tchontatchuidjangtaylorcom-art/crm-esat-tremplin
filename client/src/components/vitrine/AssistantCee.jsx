import { useEffect, useRef, useState } from "react";
import { FAQ_CEE, trouverReponseCee } from "./contenuFaqCee.js";

const ACCUEIL = {
  auteur: "assistant",
  texte:
    "Bonjour ! Je suis l'assistant automatique d'Eco Smart France pour le chauffage des serres agricoles (dispositif CEE, pompe à chaleur Démétherme 400). Je réponds aux questions générales sur l'offre. Pour étudier votre dossier, laissez vos coordonnées dans le formulaire : un conseiller vous recontacte.",
};

// Raccourcis : chacun renvoie vers une entrée de contenuFaqCee.js.
const RACCOURCIS = [
  { label: "Zéro euro ?", faq: "zero-euro" },
  { label: "C'est quoi les CEE ?", faq: "quest-ce-que-cee" },
  { label: "Démétherme 400", faq: "demetherme-400" },
  { label: "Pas de chauffage", faq: "pas-de-chauffage" },
  { label: "Et après ?", faq: "apres-contact" },
];

// Assistant du coin inférieur gauche de la page CEE (/vitrine/cee-serres),
// même esprit que AssistantOeth.jsx (coin inférieur gauche de la vitrine
// OETH) mais grounded sur l'offre serres agricoles : contenu séparé
// (contenuFaqCee.js), pas d'appel à un modèle de langage, pas de prise de
// rendez-vous (pas de calendrier d'experts CEE pour l'instant) — l'échappatoire
// est de renvoyer vers le formulaire de demande de contact de cette page.
// Présenté comme automatique (aucun faux conseiller "en ligne") : il répond
// uniquement à partir de contenuFaqCee.js, repris du script d'appel déjà en
// usage (server/src/scriptVente.js, SECTIONS_CEE) — jamais de zéro euro, de
// chiffre d'économie ou de délai de clôture annoncé comme acquis.
export default function AssistantCee({ ouvert, onBasculer, onFermer, idFormulaire = "demande-cee" }) {
  const [messages, setMessages] = useState([ACCUEIL]);
  const [saisie, setSaisie] = useState("");
  const [reflexion, setReflexion] = useState(false);
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [messages, reflexion, ouvert]);

  function repondre(question, itemImpose = null) {
    if (!question.trim()) return;
    setMessages((m) => [...m, { auteur: "visiteur", texte: question }]);
    setSaisie("");
    setReflexion(true);
    const item = itemImpose || trouverReponseCee(question);
    setTimeout(() => {
      setReflexion(false);
      setMessages((m) => [
        ...m,
        item
          ? { auteur: "assistant", texte: item.reponse, source: item.question }
          : {
              auteur: "assistant",
              texte:
                "Je n'ai pas de réponse fiable à cette question. Un conseiller peut vous répondre précisément après avoir pris connaissance de votre dossier : laissez vos coordonnées ci-dessous.",
              escalade: true,
            },
      ]);
    }, 450);
  }

  function raccourci(r) {
    const item = FAQ_CEE.find((q) => q.id === r.faq);
    repondre(item ? item.question : r.label, item);
  }

  function allerAuFormulaire() {
    onFermer();
    document.getElementById(idFormulaire)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="fixed left-3 sm:left-4 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:bottom-5 z-[60] flex flex-col items-start gap-2">
      {ouvert && (
        <div
          role="dialog"
          aria-label="Assistant CEE serres agricoles"
          className="w-[370px] max-w-[calc(100vw-1.5rem)] h-[min(560px,calc(100vh-9rem))] rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="h-1 bg-emerald-600" />
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-900/10 dark:border-white/10">
            <span className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-lg">
              🤖
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Assistant CEE — Serres agricoles</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Réponses automatiques · Eco Smart France</p>
            </div>
            <button
              type="button"
              onClick={() => setMessages([ACCUEIL])}
              className="rounded-md border border-slate-900/15 dark:border-white/15 text-[11px] px-2 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-white/10"
            >
              Réinitialiser
            </button>
            <button
              type="button"
              onClick={onFermer}
              aria-label="Fermer"
              className="w-7 h-7 rounded-md border border-slate-900/15 dark:border-white/15 flex items-center justify-center text-xs hover:bg-slate-900/10 dark:hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) =>
              m.auteur === "visiteur" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-emerald-600 text-white text-sm px-3.5 py-2">{m.texte}</p>
                </div>
              ) : (
                <div key={i} className="max-w-[92%] rounded-2xl rounded-bl-md border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.04] dark:bg-white/[0.04] px-3.5 py-2.5">
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{m.texte}</p>
                  {m.escalade && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      <button
                        type="button"
                        onClick={allerAuFormulaire}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5"
                      >
                        Laisser mes coordonnées
                      </button>
                    </div>
                  )}
                  {m.source && <p className="text-[10px] text-slate-500 mt-1.5">Source : « {m.source} »</p>}
                </div>
              )
            )}
            {reflexion && (
              <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.04] dark:bg-white/[0.04] px-3.5 py-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:120ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:240ms]" />
              </div>
            )}
            <div ref={finRef} />
          </div>

          <div className="px-3 pt-2 border-t border-slate-900/10 dark:border-white/10">
            <div className="flex flex-wrap gap-1.5">
              {RACCOURCIS.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => raccourci(r)}
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 text-[11px] font-medium px-2.5 py-1 hover:bg-emerald-500/20"
                >
                  {r.label}
                </button>
              ))}
              <button
                type="button"
                onClick={allerAuFormulaire}
                className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1"
              >
                👤 Laisser mes coordonnées
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                repondre(saisie);
              }}
              className="flex gap-2 mt-2"
            >
              <input
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                placeholder="Posez votre question sur l'offre serres…"
                aria-label="Votre question"
                className="flex-1 min-w-0 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={!saisie.trim()}
                aria-label="Envoyer"
                className="w-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-40"
              >
                ➤
              </button>
            </form>
            <p className="text-[10px] text-slate-500 leading-snug py-2">
              Assistant automatique : réponses générales à caractère informatif. L'éligibilité de votre dossier au dispositif
              CEE est vérifiée par un conseiller avant toute confirmation.
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onBasculer}
        aria-expanded={ouvert}
        className="flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs sm:text-sm font-semibold pl-2 pr-3 sm:pl-3 sm:pr-4 py-1.5 sm:py-2.5 shadow-2xl border border-emerald-400/40 transition"
      >
        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-white/15 flex items-center justify-center text-xs sm:text-sm">💬</span>
        <span className="sm:hidden">Assist. CEE</span>
        <span className="hidden sm:inline">Assistance CEE</span>
      </button>
    </div>
  );
}
