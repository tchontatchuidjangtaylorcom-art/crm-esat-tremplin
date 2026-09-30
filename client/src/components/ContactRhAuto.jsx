import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

// Recherche automatique du contact RH à l'ouverture d'une fiche qui n'a pas
// encore de nom de contact (voir POST /api/entreprises/:id/contact-rh-auto) :
// l'agent n'a plus à demander le nom au standard. Tourne en arrière-plan,
// une seule fois par fiche ; le résultat (nom, fonction, e-mail, ligne
// directe) est enregistré directement sur la fiche.
export default function ContactRhAuto({ entreprise, onMaj }) {
  const [etat, setEtat] = useState(null); // null | "recherche" | { trouve, contact } | { erreur }
  const lance = useRef(new Set());

  const sansNom = !entreprise.contact?.nom || entreprise.contact.nom === "-";
  const aRechercher = sansNom && !entreprise.rechercheContactRH;

  useEffect(() => {
    if (!aRechercher || lance.current.has(entreprise.id)) return;
    lance.current.add(entreprise.id);
    let annule = false;
    setEtat("recherche");
    api
      .rechercherContactRhAuto(entreprise.id)
      .then((r) => {
        if (annule) return;
        if (r.entreprise) onMaj?.(r.entreprise);
        setEtat(r.lance ? { trouve: r.trouve, contact: r.contact } : null);
      })
      .catch((e) => !annule && setEtat({ erreur: e.message }));
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprise.id, aRechercher]);

  if (!etat) return null;

  if (etat === "recherche") {
    return (
      <p className="mb-3 text-sm text-marine-700 dark:text-marine-300 flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-full border-2 border-marine-400 border-t-transparent animate-spin" aria-hidden />
        Claude cherche le contact RH de cette entreprise (nom, fonction, e-mail)…
      </p>
    );
  }

  if (etat.erreur) {
    return (
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Recherche automatique du contact RH indisponible pour le moment ({etat.erreur}) — nouvel essai à la prochaine
        ouverture de la fiche.
      </p>
    );
  }

  if (!etat.trouve) {
    return (
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Aucun contact RH publié n'a été trouvé automatiquement : demandez le nom au standard, ou utilisez l'assistant
        « Contact nominatif » de l'Espace IA.
      </p>
    );
  }

  const c = etat.contact || {};
  return (
    <p className="mb-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
      ✓ Contact RH trouvé par l'IA et enregistré sur la fiche : <strong>{c.nom}</strong>
      {c.role ? ` — ${c.role}` : ""}
      {c.email ? ` — ${c.email}` : ""}
      {c.telephone ? ` — ligne directe ${c.telephone}` : ""}
      <span className="text-emerald-600 dark:text-emerald-400"> (à vérifier au premier appel)</span>
    </p>
  );
}
