// Couleurs disponibles pour un espace de travail (voir server/src/espaces.js,
// COULEURS_ESPACE, qui valide la couleur choisie à la création/modification
// d'un espace) — partagé par SelecteurEspace.jsx, AdminEspaces.jsx et
// Connexion.jsx, pour que les trois restent toujours en phase. Seules des
// teintes Tailwind standard (marine est le seul ton personnalisé, voir
// tailwind.config.js), pas de retouche de config nécessaire pour en ajouter.
export const COULEURS_ESPACE = {
  marine: "bg-marine-600",
  emerald: "bg-emerald-600",
  orange: "bg-orange-500",
  violet: "bg-violet-600",
  rose: "bg-rose-600",
  sky: "bg-sky-600",
  amber: "bg-amber-600",
  teal: "bg-teal-600",
};
