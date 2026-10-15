import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import { BoutonThemeVitrine } from "../components/vitrine/ThemeVitrine.jsx";

// Page publique ouverte depuis l'e-mail "Avez-vous pu échanger avec notre
// conseiller aujourd'hui ?" (/vitrine/confirmer-echange/<jeton>, voir
// server/src/controleRdv.js) — mission de contrôle et de suivi : le client
// confirme que l'échange du jour a bien eu lieu, et en laisse un court
// récapitulatif (trace indépendante du compte-rendu du conseiller), ou
// signale qu'il n'a pas été contacté. La réponse part à l'agent principal.
export default function ConfirmerEchangeClient() {
  const { jeton } = useParams();
  const [infos, setInfos] = useState(null);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [etape, setEtape] = useState("choix"); // choix | recap
  const [recap, setRecap] = useState("");
  const [siteWeb, setSiteWeb] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [repondu, setRepondu] = useState(null); // "oui" | "non"

  useEffect(() => {
    document.title = "Confirmer votre échange — Pôle OETH / AGEFIPH";
    api
      .getControleEchange(jeton)
      .then(setInfos)
      .catch((e) => setErreurChargement(e.message));
  }, [jeton]);

  async function repondreNon() {
    setEnvoi(true);
    setErreur(null);
    try {
      await api.confirmerControleEchange(jeton, { echange: "non", siteWeb });
      setRepondu("non");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function validerRecap(ev) {
    ev.preventDefault();
    if (recap.trim().length < 5) {
      setErreur("Merci d'indiquer quelques mots sur ce qui a été convenu lors de l'échange.");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await api.confirmerControleEchange(jeton, { echange: "oui", recap: recap.trim(), siteWeb });
      setRepondu("oui");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

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
            {erreurChargement && (
              <p className="rounded-xl border border-red-300/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm px-4 py-3">
                {erreurChargement}
              </p>
            )}
            {!infos && !erreurChargement && <p className="text-sm text-slate-500 dark:text-slate-400">Chargement…</p>}

            {infos && (repondu || infos.statut !== "en_attente") ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl">
                  ✓
                </div>
                <p className="text-xl font-semibold mt-4">Merci, votre réponse est enregistrée</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  {repondu === "non" || infos.statut === "non_contacte"
                    ? "Nous en sommes désolés — un conseiller va revenir vers vous rapidement."
                    : "Merci pour ce retour, il nous aide à assurer un bon suivi de votre dossier."}
                </p>
              </div>
            ) : (
              infos && (
                <>
                  <h1 className="text-2xl sm:text-3xl font-bold">Confirmer votre échange</h1>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                    Un conseiller du Pôle OETH / AGEFIPH devait vous contacter le <strong>{infos.date}</strong> concernant{" "}
                    <strong>{infos.entreprise}</strong>.
                  </p>

                  {etape === "choix" ? (
                    <div className="mt-8 space-y-3">
                      <p className="text-sm font-semibold">Avez-vous pu échanger avec lui ?</p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={() => setEtape("recap")}
                          disabled={envoi}
                          className="flex-1 rounded-xl bg-marine-700 hover:bg-marine-800 text-white text-sm font-bold py-3.5 transition disabled:opacity-40"
                        >
                          ✅ Oui, j'ai échangé avec un conseiller
                        </button>
                        <button
                          type="button"
                          onClick={repondreNon}
                          disabled={envoi}
                          className="flex-1 rounded-xl border border-slate-900/15 dark:border-white/15 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-bold py-3.5 transition disabled:opacity-40"
                        >
                          ❌ Non, personne ne m'a contacté
                        </button>
                      </div>
                      {erreur && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{erreur}</p>}
                    </div>
                  ) : (
                    <form onSubmit={validerRecap} className="mt-8 space-y-3">
                      <label className="block text-sm font-semibold" htmlFor="recap">
                        Merci ! Pourriez-vous nous indiquer en quelques mots ce qui a été convenu lors de cet échange ?
                      </label>
                      <textarea
                        id="recap"
                        rows={4}
                        value={recap}
                        onChange={(e) => setRecap(e.target.value)}
                        placeholder="ex : points abordés, prochaines étapes envisagées…"
                        className="w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-marine-400 resize-none"
                      />
                      {/* Champ piège anti-robots, invisible pour les humains. */}
                      <input
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        className="hidden"
                        value={siteWeb}
                        onChange={(e) => setSiteWeb(e.target.value)}
                      />
                      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
                      <button
                        type="submit"
                        disabled={envoi || recap.trim().length < 5}
                        className="w-full rounded-xl bg-marine-700 hover:bg-marine-800 text-white text-sm font-bold py-3.5 transition disabled:opacity-40"
                      >
                        {envoi ? "Envoi…" : "Valider"}
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
