import { createContext, useCallback, useContext, useState } from "react";

const SupervisionContext = createContext(null);
const STORAGE_KEY = "supervision:agent";

// Mode Manager : un admin peut consulter le tableau de bord "comme si" il
// était un agent donné (ses leads, ses RDV, ses non-lus) sans changer de
// session — voir commeAgentId côté serveur (GET /api/entreprises,
// /api/archives, /api/notifications). Le choix est gardé en sessionStorage
// pour survivre à une navigation entre le tableau de bord et une fiche,
// mais jamais entre deux onglets/sessions différents (scope volontairement
// étroit pour un outil de supervision ponctuelle).
export function SupervisionProvider({ children }) {
  const [agentSupervise, setAgentSuperviseState] = useState(() => {
    try {
      const brut = window.sessionStorage.getItem(STORAGE_KEY);
      return brut ? JSON.parse(brut) : null;
    } catch {
      return null;
    }
  });

  const setAgentSupervise = useCallback((agent) => {
    setAgentSuperviseState(agent);
    try {
      if (agent) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(agent));
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // stockage indisponible (navigation privée…) — le mode reste actif pour la session en cours
    }
  }, []);

  return (
    <SupervisionContext.Provider value={{ agentSupervise, setAgentSupervise }}>{children}</SupervisionContext.Provider>
  );
}

export function useSupervision() {
  const ctx = useContext(SupervisionContext);
  if (!ctx) throw new Error("useSupervision() doit être appelé dans un <SupervisionProvider>.");
  return ctx;
}
