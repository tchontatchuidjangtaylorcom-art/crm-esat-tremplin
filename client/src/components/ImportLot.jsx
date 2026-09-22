import { useState } from "react";
import { api } from "../api.js";

// Import d'une vague de prospection (Lot 1, Lot 2…) à partir d'une liste de
// SIREN. Replié par défaut pour ne pas surcharger le tableau de bord — la
// recherche unitaire par SIREN reste le geste principal et rapide.
export default function ImportLot({ onImporte }) {
  const [ouvert, setOuvert] = useState(false);
  const [lot, setLot] = useState("");
  const [sirensTexte, setSirensTexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);

  async function soumettre(ev) {
    ev.preventDefault();
    const sirens = sirensTexte
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!lot.trim()) {
      setErreur("Merci de nommer ce lot (ex : « Lot 3 »).");
      return;
    }
    if (sirens.length === 0) {
      setErreur("Collez au moins un SIREN (un par ligne).");
      return;
    }

    setEnCours(true);
    setErreur(null);
    setResultat(null);
    try {
      const reponse = await api.importerLot(lot.trim(), sirens);
      setResultat(reponse.resultats);
      onImporte?.();
      setSirensTexte("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  const compteurs = resultat?.reduce(
    (acc, r) => ({ ...acc, [r.statut]: (acc[r.statut] || 0) + 1 }),
    {}
  );

  return (
    <div className="mb-6 bg-white border border-slate-200 rounded-xl shadow-sm">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 flex items-center justify-between"
      >
        <span>+ Importer un lot d'entreprises (par SIREN, vague de prospection)</span>
        <span className="text-slate-400">{ouvert ? "▲" : "▼"}</span>
      </button>

      {ouvert && (
        <form onSubmit={soumettre} className="px-4 pb-4 space-y-3">
          <label className="block text-xs text-slate-500">
            Nom du lot
            <input
              type="text"
              placeholder="Ex : Lot 3 — Octobre"
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-xs text-slate-500">
            Liste de SIREN (un par ligne, jusqu'à 100)
            <textarea
              value={sirensTexte}
              onChange={(e) => setSirensTexte(e.target.value)}
              placeholder={"552100554\n214401093\n..."}
              rows={5}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </label>

          <button
            type="submit"
            disabled={enCours}
            className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
          >
            {enCours ? "Import en cours…" : "Importer le lot"}
          </button>

          {erreur && <p className="text-sm text-red-600">{erreur}</p>}

          {resultat && (
            <div className="text-sm text-slate-600 space-y-2">
              <p>
                {compteurs.cree || 0} créé{(compteurs.cree || 0) > 1 ? "s" : ""} ·{" "}
                {compteurs.existant || 0} déjà existant{(compteurs.existant || 0) > 1 ? "s" : ""} ·{" "}
                {compteurs.radiee || 0} radié{(compteurs.radiee || 0) > 1 ? "s" : ""} (archivé
                {(compteurs.radiee || 0) > 1 ? "s" : ""}) · {compteurs.erreur || 0} erreur
                {(compteurs.erreur || 0) > 1 ? "s" : ""}
              </p>
              {compteurs.erreur > 0 && (
                <ul className="text-xs text-red-600 list-disc list-inside">
                  {resultat
                    .filter((r) => r.statut === "erreur")
                    .map((r) => (
                      <li key={r.siren}>
                        {r.siren} : {r.erreur}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
