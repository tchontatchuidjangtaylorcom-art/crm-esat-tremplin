import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { estAdmin } from "../roles.js";
import BoutonAppel from "../telephony/BoutonAppel.jsx";
import { jouerSonConfirmation } from "../sonConfirmation.js";
import { erreurNumero, estNumeroAffichable } from "../telephone.js";

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
  const estAdminConnecte = estAdmin(utilisateur);
  const [nouveauNumero, setNouveauNumero] = useState("");
  const [nouvelleNote, setNouvelleNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  // Remplacement du numéro principal (ex. numéro devenu invalide).
  const [remplacement, setRemplacement] = useState(null);

  const contact = entreprise.contact || {};
  const alternates = contact.telephonesAlternatifs || [];

  // `noteHistorique` : trace ajoutée à l'historique de la fiche (qui a
  // remplacé / supprimé quel numéro), puisque l'ancien numéro disparaît.
  async function sauvegarderContact(partiel, noteHistorique = null) {
    setEnCours(true);
    setErreur(null);
    try {
      let updated = await api.patchEntreprise(entreprise.id, { contact: { ...contact, ...partiel } });
      if (noteHistorique) {
        updated = await api.ajouterCommentaire(entreprise.id, {
          texte: noteHistorique,
          auteur: utilisateur?.prenom || utilisateur?.email || "Agent",
        });
      }
      onMaj?.(updated);
      jouerSonConfirmation();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  function ajouter(ev) {
    ev.preventDefault();
    if (!nouveauNumero.trim()) return;
    const refus = erreurNumero(nouveauNumero);
    if (refus) {
      setErreur(refus);
      return;
    }
    // Pas encore de numéro principal utilisable (vide, ou un e-mail saisi
    // par erreur) : le nouveau numéro le devient directement, et apparaît
    // aussitôt dans le bandeau ☎ en haut de la fiche.
    if (!estNumeroAffichable(contact.telephone)) {
      sauvegarderContact({ telephone: nouveauNumero.trim(), telephoneInvalide: false });
    } else {
      const nouvelleEntree = {
        id: idUnique(),
        numero: nouveauNumero.trim(),
        note: nouvelleNote.trim(),
        dateAjout: new Date().toISOString(),
      };
      sauvegarderContact({ telephonesAlternatifs: [...alternates, nouvelleEntree] });
    }
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

  function remplacerPrincipal(ev) {
    ev?.preventDefault?.();
    const numero = (remplacement || "").trim();
    if (!numero) return;
    const refus = erreurNumero(numero);
    if (refus) {
      setErreur(refus);
      return;
    }
    const ancien = contact.telephone;
    // Si le nouveau numéro était déjà dans les numéros supplémentaires, on
    // l'en retire (il devient le principal).
    const autres = alternates.filter((a) => a.numero.replace(/\D/g, "") !== numero.replace(/\D/g, ""));
    sauvegarderContact(
      { telephone: numero, telephoneInvalide: false, telephonesAlternatifs: autres },
      estNumeroAffichable(ancien) ? `Numéro principal remplacé : ${ancien} → ${numero}.` : `Numéro principal ajouté : ${numero}.`
    );
    setRemplacement(null);
  }

  // Suppression du numéro principal (admins) : le premier numéro
  // supplémentaire, s'il y en a un, devient le principal.
  function supprimerPrincipal() {
    const ancien = contact.telephone;
    if (!window.confirm(`Supprimer le numéro principal ${ancien} ?`)) return;
    const [suivant, ...reste] = alternates;
    sauvegarderContact(
      suivant
        ? { telephone: suivant.numero, telephoneInvalide: false, telephonesAlternatifs: reste }
        : { telephone: "", telephoneInvalide: false },
      suivant
        ? `Numéro principal supprimé : ${ancien} (remplacé par ${suivant.numero}).`
        : `Numéro principal supprimé : ${ancien}.`
    );
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
        <span className="flex items-center gap-1 shrink-0">
          {enCours && <span className="text-[10px] text-slate-400">Enregistrement…</span>}
          {estNumeroAffichable(contact.telephone) && remplacement === null && (
            <>
              <button
                type="button"
                onClick={() => {
                  setRemplacement("");
                  setErreur(null);
                }}
                className="rounded-full bg-marine-100 dark:bg-marine-950/50 text-marine-800 dark:text-marine-300 text-xs px-2 py-0.5 hover:bg-marine-200 dark:hover:bg-marine-900"
                title="Remplacer le numéro principal (ex. numéro qui ne fonctionne plus)"
              >
                Remplacer
              </button>
              {estAdminConnecte && (
                <button
                  type="button"
                  onClick={supprimerPrincipal}
                  className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 px-1 text-xs"
                  title="Supprimer le numéro principal"
                >
                  ×
                </button>
              )}
            </>
          )}
        </span>
      </div>

      {remplacement !== null && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-marine-50 dark:bg-marine-950/30 border border-marine-200 dark:border-marine-800 p-2">
          <input
            type="tel"
            inputMode="tel"
            autoFocus
            placeholder={`Nouveau numéro à la place de ${contact.telephone}`}
            value={remplacement}
            onChange={(e) => {
              setRemplacement(e.target.value);
              setErreur(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") remplacerPrincipal(e);
              if (e.key === "Escape") setRemplacement(null);
            }}
            className="flex-1 min-w-[160px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={remplacerPrincipal}
            disabled={!remplacement.trim() || enCours}
            className="rounded-lg bg-marine-700 hover:bg-marine-800 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-40"
          >
            Remplacer
          </button>
          <button
            type="button"
            onClick={() => setRemplacement(null)}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-1"
          >
            Annuler
          </button>
        </div>
      )}

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
                {estAdminConnecte && (
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
          type="tel"
          inputMode="tel"
          placeholder="Nouveau numéro (ex : 01 41 33 84 00)"
          value={nouveauNumero}
          onChange={(e) => {
            setNouveauNumero(e.target.value);
            setErreur(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && ajouter(e)}
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
