import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api.js";

const ChatContext = createContext(null);

const INTERVALLE_POLLING_MS = 15000;

// Liste des canaux (groupes + privés) et leurs compteurs de non-lus, tenue à
// jour par sondage périodique — même principe que NotificationsMail.jsx,
// pas de websocket dans cette app pour l'instant. Un seul point de sondage
// partagé par le widget flottant et la page dédiée, pour ne jamais avoir
// deux minuteurs qui divergent.
export function ChatProvider({ children }) {
  const [canaux, setCanaux] = useState([]);
  const [collegues, setCollegues] = useState([]);
  const [erreur, setErreur] = useState(null);

  const rafraichir = useCallback(() => {
    return api
      .listCanauxChat()
      .then((liste) => {
        setCanaux(liste);
        setErreur(null);
      })
      .catch((e) => setErreur(e.message));
  }, []);

  useEffect(() => {
    rafraichir();
    const id = setInterval(rafraichir, INTERVALLE_POLLING_MS);
    return () => clearInterval(id);
  }, [rafraichir]);

  useEffect(() => {
    api.listCollegues().then(setCollegues).catch(() => {});
  }, []);

  const totalNonLus = canaux.reduce((somme, c) => somme + (c.nonLus || 0), 0);

  const marquerLu = useCallback(
    (canalId) => {
      setCanaux((prev) => prev.map((c) => (c.id === canalId ? { ...c, nonLus: 0 } : c)));
      return api.marquerCanalLu(canalId).catch(() => {});
    },
    []
  );

  const creerGroupe = useCallback(
    async (nom, membres) => {
      const canal = await api.creerGroupeChat(nom, membres);
      await rafraichir();
      return canal;
    },
    [rafraichir]
  );

  const ouvrirPrive = useCallback(
    async (utilisateurId) => {
      const canal = await api.ouvrirConversationPrivee(utilisateurId);
      await rafraichir();
      return canal;
    },
    [rafraichir]
  );

  return (
    <ChatContext.Provider
      value={{ canaux, collegues, erreur, totalNonLus, rafraichir, marquerLu, creerGroupe, ouvrirPrive }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat() doit être appelé dans un <ChatProvider>.");
  return ctx;
}
