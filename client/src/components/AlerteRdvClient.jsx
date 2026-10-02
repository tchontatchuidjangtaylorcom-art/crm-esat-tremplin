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

// Fenêtre (avec son) quand un client vient de réserver un rendez-vous depuis
// le bouton « Parler à un conseiller » d'un e-mail (voir
// server/src/vitrineRdv.js) — chez l'agent qui suit la fiche uniquement.
// Reste affichée jusqu'à ce que l'agent ouvre la fiche ou clique « Vu ».
export default function AlerteRdvClient({ rdvClients = [], onVu }) {
  const navigate = useNavigate();
  const [masques, setMasques] = useState([]);
  const dejaSonnes = useRef(new Set());
  const visibles = rdvClients.filter((r) => !masques.includes(`${r.id}|${r.date}`));
  const r = visibles[0];

  useEffect(() => {
    const nouveaux = rdvClients.filter((x) => !dejaSonnes.current.has(`${x.id}|${x.date}`));
    if (nouveaux.length === 0) return;
    nouveaux.forEach((x) => dejaSonnes.current.add(`${x.id}|${x.date}`));
    jouerAlarme();
  }, [rdvClients]);

  if (!r) return null;

  function fermer() {
    setMasques((m) => [...m, `${r.id}|${r.date}`]);
    api
      .marquerRdvClientVu(r.id)
      .then(() => onVu?.(r.id))
      .catch(() => {});
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl overflow-hidden">
        <div className="bg-emerald-600 text-white px-5 py-3 font-semibold">📅 Le client vient de confirmer un rendez-vous</div>
        <div className="px-5 py-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
          <p>
            <strong>{r.nom}</strong> a choisi un créneau depuis le lien de votre e-mail :
          </p>
          <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400 capitalize">{quand(r.dateRdv)}</p>
          {(r.contact || r.telephone) && (
            <p className="text-slate-500 dark:text-slate-400">
              Contact : {[r.contact, r.telephone].filter(Boolean).join(" — ")}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            La fiche est passée en « RDV » à cette date ; le rappel sonnera à l'heure prévue.
          </p>
          {visibles.length > 1 && (
            <p className="text-xs text-slate-400">
              + {visibles.length - 1} autre{visibles.length > 2 ? "s" : ""} rendez-vous confirmé{visibles.length > 2 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-4">
          <button
            type="button"
            onClick={fermer}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Vu
          </button>
          <button
            type="button"
            onClick={() => {
              fermer();
              navigate(`/entreprise/${r.id}`);
            }}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2"
          >
            Ouvrir la fiche
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
