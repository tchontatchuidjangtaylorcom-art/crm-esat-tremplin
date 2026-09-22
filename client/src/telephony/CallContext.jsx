import { createContext, useCallback, useContext, useRef, useState } from "react";
import { creerProviderTelephonie } from "./provider.js";
import { api } from "../api.js";

const CallContext = createContext(null);

// Diffuse une entreprise mise à jour à toutes les pages ouvertes (Dashboard,
// fiche entreprise), sans dépendance ajoutée : un simple événement DOM suffit
// pour ce volume d'écrans.
export function diffuserEntrepriseMaj(entreprise) {
  window.dispatchEvent(new CustomEvent("entreprise:maj", { detail: entreprise }));
}

// Diffusé quand un dossier passe "mort" et est archivé côté serveur : le
// tableau de bord doit le retirer de la liste active plutôt que le mettre à jour.
export function diffuserEntrepriseArchivee(entreprise) {
  window.dispatchEvent(new CustomEvent("entreprise:archivee", { detail: entreprise }));
}

export function CallProvider({ children }) {
  const providerRef = useRef(creerProviderTelephonie());
  const appelActifRef = useRef(null);
  const [appel, setAppel] = useState(null);
  // appel: { entreprise, statut: 'connecting' | 'active' | 'ended', debut, fin, erreur }

  const startCall = useCallback((entreprise) => {
    const numero = entreprise?.contact?.telephone;
    if (!numero) return;

    const debut = Date.now();
    setAppel({ entreprise, statut: "connecting", debut, fin: null, erreur: null });

    appelActifRef.current = providerRef.current.call(numero, {
      onStateChange: (statut) => {
        setAppel((prev) => {
          if (!prev) return prev;
          return statut === "ended" ? { ...prev, statut, fin: Date.now() } : { ...prev, statut };
        });
      },
      onError: (erreur) => {
        setAppel((prev) => (prev ? { ...prev, statut: "ended", fin: Date.now(), erreur: String(erreur) } : prev));
      },
    });
  }, []);

  const raccrocher = useCallback(() => {
    appelActifRef.current?.hangup();
  }, []);

  const fermer = useCallback(() => {
    appelActifRef.current = null;
    setAppel(null);
  }, []);

  const enregistrerIssue = useCallback(
    async ({ kind, value, date, details }) => {
      if (!appel?.entreprise) return;
      const dureeSecondes = appel.debut && appel.fin ? Math.round((appel.fin - appel.debut) / 1000) : null;

      let updated;
      if (kind === "sortie") {
        const resultat = await api.enregistrerSortie(appel.entreprise.id, { sortie: value, details, dureeSecondes });
        updated = resultat.entreprise;
        if (resultat.archive) diffuserEntrepriseArchivee(updated);
        else diffuserEntrepriseMaj(updated);
      } else {
        updated = await api.enregistrerAppel(appel.entreprise.id, { issue: value, date, details, dureeSecondes });
        diffuserEntrepriseMaj(updated);
      }

      fermer();
      return updated;
    },
    [appel, fermer]
  );

  return (
    <CallContext.Provider value={{ appel, startCall, raccrocher, fermer, enregistrerIssue }}>
      {children}
    </CallContext.Provider>
  );
}

export function useTelephonie() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useTelephonie() doit être appelé dans un <CallProvider>.");
  return ctx;
}
