import FigureHumaine from "./FigureHumaine.jsx";

// Étape 1 : l'accueil et l'intégration dans l'entreprise — une collègue
// accueille chaleureusement un collègue en fauteuil roulant à l'entrée des
// bureaux. Illustration plate (voir FigureHumaine), pas une photo — voir la
// note dans RecitImmersif.jsx sur ce choix (fiabilité + licence + cohérence
// visuelle plutôt que du stock photo générique hotlinké).
export default function SceneAccueil() {
  return (
    <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
      <defs>
        <linearGradient id="accueil-fond" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e1a2e" />
          <stop offset="100%" stopColor="#0a1220" />
        </linearGradient>
        <radialGradient id="accueil-lueur" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#fbbf7a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fbbf7a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="800" height="600" fill="url(#accueil-fond)" />

      {/* Baie vitrée d'entrée, en arrière-plan */}
      <rect x="220" y="60" width="360" height="420" rx="10" fill="#152540" opacity="0.7" />
      <rect x="235" y="75" width="330" height="390" rx="6" fill="#1f3557" opacity="0.5" />
      <line x1="400" y1="75" x2="400" y2="465" stroke="#2c4770" strokeWidth="4" />
      <line x1="235" y1="270" x2="565" y2="270" stroke="#2c4770" strokeWidth="4" />

      {/* Halo chaleureux au point de rencontre */}
      <circle cx="400" cy="380" r="220" fill="url(#accueil-lueur)" />

      {/* Sol */}
      <rect x="0" y="470" width="800" height="130" fill="#0e1a2e" />
      <rect x="0" y="470" width="800" height="6" fill="#2c4770" opacity="0.6" />

      {/* Paillasson de bienvenue */}
      <rect x="330" y="450" width="140" height="26" rx="6" fill="#3d5f8f" opacity="0.5" />

      {/* Plante décorative */}
      <g transform="translate(640, 420)">
        <rect x="-14" y="30" width="28" height="34" rx="4" fill="#1f3557" />
        <path d="M0 30 C -30 10, -34 -30, -6 -46 C 6 -34, 10 -6, 0 30 Z" fill="#3d8f6b" opacity="0.85" />
        <path d="M0 30 C 24 4, 30 -26, 8 -40 C -2 -22, -6 4, 0 30 Z" fill="#4ea87f" opacity="0.85" />
      </g>

      {/* Les deux personnes, au centre */}
      <FigureHumaine x={340} y={330} taille={1.35} pose="accueil" peau="#e8b894" vetement="#d9a05a" pantalon="#152540" cheveux="#241a12" />
      <FigureHumaine x={470} y={340} taille={1.35} pose="fauteuil" peau="#8d5524" vetement="#3d5f8f" pantalon="#1f3557" cheveux="#0f0a08" flip />

      {/* Petites étincelles de chaleur autour de la poignée de main symbolique */}
      <g opacity="0.8">
        <circle cx="410" cy="300" r="4" fill="#fbbf7a">
          <animate attributeName="opacity" values="0.2;1;0.2" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx="425" cy="285" r="3" fill="#fbbf7a">
          <animate attributeName="opacity" values="1;0.2;1" dur="2.1s" repeatCount="indefinite" />
        </circle>
        <circle cx="395" cy="280" r="2.5" fill="#fbbf7a">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2.8s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}
