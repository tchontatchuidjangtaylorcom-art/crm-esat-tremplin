import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SceneDarkTech from "./SceneDarkTech.jsx";

gsap.registerPlugin(ScrollTrigger);

const PILIERS = [
  {
    titre: "La compétence avant tout",
    texte: "Un poste confié pour ce que la personne sait faire, pas pour combler un quota : la meilleure base d'une intégration qui dure.",
  },
  {
    titre: "L'épanouissement et la fierté",
    texte: "Un salaire, une équipe, une progression : le travail direct ouvre un accès concret à l'autonomie et à la reconnaissance sociale du métier exercé.",
  },
  {
    titre: "Une richesse pour l'entreprise",
    texte: "Diversifier ses équipes, c'est gagner en agilité, en créativité et en cohésion — l'inclusion profite à tout le collectif de travail.",
  },
];

// Ombre portée uniforme pour garder le texte lisible SANS bloc opaque
// derrière : contrairement à un panneau "verre" plein, ça laisse le fond
// Dark Tech (grille + flux + réseau, voir SceneDarkTech.jsx) entièrement
// visible autour des lettres.
const OMBRE_TEXTE = { textShadow: "0 2px 24px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.8)" };

// Récit au scroll en plein écran, piloté par GSAP + ScrollTrigger (pin +
// scrub). Fond continu "Dark Tech / Terminal" (un seul canvas, voir
// SceneDarkTech.jsx) dont l'intensité/teinte suit `progression` — remplace
// les illustrations de personnages essayées puis écartées (trop
// "dessin animé", pas assez premium). Le texte flotte directement sur ce
// fond, sans panneau opaque : seule une ombre portée assure la lisibilité,
// pour que l'arrière-plan reste visible en permanence, y compris derrière
// les mots.
export default function RecitImmersif({ onOuvrirSimulateur }) {
  const sectionRef = useRef(null);
  const stage1Ref = useRef(null);
  const stage2Ref = useRef(null);
  const stage3Ref = useRef(null);
  const pilierRefs = useRef([]);
  const scrollCueRef = useRef(null);
  const [progression, setProgression] = useState(0);
  const [etapeActive, setEtapeActive] = useState(0);
  const [pilierActif, setPilierActif] = useState(0);
  const [reduitMouvement, setReduitMouvement] = useState(false);

  useEffect(() => {
    setReduitMouvement(Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
  }, []);

  useEffect(() => {
    if (reduitMouvement) return; // voir le rendu alternatif ci-dessous

    const ctx = gsap.context(() => {
      gsap.set([stage2Ref.current, stage3Ref.current], { autoAlpha: 0, y: 0 });
      gsap.set(pilierRefs.current, { opacity: 0.32, scale: 0.95 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=350%",
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          onUpdate: (self) => setProgression(self.progress),
        },
      });

      tl.to(scrollCueRef.current, { autoAlpha: 0, duration: 0.15 }, 0)
        .to({}, { duration: 1.3 })
        .addLabel("versConvictions")
        .to(stage1Ref.current, { autoAlpha: 0, y: -40, duration: 0.6 }, "versConvictions")
        .to(stage2Ref.current, { autoAlpha: 1, duration: 0.6 }, "versConvictions")
        .call(() => {
          setEtapeActive(1);
          setPilierActif(0);
        }, null, "versConvictions")
        .to(pilierRefs.current[0], { opacity: 1, scale: 1, duration: 0.5 }, "versConvictions")
        .to({}, { duration: 0.7 })
        .to(pilierRefs.current[0], { opacity: 0.32, scale: 0.95, duration: 0.5 })
        .to(pilierRefs.current[1], { opacity: 1, scale: 1, duration: 0.5 }, "<")
        .call(() => setPilierActif(1))
        .to({}, { duration: 0.7 })
        .to(pilierRefs.current[1], { opacity: 0.32, scale: 0.95, duration: 0.5 })
        .to(pilierRefs.current[2], { opacity: 1, scale: 1, duration: 0.5 }, "<")
        .call(() => setPilierActif(2))
        .to({}, { duration: 0.9 })
        .addLabel("versCitation")
        .to(stage2Ref.current, { autoAlpha: 0, y: -40, duration: 0.6 }, "versCitation")
        .to(stage3Ref.current, { autoAlpha: 1, duration: 0.6 }, "versCitation")
        .call(() => setEtapeActive(2), null, "versCitation")
        .to({}, { duration: 2 })
        .to(stage3Ref.current, { autoAlpha: 0, y: -40, duration: 0.6 })
        .call(() => setEtapeActive(0), null, "<")
        .to({}, { duration: 0.3 });
    }, sectionRef);

    return () => ctx.revert();
  }, [reduitMouvement]);

  const convictions = (
    <div className="max-w-5xl mx-auto">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-marine-300 mb-10 text-center" style={OMBRE_TEXTE}>
        Notre conviction
      </p>
      <div className="grid sm:grid-cols-3 gap-10 sm:gap-12">
        {PILIERS.map((bloc, i) => (
          <div key={bloc.titre} ref={(el) => (pilierRefs.current[i] = el)}>
            <span
              className="block text-4xl font-bold mb-3 transition-colors"
              style={{ ...OMBRE_TEXTE, color: pilierActif === i || reduitMouvement ? "#fbbf7a" : "#6f86a8" }}
            >
              0{i + 1}
            </span>
            <h3 className="font-semibold text-lg mb-2.5 text-white" style={OMBRE_TEXTE}>
              {bloc.titre}
            </h3>
            <p className="text-sm text-marine-100/90 leading-relaxed" style={OMBRE_TEXTE}>
              {bloc.texte}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  const contenuHero = (
    <div className="max-w-3xl mx-auto text-center">
      <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-marine-300 mb-6" style={OMBRE_TEXTE}>
        Portail Opérationnel OETH
      </p>
      <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight" style={OMBRE_TEXTE}>
        L'inclusion n'est pas
        <br />
        une case à cocher.
      </h1>
      <p className="text-marine-100/90 text-lg sm:text-xl max-w-xl mx-auto mt-7 leading-relaxed" style={OMBRE_TEXTE}>
        Le Pôle OETH / AGEFIPH accompagne les entreprises vers la conformité légale — et vers un recrutement direct
        qui change durablement une trajectoire professionnelle.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
        <button
          onClick={onOuvrirSimulateur}
          className="rounded-full bg-white text-marine-900 text-sm font-semibold px-7 py-3.5 hover:bg-marine-100 transition shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
        >
          Estimer vos obligations
        </button>
      </div>
    </div>
  );

  const citation = (
    <div className="max-w-3xl mx-auto text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-marine-300 mb-8" style={OMBRE_TEXTE}>
        Ce qui compte vraiment
      </p>
      <h2 className="text-3xl sm:text-5xl font-bold text-white leading-tight" style={OMBRE_TEXTE}>
        Le recrutement direct change une vie professionnelle —{" "}
        <span className="text-marine-300">pas seulement un chiffre de conformité.</span>
      </h2>
      <p className="text-xs text-marine-200/80 mt-10 max-w-2xl mx-auto leading-relaxed" style={OMBRE_TEXTE}>
        Le recrutement direct reste la voie la plus durable vers l'inclusion ; l'accompagnement Cap Emploi et les
        solutions ESAT/EA demeurent des leviers complémentaires précieux, en particulier pour les parcours qui ont
        besoin d'un cadre plus soutenant.
      </p>
    </div>
  );

  // Rendu accessible (prefers-reduced-motion) : les 3 étapes restent
  // consultables, empilées normalement, sans pin ni scrub.
  if (reduitMouvement) {
    return (
      <div className="relative bg-black">
        {[contenuHero, convictions, citation].map((contenu, i) => (
          <div key={i} className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden">
            <SceneDarkTech progression={i / 2} />
            {contenu}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={sectionRef} className="relative h-screen overflow-hidden bg-black">
      <div className="bandeau-tricolore absolute top-0 inset-x-0 z-30">
        <span className="bg-marine-400" />
        <span className="bg-white" />
        <span className="bg-red-600" />
      </div>

      <SceneDarkTech progression={progression} />

      {/* Repère d'étapes du récit. */}
      <div className="hidden sm:flex flex-col items-center gap-3 absolute right-6 top-1/2 -translate-y-1/2 z-30">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-1.5 rounded-full transition-all duration-500 ${etapeActive === i ? "h-8 bg-white" : "h-1.5 bg-white/25"}`}
          />
        ))}
      </div>

      {/* Étape 1 — accroche */}
      <div ref={stage1Ref} className="absolute inset-0 z-10 flex items-center justify-center px-6">
        {contenuHero}
      </div>

      {/* Étape 2 — convictions (01/02/03) */}
      <div ref={stage2Ref} className="absolute inset-0 z-10 flex items-center justify-center px-6 opacity-0 invisible">
        {convictions}
      </div>

      {/* Étape 3 — citation forte */}
      <div ref={stage3Ref} className="absolute inset-0 z-10 flex items-center justify-center px-6 opacity-0 invisible">
        {citation}
      </div>

      {/* Invite au scroll — uniquement au tout début du récit. */}
      <div
        ref={scrollCueRef}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 text-white/70"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={OMBRE_TEXTE}>
          Scroll to explore
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5 animate-fleche-rebond">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}
