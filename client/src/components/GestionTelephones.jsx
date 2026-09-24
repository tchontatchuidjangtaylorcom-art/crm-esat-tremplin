import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import BoutonAppel from "../telephony/BoutonAppel.jsx";

function idUnique() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Gestion à chaud des numéros de téléphone d'une entreprise — utilisée à la
// fois sur la fiche entreprise (toujours visible, pas besoin d'ouvrir un
// modale) et dans la Fiche de Suivi Prospect. Le numéro "principal"
// (entreprise.contact.telephone) reste le seul utilisé pour l'appel/le
// dialer ; les autres numéros obtenus pendant un appel (ex: via le standard)
// sont gardés à part jusqu'à ce qu'un agent les promeuve — l'ancien numéro
// principal n'est alors jamais perdu, juste redescendu en alternatif.
// Suppression réservée aux administrateurs (restriction d'interface, voir la
// même note dans GestionContacts.jsx) : un agent ajoute/promeut librement,
// seul un admin voit le bouton "×".
export default function GestionTelephones({ entreprise, onMaj, compact = false }) {
  const { utilisateur } = useAuth();
  const estAdmin = utilisateur?.role === "admin";
  const [nouveauNumero, setNouveauNumero] = useState("");
  const [nouvelleNote, setNouvelleNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  const contact = entreprise.contact || {};
  const alternates = contact.telephonesAlternatifs || [];

  async function sauvegarderContact(partiel) {
    setEnCours(true);
    setErreur(null);
    try {
      const updated = await api.patchEntreprise(entreprise.id, { contact: { ...contact, ...partiel } });
      onMaj?.(updated);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  function ajouter(ev) {
    ev.preventDefault();
    if (!nouveauNumero.trim()) return;
    const nouvelleEntree = {
      id: idUnique(),
      numero: nouveauNumero.trim(),
      note: nouvelleNote.trim(),
      dateAjout: new Date().toISOString(),
    };
    sauvegarderContact({ telephonesAlternatifs: [...alternates, nouvelleEntree] });
    setNouveauNumero("");
    setNouvelleNote("");
  }

  function definirCommePrioritaire(alt) {
    const ancienPrincipal = contact.telephone;
    const autres = alternates.filter((a) => a.id !== alt.id);
    if (ancienPrincipal && ancienPrincipal !== alt.numero) {
      autres.push({
        id: idUnique(),
        numero: ancienPrincipal,
        note: "Ancien numéro principal",
        dateAjout: new Date().toISOString(),
      });
    }
    sauvegarderContact({ telephone: alt.numero, telephoneInvalide: false, telephonesAlternatifs: autres });
  }

  function retirer(alt) {
    sauvegarderContact({ telephonesAlternatifs: alternates.filter((a) => a.id !== alt.id) });
  }

  return (
    <div className={compact ? "space-y-2" : "rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2"}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Numéro principal : <BoutonAppel entreprise={entreprise} variant="lien" />
        </p>
        {enCours && <span className="text-[10px] text-slate-400">Enregistrement…</span>}
      </div>

      {erreur && <p className="text-xs text-red-600 dark:text-red-400">{erreur}</p>}

      {alternates.length > 0 && (
        <ul className="space-y-1">
          {alternates.map((alt) => (
            <li
              key={alt.id}
              className="flex items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5"
            >
              <span className="text-slate-600 dark:text-slate-300 truncate">
                {alt.numero}
                {alt.note ? ` — ${alt.note}` : ""}
              </span>
              <span className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => definirCommePrioritaire(alt)}
                  className="rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 hover:bg-amber-200 dark:hover:bg-amber-900"
                >
                  Prioritaire
                </button>
                {estAdmin && (
                  <button
                    type="button"
                    onClick={() => retirer(alt)}
                    className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 px-1"
                    title="Retirer ce numéro"
                  >
                    ×
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Nouveau numéro (ex : obtenu via le standard)"
          value={nouveauNumero}
          onChange={(e) => setNouveauNumero(e.target.value)}
          className="flex-1 min-w-[140px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
        />
        <input
          type="text"
          placeholder="Note (optionnel)"
          value={nouvelleNote}
          onChange={(e) => setNouvelleNote(e.target.value)}
          className="w-32 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={ajouter}
          disabled={!nouveauNumero.trim() || enCours}
          className="rounded-lg bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium px-3 py-1.5 disabled:opacity-40"
        >
          + Ajouter
        </button>
      </div>
    </div>
  );
}
