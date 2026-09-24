import { useState } from "react";
import { STATUTS, STATUTS_ARCHIVES } from "../constants.js";
import { api } from "../api.js";
import { diffuserEntrepriseMaj, diffuserEntrepriseArchivee } from "../telephony/CallContext.jsx";

// Badge de statut cliquable dans le tableau principal : un <select> natif
// habillé aux couleurs du badge (mêmes classes que StatusBadge, utilisé sur
// la fiche détaillée — un seul statut pointe vers un seul jeu de couleurs)
// plutôt qu'un menu maison en position absolue, pour ne jamais se faire
// couper par le défilement horizontal du tableau (overflow-x-auto) : un
// <select> natif s'affiche toujours par-dessus, quel que soit son parent.
// Réutilise la même route que le changement de statut groupé (une sélection
// d'un seul dossier) — donc la même règle d'archivage automatique sur
// conforme/refus/mort, avec la même confirmation qu'à la sélection multiple.
export default function StatusSelect({ entreprise }) {
  const [enCours, setEnCours] = useState(false);
  const info = STATUTS[entreprise.statut] || {
    label: entreprise.statut,
    badge: "bg-gray-100 text-gray-700 border border-gray-300",
  };

  async function changer(ev) {
    ev.stopPropagation();
    const nouveauStatut = ev.target.value;
    if (!nouveauStatut || nouveauStatut === entreprise.statut) return;

    if (
      STATUTS_ARCHIVES.includes(nouveauStatut) &&
      !window.confirm(
        `Passer « ${entreprise.nom} » au statut "${STATUTS[nouveauStatut].label}" ? Ce statut archive automatiquement le dossier (hors pipeline actif).`
      )
    ) {
      ev.target.value = entreprise.statut;
      return;
    }

    setEnCours(true);
    try {
      const { archive, entreprises } = await api.changerStatutGroupe([entreprise.id], nouveauStatut);
      const maj = entreprises[0];
      if (archive) diffuserEntrepriseArchivee(maj);
      else diffuserEntrepriseMaj(maj);
    } catch (e) {
      ev.target.value = entreprise.statut;
      window.alert(`Impossible de changer le statut : ${e.message}`);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="relative inline-block">
      <select
        value={entreprise.statut}
        onChange={changer}
        onClick={(ev) => ev.stopPropagation()}
        disabled={enCours}
        title="Changer le statut"
        className={`appearance-none cursor-pointer pl-2.5 pr-5 py-1 rounded-full text-xs font-semibold whitespace-nowrap disabled:opacity-50 ${info.badge}`}
      >
        {Object.entries(STATUTS).map(([cle, i]) => (
          <option key={cle} value={cle} className="bg-white text-slate-800">
            {i.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] opacity-60">▾</span>
    </div>
  );
}
