import { useState } from "react";
import { api } from "../api.js";
import { reserveAuxAdmins } from "../reserveAdmin.jsx";

// "✓ Corriger l'orthographe" sous un message rédigé à la main : l'IA corrige
// accents, a / à, accords et ponctuation sans changer le sens. Le texte
// d'avant reste récupérable avec "Annuler la correction".
function BoutonCorrection({ texte, onCorrige }) {
  const [enCours, setEnCours] = useState(false);
  const [avant, setAvant] = useState(null);
  const [info, setInfo] = useState(null);

  async function corriger() {
    if (!texte.trim()) return;
    setEnCours(true);
    setInfo(null);
    try {
      const { texte: corrige } = await api.corrigerTexte(texte);
      if (corrige === texte) {
        setInfo("Aucune faute trouvée.");
      } else {
        setAvant(texte);
        onCorrige(corrige);
        setInfo("Texte corrigé.");
      }
    } catch (e) {
      setInfo(e.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        onClick={corriger}
        disabled={enCours || !texte.trim()}
        className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-50"
      >
        {enCours ? "Correction…" : "✓ Corriger l'orthographe"}
      </button>
      {avant !== null && (
        <button
          type="button"
          onClick={() => {
            onCorrige(avant);
            setAvant(null);
            setInfo(null);
          }}
          className="text-slate-500 dark:text-slate-400 underline"
        >
          Annuler la correction
        </button>
      )}
      {info && <span className="text-slate-500 dark:text-slate-400">{info}</span>}
    </div>
  );
}

// Fonction IA (payante) : réservée aux administrateurs.
export default reserveAuxAdmins(BoutonCorrection);
