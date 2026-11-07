import { useState } from "react";
import { api } from "../api.js";

// Équipe (bureau) d'un compte — Cameroun, Paris… (voir server/src/equipes.js).
// Sélection UNIQUE, contrairement aux espaces (EspacesCompte.jsx) qui
// peuvent être multiples : un manager voit alors toutes les fiches de cette
// équipe, un agent y voit les siennes et les nouveaux leads qu'on lui
// assigne y sont rattachés automatiquement.
export default function EquipeCompte({ utilisateur, equipes, onMaj }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  if (!equipes?.length) return null;

  async function changer(ev) {
    const equipeId = ev.target.value || null;
    setEnCours(true);
    setErreur(null);
    try {
      const donnees = await api.definirEquipeUtilisateur(utilisateur.id, equipeId);
      onMaj?.({ ...utilisateur, equipeId: donnees.equipeId });
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <span className="mt-1 flex items-center gap-1">
      <select
        value={utilisateur.equipeId || ""}
        onChange={changer}
        disabled={enCours}
        title="Équipe (bureau) de ce compte"
        className="text-[11px] rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-2 py-0.5 disabled:opacity-50"
      >
        <option value="">Aucune équipe</option>
        {equipes.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nom}
          </option>
        ))}
      </select>
      {erreur && <span className="text-[11px] text-red-600 dark:text-red-400">{erreur}</span>}
    </span>
  );
}
