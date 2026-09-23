import { useEffect, useState } from "react";
import { api } from "../api.js";

// Notification globale des mails reçus sur la boîte du pôle, visible sur
// toutes les pages. Reste discrète (rien affiché) si la boîte n'est pas
// connectée ou s'il n'y a aucun mail non lu.
export default function NotificationsMail() {
  const [data, setData] = useState({ total: 0, parEntreprise: [] });
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    let annule = false;
    function verifier() {
      api
        .getEmailsNonLus()
        .then((d) => {
          if (!annule) setData(d);
        })
        .catch(() => {});
    }
    verifier();
    const id = setInterval(verifier, 20000);
    return () => {
      annule = true;
      clearInterval(id);
    };
  }, []);

  if (data.total === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-40">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-1.5 shadow-lg animate-pulse"
      >
        📬 {data.total} nouveau{data.total > 1 ? "x" : ""} mail{data.total > 1 ? "s" : ""}
      </button>

      {ouvert && (
        <div className="mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {data.parEntreprise.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                // Cible nommée (pas "_blank") : un second clic sur la même
                // entreprise réutilise l'onglet déjà ouvert au lieu d'en
                // empiler un nouveau.
                window.open(`/entreprise/${e.id}`, `fiche-${e.id}`);
                setOuvert(false);
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 last:border-b-0"
            >
              <span className="text-slate-700 dark:text-slate-200 truncate">{e.nom}</span>
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 shrink-0 ml-2">
                {e.count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
