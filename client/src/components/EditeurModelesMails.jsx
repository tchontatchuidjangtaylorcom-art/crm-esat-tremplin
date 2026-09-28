import { useState } from "react";
import { api } from "../api.js";
import { definirContenuAide } from "../useContenuAide.js";

const CHAMP =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm";
const BTN_RETIRER = "shrink-0 text-red-500 hover:text-red-700 dark:hover:text-red-400 text-lg leading-none px-1";
const BTN_AJOUTER = "text-xs font-medium text-marine-700 dark:text-marine-300 hover:underline";

// Éditeur des modèles de mails, réservé aux super-administrateurs (voir
// PanelOutilsVente.jsx). Le jeton littéral {{SIGNATURE}} en fin de corps
// n'est pas résolu ici : il est remplacé à l'affichage/insertion réelle par
// la vraie signature du pôle (voir mailSignature.js) — à garder tel quel.
export default function EditeurModelesMails({ data, onEnregistre, onAnnuler }) {
  const [modeles, setModeles] = useState(() => data.modeles.map((m) => ({ ...m })));
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState(null);

  function maj(i, champ, valeur) {
    setModeles((m) => m.map((mod, idx) => (idx === i ? { ...mod, [champ]: valeur } : mod)));
  }
  function ajouter() {
    setModeles((m) => [...m, { cle: null, titre: `${m.length + 1}. Nouveau modèle`, objet: "", corps: "Bonjour,\n\n\n\n{{SIGNATURE}}" }]);
  }
  function retirer(i) {
    setModeles((m) => m.filter((_, idx) => idx !== i));
  }

  async function enregistrer() {
    setEnregistrement(true);
    setErreur(null);
    try {
      const propre = modeles
        .filter((m) => m.titre.trim() && m.objet.trim() && m.corps.trim())
        .map((m) => ({ cle: m.cle, titre: m.titre.trim(), objet: m.objet.trim(), corps: m.corps.trim() }));
      const resultat = await api.modifierModelesMails(propre);
      definirContenuAide("modeles-mails", resultat);
      onEnregistre(resultat);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  async function reinitialiser() {
    if (!window.confirm("Revenir aux modèles par défaut ? Toutes les modifications personnalisées seront perdues.")) return;
    setEnregistrement(true);
    setErreur(null);
    try {
      const resultat = await api.reinitialiserModelesMails();
      definirContenuAide("modeles-mails", resultat);
      onEnregistre(resultat);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      {modeles.map((m, i) => (
        <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input className={`${CHAMP} font-semibold`} placeholder="Titre du modèle" value={m.titre} onChange={(e) => maj(i, "titre", e.target.value)} />
            <button type="button" onClick={() => retirer(i)} className={BTN_RETIRER} aria-label="Retirer le modèle">
              ×
            </button>
          </div>
          <input className={CHAMP} placeholder="Objet du mail" value={m.objet} onChange={(e) => maj(i, "objet", e.target.value)} />
          <textarea rows={6} className={CHAMP} placeholder="Corps du mail" value={m.corps} onChange={(e) => maj(i, "corps", e.target.value)} />
        </div>
      ))}

      <button type="button" onClick={ajouter} className={BTN_AJOUTER}>
        + Ajouter un modèle
      </button>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Le jeton <code>{"{{SIGNATURE}}"}</code> en fin de corps est remplacé automatiquement par la vraie signature du
        pôle au moment de l'envoi — à garder tel quel.
      </p>

      {erreur && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3">
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={enregistrer}
          disabled={enregistrement}
          className="rounded-lg bg-marine-800 hover:bg-marine-900 text-white text-sm font-semibold px-4 py-2 disabled:opacity-40"
        >
          Enregistrer
        </button>
        <button type="button" onClick={onAnnuler} disabled={enregistrement} className="text-sm text-slate-500 dark:text-slate-400 hover:underline">
          Annuler
        </button>
        <div className="flex-1" />
        <button type="button" onClick={reinitialiser} disabled={enregistrement} className="text-xs text-red-600 dark:text-red-400 hover:underline">
          Revenir aux modèles par défaut
        </button>
      </div>
    </div>
  );
}
