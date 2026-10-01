import { useEffect, useState } from "react";
import { api } from "../api.js";
import { estNumeroAffichable } from "../telephone.js";

async function appel(url, options) {
  const res = await fetch(url, options);
  const corps = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) throw new Error(corps.error || `Erreur HTTP ${res.status}`);
  return corps;
}

// « Rechercher d'autres numéros » : lance la recherche IA des numéros de
// l'entreprise en arrière-plan (voir server/src/rechercheNumerosFiche.js).
// L'agent peut appeler d'autres fiches pendant ce temps : les numéros trouvés
// s'ajoutent d'eux-mêmes à la fiche (numéros supplémentaires), et la fiche se
// met à jour dès la fin si elle est encore ouverte.
export default function BoutonRechercheNumeros({ entreprise, onMaj }) {
  const [etat, setEtat] = useState(null);
  const [erreur, setErreur] = useState(null);
  const url = `/api/entreprises/${entreprise.id}/recherche-numeros`;

  // Reprend l'affichage si une recherche tourne déjà pour cette fiche ; sinon,
  // fiche sans numéro : Claude cherche tout seul les numéros, e-mails et
  // contact RH dès l'ouverture (le serveur ne relance jamais une fiche déjà
  // cherchée).
  useEffect(() => {
    let annule = false;
    appel(url)
      .then(async (e) => {
        if (annule) return;
        setEtat(e);
        if (!e?.enCours && !estNumeroAffichable(entreprise.contact?.telephone) && !entreprise.rechercheTelephoneIA) {
          const lancement = await appel(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ auto: true }),
          });
          if (!annule && lancement?.enCours) setEtat(lancement);
        }
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprise.id]);

  useEffect(() => {
    if (!etat?.enCours) return;
    const id = setInterval(async () => {
      try {
        const e = await appel(url);
        setEtat(e);
        if (!e.enCours) onMaj?.(await api.getEntreprise(entreprise.id));
      } catch {
        // Tick manqué, on retente au prochain intervalle.
      }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat?.enCours, entreprise.id]);

  async function lancer() {
    setErreur(null);
    try {
      setEtat(await appel(url, { method: "POST" }));
    } catch (e) {
      setErreur(e.message);
    }
  }

  const fini = etat && !etat.enCours && etat.termine;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        onClick={lancer}
        disabled={etat?.enCours}
        className="inline-flex items-center gap-1.5 rounded-lg border border-marine-300 dark:border-marine-700 bg-marine-50 dark:bg-marine-950/40 text-marine-800 dark:text-marine-200 font-medium px-3 py-1.5 hover:bg-marine-100 dark:hover:bg-marine-900/50 disabled:opacity-60"
        title="Chercher sur le web tous les numéros de cette entreprise (standard, agences, RH…) et les ajouter à la fiche"
      >
        {etat?.enCours
          ? etat.auto
            ? "🔎 Claude cherche les numéros et e-mails de cette entreprise…"
            : "🔎 Recherche des numéros en cours…"
          : "🔎 Rechercher d'autres numéros"}
      </button>
      {etat?.enCours && (
        <span className="text-slate-500 dark:text-slate-400">
          30 s à 2 min — vous pouvez appeler d'autres fiches, les numéros s'ajouteront d'eux-mêmes.
        </span>
      )}
      {fini && !etat.erreur && (
        <span className={etat.nouveaux?.length ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}>
          {etat.nouveaux?.length
            ? `✓ ${etat.nouveaux.length} numéro${etat.nouveaux.length > 1 ? "s" : ""} ajouté${
                etat.nouveaux.length > 1 ? "s" : ""
              } : ${etat.nouveaux.join(", ")}${etat.contactRH ? ` · contact : ${etat.contactRH}` : ""}${
                etat.emails?.length ? ` · e-mail : ${etat.emails.join(", ")}` : ""
              }`
            : `Aucun nouveau numéro trouvé.${etat.emails?.length ? ` E-mail ajouté : ${etat.emails.join(", ")}.` : ""}`}
        </span>
      )}
      {(erreur || etat?.erreur) && <span className="text-red-600 dark:text-red-400">{erreur || etat.erreur}</span>}
    </div>
  );
}
