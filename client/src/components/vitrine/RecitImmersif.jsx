import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SceneAccueil from "./scenes/SceneAccueil.jsx";
import ScenePosteAdapte from "./scenes/ScenePosteAdapte.jsx";
import SceneEquipe from "./scenes/SceneEquipe.jsx";

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

// Panneau "verre" derrière chaque bloc de texte : fond assombri + flou, pour
// rester lisible par-dessus des scènes illustrées bien plus chargées que
// l'ancien fond en points abstraits (voir SceneAccueil/ScenePosteAdapte/
// SceneEquipe).
function PanneauVerre({ children, className = "" }) {
  return (
    <div className={`rounded-3xl bg-marine-950/55 backdrop-blur-md ring-1 ring-white/10 px-8 py-10 sm:px-12 sm:py-14 ${className}`}>
      {children}
    </div>
  );
}

// Récit au scroll en plein écran, piloté par GSAP + ScrollTrigger : un pin
// unique sur toute la traversée, avec un scrub qui anime en continu (a) le
// texte de chacune des 3 étapes (accroche → convictions → citation) et (b)
// un fondu enchaîné + zoom subtil ("Ken Burns") entre 3 scènes de fond
// illustrées représentant l'accueil, le poste de travail aménagé et l'équipe
// inclusive — remplace l'ancien fond en canvas abstrait, jugé trop statique.
// Les scènes sont des illustrations vectorielles maison (voir dossier
// scenes/), pas des photos : aucun risque de lien cassé ni de question de
// licence, et une cohérence de palette garantie avec le reste du site —
// choix fait avec l'utilisateur après discussion des alternatives (photos
// stock à sourcer/vérifier une à une, ou photos fournies par lui).
export default function RecitImmersif({ onOuvrirSimulateur }) {
  const sectionRef = useRef(null);
  const stage1Ref = useRef(null);
  const stage2Ref = useRef(null);
  const stage3Ref = useRef(null);
  const scene1Ref = useRef(null);
  const scene2Ref = useRef(null);
  const scene3Ref = useRef(null);
  const pilierRefs = useRef([]);
  const scrollCueRef = useRef(null);
  const [etapeActive, setEtapeActive] = useState(0);
  const [pilierActif, setPilierActif] = useState(0);
  const [reduitMouvement, setReduitMouvement] = useState(false);

  useEffect(() => {
    setReduitMouvement(Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
  }, []);

  useEffect(() => {
    if (reduitMouvement) return; // voir le rendu alternatif ci-dessous (contenu empilé, sans animation forcée)

    const ctx = gsap.context(() => {
      gsap.set([stage2Ref.current, stage3Ref.current], { autoAlpha: 0, y: 0 });
      gsap.set([scene2Ref.current, scene3Ref.current], { autoAlpha: 0, scale: 1.15 });
      gsap.set(pilierRefs.current, { opacity: 0.35, scale: 0.94 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=350%",
          scrub: 1,
          pin: true,
          anticipatePin: 1,
        },
      });

      tl.to(scrollCueRef.current, { autoAlpha: 0, duration: 0.15 }, 0)
        .to({}, { duration: 1.3 }) // étape 1 : temps de lecture avant la transition
        .addLabel("versConvictions")
        .to(stage1Ref.current, { autoAlpha: 0, y: -40, duration: 0.6 }, "versConvictions")
        .to(stage2Ref.current, { autoAlpha: 1, duration: 0.6 }, "versConvictions")
        .to(scene1Ref.current, { autoAlpha: 0, scale: 1.08, duration: 1 }, "versConvictions")
        .to(scene2Ref.current, { autoAlpha: 1, scale: 1, duration: 1 }, "versConvictions")
        .call(() => {
          setEtapeActive(1);
          setPilierActif(0);
        }, null, "versConvictions")
        .to(pilierRefs.current[0], { opacity: 1, scale: 1, duration: 0.5 }, "versConvictions")
        .to({}, { duration: 0.7 })
        .to(pilierRefs.current[0], { opacity: 0.35, scale: 0.94, duration: 0.5 })
        .to(pilierRefs.current[1], { opacity: 1, scale: 1, duration: 0.5 }, "<")
        .call(() => setPilierActif(1))
        .to({}, { duration: 0.7 })
        .to(pilierRefs.current[1], { opacity: 0.35, scale: 0.94, duration: 0.5 })
        .to(pilierRefs.current[2], { opacity: 1, scale: 1, duration: 0.5 }, "<")
        .call(() => setPilierActif(2))
        .to({}, { duration: 0.9 })
        .addLabel("versCitation")
        .to(stage2Ref.current, { autoAlpha: 0, y: -40, duration: 0.6 }, "versCitation")
        .to(stage3Ref.current, { autoAlpha: 1, duration: 0.6 }, "versCitation")
        .to(scene2Ref.current, { autoAlpha: 0, scale: 1.08, duration: 1 }, "versCitation")
        .to(scene3Ref.current, { autoAlpha: 1, scale: 1, duration: 1 }, "versCitation")
        .call(() => setEtapeActive(2), null, "versCitation")
        .to({}, { duration: 2 })
        .to(stage3Ref.current, { autoAlpha: 0, y: -40, duration: 0.6 })
        .call(() => setEtapeActive(0), null, "<")
        .to({}, { duration: 0.3 });
    }, sectionRef);

    return () => ctx.revert();
  }, [reduitMouvement]);

  const dotsEtape = (i) => (
    <span
      key={i}
      className={`w-1.5 rounded-full transition-all duration-500 ${etapeActive === i ? "h-8 bg-white" : "h-1.5 bg-white/30"}`}
    />
  );

  const convictions = (
    <div className="max-w-5xl mx-auto">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-marine-300 mb-10 text-center">
        Notre conviction
      </p>
      <div className="grid sm:grid-cols-3 gap-8 sm:gap-10">
        {PILIERS.map((bloc, i) => (
          <div key={bloc.titre} ref={(el) => (pilierRefs.current[i] = el)}>
            <span
              className="block text-3xl font-bold mb-3 transition-colors"
              style={{ color: pilierActif === i || reduitMouvement ? "#fbbf7a" : "#8fa9cd" }}
            >
              0{i + 1}
            </span>
            <h3 className="font-semibold text-lg mb-2.5 text-white">{bloc.titre}</h3>
            <p className="text-sm text-marine-100/85 leading-relaxed">{bloc.texte}</p>
          </div>
        ))}
      </div>
    </div>
  );

  // Rendu accessible (prefers-reduced-motion) : les 3 étapes restent
  // consultables, empilées normalement dans la page, sans pin ni scrub —
  // aucune bascule de contenu forcée par le scroll.
  if (reduitMouvement) {
    return (
      <div className="relative">
        <div className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden bg-marine-950">
          <div className="absolute inset-0"><SceneAccueil /></div>
          <div className="absolute inset-0 bg-black/45" />
          <PanneauVerre className="relative z-10 text-center max-w-4xl">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-marine-300 mb-6">
              Portail Opérationnel OETH
            </p>
            <h1 className="text-4xl sm:text-6xl font-bold text-white leading-[1.05] tracking-tight">
              L'inclusion n'est pas une case à cocher.
            </h1>
            <p className="text-marine-100/85 text-lg max-w-xl mx-auto mt-7 leading-relaxed">
              Le Pôle OETH / AGEFIPH accompagne les entreprises vers la conformité légale — et vers un recrutement
              direct qui change durablement une trajectoire professionnelle.
            </p>
            <button
              onClick={onOuvrirSimulateur}
              className="mt-10 rounded-full bg-white text-marine-900 text-sm font-semibold px-7 py-3.5 hover:bg-marine-100 transition"
            >
              Estimer vos obligations
            </button>
          </PanneauVerre>
        </div>
        <div className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden bg-marine-950">
          <div className="absolute inset-0"><ScenePosteAdapte /></div>
          <div className="absolute inset-0 bg-black/45" />
          <PanneauVerre className="relative z-10 text-center">{convictions}</PanneauVerre>
        </div>
        <div className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden bg-marine-950">
          <div className="absolute inset-0"><SceneEquipe /></div>
          <div className="absolute inset-0 bg-black/45" />
          <PanneauVerre className="relative z-10 text-center max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-marine-300 mb-8">
              Ce qui compte vraiment
            </p>
            <h2 className="text-3xl sm:text-5xl font-bold text-white leading-tight">
              Le recrutement direct change une vie professionnelle —{" "}
              <span className="text-marine-300">pas seulement un chiffre de conformité.</span>
            </h2>
          </PanneauVerre>
        </div>
      </div>
    );
  }

  return (
    <div ref={sectionRef} className="relative h-screen overflow-hidden bg-marine-950">
      <div className="bandeau-tricolore absolute top-0 inset-x-0 z-30">
        <span className="bg-marine-400" />
        <span className="bg-white" />
        <span className="bg-red-600" />
      </div>

      {/* 3 scènes illustrées, empilées et croisées en fondu + léger zoom
          (Ken Burns) par la timeline GSAP ci-dessus. */}
      <div ref={scene1Ref} className="absolute inset-0"><SceneAccueil /></div>
      <div ref={scene2Ref} className="absolute inset-0"><ScenePosteAdapte /></div>
      <div ref={scene3Ref} className="absolute inset-0"><SceneEquipe /></div>

      {/* Voile d'assombrissement — garantit un contraste minimum constant
          entre les scènes (dont la luminosité varie) et le texte au premier
          plan, en plus du panneau "verre" de chaque bloc de texte. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/60 z-[5]" />

      {/* Repère d'étapes du récit. */}
      <div className="hidden sm:flex flex-col items-center gap-3 absolute right-6 top-1/2 -translate-y-1/2 z-30">
        {[0, 1, 2].map(dotsEtape)}
      </div>

      {/* Étape 1 — accroche */}
      <div ref={stage1Ref} className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
        <PanneauVerre className="max-w-4xl mx-4">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-marine-300 mb-6">
            Portail Opérationnel OETH
          </p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight">
            L'inclusion n'est pas
            <br />
            une case à cocher.
          </h1>
          <p className="text-marine-100/85 text-lg sm:text-xl max-w-xl mx-auto mt-7 leading-relaxed">
            Le Pôle OETH / AGEFIPH accompagne les entreprises vers la conformité légale — et vers un recrutement
            direct qui change durablement une trajectoire professionnelle.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <button
              onClick={onOuvrirSimulateur}
              className="rounded-full bg-white text-marine-900 text-sm font-semibold px-7 py-3.5 hover:bg-marine-100 transition"
            >
              Estimer vos obligations
            </button>
          </div>
        </PanneauVerre>
      </div>

      {/* Étape 2 — convictions (01/02/03) */}
      <div ref={stage2Ref} className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center opacity-0 invisible">
        <PanneauVerre className="mx-4">{convictions}</PanneauVerre>
      </div>

      {/* Étape 3 — citation forte */}
      <div ref={stage3Ref} className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center opacity-0 invisible">
        <PanneauVerre className="max-w-3xl mx-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-marine-300 mb-8">
            Ce qui compte vraiment
          </p>
          <h2 className="text-3xl sm:text-5xl font-bold text-white leading-tight">
            Le recrutement direct change une vie professionnelle —{" "}
            <span className="text-marine-300">pas seulement un chiffre de conformité.</span>
          </h2>
          <p className="text-xs text-marine-200/70 mt-10 max-w-2xl mx-auto leading-relaxed">
            Le recrutement direct reste la voie la plus durable vers l'inclusion ; l'accompagnement Cap Emploi et les
            solutions ESAT/EA demeurent des leviers complémentaires précieux, en particulier pour les parcours qui
            ont besoin d'un cadre plus soutenant.
          </p>
        </PanneauVerre>
      </div>

      {/* Invite au scroll — uniquement au tout début du récit. */}
      <div ref={scrollCueRef} className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 text-white/70">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Scroll to explore</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5 animate-fleche-rebond">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}
