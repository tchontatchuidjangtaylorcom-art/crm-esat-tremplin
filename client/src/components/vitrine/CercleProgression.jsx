// Jauge circulaire "Dark Tech" (SVG, pas de dépendance) pour le simulateur
// OETH public — visualise le taux d'emploi atteint par rapport au quota
// légal de 6 %. `pourcentage` peut dépasser 100 (quota dépassé) : l'anneau
// se plafonne visuellement à 100 %, le chiffre affiché reste réel.
const TONS = {
  conforme: { anneau: "#34d399", lueur: "rgba(52,211,153,0.55)" }, // emerald-400
  partiel: { anneau: "#fb923c", lueur: "rgba(251,146,60,0.5)" }, // orange-400
  critique: { anneau: "#f87171", lueur: "rgba(248,113,113,0.5)" }, // red-400
  neutre: { anneau: "#38bdf8", lueur: "rgba(56,189,248,0.45)" }, // sky-400
};

export default function CercleProgression({ pourcentage, ton = "neutre", taille = 168, epaisseur = 12, libelle }) {
  const rayon = (taille - epaisseur) / 2;
  const circonference = 2 * Math.PI * rayon;
  const avancement = Math.max(0, Math.min(100, pourcentage));
  const decalage = circonference * (1 - avancement / 100);
  const couleurs = TONS[ton] || TONS.neutre;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: taille, height: taille }}>
      <svg width={taille} height={taille} className="-rotate-90">
        <circle cx={taille / 2} cy={taille / 2} r={rayon} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={epaisseur} />
        <circle
          cx={taille / 2}
          cy={taille / 2}
          r={rayon}
          fill="none"
          stroke={couleurs.anneau}
          strokeWidth={epaisseur}
          strokeLinecap="round"
          strokeDasharray={circonference}
          strokeDashoffset={decalage}
          style={{ filter: `drop-shadow(0 0 8px ${couleurs.lueur})`, transition: "stroke-dashoffset 0.6s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white tracking-tight">{Math.round(pourcentage)}%</span>
        {libelle && <span className="text-[10px] uppercase tracking-wide text-slate-400 mt-1 text-center px-4">{libelle}</span>}
      </div>
    </div>
  );
}
