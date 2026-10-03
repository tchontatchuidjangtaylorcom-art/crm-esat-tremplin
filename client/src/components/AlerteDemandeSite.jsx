import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { estAdmin } from "../roles.js";
import { jouerAlarme } from "../sonConfirmation.js";
import { formatDateHeure } from "../constants.js";

// Fenêtre (avec son) pour les ADMINISTRATEURS à chaque nouvelle demande du
// site public (rendez-vous expert, démo, contact, simulation, vigilance) :
// un visiteur venu de Google n'est encore suivi par personne. « Je m'en
// occupe » attribue la fiche à l'admin et l'ouvre ; « Plus tard » la laisse
// dans la cloche.
export default function AlerteDemandeSite({ demandes = [] }) {
  const { utilisateur } = useAuth();
  const navigate = useNavigate();
  const [masquees, setMasquees] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("demandes-site-masquees") || "[]");
    } catch {
      return [];
    }
  });
  const dejaSonnees = useRef(new Set());
  const [enCours, setEnCours] = useState(false);
  const admin = estAdmin(utilisateur);
  const visibles = admin ? demandes.filter((d) => !masquees.includes(`${d.id}|${d.date}`)) : [];
  const d = visibles[0];

  useEffect(() => {
    const nouvelles = visibles.filter((x) => !dejaSonnees.current.has(`${x.id}|${x.date}`));
    if (nouvelles.length === 0) return;
    nouvelles.forEach((x) => dejaSonnees.current.add(`${x.id}|${x.date}`));
    jouerAlarme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandes, admin]);

  if (!d) return null;

  function masquer() {
    const liste = [...masquees, `${d.id}|${d.date}`];
    setMasquees(liste);
    try {
      sessionStorage.setItem("demandes-site-masquees", JSON.stringify(liste));
    } catch {
      // stockage indisponible : masquée pour cette page seulement
    }
  }

  async function prendre() {
    setEnCours(true);
    try {
      await api.assignerEntreprise(d.id, utilisateur.id);
    } catch {
      // déjà attribuée ou droits insuffisants : on ouvre quand même la fiche
    } finally {
      setEnCours(false);
    }
    masquer();
    navigate(`/entreprise/${d.id}`);
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl overflow-hidden">
        <div className="bg-teal-600 text-white px-5 py-3 font-semibold">🌐 Nouvelle demande reçue du site web</div>
        <div className="px-5 py-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
          <p>
            <strong>{d.type}</strong> : <strong>{d.nom}</strong>
          </p>
          {d.date && <p className="text-slate-500 dark:text-slate-400">Reçue le {formatDateHeure(d.date)}</p>}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ce visiteur n'est encore suivi par personne : rappelez-le, complétez la fiche (SIRET, effectif, contact) puis attribuez-la.
          </p>
          {visibles.length > 1 && (
            <p className="text-xs text-slate-400">
              + {visibles.length - 1} autre{visibles.length > 2 ? "s" : ""} demande{visibles.length > 2 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-4">
          <button
            type="button"
            onClick={masquer}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={() => {
              masquer();
              navigate(`/entreprise/${d.id}`);
            }}
            className="rounded-lg border border-teal-600 text-teal-700 dark:text-teal-300 text-sm font-medium px-3 py-2"
          >
            Ouvrir la fiche
          </button>
          <button
            type="button"
            onClick={prendre}
            disabled={enCours}
            className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
          >
            Je m'en occupe
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
