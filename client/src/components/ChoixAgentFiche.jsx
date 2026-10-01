import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { estAdmin } from "../roles.js";
import { diffuserEntrepriseMaj } from "../telephony/CallContext.jsx";
import SelecteurPersonne from "./SelecteurPersonne.jsx";

// "Agent assigné" en haut de la fiche. Agent : simple affichage. Administrateur :
// liste déroulante pour attribuer la fiche à quelqu'un d'autre (ou la
// retirer), notée dans l'historique de la fiche ; le nouvel agent reçoit
// l'alerte "nouveau lead" et Claude cherche le numéro s'il manque.
export default function ChoixAgentFiche({ entreprise, onMaj }) {
  const { utilisateur } = useAuth();
  const admin = estAdmin(utilisateur);
  const [equipe, setEquipe] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!admin) return;
    api
      .listUtilisateurs()
      .then((liste) => setEquipe(liste.filter((u) => u.statut === "valide")))
      .catch(() => setEquipe([]));
  }, [admin]);

  if (!admin || !equipe) {
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
        Agent assigné :{" "}
        {entreprise.assigneANom ? (
          <span className="font-medium text-marine-700 dark:text-marine-300">{entreprise.assigneANom}</span>
        ) : (
          <span className="font-medium text-slate-400 dark:text-slate-500">Non assigné</span>
        )}
      </span>
    );
  }

  async function changer(valeur) {
    const utilisateurId = valeur || null;
    setEnCours(true);
    setErreur(null);
    try {
      const maj = await api.assignerEntreprise(entreprise.id, utilisateurId);
      onMaj?.(maj);
      diffuserEntrepriseMaj(maj);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
      Agent assigné :
      <SelecteurPersonne
        personnes={equipe}
        moiId={utilisateur.id}
        valeur={entreprise.assigneA || ""}
        onChange={changer}
        disabled={enCours}
        optionsSpeciales={[{ valeur: "", label: "Non assigné" }]}
        placeholder="Non assigné"
        className="px-2 py-1 text-xs font-medium w-44"
      />
      {enCours && <span>…</span>}
      {erreur && <span className="text-red-600 dark:text-red-400">{erreur}</span>}
    </label>
  );
}
