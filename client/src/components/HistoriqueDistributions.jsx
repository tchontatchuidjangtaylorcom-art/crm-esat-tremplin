import { useEffect, useState } from "react";

function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function requete(url, options) {
  const res = await fetch(url, options);
  const corps = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(corps.error || `Erreur HTTP ${res.status}`);
  return corps;
}

// Dernières distributions d'équipe, avec la possibilité d'en annuler une faite
// par erreur : chaque fiche encore intacte (toujours chez l'agent qui l'a
// reçue, toujours en « Nouveau ») est rendue à son agent et à son statut
// d'avant — voir /api/equipe/distributions côté serveur.
export default function HistoriqueDistributions({ version, onAnnule }) {
  const [ouvert, setOuvert] = useState(false);
  const [lots, setLots] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(null);
  const [resultat, setResultat] = useState(null);

  function charger() {
    requete("/api/equipe/distributions")
      .then((l) => {
        setLots(l);
        setErreur(null);
      })
      .catch((e) => setErreur(e.message));
  }

  useEffect(() => {
    if (ouvert) charger();
  }, [ouvert, version]);

  async function annuler(lot) {
    const destinataires = lot.agents.map((a) => `${a.nom} (${a.nb})`).join(", ");
    if (
      !window.confirm(
        `Annuler la distribution du ${formatDate(lot.date)} (${lot.total} fiche${lot.total > 1 ? "s" : ""} → ${destinataires}) ?\n` +
          `Les ${lot.annulables} fiche${lot.annulables > 1 ? "s" : ""} encore intacte${lot.annulables > 1 ? "s" : ""} seront rendues à leur agent et à leur statut d'avant.`
      )
    ) {
      return;
    }
    setEnCours(lot.cle);
    setResultat(null);
    setErreur(null);
    try {
      const r = await requete("/api/equipe/distributions/annuler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cle: lot.cle }),
      });
      setResultat(r);
      onAnnule?.();
      charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">↩︎ Dernières distributions (annuler une erreur)</span>
        <span className="text-xs text-slate-400">{ouvert ? "▲" : "▼"}</span>
      </button>

      {ouvert && (
        <div className="px-4 pb-4 space-y-2 text-sm">
          {erreur && <p className="text-red-600 dark:text-red-400">{erreur}</p>}
          {!lots && !erreur && <p className="text-slate-400">Chargement…</p>}
          {lots?.length === 0 && <p className="text-slate-400">Aucune distribution trouvée.</p>}

          {resultat && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-emerald-800 dark:text-emerald-300">
              ✓ {resultat.rendues.length} fiche{resultat.rendues.length > 1 ? "s" : ""} rendue{resultat.rendues.length > 1 ? "s" : ""} à
              leur agent d'avant.
              {resultat.ignorees.length > 0 && (
                <details className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  <summary className="cursor-pointer">
                    {resultat.ignorees.length} laissée{resultat.ignorees.length > 1 ? "s" : ""} telle{resultat.ignorees.length > 1 ? "s" : ""} quelle
                    {resultat.ignorees.length > 1 ? "s" : ""} (déjà traitée, réattribuée…)
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {resultat.ignorees.map((f, i) => (
                      <li key={i}>
                        {f.nom} — {f.raison}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {lots?.map((lot) => (
            <div key={lot.cle} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {formatDate(lot.date)} — {lot.total} fiche{lot.total > 1 ? "s" : ""} par {lot.par}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  → {lot.agents.map((a) => `${a.nom} (${a.nb})`).join(", ")}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Provenance : {lot.provenances.map((p) => `${p.libelle} (${p.nb})`).join(" · ")}
                </p>
              </div>
              <button
                type="button"
                disabled={lot.annulables === 0 || Boolean(enCours)}
                onClick={() => annuler(lot)}
                title={lot.annulables === 0 ? "Toutes les fiches ont déjà été traitées ou réattribuées" : ""}
                className="shrink-0 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-1.5 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40"
              >
                {enCours === lot.cle ? "Annulation…" : lot.annulables === 0 ? "Plus rien à annuler" : `Annuler (${lot.annulables})`}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
