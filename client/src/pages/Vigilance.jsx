import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api.js";
import EnteteVitrine from "../components/vitrine/EnteteVitrine.jsx";
import {
  VIGILANCE,
  DOMAINE_OFFICIEL,
  EMAIL_OFFICIEL,
  TELEPHONE_OFFICIEL,
  LIEN_SIGNALCONSO,
  LIEN_URSSAF_OETH,
  LIEN_ANNUAIRE_ENTREPRISES,
} from "../components/vitrine/contenuVigilance.js";

const CLASSE_INPUT =
  "w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400";

const CANAUX = ["Appel téléphonique", "E-mail", "Courrier", "Visite", "Autre"];

// Rappels du cadre applicable — faits vérifiables, avec source officielle.
const CADRE = [
  {
    titre: "Une déclaration via la DSN",
    texte:
      "L'obligation d'emploi se déclare chaque année dans la DSN (déclaration de l'exercice N en avril N+1), à partir des effectifs mis à disposition par l'URSSAF ou la MSA.",
  },
  {
    titre: "Un seul organisme de recouvrement",
    texte:
      "La contribution éventuelle est réglée à l'URSSAF (ou à la MSA). Aucun prestataire, cabinet ou « cellule » ne peut l'encaisser à sa place.",
  },
  {
    titre: "Des déductions justifiées",
    texte:
      "La sous-traitance auprès d'une EA, d'un ESAT ou d'un TIH ne réduit la contribution que sur la base de prestations réelles, attestées chaque année par la structure.",
  },
  {
    titre: "Un montant fondé sur votre situation",
    texte:
      "La contribution dépend de votre effectif, de vos bénéficiaires et de vos actions. Aucune « régularisation d'urgence » ne peut être imposée par téléphone.",
  },
];

const VIDE = {
  nom: "",
  email: "",
  telephone: "",
  entreprise: "",
  canal: "",
  interlocuteur: "",
  coordonneesInterlocuteur: "",
  description: "",
  consentement: false,
  siteWeb: "",
};

// Page publique "Vigilance" (/vitrine/vigilance) : bons réflexes face aux
// sollicitations liées à l'OETH, coordonnées officielles du pôle et
// formulaire pour faire vérifier une sollicitation par un conseiller.
export default function Vigilance() {
  const { hash } = useLocation();
  const [form, setForm] = useState(VIDE);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [envoye, setEnvoye] = useState(false);

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [hash]);

  const champ = (cle) => ({ value: form[cle], onChange: (e) => setForm((f) => ({ ...f, [cle]: e.target.value })) });

  async function envoyer(ev) {
    ev.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api.signalerSollicitation(form);
      setEnvoye(true);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  const allerFormulaire = () => document.getElementById("verifier")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white">
      <EnteteVitrine />

      {/* En-tête */}
      <section className="relative overflow-hidden pt-28 pb-14 lg:pt-32 lg:pb-20">
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 w-[640px] h-[480px] rounded-full bg-red-600/10 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1.4fr_1fr] gap-10 items-start">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-500/10 text-red-700 dark:text-red-300 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Vigilance OETH
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mt-5">
              Sécurisez vos démarches liées à l'OETH
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed mt-5">
              Des entreprises reçoivent des appels, e-mails ou courriers au sujet d'un « dossier OETH », d'une attestation ou
              d'un règlement. Quelques vérifications simples suffisent à distinguer une démarche sérieuse d'une sollicitation
              abusive.
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              <button
                type="button"
                onClick={allerFormulaire}
                className="rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-6 py-3.5 transition shadow-[0_10px_40px_rgba(220,38,38,0.3)]"
              >
                Faire vérifier une sollicitation
              </button>
              <a
                href="#reflexes"
                className="rounded-xl border border-slate-900/20 dark:border-white/20 text-sm font-semibold px-6 py-3.5 hover:bg-slate-900/10 dark:hover:bg-white/10 transition"
              >
                Les bons réflexes
              </a>
            </div>
            <div className="mt-7 rounded-xl border border-red-400/30 border-l-4 border-l-red-500 bg-red-500/[0.07] px-4 py-3.5 text-sm text-red-900 dark:text-red-100">
              <strong className="text-red-700 dark:text-red-300">À retenir :</strong> la contribution OETH se déclare dans votre DSN et se règle
              uniquement à l'URSSAF (ou à la MSA). Personne d'autre n'est habilité à l'encaisser.
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-900/10 dark:border-white/10">
              <span className="w-8 h-8 rounded-lg bg-marine-500/20 text-marine-200 flex items-center justify-center">🛡️</span>
              <p className="font-semibold">Nos coordonnées officielles</p>
            </div>
            <div className="p-5 space-y-2.5 text-sm">
              {[
                ["Site officiel", DOMAINE_OFFICIEL],
                ["Adresses e-mail", `…@${DOMAINE_OFFICIEL} (ex. ${EMAIL_OFFICIEL})`],
                ["Téléphone", TELEPHONE_OFFICIEL],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{l}</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5 break-words">{v}</p>
                </div>
              ))}
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                Pour l'envoi de documents, l'adresse postale vous est communiquée par un conseiller. Toute autre adresse
                e-mail ou tout autre site se réclamant de nous doit être vérifié.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* Bons réflexes */}
      <section id="reflexes" className="scroll-mt-24 border-t border-slate-900/10 dark:border-white/10 py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-700 dark:text-red-300">Vérifications recommandées</p>
          <h2 className="text-3xl font-bold tracking-tight mt-2">Les bons réflexes</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {VIGILANCE.map((v, i) => (
              <div key={v.titre} className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 p-5">
                <span className="w-8 h-8 rounded-lg bg-red-500/15 text-red-700 dark:text-red-300 text-xs font-bold flex items-center justify-center">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="font-semibold mt-3 leading-snug">{v.titre}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{v.texte}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cadre applicable */}
      <section className="border-t border-slate-900/10 dark:border-white/10 py-14 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-marine-600 dark:text-marine-300">Rappel réglementaire</p>
          <h2 className="text-3xl font-bold tracking-tight mt-2">Ce que prévoit le cadre applicable</h2>
          <div className="grid md:grid-cols-2 gap-4 mt-8">
            {CADRE.map((c) => (
              <div key={c.titre} className="rounded-2xl border border-slate-900/10 dark:border-white/10 border-l-4 border-l-marine-400 bg-white dark:bg-marine-950 p-5">
                <p className="font-semibold">{c.titre}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{c.texte}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-sm">
            <a href={LIEN_URSSAF_OETH} target="_blank" rel="noopener noreferrer" className="text-marine-600 dark:text-marine-300 hover:underline">
              URSSAF — contribution annuelle OETH ↗
            </a>
            <a href={LIEN_ANNUAIRE_ENTREPRISES} target="_blank" rel="noopener noreferrer" className="text-marine-600 dark:text-marine-300 hover:underline">
              Annuaire officiel des entreprises ↗
            </a>
            <a href={LIEN_SIGNALCONSO} target="_blank" rel="noopener noreferrer" className="text-marine-600 dark:text-marine-300 hover:underline">
              Signaler une pratique abusive (SignalConso) ↗
            </a>
          </div>
        </div>
      </section>

      {/* Formulaire de vérification */}
      <section id="verifier" className="scroll-mt-24 border-t border-slate-900/10 dark:border-white/10 py-14 lg:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 overflow-hidden">
            <div className="flex h-1">
              <span className="flex-1 bg-marine-500" />
              <span className="flex-1 bg-white" />
              <span className="flex-1 bg-red-500" />
            </div>
            <div className="grid lg:grid-cols-[1fr_1.4fr] gap-10 p-6 sm:p-10">
              <div>
                <span className="inline-block rounded-full border border-red-400/40 bg-red-500/10 text-red-700 dark:text-red-300 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5">
                  Faire vérifier
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-4">Vous avez reçu une sollicitation ?</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
                  Décrivez-la : un conseiller vérifie l'interlocuteur et la démarche, puis vous répond. En attendant, ne donnez
                  suite à aucune demande de paiement.
                </p>
                <ul className="mt-6 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <li>✓ Gratuit et sans engagement</li>
                  <li>✓ Accusé de réception envoyé depuis {EMAIL_OFFICIEL}</li>
                  <li>✓ Vos informations servent uniquement à traiter votre demande</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.02] dark:bg-white/[0.02] p-5 sm:p-7">
                {envoye ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl">
                      ✓
                    </div>
                    <p className="text-xl font-semibold mt-4">Demande transmise</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Un conseiller examine la sollicitation et revient vers vous rapidement.</p>
                  </div>
                ) : (
                  <form onSubmit={envoyer} className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input required placeholder="Votre nom *" className={CLASSE_INPUT} {...champ("nom")} />
                      <input required placeholder="Entreprise *" className={CLASSE_INPUT} {...champ("entreprise")} />
                      <input required type="email" placeholder="E-mail professionnel *" className={CLASSE_INPUT} {...champ("email")} />
                      <input type="tel" placeholder="Téléphone" className={CLASSE_INPUT} {...champ("telephone")} />
                    </div>
                    <select className={`${CLASSE_INPUT} cursor-pointer`} {...champ("canal")}>
                      <option className="bg-white dark:bg-marine-950" value="">
                        Comment avez-vous été sollicité ?
                      </option>
                      {CANAUX.map((c) => (
                        <option key={c} className="bg-white dark:bg-marine-950" value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input placeholder="Nom de l'interlocuteur ou de la structure" className={CLASSE_INPUT} {...champ("interlocuteur")} />
                    <input
                      placeholder="Numéro appelant, adresse e-mail ou site utilisé"
                      className={CLASSE_INPUT}
                      {...champ("coordonneesInterlocuteur")}
                    />
                    <textarea
                      required
                      rows={4}
                      placeholder="Que vous a-t-on demandé ? (paiement, attestation, numéro de dossier…) *"
                      className={`${CLASSE_INPUT} resize-none`}
                      {...champ("description")}
                    />
                    {/* Champ piège anti-robots, invisible pour les humains. */}
                    <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" {...champ("siteWeb")} />
                    <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={form.consentement}
                        onChange={(e) => setForm((f) => ({ ...f, consentement: e.target.checked }))}
                        className="mt-0.5 accent-red-500"
                      />
                      J'accepte que ces informations soient utilisées pour traiter ma demande de vérification.
                    </label>
                    {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
                    <button
                      type="submit"
                      disabled={envoi}
                      className="w-full rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold py-3.5 transition disabled:opacity-40"
                    >
                      {envoi ? "Envoi…" : "Envoyer pour vérification"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
