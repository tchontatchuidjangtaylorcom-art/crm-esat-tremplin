import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

// Verrouille l'accès : redirige vers /connexion si aucune session valide,
// ou vers "/" si `adminSeulement` et que l'utilisateur connecté n'est pas
// administrateur.
export default function RequireAuth({ children, adminSeulement = false }) {
  const { utilisateur, chargement } = useAuth();

  if (chargement) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Chargement…
      </div>
    );
  }
  if (!utilisateur) {
    return <Navigate to="/connexion" replace />;
  }
  if (adminSeulement && utilisateur.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}
