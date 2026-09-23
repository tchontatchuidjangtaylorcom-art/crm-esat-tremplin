import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTelephonie } from "./CallContext.jsx";

const DialerContext = createContext(null);

// Délai entre un appel sans réponse et la composition automatique du
// prospect suivant ("attend quelques secondes" du cahier des charges).
const DELAI_APRES_SANS_REPONSE_MS = 2500;

function statsVides() {
  return { appels: 0, decroches: 0, sansReponse: 0, rdv: 0 };
}

// Architecture du Power Dialer : enchaîne les appels d'une file de prospects
// ciblée (typiquement les statuts "Nouveau" / "NRP") en s'appuyant sur le
// même `startCall` que les appels manuels — aucune dépendance à un provider
// VoIP particulier, prêt à être branché sur un vrai dialer progressif
// (Twilio Power Dialer, Aircall Power Dialer…) en remplaçant simplement
// `provider.js`.
//
// Comportement :
//  1. `demarrer(file)` charge la liste de prospects à appeler et compose le
//     premier numéro. Remet les statistiques de session à zéro.
//  2. Sans réponse (voir CallContext, qui journalise le NRP automatiquement) :
//     après un court délai, le dialer compose seul le numéro suivant — aucune
//     action agent requise, exactement comme demandé.
//  3. Décroché (statut "active") : la fiche du prospect s'ouvre automatiquement
//     dans un nouvel onglet et le dialer se met en pause — l'agent mène son
//     argumentaire, puis qualifie l'appel via le CallPanel (RDV pris, à
//     rappeler, refus…). Une fois l'issue enregistrée, l'agent relance
//     explicitement la file avec `reprendre()` : volontairement pas
//     d'enchaînement 100% automatique après une conversation, pour laisser le
//     temps de la prise de notes ("relance la file d'attente si souhaité").
//  4. Des statistiques de session sont tenues à jour en direct (appels
//     passés, décrochés, sans réponse, RDV générés) et restent consultables
//     jusqu'au démarrage d'une nouvelle session.
export function DialerProvider({ children }) {
  const { appel, startCall } = useTelephonie();
  const [file, setFile] = useState([]);
  const [actif, setActif] = useState(false);
  const [enPause, setEnPause] = useState(false);
  const [dernierAppele, setDernierAppele] = useState(null);
  const [stats, setStats] = useState(statsVides());
  const decrocheRef = useRef(false); // l'appel en cours a-t-il déjà été compté comme décroché ?
  const dernierAppeleRef = useRef(null); // évite les closures obsolètes dans l'écouteur d'événements

  dernierAppeleRef.current = dernierAppele;

  const arreter = useCallback(() => {
    setActif(false);
    setEnPause(false);
    setFile([]);
  }, []);

  const demarrer = useCallback((prospects) => {
    setFile(prospects);
    setActif(true);
    setEnPause(false);
    setDernierAppele(null);
    setStats(statsVides());
    decrocheRef.current = false;
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
    decrocheRef.current = false;
    setStats((s) => ({ ...s, appels: s.appels + 1 }));
    startCall(prochain);
  }, [actif, enPause, appel, file, startCall]);

  // Décroché : comptabilise, ouvre la fiche, passe en pause pour la
  // conversation.
  useEffect(() => {
    if (appel?.statut === "active" && !decrocheRef.current) {
      decrocheRef.current = true;
      setStats((s) => ({ ...s, decroches: s.decroches + 1 }));
      window.open(`/entreprise/${appel.entreprise.id}`, "_blank", "noopener,noreferrer");
      setEnPause(true);
    }
  }, [appel]);

  // Sans réponse : comptabilise, puis relance seule la file après un court
  // délai (le NRP est déjà journalisé côté CallContext).
  useEffect(() => {
    if (appel?.statut !== "ended" || !appel.sansReponse) return;
    setStats((s) => ({ ...s, sansReponse: s.sansReponse + 1 }));
    if (!actif) return;
    const t = setTimeout(() => setEnPause(false), DELAI_APRES_SANS_REPONSE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appel]);

  // Comptabilise les RDV pris pendant la session, en écoutant les mêmes
  // mises à jour que le reste de l'application (voir CallContext).
  useEffect(() => {
    function onMaj(ev) {
      if (ev.detail.statut === "rdv" && ev.detail.id === dernierAppeleRef.current?.id) {
        setStats((s) => ({ ...s, rdv: s.rdv + 1 }));
      }
    }
    window.addEventListener("entreprise:maj", onMaj);
    return () => window.removeEventListener("entreprise:maj", onMaj);
  }, []);

  return (
    <DialerContext.Provider
      value={{ actif, enPause, file, dernierAppele, stats, demarrer, arreter, reprendre }}
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
