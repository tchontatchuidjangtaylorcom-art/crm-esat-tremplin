// Petite figure humaine stylisée réutilisée par les 3 scènes du récit
// immersif (voir SceneAccueil, ScenePosteAdapte, SceneEquipe) : un style
// plat/géométrique volontairement simple (cercle + capsules), dans l'esprit
// des illustrations "avatar" modernes plutôt qu'une tentative de réalisme —
// mais avec assez de variations (carnation, coiffure, posture, fauteuil
// roulant) pour que chaque scène ne semble pas peuplée de clones. `x`/`y`
// positionnent le centre de la tête ; tout le reste se déduit vers le bas.
export default function FigureHumaine({
  x = 0,
  y = 0,
  peau = "#e8b894",
  vetement = "#2c4770",
  pantalon = "#152540",
  cheveux = "#3a2a1a",
  pose = "debout", // debout | assis | fauteuil | accueil
  taille = 1,
  flip = false,
}) {
  const s = taille;
  const g = (dx) => (flip ? -dx : dx);

  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`}>
      {/* Jambes / fauteuil roulant, dessinés en premier pour rester sous le torse */}
      {pose === "debout" && (
        <>
          <rect x={-14} y={40} width={11} height={38} rx={5} fill={pantalon} />
          <rect x={3} y={40} width={11} height={38} rx={5} fill={pantalon} />
        </>
      )}
      {pose === "assis" && (
        <>
          <rect x={-14} y={40} width={11} height={22} rx={5} fill={pantalon} />
          <rect x={3} y={40} width={11} height={22} rx={5} fill={pantalon} />
        </>
      )}
      {pose === "fauteuil" && (
        <>
          {/* Roue arrière */}
          <circle cx={g(-2)} cy={78} r={26} fill="none" stroke="#93a3b8" strokeWidth={4} />
          <circle cx={g(-2)} cy={78} r={3} fill="#93a3b8" />
          <line x1={g(-2)} y1={78} x2={g(-2) + 20} y2={64} stroke="#93a3b8" strokeWidth={2} />
          <line x1={g(-2)} y1={78} x2={g(-2) - 18} y2={68} stroke="#93a3b8" strokeWidth={2} />
          {/* Roulette avant */}
          <circle cx={g(24)} cy={92} r={7} fill="#93a3b8" />
          {/* Assise */}
          <rect x={-16} y={44} width={34} height={12} rx={4} fill="#5b6b82" />
          <rect x={-14} y={16} width={10} height={34} rx={4} fill={pantalon} />
          <rect x={4} y={16} width={10} height={34} rx={4} fill={pantalon} />
        </>
      )}

      {/* Torse */}
      <rect x={-17} y={-20} width={34} height={62} rx={13} fill={vetement} />

      {/* Bras */}
      {pose === "accueil" ? (
        <>
          <rect x={-30} y={-22} width={11} height={34} rx={5.5} fill={vetement} transform="rotate(-35 -24 -6)" />
          <rect x={19} y={-14} width={11} height={30} rx={5.5} fill={vetement} />
        </>
      ) : (
        <>
          <rect x={-29} y={-14} width={11} height={32} rx={5.5} fill={vetement} />
          <rect x={18} y={-14} width={11} height={32} rx={5.5} fill={vetement} />
        </>
      )}

      {/* Cou + tête */}
      <rect x={-6} y={-30} width={12} height={12} fill={peau} />
      <circle cx={0} cy={-42} r={17} fill={peau} />

      {/* Coiffure — variation simple selon la teinte fournie */}
      <path d="M -17 -46 A 17 17 0 0 1 17 -46 L 17 -50 A 17 20 0 0 0 -17 -50 Z" fill={cheveux} />
    </g>
  );
}
