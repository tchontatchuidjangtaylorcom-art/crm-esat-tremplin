import { useEffect, useState } from "react";

const INTERVALLE_MS = 6000;

// Aucune API publique fiable ne fournit l'URL du site d'une entreprise, donc
// on ouvre son site s'il a été renseigné sur la fiche (voir EntrepriseDetail.jsx),
// sinon une recherche ciblée plutôt qu'un domaine deviné.
function urlCible(entreprise) {
  if (entreprise.siteWeb) return entreprise.siteWeb;
  const requete = `${entreprise.nom} ${entreprise.ville || ""} site officiel`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(requete)}`;
}

// Notification toast discrète en bas à gauche, qui fait défiler les
// entreprises ayant consenti à être citées publiquement (voir /api/vitrine).
// Ne s'affiche que s'il y a au moins une entreprise réelle à montrer —
// jamais de contenu fictif.
export default function ToastActivite({ entreprises }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (entreprises.length <= 1) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % entreprises.length);
        setVisible(true);
      }, 300);
    }, INTERVALLE_MS);
    return () => clearInterval(id);
  }, [entreprises.length]);

  if (entreprises.length === 0) return null;
  const entreprise = entreprises[index];

  return (
    <div className="fixed bottom-5 left-5 z-40 max-w-[300px]" aria-live="polite">
      {visible && (
        <button
          type="button"
          onClick={() => window.open(urlCible(entreprise), "_blank", "noopener,noreferrer")}
          title={`Ouvrir le site de ${entreprise.nom}`}
          className="animate-toast-slide-in flex items-start gap-2.5 text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-xl px-4 py-3 hover:shadow-xl transition-shadow"
        >
          <span className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
          <span>
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{entreprise.nom}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {entreprise.ville ? `${entreprise.ville} · ` : ""}en conformité OETH ({entreprise.beneficiairesRecrutes}/{entreprise.unitesRequises}{" "}
              unités bénéficiaires)
            </span>
            <span className="block text-[11px] text-marine-600 dark:text-marine-300 mt-1 font-medium">
              Voir le site officiel →
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
