import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import { BoutonThemeVitrine } from "../components/vitrine/ThemeVitrine.jsx";

const CLASSE_INPUT =
  "w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-marine-400";
const CLASSE_GRAND =
  "w-full rounded-2xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-slate-900 dark:text-white px-5 py-4 text-3xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-marine-400";

const euros = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} €`;
const dateFr = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// « Depuis quand aucun bénéficiaire ? » (voir DEPUIS_ZERO, server/src/ficheClient.js).
const DEPUIS_ZERO = [
  { cle: "recent", label: "Depuis 2024 ou plus récemment" },
  { cle: "2023", label: "Depuis 2023" },
  { cle: "avant", label: "Avant 2023, ou jamais" },
  { cle: "inconnu", label: "Je ne sais pas" },
];

// Page publique « Confirmer ma fiche » (/vitrine/ma-fiche/<jeton>, voir
// server/src/ficheClient.js), en étapes pour que le client se concentre sur
// une seule question à la fois :
//  1. son effectif ;
//  2. ses salariés bénéficiaires (RQTH ou équivalent) — et, s'il n'en a
//     aucun, depuis quand (décide de la surcontribution) ;
//  3. le résultat, ses coordonnées, puis la confirmation ;
//  4. confirmation faite : proposition de rendez-vous avec un conseiller.
export default function MaFicheClient() {
  const { jeton } = useParams();
  const [infos, setInfos] = useState(null);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [etape, setEtape] = useState(1);
  const [form, setForm] = useState({
    effectif: "",
    rqth: "",
    depuisZero: "",
    nom: "",
    fonction: "",
    telephone: "",
    commentaire: "",
    certifie: false,
    siteWeb: "",
  });
  const [calcul, setCalcul] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [termine, setTermine] = useState(null);

  useEffect(() => {
    document.title = "Confirmer ma fiche — Pôle OETH";
    api
      .getMaFiche(jeton)
      .then((d) => {
        setInfos(d);
        setForm((f) => ({ ...f, effectif: d.effectif ?? "", rqth: d.rqth ? String(d.rqth) : "" }));
      })
      .catch((e) => setErreurChargement(e.message));
  }, [jeton]);

  const effectif = Number(form.effectif);
  const rqth = Number(form.rqth);
  const effectifValide = Number.isInteger(effectif) && effectif >= 1;
  const rqthValide = form.rqth !== "" && Number.isInteger(rqth) && rqth >= 0 && rqth <= effectif;
  const besoinDepuis = rqthValide && rqth === 0;
  const publicFiphfp = (calcul || infos?.calcul)?.collecteur === "FIPHFP";

  // Résultat calculé au moment d'arriver à l'étape 3.
  useEffect(() => {
    if (etape !== 3) return;
    api
      .calculMaFiche(jeton, effectif, rqth, besoinDepuis ? form.depuisZero : "")
      .then(setCalcul)
      .catch((e) => setErreur(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape]);

  const champ = (cle) => ({ value: form[cle], onChange: (e) => setForm((f) => ({ ...f, [cle]: e.target.value })) });

  async function confirmer(ev) {
    ev.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.confirmerMaFiche(jeton, { ...form, effectif, rqth });
      setTermine(r);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  const boutonSuivant =
    "w-full rounded-xl bg-marine-700 hover:bg-marine-800 text-white font-semibold py-3.5 disabled:opacity-40 disabled:cursor-not-allowed";
  const boutonRetour = "text-sm text-slate-500 dark:text-slate-400 hover:underline";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white">
      <header className="max-w-2xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/logo-oeth.png" alt="Logo Pôle OETH" width="40" height="40" className="w-10 h-10 rounded-full" />
          <div>
            <p className="font-bold leading-tight">{publicFiphfp ? "Pôle FIPHFP" : "Pôle OETH / AGEFIPH"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Accompagnement à l'obligation d'emploi des travailleurs handicapés</p>
          </div>
        </div>
        <BoutonThemeVitrine />
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-white dark:bg-marine-950 border border-slate-900/10 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex h-1">
            <span className="flex-1 bg-marine-500" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-red-500" />
          </div>

          <div className="px-5 sm:px-8 pt-7 pb-8">
            <h1 className="text-2xl sm:text-3xl font-bold">Confirmer ma fiche</h1>
            {infos && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                <strong>{infos.entreprise}</strong>
                {infos.ville ? ` — ${infos.ville}` : ""}
                {infos.siret ? ` · SIRET ${infos.siret}` : ""}
              </p>
            )}

            {erreurChargement && (
              <p className="mt-6 rounded-xl border border-red-300/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm px-4 py-3">
                {erreurChargement}{" "}
                <a href="/vitrine/mon-dossier" className="underline font-medium">
                  Recevoir un nouveau lien
                </a>
              </p>
            )}
            {!infos && !erreurChargement && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Chargement de votre fiche…</p>}

            {infos && !termine && (
              <div className="flex gap-1.5 mt-5" aria-hidden>
                {[1, 2, 3].map((n) => (
                  <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= etape ? "bg-marine-600" : "bg-slate-200 dark:bg-white/10"}`} />
                ))}
              </div>
            )}

            {infos?.dejaConfirmee && !termine && etape === 1 && (
              <p className="mt-5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-sm px-4 py-3">
                ✓ Fiche déjà confirmée le {dateFr(infos.dejaConfirmee.date)} par {infos.dejaConfirmee.nom}. Vous pouvez la mettre à jour si votre
                situation a changé.
              </p>
            )}

            {termine ? (
              <div className="mt-8 text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl">
                  ✓
                </div>
                <p className="text-xl font-semibold mt-4">Merci, votre fiche est confirmée</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">Votre conseiller a été prévenu.</p>
                {termine.rdvUrl && (
                  <div className="mt-6 rounded-2xl border border-marine-200 dark:border-white/10 bg-marine-50/60 dark:bg-white/5 px-5 py-5">
                    <p className="font-semibold">Faisons le point ensemble</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      Choisissez un créneau : votre conseiller vous appelle et vous présente les solutions adaptées.
                    </p>
                    <a
                      href={termine.rdvUrl}
                      className="inline-block mt-4 rounded-xl bg-marine-700 hover:bg-marine-800 text-white font-semibold px-6 py-3"
                    >
                      📅 Prendre rendez-vous avec un conseiller
                    </a>
                  </div>
                )}
              </div>
            ) : (
              infos && (
                <form onSubmit={confirmer} className="mt-6">
                  {/* Étape 1 — effectif */}
                  {etape === 1 && (
                    <div className="space-y-5">
                      <label className="block">
                        <span className="block text-lg font-semibold">Quel est l'effectif de votre entreprise ?</span>
                        <span className="block text-sm text-slate-500 dark:text-slate-400 mt-1">Nombre de salariés</span>
                        <input type="number" min="1" inputMode="numeric" autoFocus {...champ("effectif")} className={`mt-4 ${CLASSE_GRAND}`} />
                      </label>
                      <button type="button" disabled={!effectifValide} onClick={() => setEtape(2)} className={boutonSuivant}>
                        Continuer
                      </button>
                    </div>
                  )}

                  {/* Étape 2 — bénéficiaires (+ depuis quand à 0) */}
                  {etape === 2 && (
                    <div className="space-y-5">
                      <label className="block">
                        <span className="block text-lg font-semibold">Combien de salariés bénéficiaires employez-vous ?</span>
                        <span className="block text-sm text-slate-500 dark:text-slate-400 mt-1">Salariés ayant une RQTH ou un statut équivalent</span>
                        <input
                          type="number"
                          min="0"
                          max={effectif || undefined}
                          inputMode="numeric"
                          autoFocus
                          {...champ("rqth")}
                          className={`mt-4 ${CLASSE_GRAND}`}
                        />
                      </label>
                      {!publicFiphfp && effectif >= 20 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Repère : en moyenne, les entreprises privées emploient environ 3,5 % de travailleurs handicapés, soit environ{" "}
                          {Math.max(1, Math.round(effectif * 0.035))} pour {effectif} salariés.
                        </p>
                      )}
                      {form.rqth !== "" && rqth > effectif && (
                        <p className="text-sm text-red-600 dark:text-red-400">Ce nombre ne peut pas dépasser votre effectif ({effectif}).</p>
                      )}

                      {besoinDepuis && (
                        <div>
                          <p className="font-semibold">Depuis quand votre entreprise n'emploie-t-elle aucun bénéficiaire ?</p>
                          <div className="grid sm:grid-cols-2 gap-2 mt-3">
                            {DEPUIS_ZERO.map((o) => (
                              <button
                                key={o.cle}
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, depuisZero: o.cle }))}
                                className={`rounded-xl border px-4 py-3 text-sm text-left transition ${
                                  form.depuisZero === o.cle
                                    ? "border-marine-600 bg-marine-50 dark:bg-marine-900/40 font-semibold"
                                    : "border-slate-900/10 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                                }`}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!rqthValide || (besoinDepuis && !form.depuisZero)}
                        onClick={() => setEtape(3)}
                        className={boutonSuivant}
                      >
                        Voir ma situation
                      </button>
                      <button type="button" onClick={() => setEtape(1)} className={boutonRetour}>
                        ← Modifier l'effectif
                      </button>
                    </div>
                  )}

                  {/* Étape 3 — résultat, coordonnées, confirmation */}
                  {etape === 3 && (
                    <div className="space-y-6">
                      {!calcul ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Calcul en cours…</p>
                      ) : (
                        <div className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 sm:p-5">
                          <p className="font-semibold">
                            Votre situation estimée{calcul.exercice ? ` (exercice ${calcul.exercice})` : ""} — {effectif} salariés, {rqth} bénéficiaire
                            {rqth > 1 ? "s" : ""}
                          </p>
                          {calcul.neutralise ? (
                            <p className="text-sm mt-2 text-slate-600 dark:text-slate-300">
                              Votre entreprise bénéficie actuellement d'une période de neutralisation : aucune contribution n'est due pour l'instant.
                            </p>
                          ) : !calcul.assujetti ? (
                            <p className="text-sm mt-2 text-slate-600 dark:text-slate-300">
                              Avec moins de 20 salariés, votre entreprise n'est pas soumise à l'obligation d'emploi de 6 %.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                              <div className="rounded-xl bg-white dark:bg-marine-950 border border-slate-900/10 dark:border-white/10 p-3">
                                <p className="text-xs text-slate-500 dark:text-slate-400">Obligation (6 %)</p>
                                <p className="text-2xl font-bold">{calcul.unitesRequises}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">bénéficiaire{calcul.unitesRequises > 1 ? "s" : ""} attendu{calcul.unitesRequises > 1 ? "s" : ""}</p>
                              </div>
                              <div
                                className={`rounded-xl border p-3 ${
                                  calcul.unitesManquantes > 0
                                    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                                    : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
                                }`}
                              >
                                <p className="text-xs text-slate-500 dark:text-slate-400">Unités manquantes</p>
                                <p className={`text-2xl font-bold ${calcul.unitesManquantes > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                                  {calcul.unitesManquantes}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{calcul.unitesManquantes > 0 ? "à couvrir" : "obligation atteinte"}</p>
                              </div>
                              <div className="rounded-xl bg-white dark:bg-marine-950 border border-slate-900/10 dark:border-white/10 p-3">
                                <p className="text-xs text-slate-500 dark:text-slate-400">Contribution estimée</p>
                                {calcul.montantEstime != null ? (
                                  <>
                                    <p className="text-2xl font-bold">{euros(calcul.montantEstime)}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      par an{calcul.surcontribution ? " — surcontribution" : ""}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">Présentée par votre conseiller (secteur public).</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <p className="font-semibold">Vos coordonnées</p>
                        <div className="grid sm:grid-cols-2 gap-3 mt-3">
                          <input placeholder="Votre nom *" required {...champ("nom")} className={CLASSE_INPUT} />
                          <input placeholder="Votre fonction (ex : DRH)" {...champ("fonction")} className={CLASSE_INPUT} />
                          <input type="tel" placeholder="Téléphone où vous joindre" {...champ("telephone")} className={`${CLASSE_INPUT} sm:col-span-2`} />
                        </div>
                        <textarea
                          rows={3}
                          placeholder="Un message pour votre conseiller (facultatif)"
                          {...champ("commentaire")}
                          className={`mt-3 ${CLASSE_INPUT}`}
                        />
                        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" {...champ("siteWeb")} />
                        <label className="flex items-start gap-2 mt-3 text-sm text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={form.certifie}
                            onChange={(e) => setForm((f) => ({ ...f, certifie: e.target.checked }))}
                            className="mt-1"
                          />
                          Je confirme que ces informations sont exactes à ma connaissance.
                        </label>
                      </div>

                      {erreur && (
                        <p className="rounded-xl border border-red-300/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm px-4 py-3">{erreur}</p>
                      )}
                      <button type="submit" disabled={envoi || !form.certifie || !form.nom.trim()} className={boutonSuivant}>
                        {envoi ? "Envoi…" : "Confirmer ma fiche"}
                      </button>
                      <button type="button" onClick={() => setEtape(2)} className={boutonRetour}>
                        ← Modifier les bénéficiaires
                      </button>
                    </div>
                  )}
                </form>
              )
            )}
            {infos?.pole?.email && (
              <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-6">
                Une question ? {infos.pole.email}
                {infos.pole.telephone ? ` · ${infos.pole.telephone}` : ""}
              </p>
            )}
          </div>
        </div>
        <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-4">
          Nous ne vous demanderons jamais de paiement, de codes d'accès ni de coordonnées bancaires.
        </p>
      </main>
    </div>
  );
}
