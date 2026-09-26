import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useSupervision } from "../SupervisionContext.jsx";
import { formatDureeTravail, formatHeureCourte, formatJourCourt } from "../PresenceContext.jsx";
import { CarteKpi, NavigationSemaine, PastilleEtat, MiniSemaine, couleurTaux } from "../components/PresenceUi.jsx";

const INTERVALLE_RAFRAICHISSEMENT_MS = 60_000;

// Tableau de bord manager : présence et temps de travail effectif de toute
// l'équipe, en temps quasi réel (état actif/en pause, arrivée du jour) et
// sur la semaine (taux de présence, temps actif cumulé), avec les alertes
// d'absence en tête de liste.
export default function KpisEquipe() {
  const navigate = useNavigate();
  const { setAgentSupervise } = useSupervision();
  const [semaine, setSemaine] = useState(0);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annule = false;
    function charger() {
      api
        .getKpisEquipePresence({ semaine })
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
  }, [semaine]);

  function voirDetail(u) {
    setAgentSupervise({ id: u.id, prenom: u.prenom, email: u.email });
    navigate("/mes-kpis");
  }

  const alertes = data
    ? data.membres.flatMap((m) => {
        const liste = [];
        if (m.alerteAbsence) liste.push({ m, texte: `aucune connexion ${formatJourCourt(m.alerteAbsence.jour)}` });
        if (m.aujourdHui.retard) liste.push({ m, texte: `pas encore connecté aujourd'hui (après ${data.heureAlerteArrivee} h)` });
        return liste;
      })
    : [];

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <Link to="/" className="text-sm text-marine-700 dark:text-marine-300 hover:underline">
        &larr; Retour au tableau de bord
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3 mt-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">KPIs équipe</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Présence et temps de travail effectif — actualisé chaque minute
          </p>
        </div>
        {data && data.membres[0] && (
          <NavigationSemaine decalage={semaine} lundi={data.membres[0].semaine.lundi} onChange={setSemaine} />
        )}
      </div>

      {erreur && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          Impossible de charger les KPIs de l'équipe ({erreur}).
        </div>
      )}

      {!data && !erreur && <p className="text-sm text-slate-400 dark:text-slate-500">Chargement…</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <CarteKpi
              icone="🟢"
              titre="Agents actifs en ce moment"
              valeur={`${data.resume.actifsMaintenant} / ${data.resume.total}`}
              detail={`${data.resume.presentsAujourdHui} connecté${data.resume.presentsAujourdHui > 1 ? "s" : ""} aujourd'hui`}
            />
            <CarteKpi
              icone="🚨"
              titre="Alertes d'absence"
              valeur={alertes.length}
              couleur={alertes.length ? "rouge" : "vert"}
              detail={`${data.resume.absencesVeille} absence${data.resume.absencesVeille > 1 ? "s" : ""} la veille · ${
                data.resume.retardsAujourdHui
              } non connecté${data.resume.retardsAujourdHui > 1 ? "s" : ""} ce jour`}
            />
            <CarteKpi
              icone="✅"
              titre="Taux de présence moyen"
              valeur={data.resume.tauxPresenceMoyen === null ? "—" : `${data.resume.tauxPresenceMoyen} %`}
              progression={data.resume.tauxPresenceMoyen}
              couleur={couleurTaux(data.resume.tauxPresenceMoyen)}
              detail={semaine === 0 ? "Semaine en cours" : "Semaine sélectionnée"}
            />
            <CarteKpi
              icone="⏱"
              titre="Temps actif cumulé"
              valeur={formatDureeTravail(data.resume.secondesActivesSemaine)}
              detail="Tous les agents, sur la semaine"
            />
          </div>

          {alertes.length > 0 && (
            <div className="mb-5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm">
              <p className="font-semibold text-red-800 dark:text-red-300 mb-1">⚠️ Alertes de présence</p>
              <ul className="space-y-0.5 text-red-700 dark:text-red-400">
                {alertes.map(({ m, texte }, i) => (
                  <li key={`${m.utilisateur.id}-${i}`}>
                    <strong>
                      {m.utilisateur.prenom} {m.utilisateur.nom}
                    </strong>{" "}
                    : {texte}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Collaborateur</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Maintenant</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Arrivée</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Aujourd'hui</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Semaine</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Temps semaine</th>
                  <th className="text-left px-3 py-2.5 font-semibold w-40">Présence</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.membres.map((m) => {
                  const enAlerte = Boolean(m.alerteAbsence || m.aujourdHui.retard);
                  const taux = m.semaine.tauxPresence;
                  return (
                    <tr key={m.utilisateur.id} className={enAlerte ? "bg-red-50/60 dark:bg-red-950/20" : ""}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800 dark:text-slate-100">
                          {m.utilisateur.prenom} {m.utilisateur.nom}
                          {m.utilisateur.role === "admin" && (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase text-marine-600 dark:text-marine-300">admin</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">{m.utilisateur.email}</div>
                        {m.alerteAbsence && (
                          <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                            Absent {formatJourCourt(m.alerteAbsence.jour)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <PastilleEtat etat={m.aujourdHui.etat} retard={m.aujourdHui.retard} />
                        {m.aujourdHui.etat === "pause" && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            depuis {formatHeureCourte(m.aujourdHui.derniereActivite)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {formatHeureCourte(m.aujourdHui.premiereActivite)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">
                        {m.aujourdHui.secondesActives ? formatDureeTravail(m.aujourdHui.secondesActives) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <MiniSemaine jours={m.semaine.jours} objectifSecondesJour={data.objectifSecondesJour} />
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-700 dark:text-slate-200">
                        {formatDureeTravail(m.semaine.secondesActives)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                { vert: "bg-emerald-500", orange: "bg-orange-400", rouge: "bg-red-500", marine: "bg-slate-300" }[couleurTaux(taux)]
                              }`}
                              style={{ width: `${taux || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 w-16 text-right">
                            {taux === null ? "—" : `${taux} %`}
                            <span className="block font-normal text-[10px] text-slate-400 dark:text-slate-500">
                              {m.semaine.joursPresents}/{m.semaine.joursOuvres} j
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => voirDetail(m.utilisateur)}
                          className="text-xs font-medium text-marine-700 dark:text-marine-300 hover:underline whitespace-nowrap"
                        >
                          Détail →
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {data.membres.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                      Aucun compte validé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            « Actif » : activité dans le CRM au cours des 90 dernières secondes. « En pause » : plus de 5 minutes sans
            souris ni clavier, ou CRM fermé. Une alerte est levée pour tout agent sans aucune connexion le jour ouvré
            précédent, ou pas encore connecté après {data.heureAlerteArrivee} h un jour ouvré. Les administrateurs sont
            affichés mais ne déclenchent aucune alerte.
          </p>
        </>
      )}
    </div>
  );
}
