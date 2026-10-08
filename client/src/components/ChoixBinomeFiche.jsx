import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { estAdmin } from "../roles.js";
import { diffuserEntrepriseMaj } from "../telephony/CallContext.jsx";
import SelecteurPersonne from "./SelecteurPersonne.jsx";

const LIBELLE_ROLE = { superviseur: "superviseur", admin: "admin", super_admin: "admin" };

// Binôme d'une fiche : l'agent assigné (ou un administrateur) confie aussi la
// fiche à un collègue — agent occupé ou indisponible, lead à faire suivre par
// un superviseur… La fiche reste aux DEUX : l'agent la garde dans sa liste,
// le binôme la voit dans la sienne, peut appeler et reçoit les alertes de
// rappel / RDV. Le binôme peut se retirer lui-même (« Ne plus seconder »).
export default function ChoixBinomeFiche({ entreprise, onMaj }) {
  const { utilisateur } = useAuth();
  const admin = estAdmin(utilisateur);
  const estAssigne = entreprise.assigneA === utilisateur.id;
  const estBinome = entreprise.binomeId === utilisateur.id;
  const peutChoisir = admin || estAssigne;
  const [collegues, setCollegues] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!peutChoisir) return;
    api
      .listCollegues()
      .then((l) => setCollegues(l))
      .catch(() => {});
  }, [peutChoisir]);

  async function definir(utilisateurId) {
    setEnCours(true);
    setErreur(null);
    try {
      const maj = await api.definirBinome(entreprise.id, utilisateurId);
      onMaj?.(maj);
      diffuserEntrepriseMaj(maj);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  if (peutChoisir) {
    // L'agent assigné ne peut pas être son propre binôme.
    const personnes = collegues
      .filter((c) => c.id !== entreprise.assigneA)
      .map((c) => ({ ...c, prenom: LIBELLE_ROLE[c.role] ? `${c.prenom || ""} (${LIBELLE_ROLE[c.role]})`.trim() : c.prenom }));
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
        👥 Binôme :
        <SelecteurPersonne
          personnes={personnes}
          valeur={entreprise.binomeId || ""}
          onChange={(id) => {
            if ((id || null) === (entreprise.binomeId || null)) return;
            definir(id || null);
          }}
          optionsSpeciales={[{ valeur: "", label: "Aucun" }]}
          placeholder="Aucun"
          disabled={enCours}
          titre="Confier aussi cette fiche à un collègue : elle reste dans votre liste et dans la sienne"
          className="min-w-[9rem] px-2 py-1 text-xs font-medium text-teal-700 dark:text-teal-300"
        />
        {erreur && <span className="text-red-600 dark:text-red-400">{erreur}</span>}
      </span>
    );
  }

  if (!entreprise.binomeId) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
      👥 Binôme : <span className="font-medium text-teal-700 dark:text-teal-300">{entreprise.binomeNom}</span>
      {estBinome && entreprise.assigneANom && <span>(fiche de {entreprise.assigneANom})</span>}
      {estBinome && (
        <button
          type="button"
          onClick={() => window.confirm("Ne plus seconder cette fiche ? Elle restera à l'agent assigné.") && definir(null)}
          disabled={enCours}
          className="text-slate-500 hover:underline disabled:opacity-50"
        >
          Ne plus seconder
        </button>
      )}
      {erreur && <span className="text-red-600 dark:text-red-400">{erreur}</span>}
    </span>
  );
}
