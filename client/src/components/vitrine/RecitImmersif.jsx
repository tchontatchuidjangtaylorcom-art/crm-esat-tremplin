import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SceneRecitImmersif from "./SceneRecitImmersif.jsx";

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

// Récit au scroll en plein écran, piloté par GSAP + ScrollTrigger (scrub +
// pin) plutôt qu'un calcul de progression fait à la main sur le scroll brut :
// ScrollTrigger gère lui-même l'épinglage (plus besoin d'un conteneur 400vh
// + position sticky manuelle), le lissage du scrub, et le nettoyage propre
// via gsap.context()/ctx.revert() au démontage. Trois étapes se succèdent
// SANS jamais changer de section DOM : l'accroche, les 3 convictions
// (chacune mise en valeur tour à tour selon la position du scroll), puis la
// citation finale — exactement le même contenu qu'avant, mais animé par la
// timeline plutôt que par un style calculé en ligne à chaque frame.
export default function RecitImmersif({ onOuvrirSimulateur }) {
  const sectionRef = useRef(null);
  const stage1Ref = useRef(null);
  const stage2Ref = useRef(null);
  const stage3Ref = useRef(null);
  const pilierRefs = useRef([]);
  const [progression, setProgression] = useState(0);
  const [etapeActive, setEtapeActive] = useState(0);
  const [pilierActif, setPilierActif] = useState(0);

  useEffect(() => {
    const reduitMouvement = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const trigger = {
        trigger: sectionRef.current,
        start: "top top",
        end: "+=350%",
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        onUpdate: (self) => setProgression(self.progress),
      };

      if (reduitMouvement) {
        // Contenu figé sur l'étape 1, sans mécanique de scroll forcée — le
        // fond reste néanmoins visible (voir SceneRecitImmersif, qui respecte
        // lui-même prefers-reduced-motion pour sa propre animation interne).
        ScrollTrigger.create({ trigger: sectionRef.current, start: "top top", end: "+=100%", pin: true });
        return;
      }

      gsap.set(stage2Ref.current, { autoAlpha: 0, y: 0 });
      gsap.set(stage3Ref.current, { autoAlpha: 0, y: 0 });
      gsap.set(pilierRefs.current, { opacity: 0.35, scale: 0.94 });

      const tl = gsap.timeline({ scrollTrigger: trigger });

      tl.to({}, { duration: 1.3 }) // étape 1 : temps de lecture avant de lancer la transition
        .addLabel("versConvictions")
        .to(stage1Ref.current, { autoAlpha: 0, y: -40, duration: 0.6 }, "versConvictions")
        .to(stage2Ref.current, { autoAlpha: 1, duration: 0.6 }, "versConvictions")
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
        .call(() => setEtapeActive(2), null, "versCitation")
        .to({}, { duration: 2 })
        .to(stage3Ref.current, { autoAlpha: 0, y: -40, duration: 0.6 })
        .call(() => setEtapeActive(0), null, "<") // repart de 0 si l'agent remonte tout en haut
        .to({}, { duration: 0.3 });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const opaciteScrollCue = Math.max(0, 1 - progression / 0.04);

  return (
    <div ref={sectionRef} className="relative h-screen overflow-hidden bg-gradient-to-b from-marine-950 via-marine-900 to-marine-950">
      <div className="bandeau-tricolore absolute top-0 inset-x-0 z-20">
        <span className="bg-marine-400" />
        <span className="bg-white" />
        <span className="bg-red-600" />
      </div>

      <div
        aria-hidden="true"
        className="absolute -top-1/4 -left-1/4 w-[70vw] h-[70vw] rounded-full bg-marine-600/20 blur-[120px] animate-flotter"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-1/4 -right-1/4 w-[65vw] h-[65vw] rounded-full bg-indigo-500/10 blur-[120px] animate-flotter-inverse"
      />
      <SceneRecitImmersif progression={progression} />

      {/* Repère d'étapes du récit. */}
      <div className="hidden sm:flex flex-col items-center gap-3 absolute right-6 top-1/2 -translate-y-1/2 z-20">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-1.5 rounded-full transition-all duration-500 ${
              etapeActive === i ? "h-8 bg-white" : "h-1.5 bg-white/30"
            }`}
          />
        ))}
      </div>

      {/* Étape 1 — accroche */}
      <div ref={stage1Ref} className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-marine-300 mb-6">
            Portail Opérationnel OETH
          </p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight">
            L'inclusion n'est pas
            <br />
            une case à cocher.
          </h1>
          <p className="text-marine-200/80 text-lg sm:text-xl max-w-xl mx-auto mt-7 leading-relaxed">
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
        </div>
      </div>

      {/* Étape 2 — convictions (01/02/03) */}
      <div ref={stage2Ref} className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center opacity-0 invisible">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-marine-400 mb-10">
            Notre conviction
          </p>
          <div className="grid sm:grid-cols-3 gap-8 sm:gap-10">
            {PILIERS.map((bloc, i) => (
              <div key={bloc.titre} ref={(el) => (pilierRefs.current[i] = el)}>
                <span
                  className="block text-3xl font-bold mb-3 transition-colors"
                  style={{ color: pilierActif === i ? "#fbbf7a" : "#3d5a8a" }}
                >
                  0{i + 1}
                </span>
                <h3 className="font-semibold text-lg mb-2.5 text-white">{bloc.titre}</h3>
                <p className="text-sm text-marine-200/80 leading-relaxed">{bloc.texte}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Étape 3 — citation forte */}
      <div ref={stage3Ref} className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center opacity-0 invisible">
        <div className="max-w-3xl mx-auto">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-marine-400 mb-8">
            Ce qui compte vraiment
          </p>
          <h2 className="text-3xl sm:text-5xl font-bold text-white leading-tight">
            Le recrutement direct change une vie professionnelle —{" "}
            <span className="text-marine-300">pas seulement un chiffre de conformité.</span>
          </h2>
          <p className="text-xs text-marine-400/70 mt-10 max-w-2xl mx-auto leading-relaxed">
            Le recrutement direct reste la voie la plus durable vers l'inclusion ; l'accompagnement Cap Emploi et les
            solutions ESAT/EA demeurent des leviers complémentaires précieux, en particulier pour les parcours qui
            ont besoin d'un cadre plus soutenant.
          </p>
        </div>
      </div>

      {/* Invite au scroll — uniquement au tout début du récit. */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 text-white/60"
        style={{ opacity: opaciteScrollCue, pointerEvents: "none" }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Scroll to explore</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5 animate-fleche-rebond">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}
