import FigureHumaine from "./FigureHumaine.jsx";

// Étape 2 : le poste de travail aménagé — bureau à hauteur variable, écran
// large avec interface "accessible" (contrastes et pictogrammes agrandis),
// collègue en fauteuil roulant installée devant. Voir SceneAccueil.jsx pour
// la note sur le choix de l'illustration plutôt que la photo.
export default function ScenePosteAdapte() {
  return (
    <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
      <defs>
        <linearGradient id="poste-fond" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#152540" />
          <stop offset="100%" stopColor="#0a1220" />
        </linearGradient>
        <linearGradient id="poste-lumiere" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fa9cd" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8fa9cd" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="800" height="600" fill="url(#poste-fond)" />

      {/* Fenêtre et lumière du jour, en fond */}
      <rect x="500" y="40" width="260" height="300" rx="8" fill="#0e1a2e" opacity="0.6" />
      <polygon points="500,40 760,40 760,340 500,340" fill="url(#poste-lumiere)" />
      <line x1="630" y1="40" x2="630" y2="340" stroke="#2c4770" strokeWidth="4" />
      <line x1="500" y1="190" x2="760" y2="190" stroke="#2c4770" strokeWidth="4" />

      {/* Sol */}
      <rect x="0" y="470" width="800" height="130" fill="#0e1a2e" />
      <rect x="0" y="470" width="800" height="6" fill="#2c4770" opacity="0.6" />

      {/* Bureau à hauteur variable : deux pieds télescopiques doubles */}
      <g>
        <rect x="150" y="330" width="10" height="140" fill="#3d5f8f" />
        <rect x="164" y="330" width="6" height="140" fill="#2c4770" />
        <rect x="470" y="330" width="10" height="140" fill="#3d5f8f" />
        <rect x="456" y="330" width="6" height="140" fill="#2c4770" />
        {/* Petit boîtier de réglage de hauteur */}
        <rect x="480" y="360" width="18" height="26" rx="4" fill="#fbbf7a" opacity="0.9" />
        <rect x="484" y="366" width="10" height="3" fill="#152540" />
        <rect x="484" y="372" width="10" height="3" fill="#152540" />

        <rect x="140" y="318" width="350" height="18" rx="6" fill="#5f80ae" />
      </g>

      {/* Écran large, interface accessible (gros pictogrammes, contrastes) */}
      <g transform="translate(215, 190)">
        <rect x="0" y="0" width="220" height="130" rx="10" fill="#0e1a2e" stroke="#3d5f8f" strokeWidth="4" />
        <rect x="10" y="10" width="200" height="110" rx="4" fill="#152540" />
        <rect x="24" y="24" width="60" height="22" rx="5" fill="#fbbf7a" />
        <rect x="94" y="24" width="90" height="10" rx="5" fill="#5f80ae" />
        <rect x="94" y="40" width="60" height="10" rx="5" fill="#3d5f8f" />
        <circle cx="45" cy="90" r="18" fill="#3d8f6b" opacity="0.9" />
        <rect x="76" y="78" width="118" height="10" rx="5" fill="#2c4770" />
        <rect x="76" y="96" width="90" height="10" rx="5" fill="#2c4770" />
        <rect x="100" y="130" width="20" height="14" fill="#3d5f8f" />
        <rect x="80" y="144" width="60" height="8" rx="4" fill="#2c4770" />
      </g>

      {/* Clavier + souris ergonomiques */}
      <rect x="230" y="336" width="150" height="26" rx="6" fill="#1f3557" />
      <circle cx="400" cy="349" r="10" fill="#1f3557" />

      {/* Tasse et plante, touches humaines sur le bureau */}
      <rect x="180" y="330" width="18" height="20" rx="3" fill="#d9a05a" />
      <g transform="translate(430, 300)">
        <rect x="-10" y="20" width="20" height="24" rx="3" fill="#1f3557" />
        <path d="M0 20 C -20 6, -22 -18, -4 -30 C 4 -20, 8 -2, 0 20 Z" fill="#4ea87f" opacity="0.85" />
      </g>

      {/* Collègue installée devant le poste, en fauteuil roulant */}
      <FigureHumaine x={330} y={400} taille={1.3} pose="fauteuil" peau="#f1c27d" vetement="#2c4770" pantalon="#152540" cheveux="#5a3b22" />

      {/* Pictogramme d'accessibilité, discret et lumineux */}
      <g transform="translate(700, 470)" opacity="0.9">
        <circle cx="0" cy="0" r="26" fill="#152540" stroke="#fbbf7a" strokeWidth="2.5">
          <animate attributeName="stroke-opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="0" cy="-9" r="5" fill="#fbbf7a" />
        <path d="M -10 -2 Q 0 4 10 -2 L 10 3 Q 0 9 -10 3 Z" fill="#fbbf7a" />
        <rect x="-3" y="2" width="6" height="14" fill="#fbbf7a" />
      </g>
    </svg>
  );
}
