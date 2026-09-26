import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api.js";

const JOURS_SEMAINE = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const CLASSE_INPUT =
  "w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400";

const moisCle = (iso) => iso.slice(0, 7);
function libelleMois(cle) {
  const [a, m] = cle.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}
function dateLongue(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

// Grille d'un mois (lundi en premier) : cases vides avant le 1er.
function grilleMois(cle) {
  const [a, m] = cle.split("-").map(Number);
  const premier = new Date(Date.UTC(a, m - 1, 1));
  const decalage = (premier.getUTCDay() + 6) % 7;
  const nbJours = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const cases = Array.from({ length: decalage }, () => null);
  for (let j = 1; j <= nbJours; j++) cases.push(`${cle}-${String(j).padStart(2, "0")}`);
  return cases;
}

// Fenêtre "Parler à un expert" : calendrier des créneaux disponibles
// (servis par /api/vitrine/rdv/disponibilites, heure de Paris), puis
// coordonnées et confirmation. Aucun outil tiers : les rendez-vous sont
// enregistrés côté serveur et notifiés par mail au pôle.
export default function PriseRendezVous({ onFermer }) {
  const [dispo, setDispo] = useState(null);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [mois, setMois] = useState(null);
  const [jour, setJour] = useState(null);
  const [heure, setHeure] = useState(null);
  const [etape, setEtape] = useState("creneau"); // creneau | coordonnees | confirme
  const [form, setForm] = useState({ prenom: "", nom: "", email: "", telephone: "", entreprise: "", message: "", siteWeb: "" });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const fermerRef = useRef(null);

  function charger() {
    api
      .getDisponibilitesRdv()
      .then((d) => {
        setDispo(d);
        const premiers = Object.keys(d.jours).sort();
        if (premiers.length) setMois((m) => m || moisCle(premiers[0]));
      })
      .catch((e) => setErreurChargement(e.message));
  }

  useEffect(() => {
    charger();
    fermerRef.current?.focus();
    const onTouche = (e) => e.key === "Escape" && onFermer();
    document.addEventListener("keydown", onTouche);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onTouche);
      document.body.style.overflow = avant;
    };
  }, [onFermer]);

  const moisDisponibles = useMemo(() => {
    if (!dispo) return [];
    return [...new Set(Object.keys(dispo.jours).map(moisCle))].sort();
  }, [dispo]);

  const indexMois = moisDisponibles.indexOf(mois);

  async function confirmer(ev) {
    ev.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api.reserverRdv({ ...form, date: jour, heure });
      setEtape("confirme");
    } catch (e) {
      setErreur(e.message);
      // Créneau pris entre-temps : on recharge les disponibilités.
      if (/réservé/.test(e.message)) {
        setHeure(null);
        setEtape("creneau");
        charger();
      }
    } finally {
      setEnvoi(false);
    }
  }

  const champ = (cle) => ({ value: form[cle], onChange: (e) => setForm((f) => ({ ...f, [cle]: e.target.value })) });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onFermer()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rdv-titre"
    >
      <div className="relative w-full max-w-3xl bg-marine-950 border border-white/10 rounded-2xl shadow-2xl my-8 overflow-hidden text-white">
        <div className="flex h-1">
          <span className="flex-1 bg-marine-500" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-red-500" />
        </div>
        <button
          ref={fermerRef}
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 sm:px-8 pt-7 pb-8">
          <h2 id="rdv-titre" className="text-2xl font-bold pr-10">
            Parler à un expert
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Choisissez un créneau pour échanger sur votre politique handicap, votre DOETH et vos besoins de pilotage.
          </p>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-300">
            <span>🕒 {dispo?.dureeMinutes || 45} min</span>
            <span>📹 Téléphone ou visioconférence — informations transmises à la confirmation</span>
            <span>🌍 Heure de Paris</span>
          </div>

          {etape === "creneau" && (
            <div className="mt-6 grid md:grid-cols-[1fr_220px] gap-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                {erreurChargement && <p className="text-sm text-red-400">{erreurChargement}</p>}
                {!dispo && !erreurChargement && <p className="text-sm text-slate-400">Chargement des disponibilités…</p>}
                {dispo && moisDisponibles.length === 0 && (
                  <p className="text-sm text-slate-400">Aucun créneau disponible pour le moment. Écrivez-nous via le formulaire de démo.</p>
                )}
                {dispo && mois && (
                  <>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        disabled={indexMois <= 0}
                        onClick={() => setMois(moisDisponibles[indexMois - 1])}
                        className="w-8 h-8 rounded-full hover:bg-white/10 disabled:opacity-30 transition"
                        aria-label="Mois précédent"
                      >
                        ‹
                      </button>
                      <p className="font-semibold capitalize">{libelleMois(mois)}</p>
                      <button
                        type="button"
                        disabled={indexMois >= moisDisponibles.length - 1}
                        onClick={() => setMois(moisDisponibles[indexMois + 1])}
                        className="w-8 h-8 rounded-full hover:bg-white/10 disabled:opacity-30 transition"
                        aria-label="Mois suivant"
                      >
                        ›
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mt-3 text-center">
                      {JOURS_SEMAINE.map((j) => (
                        <span key={j} className="text-[11px] text-slate-500 py-1">
                          {j}
                        </span>
                      ))}
                      {grilleMois(mois).map((iso, i) => {
                        if (!iso) return <span key={`v${i}`} />;
                        const libre = Boolean(dispo.jours[iso]);
                        const choisi = iso === jour;
                        return (
                          <button
                            key={iso}
                            type="button"
                            disabled={!libre}
                            onClick={() => {
                              setJour(iso);
                              setHeure(null);
                            }}
                            className={`aspect-square rounded-full text-sm transition ${
                              choisi
                                ? "bg-teal-400 text-marine-950 font-bold"
                                : libre
                                  ? "bg-teal-400/10 text-teal-200 font-semibold hover:bg-teal-400/25"
                                  : "text-slate-600 cursor-default"
                            }`}
                          >
                            {Number(iso.slice(8))}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold">{jour ? dateLongue(jour) : "Choisissez un jour"}</p>
                <div className="mt-3 space-y-2">
                  {jour &&
                    dispo.jours[jour]?.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHeure(h)}
                        className={`w-full rounded-xl border py-2.5 text-sm font-semibold transition ${
                          heure === h ? "border-teal-400 bg-teal-400 text-marine-950" : "border-teal-400/40 text-teal-200 hover:bg-teal-400/10"
                        }`}
                      >
                        {h.replace(":", "h")}
                      </button>
                    ))}
                </div>
                {erreur && <p className="text-xs text-red-400 mt-3">{erreur}</p>}
                <button
                  type="button"
                  disabled={!jour || !heure}
                  onClick={() => {
                    setErreur(null);
                    setEtape("coordonnees");
                  }}
                  className="mt-4 w-full rounded-xl bg-white text-marine-900 hover:bg-marine-100 text-sm font-semibold py-3 transition disabled:opacity-30"
                >
                  Continuer →
                </button>
              </div>
            </div>
          )}

          {etape === "coordonnees" && (
            <form onSubmit={confirmer} className="mt-6">
              <div className="rounded-xl border border-teal-400/25 bg-teal-400/[0.07] px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
                <span>
                  📅 <strong className="capitalize">{dateLongue(jour)}</strong> à <strong>{heure.replace(":", "h")}</strong> (heure de Paris)
                </span>
                <button type="button" onClick={() => setEtape("creneau")} className="text-xs text-teal-300 hover:underline">
                  Changer de créneau
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <input required placeholder="Prénom *" className={CLASSE_INPUT} {...champ("prenom")} />
                <input required placeholder="Nom *" className={CLASSE_INPUT} {...champ("nom")} />
                <input required type="email" placeholder="E-mail professionnel *" className={CLASSE_INPUT} {...champ("email")} />
                <input type="tel" placeholder="Téléphone" className={CLASSE_INPUT} {...champ("telephone")} />
                <input required placeholder="Entreprise / organisation *" className={`${CLASSE_INPUT} sm:col-span-2`} {...champ("entreprise")} />
                <textarea
                  rows={3}
                  placeholder="Votre contexte ou vos questions (facultatif)"
                  className={`${CLASSE_INPUT} sm:col-span-2 resize-none`}
                  {...champ("message")}
                />
                {/* Champ piège anti-robots, invisible pour les humains. */}
                <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" {...champ("siteWeb")} />
              </div>
              {erreur && <p className="text-sm text-red-400 mt-3">{erreur}</p>}
              <button
                type="submit"
                disabled={envoi}
                className="mt-4 w-full rounded-xl bg-teal-400 hover:bg-teal-300 text-marine-950 text-sm font-bold py-3 transition disabled:opacity-40"
              >
                {envoi ? "Réservation…" : "Confirmer le rendez-vous"}
              </button>
            </form>
          )}

          {etape === "confirme" && (
            <div className="mt-8 text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto text-2xl">✓</div>
              <p className="text-xl font-semibold mt-4">Rendez-vous confirmé</p>
              <p className="text-sm text-slate-400 mt-2">
                <span className="capitalize">{dateLongue(jour)}</span> à {heure.replace(":", "h")} (heure de Paris). Une confirmation
                vous sera adressée à {form.email}.
              </p>
              <button
                type="button"
                onClick={onFermer}
                className="mt-6 rounded-full border border-white/20 text-sm font-medium px-6 py-2.5 hover:bg-white/10 transition"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
