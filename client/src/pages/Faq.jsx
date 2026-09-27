import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EnteteVitrine from "../components/vitrine/EnteteVitrine.jsx";
import { FAQ, CATEGORIES_FAQ, normaliser } from "../components/vitrine/contenuFaq.js";

// Page publique "FAQ" (/vitrine/faq) : recherche plein texte (sans accents)
// et questions regroupées par thème, dépliables.
export default function Faq() {
  const [recherche, setRecherche] = useState("");
  const [deplie, setDeplie] = useState(null);
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white">
      <EnteteVitrine />
      <section className="relative overflow-hidden pt-28 pb-8 lg:pt-32">
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 w-[600px] h-[420px] rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/40 bg-teal-400/10 text-teal-700 dark:text-teal-300 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Questions fréquentes
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-5">Tout comprendre de l'OETH</h1>
          <p className="text-slate-600 dark:text-slate-300 text-lg mt-4">
            Les réponses aux questions les plus posées par les RH, la paie et les dirigeants.
          </p>
          <div className="relative mt-8 max-w-2xl mx-auto">
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher : quota, DSN, ESAT, surcontribution…"
              aria-label="Rechercher dans la FAQ"
              className="w-full rounded-2xl border border-slate-900/15 dark:border-white/15 bg-slate-900/5 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {resultats.length} question{resultats.length > 1 ? "s" : ""}
          </p>
        </div>
      </section>

      <section className="pb-16 lg:pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-10">
          {CATEGORIES_FAQ.map((cat) => {
            const items = resultats.filter((q) => q.categorie === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <h2 className="text-lg font-semibold text-teal-700 dark:text-teal-300">{cat}</h2>
                <div className="mt-3 rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 divide-y divide-slate-900/10 dark:divide-white/10">
                  {items.map((q) => (
                    <div key={q.id} id={q.id} className="scroll-mt-24">
                      <button
                        type="button"
                        onClick={() => setDeplie((d) => (d === q.id ? null : q.id))}
                        aria-expanded={deplie === q.id}
                        className="w-full text-left flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.03]"
                      >
                        <span className="font-medium">{q.question}</span>
                        <span className={`text-teal-700 dark:text-teal-300 text-xl leading-none transition-transform ${deplie === q.id ? "rotate-45" : ""}`}>
                          +
                        </span>
                      </button>
                      {deplie === q.id && (
                        <div className="px-5 pb-5 -mt-1">
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{q.reponse}</p>
                          {q.lien && (
                            <Link to={q.lien.to} className="inline-block text-sm font-semibold text-teal-700 dark:text-teal-300 hover:underline mt-3">
                              {q.lien.label} →
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {resultats.length === 0 && (
            <p className="text-center text-slate-500 dark:text-slate-400">
              Aucune réponse trouvée. Posez votre question à l'assistant (en bas à gauche) ou{" "}
              <Link to="/vitrine/pilotage" className="text-teal-700 dark:text-teal-300 hover:underline">
                échangez avec un expert
              </Link>
              .
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
