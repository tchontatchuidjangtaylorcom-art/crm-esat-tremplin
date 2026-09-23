import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useChat } from "../chat/ChatContext.jsx";
import { formatDateHeure } from "../constants.js";

const INTERVALLE_POLLING_MS = 20000;

// Centre de notifications : messages non lus, nouveaux leads assignés, RDV
// planifiés à venir (48h), et fiches potentielles en attente de finalisation
// — signaux déjà calculés côté serveur (voir GET /api/notifications),
// agrégés ici en un seul badge.
export default function NotificationCenter() {
  const navigate = useNavigate();
  const { canaux } = useChat();
  const [data, setData] = useState({ messagesNonLus: 0, nouveauxLeads: [], rdvAVenir: [], fichesPotentielles: [] });
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

  const total =
    data.messagesNonLus + data.nouveauxLeads.length + data.rdvAVenir.length + (data.fichesPotentielles?.length || 0);

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
