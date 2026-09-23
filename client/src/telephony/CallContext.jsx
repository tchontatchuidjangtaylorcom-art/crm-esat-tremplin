import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { creerProviderTelephonie } from "./provider.js";
import { api } from "../api.js";

const CallContext = createContext(null);

const MODE_STORAGE_KEY = "telephonie:mode";

// Deux modes de téléphonie, choisis par l'agent selon l'équipement disponible :
//  - "manuel"  : les numéros sont de simples liens tel: (téléphone perso/pro de
//                l'agent, Phone Link, FaceTime…), aucun enchaînement automatique.
//  - "auto"    : les appels passent par le provider VoIP (Power Dialer, SIP à
//                connecter dans provider.js), avec enchaînement automatique.
function chargerModeInitial() {
  try {
    const stocke = window.localStorage.getItem(MODE_STORAGE_KEY);
    return stocke === "auto" ? "auto" : "manuel";
  } catch {
    return "manuel";
  }
}

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
  const [mode, setModeState] = useState(chargerModeInitial);
  // appel: { entreprise, statut: 'connecting' | 'active' | 'ended', debut, fin, erreur, sansReponse }

  const setMode = useCallback((m) => {
    setModeState(m);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, m);
    } catch {
      // stockage indisponible (navigation privée…) — le mode reste actif pour la session en cours
    }
  }, []);

  const startCall = useCallback((entreprise) => {
    const numero = entreprise?.contact?.telephone;
    if (!numero) return;

    const debut = Date.now();
    setAppel({ entreprise, statut: "connecting", debut, fin: null, erreur: null, sansReponse: false });

    appelActifRef.current = providerRef.current.call(numero, {
      onStateChange: (statut, info) => {
        setAppel((prev) => {
          if (!prev) return prev;
          if (statut === "ended") {
            return { ...prev, statut, fin: Date.now(), sansReponse: !!info?.sansReponse };
          }
          return { ...prev, statut };
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

  // Appel sans réponse (Power Dialer ou manuel) : journalise automatiquement
  // un NRP, sans action agent — c'est la seule issue entièrement automatique,
  // toutes les autres (décroché) attendent la qualification manuelle via le
  // CallPanel.
  useEffect(() => {
    if (appel?.statut !== "ended" || !appel.sansReponse) return;
    const dureeSecondes = appel.debut && appel.fin ? Math.round((appel.fin - appel.debut) / 1000) : null;
    let annule = false;

    api
      .enregistrerAppel(appel.entreprise.id, {
        issue: "nrp",
        date: null,
        details: "Sans réponse — journalisé automatiquement par le Power Dialer.",
        dureeSecondes,
      })
      .then((updated) => {
        if (annule) return;
        diffuserEntrepriseMaj(updated);
      })
      .finally(() => {
        if (annule) return;
        appelActifRef.current = null;
        setAppel(null);
      });

    return () => {
      annule = true;
    };
  }, [appel]);

  return (
    <CallContext.Provider value={{ appel, mode, setMode, startCall, raccrocher, fermer, enregistrerIssue }}>
      {children}
    </CallContext.Provider>
  );
}

export function useTelephonie() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useTelephonie() doit être appelé dans un <CallProvider>.");
  return ctx;
}
