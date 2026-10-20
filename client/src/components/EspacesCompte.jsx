import { useState } from "react";

const estAdminRole = (role) => role === "admin" || role === "super_admin";

// Espaces de travail d'un compte (Gestion des accès) : un clic sur une
// pastille ouvre ou ferme l'espace pour ce compte. Les administrateurs ont
// toujours accès à tous les espaces ; un agent garde au moins un espace.
export default function EspacesCompte({ utilisateur, espaces, onMaj }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  if (!espaces?.length || espaces.length < 2) return null;

  if (estAdminRole(utilisateur.role)) {
    return <span className="block mt-1 text-[11px] text-slate-400 dark:text-slate-500">Tous les espaces</span>;
  }

  const actuels = Array.isArray(utilisateur.espaces) && utilisateur.espaces.length ? utilisateur.espaces : ["oeth"];

  async function basculer(id) {
    const suivants = actuels.includes(id) ? actuels.filter((x) => x !== id) : [...actuels, id];
    if (suivants.length === 0) return setErreur("Au moins un espace.");
    setEnCours(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/utilisateurs/${utilisateur.id}/espaces`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ espaces: suivants }),
      });
      const donnees = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(donnees.error || `Erreur HTTP ${res.status}`);
      onMaj?.({ ...utilisateur, espaces: donnees.espaces });
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {espaces.map((e) => {
        const actif = actuels.includes(e.id);
        return (
          <button
            key={e.id}
            type="button"
            disabled={enCours}
            onClick={() => basculer(e.id)}
            title={actif ? `Retirer l'accès à ${e.nom}` : `Donner accès à ${e.nom}`}
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition disabled:opacity-50 ${
              actif
                ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 line-through"
            }`}
          >
            {actif ? "✓ " : ""}
            {e.court || e.nom}
          </button>
        );
      })}
      {erreur && <span className="text-[11px] text-red-600 dark:text-red-400">{erreur}</span>}
    </span>
  );
}
