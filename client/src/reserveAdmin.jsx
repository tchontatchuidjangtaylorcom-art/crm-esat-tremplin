import { useAuth } from "./AuthContext.jsx";
import { estAdmin } from "./roles.js";

// Fonctions IA (appels à Claude, payants) : réservées aux administrateurs.
// Le serveur refuse déjà ces appels aux agents (routes en exigerAdmin) ;
// côté interface, le composant n'est simplement pas affiché pour un agent.
export function reserveAuxAdmins(Composant) {
  function ComposantReserveAuxAdmins(props) {
    const { utilisateur } = useAuth();
    return estAdmin(utilisateur) ? <Composant {...props} /> : null;
  }
  ComposantReserveAuxAdmins.displayName = `ReserveAuxAdmins(${Composant.displayName || Composant.name})`;
  return ComposantReserveAuxAdmins;
}
