import { useMemo } from "react";

// Flux d'activité "Entreprises en règle" du tableau de bord : entreprises du
// portefeuille visible (actives + archivées, déjà filtrées par visibilité
// agent/admin côté API) qui respectent ou dépassent leur quota légal OETH
// (déficit nul une fois assujetties — voir oeth.js), dédoublonnées par SIREN
// pour ne jamais afficher deux fois le même établissement (ex: plusieurs
// dossiers SIRET d'un même SIREN, ou un doublon actif/archivé).
function sirenDe(entreprise) {
  return entreprise.siret ? entreprise.siret.slice(0, 9) : entreprise.id;
}

// Date la plus pertinente pour trier le flux du plus récent au plus ancien :
// la sortie "conforme" journalisée (passage effectif en règle) si elle
// existe, sinon la date de création du dossier — à défaut d'un vrai
// horodatage de mise en conformité déclaratif.
function dateActivite(entreprise) {
  const sortie = (entreprise.historiqueAppels || []).find((h) => h.type === "sortie" && h.issue === "conforme");
  return sortie?.date || entreprise.dateCreation || null;
}

// Aucune API publique fiable ne fournit l'URL du site officiel d'une
// entreprise (Sirene/recherche-entreprises ne renseigne que des données
// légales) : plutôt que de deviner un domaine et risquer de renvoyer vers le
// mauvais site, on ouvre une recherche ciblée que l'agent peut valider en un
// clic. Si l'agent a renseigné le site sur la fiche (voir EntrepriseDetail),
// on l'utilise directement.
function urlCible(entreprise) {
  if (entreprise.siteWeb) return entreprise.siteWeb;
  const requete = `${entreprise.nom} ${entreprise.ville || ""} site officiel`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(requete)}`;
}

export default function FluxConformite({ entreprises, archives }) {
  const enRegle = useMemo(() => {
    const vus = new Set();
    const liste = [];
    for (const e of [...(entreprises || []), ...(archives || [])]) {
      if (!e.oeth?.assujetti || !e.oeth?.conforme) continue;
      const siren = sirenDe(e);
      if (vus.has(siren)) continue;
      vus.add(siren);
      liste.push(e);
    }
    liste.sort((a, b) => new Date(dateActivite(b) || 0) - new Date(dateActivite(a) || 0));
    return liste;
  }, [entreprises, archives]);

  if (enRegle.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3 mb-4">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Entreprises en règle — quota OETH atteint ou dépassé
        </h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">({enRegle.length})</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {enRegle.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => window.open(urlCible(e), "_blank", "noopener,noreferrer")}
            title={`Ouvrir le site de ${e.nom} dans un nouvel onglet`}
            className="shrink-0 flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition px-3 py-2 text-left max-w-[260px]"
          >
            <span className="text-emerald-600 dark:text-emerald-400 text-base leading-none shrink-0" aria-hidden>
              ✓
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{e.nom}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {e.ville ? `${e.ville} · ` : ""}
                {e.oeth.beneficiairesRecrutes}/{e.oeth.unitesRequises} unités bénéficiaires
              </span>
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-3.5 h-3.5 shrink-0 text-emerald-500 dark:text-emerald-400"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
