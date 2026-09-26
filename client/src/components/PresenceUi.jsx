import { formatJourCourt } from "../PresenceContext.jsx";

// Briques visuelles communes à "Mes KPIs" (agent) et "KPIs équipe" (manager).

export function CarteKpi({ icone, titre, valeur, detail, progression, couleur = "marine" }) {
  const couleursBarre = {
    marine: "bg-marine-600 dark:bg-marine-300",
    vert: "bg-emerald-500",
    orange: "bg-orange-400",
    rouge: "bg-red-500",
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
        <span aria-hidden>{icone}</span>
        {titre}
      </span>
      <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{valeur}</span>
      {progression !== undefined && progression !== null && (
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${couleursBarre[couleur] || couleursBarre.marine}`}
            style={{ width: `${Math.max(0, Math.min(100, progression))}%` }}
          />
        </div>
      )}
      {detail && <span className="text-xs text-slate-500 dark:text-slate-400">{detail}</span>}
    </div>
  );
}

export function couleurTaux(taux) {
  if (taux === null || taux === undefined) return "marine";
  if (taux >= 90) return "vert";
  if (taux >= 70) return "orange";
  return "rouge";
}

export function NavigationSemaine({ decalage, lundi, onChange }) {
  const libelle =
    decalage === 0 ? "Cette semaine" : decalage === 1 ? "Semaine dernière" : `Semaine du ${formatJourCourt(lundi, { avecJourSemaine: false })}`;
  const bouton =
    "w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(decalage + 1)} disabled={decalage >= 52} className={bouton} title="Semaine précédente">
        &larr;
      </button>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 min-w-[150px] text-center">
        {libelle}
        {lundi && decalage < 2 && (
          <span className="block text-[11px] font-normal text-slate-400 dark:text-slate-500">
            du {formatJourCourt(lundi, { avecJourSemaine: false })}
          </span>
        )}
      </span>
      <button onClick={() => onChange(decalage - 1)} disabled={decalage <= 0} className={bouton} title="Semaine suivante">
        &rarr;
      </button>
    </div>
  );
}

const ETATS = {
  actif: { label: "Actif", classe: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", point: "bg-emerald-500" },
  pause: { label: "En pause", classe: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", point: "bg-amber-400" },
  absent: { label: "Pas connecté", classe: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400", point: "bg-slate-400" },
  retard: { label: "Pas connecté", classe: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300", point: "bg-red-500" },
};

export function PastilleEtat({ etat, retard }) {
  const info = ETATS[retard ? "retard" : etat] || ETATS.absent;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${info.classe}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${info.point}`} />
      {info.label}
    </span>
  );
}

// Statut d'une journée dans le détail hebdomadaire.
export function libelleJour(j) {
  if (j.present) return { label: "Présent", classe: "text-emerald-600 dark:text-emerald-400" };
  if (j.ferie) return { label: "Férié", classe: "text-slate-400 dark:text-slate-500" };
  if (!j.ouvre) return { label: "Week-end", classe: "text-slate-400 dark:text-slate-500" };
  if (j.futur) return { label: "À venir", classe: "text-slate-400 dark:text-slate-500" };
  if (j.estAujourdHui) return { label: "En attente", classe: "text-slate-400 dark:text-slate-500" };
  if (j.absent) return { label: "Absent", classe: "text-red-600 dark:text-red-400 font-semibold" };
  return { label: "Non suivi", classe: "text-slate-400 dark:text-slate-500" };
}

// Lundi → vendredi toujours ; samedi/dimanche seulement s'ils ont été travaillés.
export function joursAffiches(jours) {
  return jours.filter((j, i) => i < 5 || j.present);
}

// Mini-calendrier lun→ven : une case par jour, teinte selon le temps actif.
export function MiniSemaine({ jours, objectifSecondesJour }) {
  return (
    <div className="flex gap-1">
      {joursAffiches(jours).map((j) => {
        const ratio = objectifSecondesJour ? j.secondesActives / objectifSecondesJour : 0;
        let classe = "bg-slate-100 dark:bg-slate-700";
        if (j.absent) classe = "bg-red-400 dark:bg-red-500";
        else if (j.present) classe = ratio >= 0.85 ? "bg-emerald-500" : ratio >= 0.5 ? "bg-emerald-300 dark:bg-emerald-600" : "bg-amber-300 dark:bg-amber-500";
        const { label } = libelleJour(j);
        return (
          <span
            key={j.jour}
            title={`${formatJourCourt(j.jour)} — ${label}${j.present ? ` (${Math.round(j.secondesActives / 60)} min)` : ""}`}
            className={`w-4 h-4 rounded ${classe} ${j.estAujourdHui ? "ring-2 ring-marine-500 ring-offset-1 dark:ring-offset-slate-800" : ""}`}
          />
        );
      })}
    </div>
  );
}
