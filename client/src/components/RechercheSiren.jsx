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
    // Tolère un SIRET complet (14 chiffres) collé à la place d'un SIREN, ainsi
    // que les espaces/points/tirets copiés depuis un Kbis ou une signature de
    // mail — n'importe quel caractère non numérique est simplement retiré
    // avant validation (même logique que normaliserSiren côté serveur).
    const chiffres = siren.replace(/\D/g, "");
    const propre = chiffres.length === 14 ? chiffres.slice(0, 9) : chiffres;
    if (!/^\d{9}$/.test(propre)) {
      setMessage({ type: "error", texte: "Le SIREN doit comporter 9 chiffres (ou 14 pour un SIRET complet)." });
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
      className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-4 py-3"
    >
      {/* Sur une seule ligne : libellé, champ et bouton côte à côte. */}
      <label
        className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
        title="Enrichissement automatique depuis le répertoire Sirene (INSEE)"
      >
        <span className="whitespace-nowrap">Nouveau lead par SIREN</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="9 chiffres (SIREN) ou 14 (SIRET) — ex : 552100554"
          value={siren}
          onChange={(e) => setSiren(e.target.value)}
          maxLength={20}
          className="w-64 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={enCours}
        className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium px-4 py-2 disabled:opacity-40"
      >
        {enCours ? "Recherche…" : "Rechercher"}
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
