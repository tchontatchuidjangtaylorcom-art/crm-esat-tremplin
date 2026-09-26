import { useEffect, useRef, useState } from "react";
import { AIDES, texteAudio } from "./aideSimulateur.js";

const SYNTHESE_DISPONIBLE = typeof window !== "undefined" && "speechSynthesis" in window;

// Petit bouton ⓘ placé à côté d'un libellé : ouvre la fiche d'aide `cle`.
export function InfoBouton({ cle, onOuvrir }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOuvrir(cle);
      }}
      aria-label={`En savoir plus : ${AIDES[cle]?.titre || ""}`}
      title="En savoir plus"
      className="inline-flex items-center justify-center w-4 h-4 ml-1.5 align-[-2px] rounded-full border border-marine-400/60 text-marine-300 text-[10px] font-bold leading-none hover:bg-marine-500 hover:text-white hover:border-marine-400 transition"
    >
      i
    </button>
  );
}

// Fenêtre d'explication (terminologie + calcul + conseil), même habillage que
// la carte du simulateur (liseré tricolore). Fermeture par la croix ✕ bien
// visible, la touche Échap ou un clic à l'extérieur. Bouton "Écouter" :
// synthèse vocale native du navigateur (Web Speech API, voix française),
// gratuite et sans serveur ; la lecture s'arrête à la fermeture.
export default function AideModale({ cle, onFermer }) {
  const aide = AIDES[cle];
  const [lecture, setLecture] = useState("arret"); // arret | lecture | pause
  const boutonFermerRef = useRef(null);

  useEffect(() => {
    boutonFermerRef.current?.focus();
    function onTouche(e) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("keydown", onTouche);
    const overflowPrecedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onTouche);
      document.body.style.overflow = overflowPrecedent;
      if (SYNTHESE_DISPONIBLE) window.speechSynthesis.cancel();
    };
  }, [onFermer]);

  if (!aide) return null;

  function basculerLecture() {
    const synth = window.speechSynthesis;
    if (lecture === "lecture") {
      synth.pause();
      setLecture("pause");
      return;
    }
    if (lecture === "pause") {
      synth.resume();
      setLecture("lecture");
      return;
    }
    synth.cancel();
    const enonce = new SpeechSynthesisUtterance(texteAudio(aide));
    enonce.lang = "fr-FR";
    enonce.rate = 1;
    const voixFr = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("fr"));
    if (voixFr) enonce.voice = voixFr;
    enonce.onend = () => setLecture("arret");
    enonce.onerror = () => setLecture("arret");
    synth.speak(enonce);
    setLecture("lecture");
  }

  function arreterLecture() {
    window.speechSynthesis.cancel();
    setLecture("arret");
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onFermer()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="aide-titre"
    >
      <div className="relative w-full max-w-lg bg-marine-950 border border-white/10 rounded-2xl shadow-2xl my-8 overflow-hidden text-white">
        <div className="flex h-1">
          <span className="flex-1 bg-marine-500" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-red-500" />
        </div>

        <button
          ref={boutonFermerRef}
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          title="Fermer"
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 sm:px-7 pt-6 pb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marine-400 pr-10">Comprendre</p>
          <h3 id="aide-titre" className="font-bold text-xl mt-1 pr-10">
            {aide.titre}
          </h3>

          {SYNTHESE_DISPONIBLE && (
            <div className="flex items-center gap-2 mt-4">
              <button
                type="button"
                onClick={basculerLecture}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium px-4 py-2 transition"
              >
                <span aria-hidden>{lecture === "lecture" ? "⏸" : "🔊"}</span>
                {lecture === "lecture" ? "Pause" : lecture === "pause" ? "Reprendre" : "Écouter"}
              </button>
              {lecture !== "arret" && (
                <button
                  type="button"
                  onClick={arreterLecture}
                  className="rounded-full text-sm text-slate-400 hover:text-white px-3 py-2 transition"
                >
                  ⏹ Arrêter
                </button>
              )}
            </div>
          )}

          <div className="mt-5 space-y-4 text-sm leading-relaxed">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">C'est quoi ?</p>
              <p className="text-slate-200">{aide.definition}</p>
            </div>
            <div className="rounded-xl border border-teal-400/20 bg-teal-400/[0.06] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-300 mb-1">Comment c'est calculé</p>
              <p className="text-slate-200">{aide.calcul}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Ce que ça change pour vous</p>
              <p className="text-slate-300">{aide.conseil}</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              {aide.sources.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-marine-300 hover:text-marine-200 hover:underline"
                >
                  {s.label} ↗
                </a>
              ))}
            </div>
            <button
              type="button"
              onClick={onFermer}
              className="rounded-full bg-white text-marine-900 hover:bg-marine-100 text-sm font-semibold px-5 py-2 transition"
            >
              J'ai compris
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
