import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api.js";
import { useSupervision } from "../SupervisionContext.jsx";
import { usePresence, formatDureeTravail, formatHeureCourte, formatJourCourt } from "../PresenceContext.jsx";
import BanniereSupervision from "../components/BanniereSupervision.jsx";
import { CarteKpi, NavigationSemaine, couleurTaux, libelleJour, joursAffiches } from "../components/PresenceUi.jsx";

const INTERVALLE_RAFRAICHISSEMENT_MS = 60_000;

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

function detailAppels(x) {
  const parts = [`${x?.appels ?? 0} uniques`, `${x?.appelsDoublons ?? 0} en doublon`];
  parts.push(pluriel(x?.entreprisesAppelees ?? x?.entreprises ?? 0, "entreprise"));
  return parts.join(" · ");
}

function Section({ titre, sousTitre, action, children }) {
  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {titre}
          {sousTitre && <span className="ml-2 normal-case tracking-normal font-normal text-slate-400 dark:text-slate-500">{sousTitre}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// Tableau de bord de présence : la journée en cours (seulement quand on
// regarde la semaine en cours), puis la semaine affichée et son détail jour
// par jour — temps actif ET appels de chaque jour. En Mode Manager, affiche
// les KPIs de l'agent supervisé.
export default function MesKpis() {
  const { agentSupervise } = useSupervision();
  const { secondesAujourdHui } = usePresence();
  // Ouverte depuis « KPIs équipe » : même semaine que celle consultée.
  const { state } = useLocation();
  const [semaine, setSemaine] = useState(() => (Number.isInteger(state?.semaine) ? state.semaine : 0));
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
  const semaineEnCours = semaine === 0;
  // Le compteur du jour avance à chaque battement (toutes les 30 s) sans
  // attendre le rafraîchissement complet de la page.
  const secondesDuJour =
    !supervision && secondesAujourdHui !== null && data?.aujourdHui
      ? Math.max(secondesAujourdHui, data.aujourdHui.secondesActives)
      : data?.aujourdHui?.secondesActives || 0;

  const secondesSemaine =
    data && semaineEnCours
      ? data.semaine.secondesActives - data.aujourdHui.secondesActives + secondesDuJour
      : data?.semaine.secondesActives || 0;

  const titre = supervision ? `KPIs de ${agentSupervise.prenom || agentSupervise.email}` : "Mes KPIs";
  const dimanche = data ? data.semaine.jours[data.semaine.jours.length - 1]?.jour : null;
  const periode = data ? `du ${formatJourCourt(data.semaine.lundi)} au ${formatJourCourt(dimanche)}` : "";

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
      <Link to="/" className="text-sm text-marine-700 dark:text-marine-300 hover:underline">
        &larr; Retour au tableau de bord
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3 mt-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{titre}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Présence, temps de travail effectif et appels</p>
        </div>
        {data && <NavigationSemaine decalage={semaine} lundi={data.semaine.lundi} onChange={setSemaine} />}
      </div>

      <BanniereSupervision />

      {erreur && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          Impossible de charger les KPIs ({erreur}).
        </div>
      )}

      {semaineEnCours && data?.alerteAbsence && (
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
          {/* La journée en cours n'a de sens que sur la semaine en cours. */}
          {semaineEnCours && (
            <Section titre="Aujourd'hui" sousTitre={formatJourCourt(data.aujourdHui.jour)}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <CarteKpi
                  icone="⏱"
                  titre="Temps actif"
                  valeur={formatDureeTravail(secondesDuJour)}
                  progression={(secondesDuJour / data.objectifSecondesJour) * 100}
                  couleur={secondesDuJour >= data.objectifSecondesJour ? "vert" : "marine"}
                  detail={`Objectif : ${formatDureeTravail(data.objectifSecondesJour)} / jour`}
                />
                <CarteKpi
                  icone="🕘"
                  titre="Arrivée"
                  valeur={formatHeureCourte(data.aujourdHui.premiereActivite)}
                  detail={
                    data.aujourdHui.derniereActivite
                      ? `Dernière activité : ${formatHeureCourte(data.aujourdHui.derniereActivite)}`
                      : "Aucune activité aujourd'hui"
                  }
                />
                <CarteKpi
                  icone="📞"
                  titre="Appels (total)"
                  valeur={String(data.aujourdHui.appelsTotal ?? 0)}
                  detail={detailAppels(data.aujourdHui)}
                />
              </div>
            </Section>
          )}

          <Section
            titre={semaineEnCours ? "Cette semaine" : "Semaine"}
            sousTitre={periode}
            action={
              !semaineEnCours && (
                <button type="button" onClick={() => setSemaine(0)} className="text-xs text-marine-700 dark:text-marine-300 hover:underline">
                  Revenir à cette semaine →
                </button>
              )
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CarteKpi
                icone="📅"
                titre="Temps actif"
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
                detail={`${pluriel(data.semaine.joursPresents, "jour")} présent${data.semaine.joursPresents > 1 ? "s" : ""} sur ${pluriel(
                  data.semaine.joursOuvres,
                  "jour"
                )} ouvré${data.semaine.joursOuvres > 1 ? "s" : ""}`}
              />
              <CarteKpi
                icone="📈"
                titre="Appels (total)"
                valeur={String(data.semaine.appelsTotal ?? 0)}
                detail={detailAppels(data.semaine)}
              />
            </div>
          </Section>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
            <h2 className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700">
              Détail jour par jour
            </h2>
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <tr>
                  <th className="text-left font-semibold px-4 py-2">Jour</th>
                  <th className="text-left font-semibold px-2 py-2">Présence</th>
                  <th className="text-left font-semibold px-2 py-2 w-[35%]">Temps actif</th>
                  <th className="text-right font-semibold px-2 py-2" title="Total des appels du jour : uniques + en doublon">
                    Appels
                  </th>
                  <th className="text-right font-semibold px-4 py-2">Horaires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {joursAffiches(data.semaine.jours).map((j) => {
                  const secondes = j.estAujourdHui && semaineEnCours ? secondesDuJour : j.secondesActives;
                  const statut = libelleJour(j);
                  const ratio = Math.min(100, (secondes / data.objectifSecondesJour) * 100);
                  const total = j.appelsTotal ?? 0;
                  const sansObjet = !j.present && !total && (j.futur || !j.ouvre || !j.compte);
                  return (
                    <tr key={j.jour} className={j.estAujourdHui ? "bg-marine-50/60 dark:bg-marine-900/20" : ""}>
                      <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200 capitalize whitespace-nowrap">
                        {formatJourCourt(j.jour)}
                        {j.estAujourdHui && <span className="ml-1 text-[10px] text-marine-600 dark:text-marine-300 normal-case">(auj.)</span>}
                      </td>
                      <td className={`px-2 py-2.5 text-xs whitespace-nowrap ${statut.classe}`}>{statut.label}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-[80px] h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${ratio >= 85 ? "bg-emerald-500" : "bg-marine-500 dark:bg-marine-300"}`}
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                          <span className="w-16 text-right font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {secondes > 0 ? formatDureeTravail(secondes) : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right whitespace-nowrap">
                        {sansObjet ? (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        ) : (
                          <>
                            <span className={`font-semibold ${total ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`}>
                              📞 {total}
                            </span>
                            {total > 0 && (
                              <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                                {j.appels ?? 0} uniq. · {j.appelsDoublons ?? 0} doubl. · {pluriel(j.entreprises ?? 0, "entr.")}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {j.present ? `${formatHeureCourte(j.premiereActivite)} → ${formatHeureCourte(j.derniereActivite)}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            Le temps actif est mesuré à partir de votre activité dans le CRM (souris, clavier, défilement, appels en
            cours). Après 5 minutes sans aucune activité, le chrono se met automatiquement en pause et reprend dès
            votre retour. Les week-ends et jours fériés ne comptent pas dans le taux de présence. Un appel est compté
            quand vous cliquez sur un numéro ou le copiez, et quand vous enregistrez le résultat de l'appel (NRP 1,
            NRP 2, Me rappelle, À rappeler, RDV, Mail, CP, Refus…) — une seule fois si vous faites les deux dans
            l'heure. Numéro composé à la main ou trouvé sur Google : enregistrez le résultat, même s'il ne change
            pas (ex. NRP 1 de nouveau). Appels uniques : chaque numéro une fois par jour ; appels en doublon : les
            nouvelles tentatives sur un numéro déjà appelé le même jour.
          </p>
        </>
      )}
    </div>
  );
}
