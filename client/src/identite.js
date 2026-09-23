import { useAuth } from "./AuthContext.jsx";
import { AGENT_ACTUEL } from "./agent.js";

// Dérive l'identité affichable de l'agent actuellement connecté à partir de
// la session réelle (AuthContext / `/api/auth/moi`), pour que le prénom
// affiché (accueil, menu profil, script de vente, auteur des commentaires…)
// suive toujours l'utilisateur réellement connecté plutôt qu'un nom en dur.
// Repli sur l'identité de démonstration (agent.js) uniquement si la session
// n'est pas encore chargée ou a échoué.
export function useIdentiteActuelle() {
  const { utilisateur } = useAuth();

  if (!utilisateur) return AGENT_ACTUEL;

  return {
    prenom: utilisateur.prenom || utilisateur.email.split("@")[0],
    nom: utilisateur.nom || "",
    role: utilisateur.role === "admin" ? "Administrateur" : "Télépro",
    bureau: utilisateur.email,
  };
}
