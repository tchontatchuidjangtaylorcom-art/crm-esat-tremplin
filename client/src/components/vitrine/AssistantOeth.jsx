import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FAQ, trouverReponse } from "./contenuFaq.js";
import { EMAIL_OFFICIEL } from "./contenuVigilance.js";
import PriseRendezVous from "./PriseRendezVous.jsx";

const ACCUEIL = {
  auteur: "assistant",
  texte:
    "Bonjour ! Je suis l'assistant automatique du Pôle OETH / AGEFIPH. Je réponds aux questions générales : quota de 6 %, DSN, contribution, surcontribution, déductions, vigilance. Pour votre situation précise, un expert peut échanger avec vous.",
};

// Raccourcis : chacun renvoie vers une entrée de la FAQ.
const RACCOURCIS = [
  { label: "Calcul 6 %", faq: "quota" },
  { label: "DSN / échéance", faq: "quand-declarer" },
  { label: "Contribution", faq: "contribution" },
  { label: "Surcontribution", faq: "majoree" },
  { label: "Vigilance", faq: "sollicitation" },
];

// Horaires des experts : du lundi au vendredi, 8h45-18h, heure de Paris
// (mêmes horaires que les créneaux de rendez-vous, voir vitrineRdv.js).
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export function statutExperts(maintenant = new Date()) {
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(maintenant)
      .map((p) => [p.type, p.value])
  );
  const jour = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parties.weekday);
  const minutes = Number(parties.hour) * 60 + Number(parties.minute);
  const ouvre = jour >= 1 && jour <= 5;
  if (ouvre && minutes >= 8 * 60 + 45 && minutes < 18 * 60) {
    return { ouvert: true, texte: "Experts disponibles jusqu'à 18h (lun.–ven. 8h45–18h)" };
  }
  // Prochaine ouverture : aujourd'hui si avant 8h45 un jour ouvré, sinon le
  // prochain jour ouvré.
  if (ouvre && minutes < 8 * 60 + 45) return { ouvert: false, texte: "Experts disponibles aujourd'hui dès 8h45" };
  let suivant = (jour + 1) % 7;
  while (suivant === 0 || suivant === 6) suivant = (suivant + 1) % 7;
  const quand = suivant === (jour + 1) % 7 ? "demain" : JOURS[suivant];
  return { ouvert: false, texte: `Experts disponibles ${quand} dès 8h45 (lun.–ven. 8h45–18h)` };
}

// Assistant du coin inférieur gauche. Volontairement présenté comme
// automatique (aucun faux conseiller "en ligne") : il répond uniquement à
// partir de la FAQ vérifiée (contenuFaq.js) et, s'il ne trouve pas, propose
// un échange avec un expert (prise de rendez-vous) ou un e-mail.
export default function AssistantOeth({ ouvert, onBasculer, onFermer }) {
  const [messages, setMessages] = useState([ACCUEIL]);
  const [saisie, setSaisie] = useState("");
  const [reflexion, setReflexion] = useState(false);
  const [rdvOuvert, setRdvOuvert] = useState(false);
  const fermerRdv = useCallback(() => setRdvOuvert(false), []);
  const finRef = useRef(null);
  const [experts, setExperts] = useState(statutExperts);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [messages, reflexion, ouvert]);

  // Statut des experts rafraîchi chaque minute tant que le panneau est ouvert.
  useEffect(() => {
    if (!ouvert) return undefined;
    setExperts(statutExperts());
    const minuteur = setInterval(() => setExperts(statutExperts()), 60000);
    return () => clearInterval(minuteur);
  }, [ouvert]);

  function repondre(question, itemImpose = null) {
    if (!question.trim()) return;
    setMessages((m) => [...m, { auteur: "visiteur", texte: question }]);
    setSaisie("");
    setReflexion(true);
    const item = itemImpose || trouverReponse(question);
    setTimeout(() => {
      setReflexion(false);
      setMessages((m) => [
        ...m,
        item
          ? { auteur: "assistant", texte: item.reponse, lien: item.lien, source: item.question }
          : {
              auteur: "assistant",
              texte:
                "Je n'ai pas de réponse fiable à cette question. Un expert du pôle peut vous répondre précisément : réservez un échange ou écrivez-nous.",
              escalade: true,
            },
      ]);
    }, 450);
  }

  function raccourci(r) {
    const item = FAQ.find((q) => q.id === r.faq);
    repondre(item ? item.question : r.label, item);
  }

  return (
    <>
      <div className="fixed left-3 sm:left-4 bottom-24 sm:bottom-5 z-[60] flex flex-col items-start gap-2">
        {ouvert && (
          <div
            role="dialog"
            aria-label="Assistant OETH"
            className="w-[370px] max-w-[calc(100vw-1.5rem)] h-[min(560px,calc(100vh-9rem))] rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 text-slate-900 dark:text-white shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex h-1">
              <span className="flex-1 bg-marine-500" />
              <span className="flex-1 bg-white" />
              <span className="flex-1 bg-red-500" />
            </div>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-900/10 dark:border-white/10">
              <span className="w-9 h-9 rounded-xl bg-teal-400/15 border border-teal-400/30 text-teal-700 dark:text-teal-300 flex items-center justify-center text-lg">
                🤖
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Assistant OETH</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Réponses automatiques · disponible 24 h/24</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${experts.ouvert ? "bg-emerald-400" : "bg-slate-400"}`} />
                  {experts.texte}
                </p>
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
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-teal-400 text-marine-950 text-sm px-3.5 py-2">{m.texte}</p>
                  </div>
                ) : (
                  <div key={i} className="max-w-[92%] rounded-2xl rounded-bl-md border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.04] dark:bg-white/[0.04] px-3.5 py-2.5">
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{m.texte}</p>
                    {m.lien &&
                      (m.lien.href ? (
                        <a
                          href={m.lien.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs font-semibold text-teal-700 dark:text-teal-300 hover:underline mt-2"
                        >
                          {m.lien.label} ↗
                        </a>
                      ) : (
                        <Link to={m.lien.to} onClick={onFermer} className="inline-block text-xs font-semibold text-teal-700 dark:text-teal-300 hover:underline mt-2">
                          {m.lien.label} →
                        </Link>
                      ))}
                    {m.escalade && (
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        <button
                          type="button"
                          onClick={() => setRdvOuvert(true)}
                          className="rounded-lg bg-teal-400 hover:bg-teal-300 text-marine-950 text-xs font-bold px-3 py-1.5"
                        >
                          Parler à un expert
                        </button>
                        <a
                          href={`mailto:${EMAIL_OFFICIEL}`}
                          className="rounded-lg border border-slate-900/20 dark:border-white/20 text-xs font-semibold px-3 py-1.5 hover:bg-slate-900/10 dark:hover:bg-white/10"
                        >
                          Nous écrire
                        </a>
                      </div>
                    )}
                    {m.source && <p className="text-[10px] text-slate-500 mt-1.5">Source : FAQ — « {m.source} »</p>}
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
                    className="rounded-full border border-teal-400/30 bg-teal-400/10 text-teal-700 dark:text-teal-200 text-[11px] font-medium px-2.5 py-1 hover:bg-teal-400/20"
                  >
                    {r.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRdvOuvert(true)}
                  className="rounded-full bg-teal-400 hover:bg-teal-300 text-marine-950 text-[11px] font-bold px-2.5 py-1"
                >
                  👤 Parler à un expert
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
                  placeholder="Posez votre question OETH ou DOETH…"
                  aria-label="Votre question"
                  className="flex-1 min-w-0 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <button
                  type="submit"
                  disabled={!saisie.trim()}
                  aria-label="Envoyer"
                  className="w-11 rounded-xl bg-teal-400 hover:bg-teal-300 text-marine-950 font-bold disabled:opacity-40"
                >
                  ➤
                </button>
              </form>
              <p className="text-[10px] text-slate-500 leading-snug py-2">
                Assistant automatique : réponses générales à caractère informatif. Votre situation (effectifs, justificatifs)
                doit être vérifiée avant toute déclaration.
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onBasculer}
          aria-expanded={ouvert}
          className="flex items-center gap-2 rounded-2xl bg-marine-600 hover:bg-marine-500 text-white text-sm font-semibold pl-3 pr-4 py-2.5 shadow-2xl border border-marine-400/40 transition"
        >
          <span className="w-7 h-7 rounded-lg bg-slate-900/15 dark:bg-white/15 flex items-center justify-center">💬</span>
          Assistance OETH
        </button>
      </div>

      {rdvOuvert && <PriseRendezVous onFermer={fermerRdv} />}
    </>
  );
}
