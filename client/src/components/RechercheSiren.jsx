import { useState } from "react";
import { api } from "../api.js";

// Saisie rapide d'un SIREN : déduplication, puis enrichissement + qualification
// automatique via le répertoire Sirene (INSEE). La fiche résultante s'ouvre
// dans un nouvel onglet pour ne pas perdre le tableau de bord en cours.
export default function RechercheSiren({ onEntreprise }) {
  const [siren, setSiren] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function soumettre(ev) {
    ev.preventDefault();
    const propre = siren.replace(/\s/g, "");
    if (!/^\d{9}$/.test(propre)) {
      setMessage({ type: "error", texte: "Le SIREN doit comporter exactement 9 chiffres." });
      return;
    }

    setEnCours(true);
    setMessage(null);
    try {
      const resultat = await api.rechercherSiren(propre);
      onEntreprise?.(resultat.entreprise, resultat.existant, resultat.archive);
      setMessage({
        type: "success",
        texte: resultat.existant
          ? `Fiche déjà existante pour ${resultat.entreprise.nom} — ouverture dans un nouvel onglet.`
          : resultat.archive
          ? `${resultat.entreprise.nom} est radiée d'après le Sirene : dossier archivé automatiquement, aucune action requise.`
          : `Lead créé et qualifié automatiquement : ${resultat.entreprise.nom} (${resultat.entreprise.collecteur}).`,
      });
      window.open(`/entreprise/${resultat.entreprise.id}`, "_blank", "noopener,noreferrer");
      setSiren("");
    } catch (e) {
      setMessage({ type: "error", texte: e.message });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form
      onSubmit={soumettre}
      className="flex flex-wrap items-end gap-3 mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-4"
    >
      <label className="text-xs text-slate-500 dark:text-slate-400">
        Nouveau lead par SIREN (enrichissement automatique — répertoire Sirene INSEE)
        <input
          type="text"
          inputMode="numeric"
          placeholder="9 chiffres, ex : 552100554"
          value={siren}
          onChange={(e) => setSiren(e.target.value)}
          maxLength={11}
          className="mt-1 w-64 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={enCours}
        className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium px-4 py-2 disabled:opacity-40"
      >
        {enCours ? "Recherche…" : "Rechercher & qualifier"}
      </button>
      {message && (
        <span
          className={`text-sm ${message.type === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
        >
          {message.texte}
        </span>
      )}
    </form>
  );
}
