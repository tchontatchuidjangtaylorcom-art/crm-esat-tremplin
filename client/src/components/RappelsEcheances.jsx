import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { jouerAlarme } from "../sonConfirmation.js";
import { versLienTel } from "../telephony/BoutonAppel.jsx";
import { estNumeroAffichable } from "../telephone.js";
import ChampDateHeure from "./ChampDateHeure.jsx";
import { compterAppel } from "../telephony/compterAppel.js";

// Alerte à l'heure d'un RDV ou d'un rappel (voir GET /api/echeances) : une
// fenêtre qui ne se ferme pas d'un clic à côté, un bip répété, et une
// notification Windows si le CRM est en arrière-plan. L'agent doit choisir :
// appeler maintenant, reporter de 10 minutes, ou indiquer que c'est déjà fait.
// Un rappel manqué (agent connecté en retard) s'affiche dès son arrivée.

const INTERVALLE_CHARGEMENT_MS = 60_000;
const INTERVALLE_VERIFICATION_MS = 15_000;
const INTERVALLE_BIP_MS = 20_000;
// L'alerte part 2 minutes avant l'heure, pour être prêt à appeler à l'heure.
const AVANCE_MS = 2 * 60_000;
// Au-delà, un rappel manqué n'est plus signalé (il reste visible sur la fiche).
const RETARD_MAX_MS = 12 * 3600_000;
const REPORT_MS = 10 * 60_000;

const LIBELLES = {
  rdv: "Rendez-vous téléphonique",
  a_rappeler: "Rappel à faire",
  me_rappelle: "Le contact devait vous rappeler",
  fiche: "Client potentiel à rappeler",
};

function cleEcheance(e) {
  return `${e.id}|${e.type}|${e.date}`;
}

function chargerEtat(cleStockage) {
  try {
    const brut = JSON.parse(localStorage.getItem(cleStockage) || "{}");
    return { traites: brut.traites || {}, reportes: brut.reportes || {} };
  } catch {
    return { traites: {}, reportes: {} };
  }
}

function sauverEtat(cleStockage, etat) {
  // Ménage : on oublie les échéances traitées depuis plus de 3 jours.
  const limite = Date.now() - 3 * 24 * 3600_000;
  const traites = Object.fromEntries(Object.entries(etat.traites).filter(([, t]) => t > limite));
  const reportes = Object.fromEntries(Object.entries(etat.reportes).filter(([, t]) => t > Date.now()));
  try {
    localStorage.setItem(cleStockage, JSON.stringify({ traites, reportes }));
  } catch {
    // stockage indisponible : l'état vaut pour la session en cours
  }
}

function formatQuand(date) {
  const d = new Date(date);
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const aujourdHui = new Date();
  if (d.toDateString() === aujourdHui.toDateString()) return `aujourd'hui à ${heure}`;
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  if (d.toDateString() === demain.toDateString()) return `demain à ${heure}`;
  return `le ${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${heure}`;
}

// Date au format "AAAA-MM-JJTHH:MM" en heure locale (celui de ChampDateHeure),
// c'est le format enregistré pour dateRappel / dateRdv.
function versChampDate(d) {
  const deux = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}T${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

// Même heure que l'échéance, N jours après aujourd'hui.
function memeHeureDansJours(dateEcheance, jours) {
  const origine = new Date(dateEcheance);
  const d = new Date();
  d.setDate(d.getDate() + jours);
  d.setHours(origine.getHours(), origine.getMinutes(), 0, 0);
  return d;
}

function jourCourt(d) {
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function formatEcart(instant) {
  const ecartMin = Math.round((Date.now() - instant) / 60_000);
  if (ecartMin < -1) return `dans ${-ecartMin} min`;
  if (ecartMin <= 1) return "maintenant";
  if (ecartMin < 60) return `en retard de ${ecartMin} min`;
  return `en retard de ${Math.floor(ecartMin / 60)} h ${String(ecartMin % 60).padStart(2, "0")}`;
}

export default function RappelsEcheances() {
  const { utilisateur } = useAuth();
  const navigate = useNavigate();
  const cleStockage = utilisateur ? `crm-rappels-${utilisateur.id}` : null;
  const [echeances, setEcheances] = useState([]);
  const [etat, setEtat] = useState(() => (cleStockage ? chargerEtat(cleStockage) : { traites: {}, reportes: {} }));
  const [maintenant, setMaintenant] = useState(Date.now());
  const [permission, setPermission] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  const derniereAlerte = useRef(null);
  // Report à une autre date (client indisponible) : date choisie, motif.
  const [autreDate, setAutreDate] = useState(null);
  const [motifReport, setMotifReport] = useState("");
  const [reportEnCours, setReportEnCours] = useState(false);
  const [erreurReport, setErreurReport] = useState(null);

  const charger = useCallback(() => {
    api
      .getEcheances()
      .then(setEcheances)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!utilisateur) return;
    setEtat(chargerEtat(cleStockage));
    charger();
    const idChargement = setInterval(charger, INTERVALLE_CHARGEMENT_MS);
    const idHorloge = setInterval(() => setMaintenant(Date.now()), INTERVALLE_VERIFICATION_MS);
    function auRetour() {
      if (document.visibilityState === "visible") {
        charger();
        setMaintenant(Date.now());
      }
    }
    // Une échéance traitée dans un autre onglet se ferme ici aussi.
    function surStockage(ev) {
      if (ev.key === cleStockage) setEtat(chargerEtat(cleStockage));
    }
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("storage", surStockage);
    // Une fiche mise à jour (statut, date) peut faire apparaître ou
    // disparaître une échéance : on recharge aussitôt.
    window.addEventListener("entreprise:maj", charger);
    return () => {
      clearInterval(idChargement);
      clearInterval(idHorloge);
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("storage", surStockage);
      window.removeEventListener("entreprise:maj", charger);
    };
  }, [utilisateur, cleStockage, charger]);

  const dues = echeances.filter((e) => {
    const instant = new Date(e.date).getTime();
    const cle = cleEcheance(e);
    return (
      Number.isFinite(instant) &&
      maintenant >= instant - AVANCE_MS &&
      maintenant - instant <= RETARD_MAX_MS &&
      !etat.traites[cle] &&
      !(etat.reportes[cle] > maintenant)
    );
  });
  const alerte = dues[0] || null;
  const cleAlerte = alerte ? cleEcheance(alerte) : null;

  // Bip répété, titre de l'onglet qui clignote et notification Windows tant
  // que l'alerte n'est pas traitée.
  useEffect(() => {
    if (!alerte) return;
    const titreOriginal = document.title;
    const quand = formatQuand(alerte.date);
    jouerAlarme();
    if (derniereAlerte.current !== cleAlerte && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const notification = new Notification(`⏰ ${LIBELLES[alerte.type] || "Rappel"} — ${alerte.nom}`, {
          body: `Prévu ${quand}.${alerte.telephone ? ` Appelez le ${alerte.telephone}.` : ""}`,
          tag: cleAlerte,
          requireInteraction: true,
        });
        notification.onclick = () => window.focus();
      } catch {
        // notifications indisponibles : la fenêtre et le son suffisent
      }
    }
    derniereAlerte.current = cleAlerte;
    const idBip = setInterval(jouerAlarme, INTERVALLE_BIP_MS);
    let bascule = false;
    const idTitre = setInterval(() => {
      bascule = !bascule;
      document.title = bascule ? `⏰ RAPPEL — ${alerte.nom}` : titreOriginal;
    }, 1000);
    return () => {
      clearInterval(idBip);
      clearInterval(idTitre);
      document.title = titreOriginal;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleAlerte]);

  if (!utilisateur) return null;

  // Pas encore d'alerte, mais des rappels à venir : proposer (une fois) les
  // notifications Windows, pour être prévenu même CRM en arrière-plan.
  if (!alerte) {
    let propositionMasquee = false;
    try {
      propositionMasquee = localStorage.getItem("crm-rappels-notif-masquee") === "1";
    } catch {
      // stockage indisponible
    }
    if (permission !== "default" || echeances.length === 0 || propositionMasquee) return null;
    return (
      <div className="fixed bottom-20 left-4 z-40 max-w-xs rounded-xl border border-marine-200 dark:border-marine-800 bg-white dark:bg-slate-800 shadow-xl px-4 py-3 text-sm">
        <p className="text-slate-700 dark:text-slate-200">
          🔔 Vous avez {echeances.length} rappel{echeances.length > 1 ? "s" : ""} / RDV prévu{echeances.length > 1 ? "s" : ""}.
          Être prévenu par Windows même quand le CRM est en arrière-plan ?
        </p>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() =>
              Notification.requestPermission()
                .then(setPermission)
                .catch(() => {})
            }
            className="rounded-lg bg-marine-800 text-white px-3 py-1 text-xs font-medium"
          >
            Activer
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem("crm-rappels-notif-masquee", "1");
              } catch {
                // stockage indisponible
              }
              setPermission("masquee");
            }}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs text-slate-600 dark:text-slate-300"
          >
            Plus tard
          </button>
        </div>
      </div>
    );
  }

  function mettreAJour(modif) {
    const suivant = {
      traites: { ...etat.traites, ...(modif.traites || {}) },
      reportes: { ...etat.reportes, ...(modif.reportes || {}) },
    };
    setEtat(suivant);
    sauverEtat(cleStockage, suivant);
  }

  function marquerTraite() {
    mettreAJour({ traites: { [cleAlerte]: Date.now() } });
  }

  function reporter() {
    mettreAJour({ reportes: { [cleAlerte]: Date.now() + REPORT_MS } });
  }

  // Déplace le RDV / rappel sur la fiche (même route que les issues d'appel :
  // met à jour dateRdv ou dateRappel et l'inscrit dans l'historique). L'alerte
  // se ferme et reviendra à la nouvelle date.
  async function reporterA(date) {
    if (!date) return;
    setReportEnCours(true);
    setErreurReport(null);
    try {
      const nouvelle = typeof date === "string" ? date : versChampDate(date);
      // Client Potentiel : le statut reste CP, seule la date de rappel bouge.
      if (alerte.type === "fiche") {
        await api.patchEntreprise(alerte.id, { dateRappel: nouvelle });
        await api.ajouterCommentaire(alerte.id, {
          texte: `Rappel du client potentiel reporté ${formatQuand(nouvelle)}${motifReport.trim() ? ` — ${motifReport.trim()}` : ""}.`,
          auteur: utilisateur?.prenom || utilisateur?.email || "Agent",
        });
      } else await api.enregistrerAppel(alerte.id, {
        issue: alerte.type,
        date: nouvelle,
        details: `Reporté ${formatQuand(nouvelle)}${motifReport.trim() ? ` — ${motifReport.trim()}` : " à la demande du client"}.`,
      });
      mettreAJour({ traites: { [cleAlerte]: Date.now() } });
      setAutreDate(null);
      setMotifReport("");
      charger();
      window.dispatchEvent(new Event("entreprise:maj"));
    } catch (e) {
      setErreurReport(e.message);
    } finally {
      setReportEnCours(false);
    }
  }

  function ouvrirFiche() {
    marquerTraite();
    ouvrirDansNouvelOnglet();
  }

  // Nouvel onglet : la page en cours n'est pas remplacée (plusieurs alertes à
  // la suite = un onglet par fiche, comme les fiches ouvertes du tableau de bord).
  function ouvrirDansNouvelOnglet() {
    const onglet = window.open(`/entreprise/${alerte.id}`, "_blank");
    if (onglet) onglet.opener = null;
    else navigate(`/entreprise/${alerte.id}`); // ouverture bloquée : repli sur l'onglet courant
  }

  const instant = new Date(alerte.date).getTime();
  const enRetard = maintenant - instant > 60_000;
  const numero = estNumeroAffichable(alerte.telephone) ? alerte.telephone : null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/60 flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl overflow-hidden">
        <div className={`px-5 py-3 text-white ${enRetard ? "bg-red-600" : "bg-marine-800"}`}>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-90">
            ⏰ {LIBELLES[alerte.type] || "Rappel"} — {formatEcart(instant)}
          </p>
          {/* Ouvre la fiche : l'alerte est mise en pause 10 min (sinon elle
              recouvrirait la fiche) et revient si aucune issue n'est enregistrée. */}
          <button
            type="button"
            onClick={() => {
              reporter();
              ouvrirDansNouvelOnglet();
            }}
            title="Ouvrir la fiche de l'entreprise (l'alerte revient dans 10 min si rien n'est enregistré)"
            className="block text-left text-lg font-bold leading-snug mt-0.5 underline decoration-white/40 underline-offset-4 hover:decoration-white"
          >
            {alerte.nom} ↗
          </button>
          <p className="text-sm opacity-90">Prévu {formatQuand(alerte.date)}</p>
        </div>

        <div className="px-5 py-4 space-y-3">
          {(alerte.contactNom || alerte.contactFonction) && (
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Contact : <strong>{alerte.contactNom || "—"}</strong>
              {alerte.contactFonction ? ` (${alerte.contactFonction})` : ""}
            </p>
          )}

          {numero ? (
            <a
              href={versLienTel(numero)}
              onClick={() => {
                compterAppel(alerte.id, numero, "lien");
                ouvrirFiche();
              }}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold py-3"
            >
              📞 Appeler maintenant — {numero}
            </a>
          ) : (
            <button
              type="button"
              onClick={ouvrirFiche}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold py-3"
            >
              Ouvrir la fiche (aucun numéro enregistré)
            </button>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={reporter}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              ⏳ Reporter de 10 min
            </button>
            <button
              type="button"
              onClick={marquerTraite}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              ✓ Déjà fait
            </button>
          </div>

          {/* Report à un autre jour : le client demande de rappeler plus tard. */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">📅 Reporter (le client demande de rappeler plus tard) :</p>
            <div className="flex gap-2">
              {[1, 2].map((jours) => {
                const d = memeHeureDansJours(alerte.date, jours);
                return (
                  <button
                    key={jours}
                    type="button"
                    disabled={reportEnCours}
                    onClick={() => reporterA(d)}
                    className="flex-1 rounded-lg bg-marine-50 dark:bg-marine-950/40 border border-marine-200 dark:border-marine-800 px-2 py-1.5 text-xs font-medium text-marine-800 dark:text-marine-200 hover:bg-marine-100 dark:hover:bg-marine-900/50 disabled:opacity-50"
                    title={`Reporter au ${d.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}`}
                  >
                    {jours === 1 ? "Demain" : "Après-demain"}
                    <span className="block text-[10px] font-normal opacity-75">
                      {jourCourt(d)} · {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                disabled={reportEnCours}
                onClick={() => setAutreDate(autreDate === null ? versChampDate(memeHeureDansJours(alerte.date, 1)) : null)}
                className="flex-1 rounded-lg bg-marine-50 dark:bg-marine-950/40 border border-marine-200 dark:border-marine-800 px-2 py-1.5 text-xs font-medium text-marine-800 dark:text-marine-200 hover:bg-marine-100 dark:hover:bg-marine-900/50 disabled:opacity-50"
              >
                Autre date
                <span className="block text-[10px] font-normal opacity-75">au choix</span>
              </button>
            </div>
            {autreDate !== null && (
              <div className="space-y-2">
                {/* Même sélecteur que le reste du CRM (heure tapée à la main,
                    raccourcis) plutôt que le champ natif du navigateur. */}
                <ChampDateHeure value={autreDate} onChange={setAutreDate} libelleDate="Nouvelle date du rappel" />
                <button
                  type="button"
                  disabled={!autreDate || reportEnCours}
                  onClick={() => reporterA(autreDate)}
                  className="w-full rounded-lg bg-marine-700 hover:bg-marine-800 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Valider le report
                </button>
              </div>
            )}
            <input
              type="text"
              value={motifReport}
              onChange={(e) => setMotifReport(e.target.value)}
              placeholder="Motif (facultatif) — ex : RH absents cette semaine"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-xs"
            />
            {reportEnCours && <p className="text-xs text-slate-500">Enregistrement du report…</p>}
            {erreurReport && <p className="text-xs text-red-600 dark:text-red-400">{erreurReport}</p>}
          </div>

          {dues.length > 1 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              + {dues.length - 1} autre{dues.length > 2 ? "s" : ""} rappel{dues.length > 2 ? "s" : ""} en attente après celui-ci.
            </p>
          )}

          {permission === "default" && (
            <button
              type="button"
              onClick={() =>
                Notification.requestPermission()
                  .then(setPermission)
                  .catch(() => {})
              }
              className="text-xs text-marine-700 dark:text-marine-300 hover:underline"
            >
              🔔 Être aussi prévenu par Windows quand le CRM est en arrière-plan
            </button>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Après l'appel, enregistrez l'issue sur la fiche (NRP, RDV, Mail…) : le rappel disparaît de lui-même.
          </p>
        </div>
      </div>
    </div>
  );
}
