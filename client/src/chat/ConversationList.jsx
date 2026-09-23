import { useState } from "react";
import { useChat } from "./ChatContext.jsx";
import { formatDateHeure } from "../constants.js";

function CanalItem({ canal, actif, compact, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2 ${
        actif ? "bg-slate-100 dark:bg-slate-700" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
          {canal.type === "general" ? "📢 " : ""}
          {canal.nom}
        </p>
        {!compact && canal.dernierMessage && (
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
            {canal.dernierMessage.texte}
            <span className="ml-1">· {formatDateHeure(canal.dernierMessage.date)}</span>
          </p>
        )}
      </div>
      {canal.nonLus > 0 && (
        <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold">
          {canal.nonLus}
        </span>
      )}
    </button>
  );
}

// Liste des canaux avec deux onglets ("Groupes" — général + groupes d'équipe
// — et "Privés" — conversations directes), plus les actions de création :
// nouveau groupe (choix libre des membres) et nouveau message privé (choix
// d'un collègue). Composant partagé par le widget flottant et la page /chat.
export default function ConversationList({ canalActifId, onSelect, compact = false }) {
  const { canaux, collegues, creerGroupe, ouvrirPrive } = useChat();
  const [onglet, setOnglet] = useState("groupes");
  const [creationGroupe, setCreationGroupe] = useState(false);
  const [nomGroupe, setNomGroupe] = useState("");
  const [membresChoisis, setMembresChoisis] = useState([]);
  const [enregistrement, setEnregistrement] = useState(false);

  const groupes = canaux.filter((c) => c.type === "general" || c.type === "groupe");
  const prives = canaux.filter((c) => c.type === "prive");

  async function validerCreationGroupe(ev) {
    ev.preventDefault();
    if (!nomGroupe.trim() || membresChoisis.length === 0) return;
    setEnregistrement(true);
    try {
      const canal = await creerGroupe(nomGroupe.trim(), membresChoisis);
      setCreationGroupe(false);
      setNomGroupe("");
      setMembresChoisis([]);
      onSelect?.(canal.id);
    } finally {
      setEnregistrement(false);
    }
  }

  async function demarrerConversation(ev) {
    const utilisateurId = ev.target.value;
    if (!utilisateurId) return;
    const canal = await ouvrirPrive(utilisateurId);
    onSelect?.(canal.id);
    ev.target.value = "";
  }

  function basculerMembre(id) {
    setMembresChoisis((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-slate-200 dark:border-slate-700 text-sm">
        <button
          onClick={() => setOnglet("groupes")}
          className={`flex-1 px-3 py-2 font-medium ${
            onglet === "groupes"
              ? "text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          Groupes
        </button>
        <button
          onClick={() => setOnglet("prives")}
          className={`flex-1 px-3 py-2 font-medium ${
            onglet === "prives"
              ? "text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          Privés
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {onglet === "groupes" && (
          <>
            {groupes.map((c) => (
              <CanalItem
                key={c.id}
                canal={c}
                actif={c.id === canalActifId}
                compact={compact}
                onClick={() => onSelect?.(c.id)}
              />
            ))}
            {creationGroupe ? (
              <form onSubmit={validerCreationGroupe} className="p-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Nom du groupe (ex : Équipe Lyon)"
                  value={nomGroupe}
                  onChange={(e) => setNomGroupe(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
                />
                <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
                  {collegues.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={membresChoisis.includes(c.id)}
                        onChange={() => basculerMembre(c.id)}
                      />
                      {c.prenom || c.email}
                    </label>
                  ))}
                  {collegues.length === 0 && <p className="text-xs text-slate-400">Aucun autre agent pour l'instant.</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={enregistrement || !nomGroupe.trim() || membresChoisis.length === 0}
                    className="flex-1 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium py-1.5 disabled:opacity-40"
                  >
                    Créer
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationGroupe(false)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setCreationGroupe(true)}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                + Nouveau groupe
              </button>
            )}
          </>
        )}

        {onglet === "prives" && (
          <>
            {prives.map((c) => (
              <CanalItem
                key={c.id}
                canal={c}
                actif={c.id === canalActifId}
                compact={compact}
                onClick={() => onSelect?.(c.id)}
              />
            ))}
            <div className="p-3 border-t border-slate-100 dark:border-slate-700">
              <select
                defaultValue=""
                onChange={demarrerConversation}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
              >
                <option value="" disabled>
                  + Nouveau message à…
                </option>
                {collegues.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.prenom || c.email}
                  </option>
                ))}
              </select>
            </div>
            {prives.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">Aucune conversation privée pour l'instant.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
