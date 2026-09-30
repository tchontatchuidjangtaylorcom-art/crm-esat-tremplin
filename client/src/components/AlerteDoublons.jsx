import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { STATUTS } from "../constants.js";
import { jouerSonConfirmation } from "../sonConfirmation.js";
import { diffuserEntrepriseArchivee } from "../telephony/CallContext.jsx";

// Doublon probable : une autre fiche du CRM partage un numéro (ex. même
// standard pour deux sociétés d'un même groupe) ou le même SIREN — voir
// GET /api/entreprises/:id/doublons. L'agent peut ouvrir l'autre fiche ou
// marquer celle-ci comme doublon : elle sort du pipeline mais reste dans les
// archives, avec le lien vers la fiche conservée.
export default function AlerteDoublons({ entreprise, prenomAgent }) {
  const navigate = useNavigate();
  const [doublons, setDoublons] = useState([]);
  const [enCours, setEnCours] = useState(null);
  const [erreur, setErreur] = useState(null);

  const numeros = [entreprise.contact?.telephone, ...(entreprise.contact?.telephonesAlternatifs || []).map((t) => t.numero)]
    .filter(Boolean)
    .join("|");

  useEffect(() => {
    let annule = false;
    api
      .getDoublons(entreprise.id)
      .then((liste) => !annule && setDoublons(liste))
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [entreprise.id, numeros, entreprise.siret]);

  async function marquerDoublonDe(autre) {
    if (
      !window.confirm(
        `Marquer « ${entreprise.nom} » comme doublon de « ${autre.nom} » ?\nCette fiche sort du pipeline actif mais reste consultable dans les archives.`
      )
    ) {
      return;
    }
    setEnCours(autre.id);
    setErreur(null);
    try {
      const { entreprise: archivee } = await api.enregistrerSortie(entreprise.id, {
        sortie: "doublon",
        details: null,
        doublonDe: autre.id,
      });
      await api
        .ajouterCommentaire(entreprise.id, {
          texte: `Doublon de « ${autre.nom} » (${autre.raisons.join(", ")}). Fiche conservée dans les archives.`,
          auteur: prenomAgent,
        })
        .catch(() => {});
      jouerSonConfirmation();
      diffuserEntrepriseArchivee(archivee);
      // On continue sur la fiche conservée plutôt que de revenir au tableau.
      if (autre.accessible && !autre.archivee) navigate(`/entreprise/${autre.id}`);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  }

  // Fiche déjà marquée doublon : rappel de la fiche d'origine.
  if (entreprise.statut === "doublon") {
    const origine = doublons.find((d) => d.id === entreprise.doublonDe);
    return (
      <div className="mb-4 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/40 px-4 py-3 text-sm text-stone-700 dark:text-stone-300">
        👥 Cette fiche est marquée comme <strong>doublon</strong>
        {origine ? (
          <>
            {" "}
            de{" "}
            {origine.accessible ? (
              <button type="button" onClick={() => navigate(`/entreprise/${origine.id}`)} className="font-semibold underline">
                {origine.nom}
              </button>
            ) : (
              <strong>{origine.nom}</strong>
            )}
          </>
        ) : null}
        . Elle est conservée dans les archives.
      </div>
    );
  }

  if (doublons.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm">
      <p className="font-semibold text-amber-800 dark:text-amber-300">
        👥 Doublon possible : {doublons.length === 1 ? "une autre fiche" : `${doublons.length} autres fiches`} du CRM
        partage{doublons.length > 1 ? "nt" : ""} les mêmes coordonnées
      </p>
      <ul className="mt-2 space-y-1.5">
        {doublons.map((d) => {
          const statut = STATUTS[d.statut] || { label: d.statut, badge: "" };
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-slate-800 dark:text-slate-100">{d.nom}</span>
              {(d.codePostal || d.ville) && (
                <span className="text-xs text-slate-500 dark:text-slate-400">{[d.codePostal, d.ville].filter(Boolean).join(" ")}</span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statut.badge}`}>{statut.label}</span>
              {d.archivee && <span className="text-[10px] text-slate-500">archivée</span>}
              <span className="text-xs text-amber-700 dark:text-amber-400">— {d.raisons.join(", ")}</span>
              <span className="flex gap-1.5 ml-auto">
                {d.accessible && (
                  <button
                    type="button"
                    onClick={() => navigate(`/entreprise/${d.id}`)}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                  >
                    Ouvrir
                  </button>
                )}
                {entreprise.statut !== "doublon" && (
                  <button
                    type="button"
                    disabled={Boolean(enCours)}
                    onClick={() => marquerDoublonDe(d)}
                    className="rounded-lg bg-stone-700 hover:bg-stone-800 text-white px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                  >
                    {enCours === d.id ? "…" : "Marquer cette fiche comme doublon"}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {erreur && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erreur}</p>}
    </div>
  );
}
