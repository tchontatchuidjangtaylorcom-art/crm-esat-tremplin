import { useState } from "react";
import { api } from "../api.js";
import { definirContenuAide } from "../useContenuAide.js";

const CHAMP =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm";
const BTN_RETIRER = "shrink-0 text-red-500 hover:text-red-700 dark:hover:text-red-400 text-lg leading-none px-1";
const BTN_AJOUTER = "text-xs font-medium text-marine-700 dark:text-marine-300 hover:underline";

// Éditeur de l'argumentaire AGEFIPH, réservé aux super-administrateurs (voir
// PanelOutilsVente.jsx, qui n'affiche ce composant que pour ce rôle — le
// serveur revalide de toute façon via exigerSuperAdmin). `calcul` et
// `bareme` ne sont volontairement PAS éditables ici : ce sont des valeurs
// dérivées automatiquement du moteur OETH (server/src/oeth.js), les rendre
// modifiables romprait leur exactitude — voir argumentaire.js côté serveur.
export default function EditeurArgumentaire({ data, onEnregistre, onAnnuler }) {
  const [brouillon, setBrouillon] = useState(() => ({
    objectif: data.objectif,
    devise: data.devise,
    quiSommesNousTexte: data.quiSommesNous.texte,
    quiSommesNousPoints: [...data.quiSommesNous.points],
    pourquoiObligation: [...data.pourquoiObligation],
    chronologie: data.chronologie.map((c) => ({ ...c })),
  }));
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState(null);

  function majListe(cle, i, valeur) {
    setBrouillon((b) => ({ ...b, [cle]: b[cle].map((v, idx) => (idx === i ? valeur : v)) }));
  }
  function ajouterListe(cle, valeurVide) {
    setBrouillon((b) => ({ ...b, [cle]: [...b[cle], valeurVide] }));
  }
  function retirerListe(cle, i) {
    setBrouillon((b) => ({ ...b, [cle]: b[cle].filter((_, idx) => idx !== i) }));
  }
  function majChrono(i, champ, valeur) {
    setBrouillon((b) => ({
      ...b,
      chronologie: b.chronologie.map((c, idx) => (idx === i ? { ...c, [champ]: valeur } : c)),
    }));
  }

  async function enregistrer() {
    setEnregistrement(true);
    setErreur(null);
    try {
      const contenu = {
        objectif: brouillon.objectif.trim(),
        devise: brouillon.devise.trim(),
        quiSommesNous: {
          texte: brouillon.quiSommesNousTexte.trim(),
          points: brouillon.quiSommesNousPoints.map((p) => p.trim()).filter(Boolean),
        },
        pourquoiObligation: brouillon.pourquoiObligation.map((p) => p.trim()).filter(Boolean),
        chronologie: brouillon.chronologie
          .filter((c) => c.titre?.trim())
          .map((c) => ({ annee: Number(c.annee) || c.annee, titre: c.titre.trim(), description: (c.description || "").trim() })),
      };
      const resultat = await api.modifierArgumentaireAgefiph(contenu);
      definirContenuAide("argumentaire-agefiph", resultat);
      onEnregistre(resultat);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  async function reinitialiser() {
    if (!window.confirm("Revenir au contenu par défaut ? Toutes les modifications personnalisées seront perdues.")) return;
    setEnregistrement(true);
    setErreur(null);
    try {
      const resultat = await api.reinitialiserArgumentaireAgefiph();
      definirContenuAide("argumentaire-agefiph", resultat);
      onEnregistre(resultat);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <div className="space-y-5 text-sm">
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Objectif</label>
        <input className={CHAMP} value={brouillon.objectif} onChange={(e) => setBrouillon((b) => ({ ...b, objectif: e.target.value }))} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Qui sommes-nous ? (texte)</label>
        <textarea
          rows={2}
          className={CHAMP}
          value={brouillon.quiSommesNousTexte}
          onChange={(e) => setBrouillon((b) => ({ ...b, quiSommesNousTexte: e.target.value }))}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Points clés</label>
          <button type="button" onClick={() => ajouterListe("quiSommesNousPoints", "")} className={BTN_AJOUTER}>
            + Ajouter
          </button>
        </div>
        <div className="space-y-1.5">
          {brouillon.quiSommesNousPoints.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input className={CHAMP} value={p} onChange={(e) => majListe("quiSommesNousPoints", i, e.target.value)} />
              <button type="button" onClick={() => retirerListe("quiSommesNousPoints", i)} className={BTN_RETIRER} aria-label="Retirer">
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pourquoi cette obligation ?</label>
          <button type="button" onClick={() => ajouterListe("pourquoiObligation", "")} className={BTN_AJOUTER}>
            + Ajouter
          </button>
        </div>
        <div className="space-y-1.5">
          {brouillon.pourquoiObligation.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input className={CHAMP} value={p} onChange={(e) => majListe("pourquoiObligation", i, e.target.value)} />
              <button type="button" onClick={() => retirerListe("pourquoiObligation", i)} className={BTN_RETIRER} aria-label="Retirer">
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Chronologie & dates clés</label>
          <button
            type="button"
            onClick={() => ajouterListe("chronologie", { annee: new Date().getFullYear(), titre: "", description: "" })}
            className={BTN_AJOUTER}
          >
            + Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {brouillon.chronologie.map((c, i) => (
            <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  className={`${CHAMP} w-24`}
                  value={c.annee}
                  onChange={(e) => majChrono(i, "annee", e.target.value)}
                />
                <input
                  className={CHAMP}
                  placeholder="Titre"
                  value={c.titre}
                  onChange={(e) => majChrono(i, "titre", e.target.value)}
                />
                <button type="button" onClick={() => retirerListe("chronologie", i)} className={BTN_RETIRER} aria-label="Retirer">
                  ×
                </button>
              </div>
              <textarea
                rows={2}
                placeholder="Description"
                className={CHAMP}
                value={c.description}
                onChange={(e) => majChrono(i, "description", e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Devise (bandeau final)</label>
        <input className={CHAMP} value={brouillon.devise} onChange={(e) => setBrouillon((b) => ({ ...b, devise: e.target.value }))} />
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Le calcul et le barème des unités bénéficiaires ne sont pas modifiables ici : ils sont toujours dérivés
        automatiquement du moteur OETH, pour rester exacts.
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
          Revenir au contenu par défaut
        </button>
      </div>
    </div>
  );
}
