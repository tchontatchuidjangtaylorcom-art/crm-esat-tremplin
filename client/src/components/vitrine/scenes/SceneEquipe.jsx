import FigureHumaine from "./FigureHumaine.jsx";

// Étape 3 : l'équipe inclusive et collaborative, autour d'une table de
// réunion — synthèse visuelle de la citation finale ("le recrutement direct
// change une vie professionnelle"). Voir SceneAccueil.jsx pour la note sur
// le choix de l'illustration plutôt que la photo.
export default function SceneEquipe() {
  return (
    <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
      <defs>
        <linearGradient id="equipe-fond" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1f3557" />
          <stop offset="100%" stopColor="#0a1220" />
        </linearGradient>
        <radialGradient id="equipe-lueur" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#8fa9cd" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#8fa9cd" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="800" height="600" fill="url(#equipe-fond)" />
      <circle cx="400" cy="340" r="280" fill="url(#equipe-lueur)" />

      {/* Baies vitrées de la salle de réunion */}
      <rect x="40" y="60" width="180" height="220" rx="8" fill="#152540" opacity="0.5" />
      <rect x="580" y="60" width="180" height="220" rx="8" fill="#152540" opacity="0.5" />

      {/* Sol */}
      <rect x="0" y="470" width="800" height="130" fill="#0e1a2e" />
      <rect x="0" y="470" width="800" height="6" fill="#2c4770" opacity="0.6" />

      {/* Table de réunion, vue en perspective douce */}
      <ellipse cx="400" cy="420" rx="230" ry="60" fill="#152540" stroke="#2c4770" strokeWidth="4" />
      <ellipse cx="400" cy="414" rx="230" ry="60" fill="#1f3557" />

      {/* Objets sur la table : ordinateur, documents, cafés */}
      <rect x="340" y="386" width="90" height="10" rx="3" fill="#3d5f8f" />
      <rect x="355" y="368" width="60" height="20" rx="3" fill="#0e1a2e" stroke="#5f80ae" strokeWidth="2" />
      <rect x="230" y="392" width="46" height="30" rx="3" fill="#5f80ae" opacity="0.8" />
      <rect x="500" y="392" width="18" height="20" rx="3" fill="#d9a05a" />
      <rect x="540" y="396" width="18" height="20" rx="3" fill="#d9a05a" />

      {/* Bulles de conversation, symbole de collaboration */}
      <g opacity="0.85">
        <circle cx="260" cy="210" r="5" fill="#fbbf7a">
          <animate attributeName="cy" values="210;198;210" dur="3.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="540" cy="200" r="5" fill="#8fa9cd">
          <animate attributeName="cy" values="200;188;200" dur="2.6s" repeatCount="indefinite" />
        </circle>
        <circle cx="400" cy="170" r="5" fill="#fbbf7a">
          <animate attributeName="cy" values="170;158;170" dur="3.6s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Quatre collègues, dont une en fauteuil roulant, autour de la table */}
      <FigureHumaine x={230} y={330} taille={1.05} pose="assis" peau="#f1c27d" vetement="#3d5f8f" pantalon="#152540" cheveux="#241a12" />
      <FigureHumaine x={340} y={300} taille={1.05} pose="assis" peau="#8d5524" vetement="#d9a05a" pantalon="#152540" cheveux="#0f0a08" />
      <FigureHumaine x={460} y={300} taille={1.05} pose="assis" peau="#e8b894" vetement="#4ea87f" pantalon="#1f3557" cheveux="#5a3b22" flip />
      <FigureHumaine x={570} y={340} taille={1.05} pose="fauteuil" peau="#c68642" vetement="#2c4770" pantalon="#152540" cheveux="#241a12" flip />
    </svg>
  );
}
