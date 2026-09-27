import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import EnteteVitrine from "../components/vitrine/EnteteVitrine.jsx";
import PriseRendezVous from "../components/vitrine/PriseRendezVous.jsx";
import { FAQ, CATEGORIES_FAQ, normaliser } from "../components/vitrine/contenuFaq.js";
import { EMAIL_OFFICIEL, TELEPHONE_OFFICIEL } from "../components/vitrine/contenuVigilance.js";

// Les 4 étapes d'un dossier OETH bien préparé (blocs du haut de page).
const REPERES = [
  {
    titre: "Analyse réglementaire",
    texte: "Étude de l'effectif, du quota de 6 %, des bénéficiaires déclarés et du risque de contribution.",
  },
  {
    titre: "Vérification administrative",
    texte: "Contrôle de la cohérence des données utiles à la déclaration DOETH et des justificatifs disponibles.",
  },
  {
    titre: "Solutions mobilisables",
    texte: "Identification des leviers : emploi direct, alternance, sous-traitance EA / ESAT / TIH, dépenses déductibles.",
  },
  {
    titre: "Sécurisation du dossier",
    texte: "Mise à jour du dossier et structuration des pièces utiles à la déclaration et au suivi.",
  },
];

const CLASSE_INPUT =
  "w-full rounded-xl border border-slate-900/15 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400";

const TEL_LIEN = `tel:${TELEPHONE_OFFICIEL.replace(/\s/g, "")}`;

// Page publique "FAQ" (/vitrine/faq), ouverte depuis le bouton flottant :
// repères du dossier OETH, toutes les questions (réponses visibles, avec
// recherche et "tout replier"), puis bloc Contact et assistance.
export default function Faq() {
  const [recherche, setRecherche] = useState("");
  const [toutDeplie, setToutDeplie] = useState(true);
  const [replies, setReplies] = useState(() => new Set()); // questions repliées une à une
  const [rdvOuvert, setRdvOuvert] = useState(false);
  const fermerRdv = useCallback(() => setRdvOuvert(false), []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const resultats = useMemo(() => {
    const q = normaliser(recherche).trim();
    if (!q) return FAQ;
    const mots = q.split(/\s+/).filter(Boolean);
    return FAQ.filter((item) => {
      const texte = normaliser(`${item.question} ${item.reponse} ${item.motsCles.join(" ")}`);
      return mots.every((m) => texte.includes(m));
    });
  }, [recherche]);

  const estOuverte = (id) => (toutDeplie ? !replies.has(id) : replies.has(id));
  function basculerQuestion(id) {
    setReplies((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function basculerTout() {
    setToutDeplie((v) => !v);
    setReplies(new Set());
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white">
      <EnteteVitrine />

      {/* En-tête */}
      <section className="relative overflow-hidden pt-28 pb-8 lg:pt-32">
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 w-[600px] h-[420px] rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/40 bg-teal-400/10 text-teal-700 dark:text-teal-300 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Questions fréquentes
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-5">Tout comprendre de l'OETH</h1>
          <p className="text-slate-600 dark:text-slate-300 text-lg mt-4">
            Les repères essentiels et les réponses aux questions les plus posées par les RH, la paie et les dirigeants.
          </p>
        </div>
      </section>

      {/* Repères pour votre dossier OETH */}
      <section className="pb-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl font-semibold">Repères pour votre dossier OETH</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Les principaux points à vérifier avant la déclaration et le règlement éventuel de la contribution.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            {REPERES.map((r, i) => (
              <div
                key={r.titre}
                className="rounded-2xl border border-slate-900/10 dark:border-white/10 border-t-4 border-t-teal-400 bg-white dark:bg-marine-950 p-5"
              >
                <span className="w-8 h-8 rounded-lg bg-teal-400/15 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="font-semibold mt-3">{r.titre}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{r.texte}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Toutes les questions */}
      <section className="pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Questions fréquentes</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {resultats.length} question{resultats.length > 1 ? "s" : ""}
                {recherche ? " trouvée" + (resultats.length > 1 ? "s" : "") : ""} · réponses{" "}
                {toutDeplie ? "affichées" : "masquées"}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-72">
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher : quota, DSN, ESAT…"
                  aria-label="Rechercher dans la FAQ"
                  className={`${CLASSE_INPUT} pl-10 py-2.5`}
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              </div>
              <button
                type="button"
                onClick={basculerTout}
                className="shrink-0 rounded-xl border border-slate-900/15 dark:border-white/15 text-xs font-semibold px-3.5 hover:bg-slate-900/5 dark:hover:bg-white/10 transition"
              >
                {toutDeplie ? "Tout replier" : "Tout déplier"}
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-8">
            {CATEGORIES_FAQ.map((cat) => {
              const items = resultats.filter((q) => q.categorie === cat);
              if (!items.length) return null;
              return (
                <div key={cat}>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">{cat}</h3>
                  <div className="mt-2.5 rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 divide-y divide-slate-900/10 dark:divide-white/10">
                    {items.map((q) => {
                      const ouverte = estOuverte(q.id);
                      return (
                        <div key={q.id} id={q.id} className="scroll-mt-24">
                          <button
                            type="button"
                            onClick={() => basculerQuestion(q.id)}
                            aria-expanded={ouverte}
                            className="w-full text-left flex items-start justify-between gap-4 px-5 pt-4 pb-2 hover:bg-slate-900/[0.02] dark:hover:bg-white/[0.02]"
                          >
                            <span className="font-semibold">{q.question}</span>
                            <span className={`text-teal-700 dark:text-teal-300 text-xl leading-none transition-transform ${ouverte ? "rotate-45" : ""}`}>
                              +
                            </span>
                          </button>
                          {ouverte ? (
                            <div className="px-5 pb-4">
                              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{q.reponse}</p>
                              {q.lien && (
                                <Link to={q.lien.to} className="inline-block text-sm font-semibold text-teal-700 dark:text-teal-300 hover:underline mt-2">
                                  {q.lien.label} →
                                </Link>
                              )}
                            </div>
                          ) : (
                            <div className="pb-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {resultats.length === 0 && (
              <p className="text-center text-slate-500 dark:text-slate-400">
                Aucune réponse trouvée. Posez votre question à l'assistant (en bas à gauche) ou contactez-nous ci-dessous.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Contact et assistance */}
      <section id="contact-assistance" className="scroll-mt-24 pb-16 lg:pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 overflow-hidden">
            <div className="flex h-1">
              <span className="flex-1 bg-marine-500" />
              <span className="flex-1 bg-slate-200 dark:bg-white" />
              <span className="flex-1 bg-red-500" />
            </div>
            <div className="flex items-center gap-3 px-6 sm:px-8 pt-6">
              <span className="w-9 h-9 rounded-xl bg-teal-400/15 text-teal-700 dark:text-teal-300 flex items-center justify-center">☎</span>
              <h2 className="text-xl font-semibold">Contact et assistance</h2>
            </div>
            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 px-6 sm:px-8 pb-8 pt-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cadre de l'accompagnement</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
                  Le pôle accompagne les entreprises sur l'OETH et la DOETH : compréhension de la contribution, identification
                  des leviers adaptés, mise à jour du dossier et sécurisation des justificatifs.
                </p>
                <div className="space-y-2.5 mt-5">
                  <a
                    href={TEL_LIEN}
                    className="flex items-center justify-between rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] px-4 py-3 hover:border-teal-400/50 transition"
                  >
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Téléphone</span>
                      <span className="font-semibold">{TELEPHONE_OFFICIEL}</span>
                    </span>
                    <span className="text-teal-700 dark:text-teal-300 text-sm">Appeler →</span>
                  </a>
                  <a
                    href={`mailto:${EMAIL_OFFICIEL}`}
                    className="flex items-center justify-between rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] px-4 py-3 hover:border-teal-400/50 transition"
                  >
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">E-mail</span>
                      <span className="font-semibold">{EMAIL_OFFICIEL}</span>
                    </span>
                    <span className="text-teal-700 dark:text-teal-300 text-sm">Écrire →</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setRdvOuvert(true)}
                    className="w-full rounded-xl bg-teal-400 hover:bg-teal-300 text-marine-950 text-sm font-bold py-3 transition"
                  >
                    Réserver un échange avec un expert
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
                  L'adresse postale, utile pour l'envoi de documents, vous est communiquée par un conseiller.
                </p>
              </div>
              <FormulaireContact />
            </div>
          </div>
        </div>
      </section>

      {rdvOuvert && <PriseRendezVous onFermer={fermerRdv} />}
    </div>
  );
}

// Formulaire de contact : envoie la demande à la boîte du pôle ; le visiteur
// reçoit un accusé de réception depuis contact@oeth-fiph.fr (côté serveur).
function FormulaireContact() {
  const [form, setForm] = useState({ nom: "", email: "", telephone: "", entreprise: "", message: "" });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [envoye, setEnvoye] = useState(false);
  const champ = (cle) => ({ value: form[cle], onChange: (e) => setForm((f) => ({ ...f, [cle]: e.target.value })) });

  async function envoyer(ev) {
    ev.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api.contacterConseillerVitrine(form);
      setEnvoye(true);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (envoye) {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center self-start">
        <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">Message envoyé</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5">
          Un accusé de réception vous a été adressé. Un conseiller vous répond rapidement.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-5 space-y-3">
      <p className="font-semibold">Formulaire de contact</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <input required placeholder="Votre nom *" className={CLASSE_INPUT} {...champ("nom")} />
        <input placeholder="Entreprise" className={CLASSE_INPUT} {...champ("entreprise")} />
        <input required type="email" placeholder="E-mail *" className={CLASSE_INPUT} {...champ("email")} />
        <input type="tel" placeholder="Téléphone" className={CLASSE_INPUT} {...champ("telephone")} />
      </div>
      <textarea rows={4} placeholder="Votre question ou votre situation" className={`${CLASSE_INPUT} resize-none`} {...champ("message")} />
      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
      <button
        type="submit"
        disabled={envoi}
        className="w-full rounded-xl bg-marine-700 hover:bg-marine-600 text-white text-sm font-bold py-3 transition disabled:opacity-40"
      >
        {envoi ? "Envoi…" : "Envoyer ma demande"}
      </button>
    </form>
  );
}
