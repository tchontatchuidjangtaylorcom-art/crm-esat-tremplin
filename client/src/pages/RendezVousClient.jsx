import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import { BoutonThemeVitrine } from "../components/vitrine/ThemeVitrine.jsx";

const CLASSE_INPUT =
  "w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-marine-400";
const JOURS_AFFICHES = 10;

const dateCourte = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dateLongue = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const heureFr = (h) => h.replace(":", "h");

// Page publique ouverte par le bouton « Parler à un conseiller » d'un e-mail
// envoyé depuis le CRM (/vitrine/rendez-vous/<jeton>, voir
// server/src/vitrineRdv.js) : le client choisit un créneau dans les horaires
// du pôle (lundi au vendredi, 9h–17h30, heure de Paris) et valide ; l'agent
// qui suit son dossier est aussitôt prévenu.
export default function RendezVousClient() {
  const { jeton } = useParams();
  const [infos, setInfos] = useState(null);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [jour, setJour] = useState(null);
  const [heure, setHeure] = useState(null);
  const [tousLesJours, setTousLesJours] = useState(false);
  const [form, setForm] = useState({ nom: "", telephone: "", message: "", siteWeb: "" });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [confirme, setConfirme] = useState(null);

  function charger() {
    api
      .getRdvClient(jeton)
      .then((d) => {
        setInfos(d);
        setJour((j) => (j && d.jours[j] ? j : Object.keys(d.jours).sort()[0] || null));
      })
      .catch((e) => setErreurChargement(e.message));
  }

  useEffect(() => {
    document.title = "Prendre rendez-vous — Pôle OETH / AGEFIPH";
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jeton]);

  const jours = useMemo(() => (infos ? Object.keys(infos.jours).sort() : []), [infos]);
  const joursVisibles = tousLesJours ? jours : jours.slice(0, JOURS_AFFICHES);

  async function valider(ev) {
    ev.preventDefault();
    if (!jour || !heure) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.reserverRdvClient(jeton, { ...form, date: jour, heure });
      setConfirme(r);
    } catch (e) {
      setErreur(e.message);
      // Créneau pris entre-temps : on recharge les disponibilités.
      if (/disponible/.test(e.message)) {
        setHeure(null);
        charger();
      }
    } finally {
      setEnvoi(false);
    }
  }

  const champ = (cle) => ({ value: form[cle], onChange: (e) => setForm((f) => ({ ...f, [cle]: e.target.value })) });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white">
      <header className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/logo-oeth.png" alt="Logo Pôle OETH" width="40" height="40" className="w-10 h-10 rounded-full" />
          <div>
            <p className="font-bold leading-tight">Pôle OETH / AGEFIPH</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Accompagnement à l'obligation d'emploi des travailleurs handicapés</p>
          </div>
        </div>
        <BoutonThemeVitrine />
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-white dark:bg-marine-950 border border-slate-900/10 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex h-1">
            <span className="flex-1 bg-marine-500" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-red-500" />
          </div>

          <div className="px-5 sm:px-8 pt-7 pb-8">
            <h1 className="text-2xl sm:text-3xl font-bold">Parler à un conseiller</h1>
            {infos?.entreprise && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Choisissez le créneau qui vous convient pour faire le point sur la situation de <strong>{infos.entreprise}</strong>.
              </p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-xs text-slate-600 dark:text-slate-300">
              <span>🕒 {infos?.dureeMinutes || 30} min</span>
              <span>📞 Le conseiller vous appelle à l'heure choisie</span>
              <span>🗓️ Du lundi au vendredi, de 9h à 17h30 (heure de Paris)</span>
            </div>

            {erreurChargement && (
              <p className="mt-6 rounded-xl border border-red-300/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm px-4 py-3">
                {erreurChargement}
              </p>
            )}
            {!infos && !erreurChargement && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Chargement des créneaux…</p>}

            {confirme ? (
              <div className="mt-8 text-center py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl">
                  ✓
                </div>
                <p className="text-xl font-semibold mt-4">Rendez-vous confirmé</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  <span className="capitalize">{dateLongue(confirme.date)}</span> à {heureFr(confirme.heure)} (heure de Paris).
                  <br />
                  Votre conseiller vous appellera à cette heure-là.
                  {confirme.confirmationEnvoyee ? " Une confirmation vous a été envoyée par e-mail." : ""}
                </p>
                {infos?.pole?.telephone && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
                    Un empêchement ? Utilisez de nouveau ce lien, ou appelez-nous au {infos.pole.telephone}.
                  </p>
                )}
              </div>
            ) : (
              infos && (
                <>
                  {infos.rdvConfirme && (
                    <p className="mt-5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-sm px-4 py-3">
                      ✓ Votre rendez-vous est prévu le <strong className="capitalize">{dateLongue(infos.rdvConfirme.date)}</strong> à{" "}
                      <strong>{heureFr(infos.rdvConfirme.heure)}</strong>. Pour le déplacer, choisissez un autre créneau ci-dessous.
                    </p>
                  )}

                  {jours.length === 0 ? (
                    <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
                      Aucun créneau disponible pour le moment. Écrivez-nous à {infos.pole?.email}
                      {infos.pole?.telephone ? ` ou appelez-nous au ${infos.pole.telephone}` : ""}.
                    </p>
                  ) : (
                    <form onSubmit={valider} className="mt-6 space-y-6">
                      <section>
                        <h2 className="text-sm font-semibold">1. Choisissez un jour</h2>
                        <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {joursVisibles.map((iso) => (
                            <button
                              key={iso}
                              type="button"
                              onClick={() => {
                                setJour(iso);
                                setHeure(null);
                              }}
                              className={`rounded-xl border px-2 py-2.5 text-sm capitalize transition ${
                                iso === jour
                                  ? "border-marine-600 bg-marine-700 text-white font-semibold"
                                  : "border-slate-900/10 dark:border-white/15 hover:border-marine-400 hover:bg-marine-50 dark:hover:bg-white/5"
                              }`}
                            >
                              {dateCourte(iso)}
                            </button>
                          ))}
                        </div>
                        {jours.length > JOURS_AFFICHES && (
                          <button
                            type="button"
                            onClick={() => setTousLesJours((v) => !v)}
                            className="mt-2 text-xs text-marine-700 dark:text-marine-300 hover:underline"
                          >
                            {tousLesJours ? "Moins de dates" : `Voir plus de dates (${jours.length - JOURS_AFFICHES})`}
                          </button>
                        )}
                      </section>

                      {jour && (
                        <section>
                          <h2 className="text-sm font-semibold">
                            2. Choisissez une heure — <span className="capitalize font-normal">{dateLongue(jour)}</span>
                          </h2>
                          <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {infos.jours[jour].map((h) => (
                              <button
                                key={h}
                                type="button"
                                onClick={() => setHeure(h)}
                                className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                                  heure === h
                                    ? "border-marine-600 bg-marine-700 text-white"
                                    : "border-marine-400/40 text-marine-800 dark:text-marine-200 hover:bg-marine-50 dark:hover:bg-white/5"
                                }`}
                              >
                                {heureFr(h)}
                              </button>
                            ))}
                          </div>
                        </section>
                      )}

                      {heure && (
                        <section className="space-y-3">
                          <h2 className="text-sm font-semibold">3. Vos coordonnées (facultatif)</h2>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <input placeholder="Votre nom" autoComplete="name" className={CLASSE_INPUT} {...champ("nom")} />
                            <input
                              type="tel"
                              placeholder="Téléphone où vous joindre"
                              autoComplete="tel"
                              className={CLASSE_INPUT}
                              {...champ("telephone")}
                            />
                            <textarea
                              rows={2}
                              placeholder="Un message pour votre conseiller (facultatif)"
                              className={`${CLASSE_INPUT} sm:col-span-2 resize-none`}
                              {...champ("message")}
                            />
                            {/* Champ piège anti-robots, invisible pour les humains. */}
                            <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" {...champ("siteWeb")} />
                          </div>
                        </section>
                      )}

                      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
                      <button
                        type="submit"
                        disabled={!jour || !heure || envoi}
                        className="w-full rounded-xl bg-marine-700 hover:bg-marine-800 text-white text-sm font-bold py-3.5 transition disabled:opacity-40"
                      >
                        {envoi
                          ? "Validation…"
                          : heure
                            ? `Valider le rendez-vous — ${dateCourte(jour)} à ${heureFr(heure)}`
                            : "Choisissez un créneau"}
                      </button>
                    </form>
                  )}
                </>
              )
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Le Pôle OETH / AGEFIPH ne vous demandera jamais de paiement, ni vos codes d'accès ou coordonnées bancaires.
          {infos?.pole?.email ? ` Contact : ${infos.pole.email}` : ""}
          {infos?.pole?.telephone ? ` · ${infos.pole.telephone}` : ""}
        </p>
      </main>
    </div>
  );
}
