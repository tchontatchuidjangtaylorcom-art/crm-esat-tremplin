import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useSupervision } from "../SupervisionContext.jsx";
import { usePresence, formatDureeTravail, formatHeureCourte, formatJourCourt } from "../PresenceContext.jsx";
import BanniereSupervision from "../components/BanniereSupervision.jsx";
import { CarteKpi, NavigationSemaine, couleurTaux, libelleJour, joursAffiches } from "../components/PresenceUi.jsx";

const INTERVALLE_RAFRAICHISSEMENT_MS = 60_000;

// Tableau de bord personnel de présence : temps de travail effectif du jour
// et de la semaine, taux de présence, et alerte si aucune activité n'a été
// enregistrée le jour ouvré précédent. En Mode Manager, affiche les KPIs de
// l'agent supervisé.
export default function MesKpis() {
  const { agentSupervise } = useSupervision();
  const { secondesAujourdHui } = usePresence();
  const [semaine, setSemaine] = useState(0);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annule = false;
    function charger() {
      api
        .getMesKpisPresence({ semaine, commeAgentId: agentSupervise?.id })
        .then((d) => {
          if (annule) return;
          setData(d);
          setErreur(null);
        })
        .catch((e) => !annule && setErreur(e.message));
    }
    charger();
    const id = setInterval(charger, INTERVALLE_RAFRAICHISSEMENT_MS);
    return () => {
      annule = true;
      clearInterval(id);
    };
  }, [semaine, agentSupervise]);

  const supervision = Boolean(agentSupervise);
  // Le compteur du jour avance à chaque battement (toutes les 30 s) sans
  // attendre le rafraîchissement complet de la page.
  const secondesDuJour =
    !supervision && secondesAujourdHui !== null && data?.aujourdHui
      ? Math.max(secondesAujourdHui, data.aujourdHui.secondesActives)
      : data?.aujourdHui?.secondesActives || 0;

  const secondesSemaine =
    data && semaine === 0
      ? data.semaine.secondesActives - data.aujourdHui.secondesActives + secondesDuJour
      : data?.semaine.secondesActives || 0;

  const titre = supervision ? `KPIs de ${agentSupervise.prenom || agentSupervise.email}` : "Mes KPIs";

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
      <Link to="/" className="text-sm text-marine-700 dark:text-marine-300 hover:underline">
        &larr; Retour au tableau de bord
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3 mt-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{titre}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Présence et temps de travail effectif</p>
        </div>
        {data && <NavigationSemaine decalage={semaine} lundi={data.semaine.lundi} onChange={setSemaine} />}
      </div>

      <BanniereSupervision />

      {erreur && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          Impossible de charger les KPIs ({erreur}).
        </div>
      )}

      {data?.alerteAbsence && (
        <div className="mb-5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm flex items-start gap-3">
          <span className="text-lg leading-none" aria-hidden>
            ⚠️
          </span>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">
              Aucune activité enregistrée le {formatJourCourt(data.alerteAbsence.jour)}
            </p>
            <p className="text-red-700 dark:text-red-400 text-xs mt-0.5">
              {supervision
                ? "L'agent ne s'est pas connecté au CRM de toute la journée."
                : "Si vous étiez en congé, en formation ou en rendez-vous extérieur, pensez à prévenir votre manager — cette alerte lui est également signalée."}
            </p>
          </div>
        </div>
      )}

      {!data && !erreur && <p className="text-sm text-slate-400 dark:text-slate-500">Chargement…</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <CarteKpi
              icone="⏱"
              titre="Temps actif aujourd'hui"
              valeur={formatDureeTravail(secondesDuJour)}
              progression={(secondesDuJour / data.objectifSecondesJour) * 100}
              couleur={secondesDuJour >= data.objectifSecondesJour ? "vert" : "marine"}
              detail={`Objectif : ${formatDureeTravail(data.objectifSecondesJour)} / jour`}
            />
            <CarteKpi
              icone="🕘"
              titre="Arrivée aujourd'hui"
              valeur={formatHeureCourte(data.aujourdHui.premiereActivite)}
              detail={
                data.aujourdHui.derniereActivite
                  ? `Dernière activité : ${formatHeureCourte(data.aujourdHui.derniereActivite)}`
                  : "Aucune activité aujourd'hui"
              }
            />
            <CarteKpi
              icone="📅"
              titre={semaine === 0 ? "Temps actif cette semaine" : "Temps actif de la semaine"}
              valeur={formatDureeTravail(secondesSemaine)}
              progression={data.semaine.objectifSecondes ? (secondesSemaine / data.semaine.objectifSecondes) * 100 : null}
              detail={
                data.semaine.joursPresents
                  ? `Moyenne : ${formatDureeTravail(data.semaine.moyenneSecondesParJourPresent)} / jour travaillé`
                  : "Aucun jour travaillé"
              }
            />
            <CarteKpi
              icone="✅"
              titre="Taux de présence"
              valeur={data.semaine.tauxPresence === null ? "—" : `${data.semaine.tauxPresence} %`}
              progression={data.semaine.tauxPresence}
              couleur={couleurTaux(data.semaine.tauxPresence)}
              detail={`${data.semaine.joursPresents} jour${data.semaine.joursPresents > 1 ? "s" : ""} présent${
                data.semaine.joursPresents > 1 ? "s" : ""
              } sur ${data.semaine.joursOuvres} jour${data.semaine.joursOuvres > 1 ? "s" : ""} ouvré${data.semaine.joursOuvres > 1 ? "s" : ""}`}
            />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <h2 className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700">
              Détail jour par jour
            </h2>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {joursAffiches(data.semaine.jours).map((j) => {
                const secondes = j.estAujourdHui && semaine === 0 ? secondesDuJour : j.secondesActives;
                const statut = libelleJour(j);
                const ratio = Math.min(100, (secondes / data.objectifSecondesJour) * 100);
                return (
                  <li key={j.jour} className={`px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${j.estAujourdHui ? "bg-marine-50/60 dark:bg-marine-900/20" : ""}`}>
                    <span className="w-32 font-medium text-slate-700 dark:text-slate-200 capitalize">
                      {formatJourCourt(j.jour)}
                      {j.estAujourdHui && <span className="ml-1 text-[10px] text-marine-600 dark:text-marine-300 normal-case">(auj.)</span>}
                    </span>
                    <span className={`w-20 text-xs ${statut.classe}`}>{statut.label}</span>
                    <div className="flex-1 min-w-[120px] h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ratio >= 85 ? "bg-emerald-500" : "bg-marine-500 dark:bg-marine-300"}`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-semibold text-slate-800 dark:text-slate-100">
                      {secondes > 0 ? formatDureeTravail(secondes) : "—"}
                    </span>
                    <span className="w-28 text-right text-xs text-slate-400 dark:text-slate-500">
                      {j.present ? `${formatHeureCourte(j.premiereActivite)} → ${formatHeureCourte(j.derniereActivite)}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            Le temps actif est mesuré à partir de votre activité dans le CRM (souris, clavier, défilement, appels en
            cours). Après 5 minutes sans aucune activité, le chrono se met automatiquement en pause et reprend dès
            votre retour. Les week-ends et jours fériés ne comptent pas dans le taux de présence.
          </p>
        </>
      )}
    </div>
  );
}
