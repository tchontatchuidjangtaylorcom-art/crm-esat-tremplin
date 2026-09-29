import { useEffect, useState } from "react";

// Saisie date + heure pour les rappels et rendez-vous, en remplacement du
// champ natif "datetime-local" : son calendrier recouvrait le bouton
// Enregistrer et l'heure ne se tapait pas facilement. Ici la date garde un
// petit calendrier, l'heure se tape librement ("14:30", "14h30", "14h",
// "1430"), et des raccourcis couvrent les cas courants en un clic.
// Valeur échangée au même format que datetime-local ("AAAA-MM-JJTHH:MM"),
// vide tant que la date ou l'heure n'est pas valide.

const HEURES_RAPIDES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];

function deuxChiffres(n) {
  return String(n).padStart(2, "0");
}

function jourISO(d) {
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`;
}

// "14:30" | "14h30" | "14h" | "14" | "1430" | "930" → "HH:MM", sinon null.
export function normaliserHeure(texte) {
  const brut = String(texte || "").trim().toLowerCase().replace(/\s/g, "");
  if (!brut) return null;
  let h;
  let m;
  const avecSeparateur = brut.match(/^(\d{1,2})[:h.](\d{0,2})$/);
  if (avecSeparateur) {
    h = Number(avecSeparateur[1]);
    m = Number(avecSeparateur[2] || 0);
  } else if (/^\d{1,4}$/.test(brut)) {
    if (brut.length <= 2) {
      h = Number(brut);
      m = 0;
    } else {
      h = Number(brut.slice(0, -2));
      m = Number(brut.slice(-2));
    }
  } else {
    return null;
  }
  if (h > 23 || m > 59) return null;
  return `${deuxChiffres(h)}:${deuxChiffres(m)}`;
}

function decomposer(valeur) {
  const [date = "", heure = ""] = String(valeur || "").split("T");
  return { date, heure: heure.slice(0, 5) };
}

export default function ChampDateHeure({ value, onChange, autoFocus = false, raccourcis = true, libelleDate, libelleHeure = "Heure" }) {
  const initial = decomposer(value);
  const [date, setDate] = useState(initial.date);
  const [heure, setHeure] = useState(initial.heure);

  // Valeur modifiée de l'extérieur (fiche rechargée, formulaire réinitialisé) :
  // seulement si elle diffère de ce que la saisie en cours produirait, pour ne
  // jamais effacer une heure en cours de frappe.
  useEffect(() => {
    const h = normaliserHeure(heure);
    const saisieCourante = date && h ? `${date}T${h}` : "";
    if ((value || "") !== saisieCourante) {
      const d = decomposer(value);
      setDate(d.date);
      setHeure(d.heure);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emettre(nouvelleDate, nouvelleHeure) {
    const h = normaliserHeure(nouvelleHeure);
    onChange(nouvelleDate && h ? `${nouvelleDate}T${h}` : "");
  }

  function changerDate(d) {
    setDate(d);
    emettre(d, heure);
  }

  function changerHeure(h) {
    setHeure(h);
    emettre(date, h);
  }

  function jourDans(nbJours) {
    const d = new Date();
    d.setDate(d.getDate() + nbJours);
    return jourISO(d);
  }

  function lundiProchain() {
    const d = new Date();
    const decalage = ((8 - d.getDay()) % 7) || 7;
    d.setDate(d.getDate() + decalage);
    return jourISO(d);
  }

  const heureInvalide = heure.trim() !== "" && !normaliserHeure(heure);
  const champ =
    "mt-1 w-full rounded-lg border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm";
  const puce =
    "rounded-full border border-slate-300 dark:border-slate-600 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700";
  const puceActive = "border-marine-500 bg-marine-50 text-marine-800 dark:bg-marine-900/40 dark:text-marine-200";

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <label className="flex-1 min-w-0 text-xs text-slate-500 dark:text-slate-400">
          {libelleDate || "Date"}
          <input
            type="date"
            autoFocus={autoFocus}
            value={date}
            onChange={(e) => changerDate(e.target.value)}
            className={`${champ} border-slate-300 dark:border-slate-600`}
          />
        </label>
        <label className="w-24 shrink-0 text-xs text-slate-500 dark:text-slate-400">
          {libelleHeure}
          <input
            type="text"
            inputMode="numeric"
            value={heure}
            onChange={(e) => changerHeure(e.target.value)}
            onBlur={() => {
              const h = normaliserHeure(heure);
              if (h) setHeure(h);
            }}
            placeholder="14:30"
            maxLength={5}
            className={`${champ} tabular-nums ${heureInvalide ? "border-red-400" : "border-slate-300 dark:border-slate-600"}`}
          />
        </label>
      </div>
      {heureInvalide && <p className="text-[11px] text-red-600 dark:text-red-400">Heure invalide : tapez par exemple 14:30 ou 9h.</p>}

      {raccourcis && (
        <div className="flex flex-wrap gap-1">
          {[
            { label: "Aujourd'hui", valeur: jourDans(0) },
            { label: "Demain", valeur: jourDans(1) },
            { label: "Lundi", valeur: lundiProchain() },
          ].map((j) => (
            <button key={j.label} type="button" onClick={() => changerDate(j.valeur)} className={`${puce} ${date === j.valeur ? puceActive : ""}`}>
              {j.label}
            </button>
          ))}
          <span className="mx-0.5 text-slate-300 dark:text-slate-600">|</span>
          {HEURES_RAPIDES.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => changerHeure(h)}
              className={`${puce} tabular-nums ${normaliserHeure(heure) === h ? puceActive : ""}`}
            >
              {h.replace(":00", "h")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
