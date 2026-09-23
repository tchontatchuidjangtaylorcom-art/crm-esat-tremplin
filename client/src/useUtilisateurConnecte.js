import { useEffect, useState } from "react";
import { api } from "./api.js";

// Utilisateur réellement connecté (session lien magique / Google), s'il y en
// a un. Tant que l'authentification n'est pas obligatoire sur le reste du
// CRM, les composants qui l'utilisent (UserMenu, script de vente…) doivent
// prévoir un repli sur l'identité de démonstration (voir agent.js).
export function useUtilisateurConnecte() {
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(true);

  function rafraichir() {
    setChargement(true);
    api
      .getMoi()
      .then(setUtilisateur)
      .catch(() => setUtilisateur(null))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    rafraichir();
  }, []);

  return { utilisateur, chargement, rafraichir };
}
