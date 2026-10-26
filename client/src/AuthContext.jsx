import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

function attendre(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Nombre et espacement des tentatives quand /api/auth/moi échoue parce que le
// serveur redémarre (voir SERVEUR_INDISPONIBLE dans api.js) — 5 × 4s couvre
// la trentaine de secondes qu'annonce ce message d'erreur. Sans ce retry, un
// agent qui recharge la page pile pendant un redémarrage Render (déploiement,
// relance automatique après dépassement mémoire) se faisait rejeter vers
// /connexion comme si sa session avait expiré, alors qu'elle restait valide —
// juste le serveur injoignable une poignée de secondes.
const TENTATIVES_SERVEUR_INDISPONIBLE = 5;
const DELAI_ENTRE_TENTATIVES_MS = 4000;

// Session unique partagée par toute l'application (RequireAuth, UserMenu…) —
// un seul appel à /api/auth/moi au lieu d'un par composant, et une source de
// vérité cohérente après connexion/déconnexion.
export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(true);

  const rafraichir = useCallback(async () => {
    setChargement(true);
    for (let tentative = 1; tentative <= TENTATIVES_SERVEUR_INDISPONIBLE; tentative++) {
      try {
        setUtilisateur(await api.getMoi());
        setChargement(false);
        return;
      } catch (e) {
        if (e.code !== "SERVEUR_INDISPONIBLE" || tentative === TENTATIVES_SERVEUR_INDISPONIBLE) {
          // Erreur définitive (401 non authentifié, etc.) ou dernière
          // tentative épuisée : là seulement on considère la session perdue.
          setUtilisateur(null);
          setChargement(false);
          return;
        }
        await attendre(DELAI_ENTRE_TENTATIVES_MS);
      }
    }
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
