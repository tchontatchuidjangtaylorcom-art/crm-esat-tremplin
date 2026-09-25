import { useRef } from "react";
import useProgressionScroll, { trapeze } from "./useProgressionScroll.js";
import SceneRecitImmersif from "./SceneRecitImmersif.jsx";

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

// Bandes de progression (0→1 sur toute la hauteur du conteneur épinglé) —
// réglées à la main pour que chaque étape ait le temps d'être lue avant de
// céder la place à la suivante. Voir trapeze() dans useProgressionScroll.js.
const BANDES = {
  stage1: [0, 0.02, 0.1, 0.16],
  convictions: [0.12, 0.18, 0.62, 0.68],
  pilier: [
    [0.12, 0.18, 0.3, 0.36],
    [0.3, 0.36, 0.48, 0.54],
    [0.48, 0.54, 0.62, 0.68],
  ],
  stage3: [0.64, 0.72, 0.94, 1],
};

// Récit au scroll en plein écran, façon "scroll-driven storytelling" : un
// conteneur de 400vh dont l'intérieur reste épinglé (sticky) pendant que la
// progression du défilement pilote en continu le fond animé (voir
// SceneRecitImmersif) ET l'apparition/disparition des 3 étapes de texte —
// jamais un simple fade-in-once (voir RevelerAuScroll, gardé ailleurs sur la
// page pour les sections qui n'ont pas besoin de cette mécanique). Remplace
// l'ancien hero + manifeste statiques.
export default function RecitImmersif({ onOuvrirSimulateur }) {
  const conteneurRef = useRef(null);
  const p = useProgressionScroll(conteneurRef);

  const opaciteStage1 = trapeze(p, ...BANDES.stage1);
  const opaciteConvictions = trapeze(p, ...BANDES.convictions);
  const opaciteStage3 = trapeze(p, ...BANDES.stage3);
  const opacitesPiliers = BANDES.pilier.map((b) => trapeze(p, ...b));
  const opaciteScrollCue = Math.max(0, 1 - p / 0.05);

  const etapeActive = p < BANDES.stage1[3] ? 0 : p < BANDES.stage3[0] ? 1 : 2;

  return (
    <div ref={conteneurRef} className="relative h-[400vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-gradient-to-b from-marine-950 via-marine-900 to-marine-950">
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
        <SceneRecitImmersif progression={p} />

        {/* Repère d'étapes — signale au visiteur qu'un récit en 3 temps se
            joue au fil du scroll, comme les indicateurs de progression des
            sites de scrollytelling premium. */}
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
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
          style={{ opacity: opaciteStage1, pointerEvents: opaciteStage1 > 0.5 ? "auto" : "none" }}
        >
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
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
          style={{ opacity: opaciteConvictions, pointerEvents: opaciteConvictions > 0.5 ? "auto" : "none" }}
        >
          <div className="max-w-5xl mx-auto">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-marine-400 mb-10">
              Notre conviction
            </p>
            <div className="grid sm:grid-cols-3 gap-8 sm:gap-10">
              {PILIERS.map((bloc, i) => (
                <div
                  key={bloc.titre}
                  className="transition-all duration-500"
                  style={{
                    opacity: 0.35 + opacitesPiliers[i] * 0.65,
                    transform: `scale(${0.94 + opacitesPiliers[i] * 0.06}) translateY(${(1 - opacitesPiliers[i]) * 10}px)`,
                  }}
                >
                  <span
                    className="block text-3xl font-bold mb-3 transition-colors"
                    style={{ color: opacitesPiliers[i] > 0.5 ? "#fbbf7a" : "#3d5a8a" }}
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
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
          style={{ opacity: opaciteStage3, pointerEvents: opaciteStage3 > 0.5 ? "auto" : "none" }}
        >
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
    </div>
  );
}
