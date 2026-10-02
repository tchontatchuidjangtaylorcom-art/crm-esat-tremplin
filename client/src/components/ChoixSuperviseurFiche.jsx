import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { estAdmin, estSuperviseur } from "../roles.js";
import { diffuserEntrepriseMaj } from "../telephony/CallContext.jsx";

// Lead partagé agent + superviseur : l'agent garde la fiche (il sait quel
// superviseur suit son lead), le superviseur la prend en charge (il sait de
// quel agent elle vient). Affiché à tous à côté de « Agent assigné ».
//  - Superviseur : « 🤝 Prendre ce lead » (ou « Rendre ») ;
//  - Administrateur : liste des superviseurs pour en désigner un.
export default function ChoixSuperviseurFiche({ entreprise, onMaj }) {
  const { utilisateur } = useAuth();
  const admin = estAdmin(utilisateur);
  const superviseur = estSuperviseur(utilisateur);
  const [superviseurs, setSuperviseurs] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!admin) return;
    api
      .listUtilisateurs()
      .then((l) =>
        setSuperviseurs(
          l
            .filter((u) => u.statut === "valide" && (u.role === "superviseur" || u.role === "admin" || u.role === "super_admin"))
            .sort((a, b) => (a.role === "superviseur" ? 0 : 1) - (b.role === "superviseur" ? 0 : 1) || `${a.prenom}`.localeCompare(`${b.prenom}`, "fr"))
        )
      )
      .catch(() => {});
  }, [admin]);

  async function definir(utilisateurId) {
    setEnCours(true);
    setErreur(null);
    try {
      const maj = await api.definirSuperviseur(entreprise.id, utilisateurId);
      onMaj?.(maj);
      diffuserEntrepriseMaj(maj);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  const nom = (u) => [u.prenom, u.nom].filter(Boolean).join(" ") || u.email;
  const libelle = (
    <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
      🤝 Superviseur :{" "}
      {entreprise.superviseurNom ? (
        <span className="font-medium text-violet-700 dark:text-violet-300">{entreprise.superviseurNom}</span>
      ) : (
        <span className="font-medium text-slate-400 dark:text-slate-500">aucun</span>
      )}
    </span>
  );

  if (admin) {
    return (
      <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
        🤝 Superviseur :
        <select
          value={entreprise.superviseurId || ""}
          onChange={(e) => definir(e.target.value || null)}
          disabled={enCours}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-medium text-violet-700 dark:text-violet-300 disabled:opacity-50"
        >
          <option value="">Aucun</option>
          {superviseurs.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id === utilisateur.id ? `Moi (${nom(u)})` : nom(u)}
              {u.role !== "superviseur" ? " — admin" : ""}
            </option>
          ))}
        </select>
        {erreur && <span className="text-red-600 dark:text-red-400">{erreur}</span>}
      </label>
    );
  }

  if (superviseur) {
    const estLeMien = entreprise.superviseurId === utilisateur.id;
    return (
      <span className="inline-flex items-center gap-1.5">
        {libelle}
        {!entreprise.superviseurId && (
          <button
            type="button"
            onClick={() => definir(utilisateur.id)}
            disabled={enCours}
            className="rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium px-2.5 py-0.5 disabled:opacity-50"
          >
            🤝 Prendre ce lead
          </button>
        )}
        {estLeMien && (
          <button
            type="button"
            onClick={() => window.confirm("Ne plus suivre ce lead ?") && definir(null)}
            disabled={enCours}
            className="text-xs text-slate-500 hover:underline"
          >
            Rendre
          </button>
        )}
        {erreur && <span className="text-xs text-red-600 dark:text-red-400">{erreur}</span>}
      </span>
    );
  }

  return libelle;
}
