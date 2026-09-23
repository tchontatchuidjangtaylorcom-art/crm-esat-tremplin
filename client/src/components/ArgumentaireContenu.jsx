// Contenu de l'affiche officielle du pôle AGEFIPH, partagé entre le panneau
// d'aide-mémoire (accessible partout via la barre d'outils) et la fiche
// entreprise (mise en avant contextuelle selon l'effectif du prospect en
// cours d'appel). Séparateurs violets (couleur associée à l'AGEFIPH) entre
// les sections, pour bien les distinguer d'un coup d'œil.
const SECTION = "py-4 first:pt-0 border-t border-purple-100 dark:border-purple-900/30 first:border-t-0";

export default function ArgumentaireContenu({ data, ligneSurlignee, compact = false }) {
  if (!data) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Chargement de l'argumentaire…</p>;
  }

  return (
    <div className="text-sm">
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
              ligneSurlignee &&
              ligneSurlignee.effectifMin === ligne.effectifMin &&
              ligneSurlignee.effectifMax === ligne.effectifMax;
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
          <ul className="space-y-2 border-l-2 border-purple-200 dark:border-purple-900 pl-3">
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
