import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useChat } from "../chat/ChatContext.jsx";
import { formatDateHeure } from "../constants.js";
import { formatJourCourt } from "../PresenceContext.jsx";

const INTERVALLE_POLLING_MS = 20000;

// Centre de notifications : messages non lus, nouveaux leads assignés, RDV
// planifiés à venir (48h), et fiches potentielles en attente de finalisation
// — signaux déjà calculés côté serveur (voir GET /api/notifications),
// agrégés ici en un seul badge.
export default function NotificationCenter() {
  const navigate = useNavigate();
  const { canaux } = useChat();
  const [data, setData] = useState({
    messagesNonLus: 0,
    nouveauxLeads: [],
    rdvAVenir: [],
    fichesPotentielles: [],
    demandesAcces: [],
  });
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    let annule = false;
    function verifier() {
      api
        .getNotifications()
        .then((d) => !annule && setData(d))
        .catch(() => {});
    }
    verifier();
    const id = setInterval(verifier, INTERVALLE_POLLING_MS);
    return () => {
      annule = true;
      clearInterval(id);
    };
  }, []);

  const alertesEquipe = data.alertesPresenceEquipe || [];
  const demandesAcces = data.demandesAcces || [];
  const total =
    data.messagesNonLus +
    data.nouveauxLeads.length +
    data.rdvAVenir.length +
    (data.fichesPotentielles?.length || 0) +
    (data.alertePresence ? 1 : 0) +
    alertesEquipe.length +
    demandesAcces.length;

  function ouvrirCanalNonLu() {
    setOuvert(false);
    const premierNonLu = canaux.find((c) => c.nonLus > 0);
    navigate("/chat", { state: { canalId: premierNonLu?.id || null } });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="relative w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        title="Notifications"
      >
        🔔
        {total > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 text-sm">
          {total === 0 ? (
            <p className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">Rien de nouveau.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {data.alertePresence && (
                <button
                  onClick={() => {
                    setOuvert(false);
                    navigate("/mes-kpis");
                  }}
                  className="w-full text-left px-4 py-2.5 bg-red-50/70 dark:bg-red-950/30 hover:bg-red-50 dark:hover:bg-red-950/50 flex items-center gap-2"
                >
                  <span aria-hidden>⚠️</span>
                  <span className="text-red-700 dark:text-red-300">
                    Aucune activité enregistrée le <strong>{formatJourCourt(data.alertePresence.jour)}</strong>
                  </span>
                </button>
              )}

              {alertesEquipe.length > 0 && (
                <button
                  onClick={() => {
                    setOuvert(false);
                    navigate("/kpis-equipe");
                  }}
                  className="w-full text-left px-4 py-2.5 bg-red-50/70 dark:bg-red-950/30 hover:bg-red-50 dark:hover:bg-red-950/50 flex items-start gap-2"
                >
                  <span aria-hidden>🚨</span>
                  <span className="text-red-700 dark:text-red-300">
                    Absence le {formatJourCourt(alertesEquipe[0].jour)} :{" "}
                    <strong>{alertesEquipe.map((a) => a.prenom || a.email).join(", ")}</strong>
                  </span>
                </button>
              )}

              {demandesAcces.length > 0 && (
                <button
                  onClick={() => {
                    setOuvert(false);
                    navigate("/admin/utilisateurs");
                  }}
                  className="w-full text-left px-4 py-2.5 bg-marine-50/70 dark:bg-marine-950/30 hover:bg-marine-50 dark:hover:bg-marine-950/50 flex items-center gap-2"
                >
                  <span aria-hidden>🔑</span>
                  <span className="text-marine-800 dark:text-marine-300 truncate">
                    {demandesAcces.length} demande{demandesAcces.length > 1 ? "s" : ""} d'accès à valider :{" "}
                    <strong>
                      {demandesAcces
                        .slice(0, 2)
                        .map((d) => d.prenom || d.email)
                        .join(", ")}
                      {demandesAcces.length > 2 ? "…" : ""}
                    </strong>
                  </span>
                </button>
              )}

              {data.messagesNonLus > 0 && (
                <button
                  onClick={ouvrirCanalNonLu}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                >
                  <span aria-hidden>💬</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {data.messagesNonLus} message{data.messagesNonLus > 1 ? "s" : ""} non lu
                    {data.messagesNonLus > 1 ? "s" : ""}
                  </span>
                </button>
              )}

              {data.nouveauxLeads.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setOuvert(false);
                    navigate(`/entreprise/${l.id}`);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                >
                  <span aria-hidden>🆕</span>
                  <span className="text-slate-700 dark:text-slate-200 truncate">
                    Nouveau lead assigné : <strong>{l.nom}</strong>
                  </span>
                </button>
              ))}

              {data.rdvAVenir.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setOuvert(false);
                    navigate(`/entreprise/${r.id}`);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                >
                  <span aria-hidden>📅</span>
                  <span className="text-slate-700 dark:text-slate-200 truncate">
                    RDV <strong>{r.nom}</strong> — {formatDateHeure(r.dateRdv)}
                  </span>
                </button>
              ))}

              {(data.fichesPotentielles || []).map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setOuvert(false);
                    navigate(`/entreprise/${f.id}`);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                >
                  <span aria-hidden>📋</span>
                  <span className="text-slate-700 dark:text-slate-200 truncate">
                    Fiche Potentielle à finaliser : <strong>{f.nom}</strong>
                    {f.soumisePar ? ` (${f.soumisePar})` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
