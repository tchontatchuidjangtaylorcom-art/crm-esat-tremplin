import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { jouerAlarme } from "../sonConfirmation.js";

function quand(dateRdv) {
  if (!dateRdv) return "";
  const d = new Date(dateRdv);
  if (Number.isNaN(d.getTime())) return dateRdv;
  return d.toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

// Rendez-vous pris par les clients depuis le lien d'un e-mail (voir
// server/src/vitrineRdv.js) : plus de fenêtre qui bloque l'écran (plusieurs
// clients pouvaient répondre à la suite, et elle se mêlait aux rappels de
// RDV à appeler). À la place, une barre verte en haut à droite —
// « 📅 RDV clients » avec le nombre de nouveaux — qui ouvre la liste de
// tous les rendez-vous clients à venir ; on les ouvre un par un. Un son
// signale chaque nouvelle réservation. La fenêtre au centre de l'écran
// reste réservée aux rappels de RDV / à rappeler (RappelsEcheances).
export default function AlerteRdvClient({ rdvClients = [], rdvClientsAVenir = [], onVu }) {
  const navigate = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const dejaSonnes = useRef(new Set());

  // Liste : tous les RDV clients à venir ; les nouveaux en tête.
  const nouveauxIds = new Set(rdvClients.map((r) => r.id));
  const liste = [
    ...rdvClients.filter((r) => !rdvClientsAVenir.some((x) => x.id === r.id)).map((r) => ({ ...r, nouveau: true })),
    ...rdvClientsAVenir.map((r) => ({ ...r, nouveau: r.nouveau || nouveauxIds.has(r.id) })),
  ];
  const nbNouveaux = liste.filter((r) => r.nouveau).length;

  useEffect(() => {
    const nouveaux = rdvClients.filter((x) => !dejaSonnes.current.has(`${x.id}|${x.date}`));
    if (nouveaux.length === 0) return;
    nouveaux.forEach((x) => dejaSonnes.current.add(`${x.id}|${x.date}`));
    jouerAlarme();
  }, [rdvClients]);

  if (liste.length === 0) return null;

  function ouvrirFiche(r) {
    if (r.nouveau) {
      api
        .marquerRdvClientVu(r.id)
        .then(() => onVu?.(r.id))
        .catch(() => {});
    }
    setOuvert(false);
    navigate(`/entreprise/${r.id}`);
  }

  return createPortal(
    <div className="fixed top-28 right-4 sm:top-16 sm:right-56 z-40">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        title="Rendez-vous pris par des clients depuis le lien d'un e-mail"
        className={`rounded-full text-white text-sm font-semibold px-4 py-2 shadow-lg flex items-center gap-2 ${
          nbNouveaux ? "bg-emerald-600 hover:bg-emerald-700 ring-4 ring-emerald-300/70" : "bg-emerald-600/90 hover:bg-emerald-700"
        }`}
      >
        📅 RDV clients
        <span className="rounded-full bg-white text-emerald-700 text-xs font-bold px-1.5">{nbNouveaux ? `${nbNouveaux} nouveau${nbNouveaux > 1 ? "x" : ""}` : liste.length}</span>
      </button>

      {ouvert && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden text-sm">
          <div className="bg-emerald-600 text-white px-4 py-2.5 font-semibold">📅 Rendez-vous confirmés par les clients</div>
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {liste.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => ouvrirFiche(r)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 ${r.nouveau ? "bg-emerald-50/70 dark:bg-emerald-950/20" : ""}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <strong className="truncate text-slate-800 dark:text-slate-100">{r.nom}</strong>
                    {r.nouveau && <span className="shrink-0 rounded-full bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5">NOUVEAU</span>}
                  </span>
                  <span className="block text-emerald-700 dark:text-emerald-400 font-medium capitalize">{quand(r.dateRdv)}</span>
                  {(r.contact || r.telephone || r.agent) && (
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                      {[r.contact, r.telephone, r.agent ? `agent : ${r.agent}` : null].filter(Boolean).join(" — ")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>,
    document.body
  );
}
