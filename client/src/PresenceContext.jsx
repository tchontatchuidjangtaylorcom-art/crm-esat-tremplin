import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "./api.js";
import { useAuth } from "./AuthContext.jsx";
import { useTelephonie } from "./telephony/CallContext.jsx";

// Au-delà de 5 min sans souris/clavier/défilement, le chrono se met en pause
// (plus aucun battement envoyé) — il reprend au premier mouvement. Pendant un
// appel, l'agent ne touche souvent à rien : un appel en cours compte donc
// toujours comme de l'activité. Voir server/src/presence.js pour le calcul.
const SEUIL_INACTIVITE_MS = 5 * 60 * 1000;
const INTERVALLE_BATTEMENT_MS = 30 * 1000;
const EVENEMENTS_ACTIVITE = ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart"];
// Pages publiques : un agent connecté qui consulte la vitrine ne travaille
// pas dans le CRM.
const PAGES_NON_SUIVIES = ["/vitrine", "/connexion"];

const PresenceContext = createContext({ suivi: false, enPause: false, secondesAujourdHui: null });

export function PresenceProvider({ children }) {
  const { utilisateur } = useAuth();
  const { appel } = useTelephonie();
  const { pathname } = useLocation();
  const [enPause, setEnPause] = useState(false);
  const [secondesAujourdHui, setSecondesAujourdHui] = useState(null);

  const derniereActiviteRef = useRef(Date.now());
  const enPauseRef = useRef(false);
  const appelEnCoursRef = useRef(false);
  appelEnCoursRef.current = Boolean(appel && appel.statut !== "ended");

  const suivi = Boolean(utilisateur) && !PAGES_NON_SUIVIES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!suivi) return;
    let annule = false;
    let derniereCapture = 0;

    function envoyer() {
      api
        .envoyerBattementPresence()
        .then((r) => !annule && setSecondesAujourdHui(r.secondesActives))
        .catch(() => {});
    }

    function changerPause(valeur) {
      enPauseRef.current = valeur;
      setEnPause(valeur);
    }

    function marquerActivite() {
      const maintenant = Date.now();
      // mousemove se déclenche des dizaines de fois par seconde : une
      // capture par seconde suffit largement.
      if (maintenant - derniereCapture < 1000) return;
      derniereCapture = maintenant;
      derniereActiviteRef.current = maintenant;
      // Reprise après une pause : battement immédiat, sans attendre le
      // prochain tick, pour que le chrono et le statut repartent aussitôt.
      if (enPauseRef.current) {
        changerPause(false);
        envoyer();
      }
    }

    function tick() {
      const actif = appelEnCoursRef.current || Date.now() - derniereActiviteRef.current < SEUIL_INACTIVITE_MS;
      if (actif) {
        if (enPauseRef.current) changerPause(false);
        envoyer();
      } else if (!enPauseRef.current) {
        changerPause(true);
      }
    }

    function onVisibilite() {
      if (document.visibilityState === "visible") marquerActivite();
    }

    EVENEMENTS_ACTIVITE.forEach((ev) => window.addEventListener(ev, marquerActivite, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", onVisibilite);
    // Arriver sur le CRM (connexion, rechargement) est déjà une activité.
    derniereActiviteRef.current = Date.now();
    tick();
    const id = setInterval(tick, INTERVALLE_BATTEMENT_MS);

    return () => {
      annule = true;
      clearInterval(id);
      EVENEMENTS_ACTIVITE.forEach((ev) => window.removeEventListener(ev, marquerActivite, { capture: true }));
      document.removeEventListener("visibilitychange", onVisibilite);
    };
  }, [suivi]);

  return (
    <PresenceContext.Provider value={{ suivi, enPause: suivi && enPause, secondesAujourdHui }}>
      {children}
      {suivi && enPause && (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/80 px-4 py-2 text-xs font-medium text-amber-800 dark:text-amber-300 shadow-lg"
        >
          <span aria-hidden>⏸</span>
          Chrono en pause (5 min sans activité) — bougez la souris pour reprendre
        </div>
      )}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}

// "3 h 25", "45 min", "0 min" — durées de travail (jamais de secondes).
export function formatDureeTravail(secondes) {
  if (!Number.isFinite(secondes) || secondes <= 0) return "0 min";
  const totalMinutes = Math.floor(secondes / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

export function formatHeureCourte(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// "lundi 21/09" à partir d'un jour "AAAA-MM-JJ" (sans décalage de fuseau).
export function formatJourCourt(jour, { avecJourSemaine = true } = {}) {
  if (!jour) return "—";
  const d = new Date(`${jour}T12:00:00Z`);
  return d.toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    ...(avecJourSemaine ? { weekday: "long" } : {}),
    day: "2-digit",
    month: "2-digit",
  });
}
