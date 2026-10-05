import { useState } from "react";
import { Link } from "react-router-dom";
import { STATUTS } from "../constants.js";

function formatJour(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

// Pourquoi une fiche qualifiée ce mois-ci n'apparaît plus (ou pas) dans le
// compteur "Client Potentiel (CP)" du tableau de bord, qui ne montre que
// les fiches ACTUELLEMENT dans ce statut, actives et "Prioritaires".
function raisonHorsCompteur(f) {
  if (f.archivee) return "archivée";
  if (f.entreprise.statut !== "fiche") return null; // le statut actuel suffit à l'expliquer
  if (!f.entreprise.oeth?.assujetti) return "moins de 20 salariés : masquée par « Prioritaires uniquement »";
  return null;
}

// Couleur d'une barre face à l'objectif : vert atteint, orange à mi-chemin,
// rouge en dessous.
function couleurBarre(v, min) {
  return v >= min ? "bg-green-500" : v >= min / 2 ? "bg-orange-400" : "bg-red-400";
}

// Indicateur de performance : nombre de fiches qualifiées (passées en
// "Client Potentiel", "Fiche one-shot" ou "Conforme") ce mois-ci, face à
// l'objectif de 20 à 30 PAR AGENT. Un clic déplie la liste de ces fiches, avec
// leur statut actuel — une fiche qualifiée reste comptée même si son statut a
// changé depuis (RDV, mail, conforme archivé…).
//
// `equipe` (administrateur, hors Mode Manager) : la barre montre la MOYENNE
// par agent (total ÷ nombre d'agents), et le détail une barre par agent
// (CP attribué à l'agent assigné à la fiche). Sans `equipe` (agent, ou admin
// sur le compte d'un agent) : ses propres fiches qualifiées.
export default function KpiObjectifMensuel({ valeur, min, max, fiches = [], equipe = null }) {
  const [ouvert, setOuvert] = useState(false);
  const vueEquipe = Array.isArray(equipe) && equipe.length > 0;
  const moyenne = vueEquipe ? valeur / equipe.length : valeur;
  const pourcentage = Math.min(100, Math.round((moyenne / min) * 100));
  const atteint = moyenne >= min;
  const parAgent = vueEquipe
    ? equipe
        .map((a) => ({ ...a, cp: fiches.filter((f) => f.entreprise.assigneA === a.id).length }))
        .sort((a, b) => b.cp - a.cp || a.nom.localeCompare(b.nom, "fr"))
    : [];
  const sansAgent = vueEquipe ? fiches.filter((f) => !equipe.some((a) => a.id === f.entreprise.assigneA)).length : 0;
  const moyenneTexte = moyenne.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-4">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        title="Voir les fiches qualifiées ce mois-ci"
        className="w-full px-4 py-2.5 flex items-center gap-4 text-left rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition"
      >
        <span className="text-xl" aria-hidden>
          🎯
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Objectif du mois — fiches qualifiées{vueEquipe ? " (moyenne par agent)" : ""}
            </span>
            <span className={`text-sm font-bold ${atteint ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-200"}`}>
              {vueEquipe ? (
                <>
                  {moyenneTexte} / {min}-{max} par agent
                  <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                    ({valeur} CP · {equipe.length} agent{equipe.length > 1 ? "s" : ""})
                  </span>
                </>
              ) : (
                <>
                  {valeur} / {min}-{max}
                </>
              )}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${couleurBarre(moyenne, min)}`}
              style={{ width: `${pourcentage}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{ouvert ? "▲" : "▼"}</span>
      </button>

      {ouvert && (
        <div className="px-4 pb-3 border-t border-slate-100 dark:border-slate-700">
          {vueEquipe && (
            <div className="py-2 space-y-1.5">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Par agent — objectif {min} à {max} CP ce mois-ci</p>
              {parAgent.map((a) => (
                <div key={a.id} className="flex items-center gap-3 text-sm">
                  <span className="w-40 truncate text-slate-700 dark:text-slate-200" title={a.nom}>
                    {a.nom}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${couleurBarre(a.cp, min)}`} style={{ width: `${Math.min(100, (a.cp / min) * 100)}%` }} />
                  </div>
                  <span className={`w-16 text-right font-semibold ${a.cp >= min ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-200"}`}>
                    {a.cp} / {min}
                  </span>
                </div>
              ))}
              {sansAgent > 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  + {sansAgent} CP sur des fiches sans agent (ou d'un administrateur) — comptés dans le total, pas dans les barres.
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
            Compte chaque entreprise passée en <strong>Client Potentiel</strong>, <strong>Fiche one-shot</strong> ou{" "}
            <strong>Conforme</strong> ce mois-ci, même si son statut a changé depuis. Le compteur « Client Potentiel
            (CP) » plus bas n'affiche que les fiches encore dans ce statut aujourd'hui.
          </p>
          {fiches.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 pb-1">Aucune fiche qualifiée ce mois-ci pour l'instant.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {fiches.map((f) => {
                const qualif = STATUTS[f.sortie.issue] || { label: f.sortie.issue };
                const actuel = STATUTS[f.entreprise.statut] || { label: f.entreprise.statut, badge: "" };
                const raison = raisonHorsCompteur(f);
                return (
                  <li key={f.entreprise.id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Link
                      to={`/entreprise/${f.entreprise.id}`}
                      className="font-medium text-marine-700 dark:text-marine-300 hover:underline min-w-[160px]"
                    >
                      {f.entreprise.nom}
                    </Link>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {qualif.label} le {formatJour(f.sortie.date)}
                    </span>
                    <span className="text-xs text-slate-400">→ aujourd'hui :</span>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${actuel.badge}`}>
                      {actuel.label}
                    </span>
                    {raison && <span className="text-[11px] text-amber-700 dark:text-amber-400">({raison})</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
