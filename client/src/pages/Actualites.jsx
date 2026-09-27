import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EnteteVitrine from "../components/vitrine/EnteteVitrine.jsx";
import { ACTUALITES } from "../components/vitrine/contenuActualites.js";

// Page publique "Actualités" (/vitrine/actualites) : les repères
// réglementaires du bouton flottant orange, filtrables par thème.
export default function Actualites() {
  const [theme, setTheme] = useState("Tous");
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const themes = useMemo(() => ["Tous", ...new Set(ACTUALITES.map((a) => a.theme))], []);
  const liste = theme === "Tous" ? ACTUALITES : ACTUALITES.filter((a) => a.theme === theme);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white">
      <EnteteVitrine />
      <section className="relative overflow-hidden pt-28 pb-10 lg:pt-32">
        <div aria-hidden className="pointer-events-none absolute -top-32 right-0 w-[600px] h-[420px] rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Actualités OETH
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-5">Actualités OETH : les repères réglementaires à connaître</h1>
          <p className="text-slate-600 dark:text-slate-300 text-lg mt-4 max-w-3xl">
            Échéances, SMIC, coefficients, déductions, codes DSN : l'essentiel pour anticiper votre déclaration OETH.
          </p>
          <div className="flex flex-wrap gap-2 mt-7">
            {themes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  theme === t ? "border-amber-400 bg-amber-400 text-amber-950" : "border-slate-900/15 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-white/10"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-16 lg:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {liste.map((a) => (
            <article key={a.titre} className="rounded-2xl border border-slate-900/10 dark:border-white/10 border-t-4 border-t-amber-400 bg-white dark:bg-marine-950 p-5 flex flex-col">
              <span className="self-start rounded-full bg-amber-400/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
                {a.theme}
              </span>
              <h2 className="font-semibold mt-3 leading-snug">{a.titre}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">{a.texte}</p>
              {a.action && (
                <Link
                  to={a.action.to}
                  className="self-start mt-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-amber-950 text-xs font-bold px-3.5 py-2 transition"
                >
                  {a.action.label} →
                </Link>
              )}
            </article>
          ))}
        </div>
        <p className="max-w-6xl mx-auto px-4 sm:px-6 text-xs text-slate-500 mt-8">
          Informations générales à jour de septembre 2026, fondées sur les règles de droit commun. Seule l'URSSAF (ou la MSA)
          calcule et recouvre la contribution.
        </p>
      </section>
    </div>
  );
}
