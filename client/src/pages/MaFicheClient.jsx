import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import { BoutonThemeVitrine } from "../components/vitrine/ThemeVitrine.jsx";

const CLASSE_INPUT =
  "w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-marine-400";

const euros = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} €`;
const dateFr = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// Page publique « Confirmer ma fiche » (/vitrine/ma-fiche/<jeton>, voir
// server/src/ficheClient.js) : le client confirme son effectif et son nombre
// de bénéficiaires, voit l'estimation se mettre à jour, puis valide — sa fiche
// est mise à jour et son conseiller prévenu.
export default function MaFicheClient() {
  const { jeton } = useParams();
  const [infos, setInfos] = useState(null);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [form, setForm] = useState({ effectif: "", rqth: "", nom: "", fonction: "", commentaire: "", certifie: false, siteWeb: "" });
  const [calcul, setCalcul] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [termine, setTermine] = useState(null);
  const minuterie = useRef(null);

  useEffect(() => {
    document.title = "Confirmer ma fiche — Pôle OETH";
    api
      .getMaFiche(jeton)
      .then((d) => {
        setInfos(d);
        setCalcul(d.calcul);
        setForm((f) => ({ ...f, effectif: d.effectif ?? "", rqth: d.rqth ?? 0 }));
      })
      .catch((e) => setErreurChargement(e.message));
  }, [jeton]);

  // Recalcul en direct (léger délai pendant la frappe).
  useEffect(() => {
    if (!infos) return;
    const eff = Number(form.effectif);
    const rq = Number(form.rqth);
    if (!Number.isInteger(eff) || eff < 1 || !Number.isInteger(rq) || rq < 0) return;
    clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => {
      api.calculMaFiche(jeton, eff, rq).then(setCalcul).catch(() => {});
    }, 350);
    return () => clearTimeout(minuterie.current);
  }, [form.effectif, form.rqth, infos, jeton]);

  const champ = (cle) => ({ value: form[cle], onChange: (e) => setForm((f) => ({ ...f, [cle]: e.target.value })) });

  async function confirmer(ev) {
    ev.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.confirmerMaFiche(jeton, {
        ...form,
        effectif: Number(form.effectif),
        rqth: Number(form.rqth),
      });
      setTermine(r.calcul || calcul);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  const publicFiphfp = calcul?.collecteur === "FIPHFP";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white">
      <header className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/logo-192.png" alt="" width="40" height="40" className="w-10 h-10 rounded-lg" />
          <div>
            <p className="font-bold leading-tight">{publicFiphfp ? "Pôle FIPHFP" : "Pôle OETH / AGEFIPH"}</p>
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

            {termine ? (
              <div className="mt-8 text-center py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl">
                  ✓
                </div>
                <p className="text-xl font-semibold mt-4">Merci, votre fiche est confirmée</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  Effectif : <strong>{form.effectif}</strong> · Bénéficiaires : <strong>{form.rqth}</strong> ·{" "}
                  {termine.unitesManquantes > 0 ? (
                    <>
                      <strong>{termine.unitesManquantes}</strong> unité{termine.unitesManquantes > 1 ? "s" : ""} manquante
                      {termine.unitesManquantes > 1 ? "s" : ""}
                    </>
                  ) : (
                    <strong>obligation atteinte</strong>
                  )}
                  .
                  <br />
                  Votre conseiller a été prévenu et revient vers vous avec les solutions adaptées.
                </p>
              </div>
            ) : (
              infos && (
                <form onSubmit={confirmer} className="mt-6 space-y-6">
                  {infos.dejaConfirmee && (
                    <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-sm px-4 py-3">
                      ✓ Fiche déjà confirmée le {dateFr(infos.dejaConfirmee.date)} par {infos.dejaConfirmee.nom}. Vous pouvez la mettre à jour
                      ci-dessous si votre situation a changé.
                    </p>
                  )}

                  <div>
                    <p className="font-semibold">1. Vos effectifs</p>
                    <div className="grid sm:grid-cols-2 gap-3 mt-3">
                      <label className="block text-sm">
                        <span className="text-slate-600 dark:text-slate-300">Effectif de l'entreprise (salariés)</span>
                        <input type="number" min="1" inputMode="numeric" required {...champ("effectif")} className={`mt-1 ${CLASSE_INPUT}`} />
                      </label>
                      <label className="block text-sm">
                        <span className="text-slate-600 dark:text-slate-300">Salariés bénéficiaires (RQTH ou équivalent)</span>
                        <input type="number" min="0" inputMode="numeric" required {...champ("rqth")} className={`mt-1 ${CLASSE_INPUT}`} />
                      </label>
                    </div>
                    <div className="mt-3 rounded-xl bg-marine-50/70 dark:bg-white/5 border border-marine-100 dark:border-white/10 px-4 py-3 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                      <p>
                        <strong>Pourquoi le nombre de bénéficiaires est parfois à 0 ?</strong> Ce nombre n'est publié nulle part : c'est une
                        information confidentielle, que seule votre entreprise connaît. Tant qu'il ne nous a pas été communiqué, l'estimation
                        part de 0 — ce n'est pas un jugement sur votre situation. Indiquez votre nombre réel (salariés ayant une RQTH ou un
                        statut équivalent) pour une estimation juste.
                      </p>
                      {calcul?.collecteur !== "FIPHFP" && Number(form.effectif) >= 20 && (
                        <p>
                          <strong>Repère :</strong> en moyenne, les entreprises privées emploient environ 3,5 % de travailleurs handicapés,
                          soit environ <strong>{Math.max(1, Math.round(Number(form.effectif) * 0.035))}</strong> pour un effectif de{" "}
                          {Number(form.effectif)} salariés. Ce n'est qu'une moyenne nationale, pas le chiffre de votre entreprise.
                        </p>
                      )}
                      <p>Un handicap n'est pas toujours visible ni déclaré : votre conseiller vous aide à faire le point. Ces informations restent confidentielles.</p>
                    </div>
                  </div>

                  {calcul && (
                    <div className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 sm:p-5">
                      <p className="font-semibold">2. Votre situation estimée{calcul.exercice ? ` (exercice ${calcul.exercice})` : ""}</p>
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
                          <div className={`rounded-xl border p-3 ${calcul.unitesManquantes > 0 ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900" : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"}`}>
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
                                <p className="text-xs text-slate-500 dark:text-slate-400">par an, avant solutions{calcul.surcontribution ? " (surcontribution)" : ""}</p>
                              </>
                            ) : (
                              <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">Calculée avec votre conseiller (secteur public, FIPHFP).</p>
                            )}
                          </div>
                        </div>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                        Estimation indicative établie à partir des chiffres que vous indiquez et des règles générales ; le montant réel dépend de votre
                        déclaration et des actions engagées (recrutement, sous-traitance ESAT / EA / TIH…).
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="font-semibold">3. Qui confirme ?</p>
                    <div className="grid sm:grid-cols-2 gap-3 mt-3">
                      <input placeholder="Votre nom *" required {...champ("nom")} className={CLASSE_INPUT} />
                      <input placeholder="Votre fonction (ex : DRH)" {...champ("fonction")} className={CLASSE_INPUT} />
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
                  <button
                    type="submit"
                    disabled={envoi || !form.certifie}
                    className="w-full rounded-xl bg-marine-700 hover:bg-marine-800 text-white font-semibold py-3.5 disabled:opacity-50"
                  >
                    {envoi ? "Envoi…" : "Confirmer ma fiche"}
                  </button>
                  {infos.pole?.email && (
                    <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                      Une question ? {infos.pole.email}
                      {infos.pole.telephone ? ` · ${infos.pole.telephone}` : ""}
                    </p>
                  )}
                </form>
              )
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
