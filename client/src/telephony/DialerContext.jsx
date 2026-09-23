import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTelephonie } from "./CallContext.jsx";

const DialerContext = createContext(null);

// Architecture du dialer automatique : enchaîne les appels d'une file de
// prospects (typiquement les statuts "Nouveau" / "NRP") en s'appuyant sur le
// même `startCall` que les appels manuels — aucune dépendance à un provider
// VoIP particulier, prêt à être branché sur un vrai dialer progressif
// (Twilio Power Dialer, Aircall Power Dialer…) en remplaçant simplement
// `provider.js`.
//
// Comportement :
//  1. `demarrer(file)` charge la liste de prospects à appeler et compose le
//     premier numéro.
//  2. Dès que l'appel décroche (statut "active"), la fiche du prospect
//     s'ouvre automatiquement dans un nouvel onglet et le dialer se met en
//     pause — l'agent gère la conversation normalement via le CallPanel.
//  3. Une fois l'issue enregistrée (ou l'appel fermé), l'agent relance
//     explicitement le dialer avec `reprendre()` pour composer le suivant :
//     volontairement pas d'enchaînement 100% automatique après une
//     conversation, pour laisser le temps de la prise de notes.
export function DialerProvider({ children }) {
  const { appel, startCall } = useTelephonie();
  const [file, setFile] = useState([]);
  const [actif, setActif] = useState(false);
  const [enPause, setEnPause] = useState(false);
  const [dernierAppele, setDernierAppele] = useState(null);
  const ficheOuvertePourRef = useRef(null);

  const arreter = useCallback(() => {
    setActif(false);
    setEnPause(false);
    setFile([]);
    ficheOuvertePourRef.current = null;
  }, []);

  const demarrer = useCallback((prospects) => {
    setFile(prospects);
    setActif(true);
    setEnPause(false);
    setDernierAppele(null);
    ficheOuvertePourRef.current = null;
  }, []);

  const reprendre = useCallback(() => {
    setEnPause(false);
  }, []);

  // Compose automatiquement le prochain numéro de la file dès qu'aucun appel
  // n'est en cours et que le dialer n'est pas en pause.
  useEffect(() => {
    if (!actif || enPause || appel) return;
    if (file.length === 0) {
      setActif(false);
      return;
    }
    const [prochain, ...reste] = file;
    setFile(reste);
    setDernierAppele(prochain);
    startCall(prochain);
  }, [actif, enPause, appel, file, startCall]);

  // Décroché : ouvre la fiche du prospect pour l'argumentaire en direct, et
  // marque une pause le temps de la conversation.
  useEffect(() => {
    if (appel?.statut === "active" && ficheOuvertePourRef.current !== appel.entreprise.id) {
      ficheOuvertePourRef.current = appel.entreprise.id;
      window.open(`/entreprise/${appel.entreprise.id}`, "_blank", "noopener,noreferrer");
      setEnPause(true);
    }
    if (!appel) {
      ficheOuvertePourRef.current = null;
    }
  }, [appel]);

  return (
    <DialerContext.Provider
      value={{ actif, enPause, file, dernierAppele, demarrer, arreter, reprendre }}
    >
      {children}
    </DialerContext.Provider>
  );
}

export function useDialer() {
  const ctx = useContext(DialerContext);
  if (!ctx) throw new Error("useDialer() doit être appelé dans un <DialerProvider>.");
  return ctx;
}
