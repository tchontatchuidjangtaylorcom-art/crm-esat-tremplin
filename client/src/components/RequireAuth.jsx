import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

// Sur le nom de domaine public (oeth-fiph.fr, www.oeth-fiph.fr), un visiteur
// non connecté qui arrive sur la racine voit la vitrine (simulateur), pas la
// page de connexion du CRM — celle-ci reste accessible via "Portail
// sécurisé" (/connexion). Sur l'adresse Render, comportement inchangé.
const DOMAINE_PUBLIC = /(^|\.)oeth-fiph\.fr$/i;

// Verrouille l'accès : redirige vers /connexion si aucune session valide,
// ou vers "/" si `adminSeulement` et que l'utilisateur connecté n'est pas
// administrateur.
export default function RequireAuth({ children, adminSeulement = false }) {
  const { utilisateur, chargement } = useAuth();
  const { pathname } = useLocation();

  if (chargement) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Chargement…
      </div>
    );
  }
  if (!utilisateur) {
    if (pathname === "/" && DOMAINE_PUBLIC.test(window.location.hostname)) {
      return <Navigate to="/vitrine" replace />;
    }
    return <Navigate to="/connexion" replace />;
  }
  if (adminSeulement && utilisateur.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}
