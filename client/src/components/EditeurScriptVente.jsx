import { useState } from "react";
import { api } from "../api.js";
import { definirContenuAide } from "../useContenuAide.js";

const CHAMP =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm";
const BTN_RETIRER = "shrink-0 text-red-500 hover:text-red-700 dark:hover:text-red-400 text-lg leading-none px-1";
const BTN_AJOUTER = "text-xs font-medium text-marine-700 dark:text-marine-300 hover:underline";

// Éditeur du script de vente, réservé aux super-administrateurs (voir
// PanelOutilsVente.jsx). `[Prénom]` reste un jeton littéral remplacé côté
// affichage (ScriptVenteContenu.jsx) par le prénom de l'agent connecté — à
// garder tel quel dans le texte si on veut cette personnalisation.
export default function EditeurScriptVente({ data, onEnregistre, onAnnuler }) {
  const [sections, setSections] = useState(() => data.sections.map((s) => ({ titre: s.titre, lignes: s.lignes.map((l) => ({ ...l })) })));
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState(null);

  function majTitreSection(i, valeur) {
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, titre: valeur } : sec)));
  }
  function ajouterSection() {
    setSections((s) => [...s, { titre: `${s.length + 1}. Nouvelle section`, lignes: [] }]);
  }
  function retirerSection(i) {
    setSections((s) => s.filter((_, idx) => idx !== i));
  }
  function ajouterLigne(i, type) {
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, lignes: [...sec.lignes, { type, texte: "" }] } : sec)));
  }
  function majLigne(i, j, champ, valeur) {
    setSections((s) =>
      s.map((sec, idx) =>
        idx === i ? { ...sec, lignes: sec.lignes.map((l, jdx) => (jdx === j ? { ...l, [champ]: valeur } : l)) } : sec
      )
    );
  }
  function retirerLigne(i, j) {
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, lignes: sec.lignes.filter((_, jdx) => jdx !== j) } : sec)));
  }

  async function enregistrer() {
    setEnregistrement(true);
    setErreur(null);
    try {
      const propre = sections
        .filter((s) => s.titre.trim())
        .map((s) => ({ titre: s.titre.trim(), lignes: s.lignes.filter((l) => l.texte.trim()).map((l) => ({ type: l.type, texte: l.texte.trim() })) }));
      const resultat = await api.modifierScriptVente(propre);
      definirContenuAide("script-vente", resultat);
      onEnregistre(resultat);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  async function reinitialiser() {
    if (!window.confirm("Revenir au script par défaut ? Toutes les modifications personnalisées seront perdues.")) return;
    setEnregistrement(true);
    setErreur(null);
    try {
      const resultat = await api.reinitialiserScriptVente();
      definirContenuAide("script-vente", resultat);
      onEnregistre(resultat);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <div className="space-y-5 text-sm">
      {sections.map((s, i) => (
        <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <input className={`${CHAMP} font-semibold`} value={s.titre} onChange={(e) => majTitreSection(i, e.target.value)} />
            <button type="button" onClick={() => retirerSection(i)} className={BTN_RETIRER} aria-label="Retirer la section">
              ×
            </button>
          </div>

          {s.lignes.map((l, j) => (
            <div key={j} className="flex items-start gap-1.5 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
              <select
                value={l.type}
                onChange={(e) => majLigne(i, j, "type", e.target.value)}
                className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-2 text-xs"
              >
                <option value="instruction">Consigne</option>
                <option value="texte">Texte à lire</option>
              </select>
              <textarea
                rows={2}
                className={CHAMP}
                value={l.texte}
                onChange={(e) => majLigne(i, j, "texte", e.target.value)}
              />
              <button type="button" onClick={() => retirerLigne(i, j)} className={BTN_RETIRER} aria-label="Retirer la ligne">
                ×
              </button>
            </div>
          ))}

          <div className="flex gap-3 pl-2">
            <button type="button" onClick={() => ajouterLigne(i, "instruction")} className={BTN_AJOUTER}>
              + Consigne
            </button>
            <button type="button" onClick={() => ajouterLigne(i, "texte")} className={BTN_AJOUTER}>
              + Texte à lire
            </button>
          </div>
        </div>
      ))}

      <button type="button" onClick={ajouterSection} className={BTN_AJOUTER}>
        + Ajouter une section
      </button>

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
          Revenir au script par défaut
        </button>
      </div>
    </div>
  );
}
