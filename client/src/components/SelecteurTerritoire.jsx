import { useEffect, useState } from "react";
import { TERRITOIRES, heureLocale, etatBureaux } from "../territoires.js";

const PASTILLES = {
  ouvert: { classe: "bg-emerald-500", titre: "Bureaux ouverts : bon moment pour appeler" },
  pause: { classe: "bg-amber-400", titre: "Pause déjeuner sur place (12 h – 14 h)" },
  ferme: { classe: "bg-slate-300 dark:bg-slate-600", titre: "Bureaux fermés sur place" },
};

// Choix du territoire de travail (métropole, La Réunion, Guadeloupe…) : tout
// le tableau de bord (secteurs, compteurs, liste, téléphonie) se limite
// ensuite aux fiches de ce territoire. Chaque bouton montre le nombre de
// fiches, l'heure sur place et si les bureaux sont ouverts.
export default function SelecteurTerritoire({ valeur, onChange, comptes, total }) {
  const [, setTic] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTic((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const bouton = (actif) =>
    `flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition whitespace-nowrap ${
      actif
        ? "border-marine-800 bg-marine-800 text-white dark:border-marine-200 dark:bg-marine-200 dark:text-marine-900"
        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
    }`;

  return (
    <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
        Territoire — choisissez la zone à appeler
      </p>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Territoire">
        <button type="button" role="tab" aria-selected={valeur === "tous"} onClick={() => onChange("tous")} className={bouton(valeur === "tous")}>
          <span className="font-medium">Tous</span>
          <span className="opacity-70 tabular-nums">{total}</span>
        </button>
        {TERRITOIRES.map((t) => {
          const actif = valeur === t.cle;
          const nombre = comptes[t.cle] || 0;
          const pastille = PASTILLES[etatBureaux(t.fuseau)];
          return (
            <button
              key={t.cle}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => onChange(t.cle)}
              title={`${t.nom} — ${heureLocale(t.fuseau)} sur place. ${pastille.titre}.`}
              className={`${bouton(actif)} ${!actif && nombre === 0 ? "opacity-50" : ""}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${pastille.classe}`} aria-hidden />
              <span className="font-medium">{t.court}</span>
              <span className="opacity-70 tabular-nums">{nombre}</span>
              <span className={`text-xs tabular-nums ${actif ? "opacity-80" : "text-slate-400 dark:text-slate-500"}`}>
                🕐 {heureLocale(t.fuseau)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
