// Contenu de l'affiche officielle du pôle AGEFIPH, partagé entre le panneau
// d'aide-mémoire (accessible partout via la barre d'outils) et la fiche
// entreprise (mise en avant contextuelle selon l'effectif du prospect en
// cours d'appel). Séparateurs violets (couleur associée à l'AGEFIPH) entre
// les sections, pour bien les distinguer d'un coup d'œil.
import { useState } from "react";

const SECTION = "py-4 first:pt-0 border-t border-marine-100 dark:border-marine-900/30 first:border-t-0";

// Calcul instantané de l'obligation pendant un appel : le client donne son
// effectif, l'agent voit tout de suite les 6 % (arrondi à l'entier inférieur,
// dès 20 salariés — même règle que server/src/oeth.js), sans calculatrice.
function CalculRapide({ effectif, onChange }) {
  const eff = Number(String(effectif).replace(",", "."));
  const saisi = String(effectif).trim() !== "" && Number.isFinite(eff);
  const assujetti = saisi && eff >= 20;
  const exact = eff * 0.06;
  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Calcul rapide 6 %</p>
      <div className="mt-2 flex items-stretch gap-2">
        <label className="flex-1 min-w-0">
          <span className="sr-only">Effectif de l'entreprise</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={effectif}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Effectif (salariés)"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-amber-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
        <div className="shrink-0 w-28 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700/60 px-2 py-1 text-center flex flex-col justify-center">
          <p className="text-xl font-bold leading-tight tabular-nums text-slate-900 dark:text-white">
            {assujetti ? Math.floor(exact) : "—"}
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 ml-1">BOETH</span>
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
            {assujetti ? `${exact.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} arrondi` : "à employer"}
          </p>
        </div>
      </div>
      {saisi && !assujetti && (
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5">Moins de 20 salariés : pas d'obligation d'emploi OETH.</p>
      )}
    </div>
  );
}

export default function ArgumentaireContenu({ data, ligneSurlignee, compact = false }) {
  const [effectifRapide, setEffectifRapide] = useState("");

  if (!data) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Chargement de l'argumentaire…</p>;
  }

  // Ligne du barème correspondant à l'effectif tapé dans le calcul rapide
  // (prioritaire sur la mise en avant liée à la fiche ouverte).
  const effRapide = Number(effectifRapide);
  const ligneRapide =
    effectifRapide !== "" && effRapide >= 20
      ? data.bareme.find((l) => effRapide >= l.effectifMin && (l.effectifMax == null || effRapide <= l.effectifMax))
      : null;
  const ligneAffichee = ligneRapide || ligneSurlignee;

  return (
    <div className="text-sm">
      <div className={SECTION}>
        <CalculRapide effectif={effectifRapide} onChange={setEffectifRapide} />
      </div>

      <div className={SECTION}>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Qui sommes-nous ?</h3>
        <p className="text-slate-600 dark:text-slate-300">{data.quiSommesNous.texte}</p>
        <ul className="mt-1 space-y-0.5">
          {data.quiSommesNous.points.map((p) => (
            <li key={p} className="text-slate-600 dark:text-slate-300">
              → {p}
            </li>
          ))}
        </ul>
      </div>

      <div className={SECTION}>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Objectif</h3>
        <p className="text-slate-600 dark:text-slate-300">{data.objectif}</p>
      </div>

      <div className={SECTION}>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Quotas OETH</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Calcul : <strong>{data.calcul.formule}</strong>
        </p>
        <div className="space-y-1">
          {data.bareme.map((ligne) => {
            const surlignee =
              ligneAffichee &&
              ligneAffichee.effectifMin === ligne.effectifMin &&
              ligneAffichee.effectifMax === ligne.effectifMax;
            return (
              <div
                key={ligne.effectifMin}
                className={`flex items-center justify-between px-2 py-1 rounded-md ${
                  surlignee ? "bg-red-100 dark:bg-red-900/40 ring-1 ring-red-300 dark:ring-red-700" : ""
                }`}
              >
                <span className="text-slate-600 dark:text-slate-300">
                  {ligne.effectifMin}–{ligne.effectifMax ?? "+"}
                </span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                    surlignee
                      ? "bg-red-600 text-white"
                      : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                  }`}
                >
                  {ligne.unitesBeneficiaires} UB
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {!compact && (
        <div className={SECTION}>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Chronologie & dates clés</h3>
          <ul className="space-y-2 border-l-2 border-marine-200 dark:border-marine-900 pl-3">
            {data.chronologie.map((c, i) => (
              <li key={i}>
                <span className="inline-block text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded px-1.5 py-0.5 mr-1.5">
                  {c.annee}
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{c.titre}</span>
                <p className="text-xs text-slate-500 dark:text-slate-400">{c.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={SECTION}>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Pourquoi cette obligation ?</h3>
        <ul className="space-y-1.5">
          {data.pourquoiObligation.map((p, i) => (
            <li key={i} className="flex gap-2 text-slate-600 dark:text-slate-300">
              <span className="text-green-600 dark:text-green-400 shrink-0">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center font-bold uppercase tracking-wide text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-lg py-2 px-3 text-xs mt-4">
        {data.devise}
      </p>
    </div>
  );
}
