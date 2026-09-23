import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

// Session unique partagée par toute l'application (RequireAuth, UserMenu…) —
// un seul appel à /api/auth/moi au lieu d'un par composant, et une source de
// vérité cohérente après connexion/déconnexion.
export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(true);

  const rafraichir = useCallback(() => {
    setChargement(true);
    return api
      .getMoi()
      .then(setUtilisateur)
      .catch(() => setUtilisateur(null))
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => {
    rafraichir();
  }, [rafraichir]);

  return <AuthContext.Provider value={{ utilisateur, chargement, rafraichir }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() doit être appelé dans un <AuthProvider>.");
  return ctx;
}
