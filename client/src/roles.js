// Rôles de compte — même règle que estAdmin() côté serveur (auth.js) : un
// "super_admin" peut tout ce que peut un "admin", plus l'édition des
// contenus partagés. Toute vérification "est-ce un admin ?" de l'interface
// passe par ici, pour qu'un nouveau rôle ne masque plus jamais les outils
// d'administration (import, enrichissement Claude, KPIs équipe…).
export function estAdmin(utilisateur) {
  return utilisateur?.role === "admin" || utilisateur?.role === "super_admin";
}

// Superviseur : comme un agent, et peut prendre en charge le lead d'un agent
// (lead partagé — voir ChoixSuperviseurFiche.jsx).
export function estSuperviseur(utilisateur) {
  return utilisateur?.role === "superviseur";
}

export function libelleRole(role) {
  if (role === "super_admin") return "Super-administrateur";
  if (role === "admin") return "Administrateur";
  if (role === "superviseur") return "Superviseur";
  return "Télépro";
}
