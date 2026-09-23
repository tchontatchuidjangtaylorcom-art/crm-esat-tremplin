import { useState } from "react";
import { api } from "../api.js";
import { useContenuAide } from "../useContenuAide.js";

// Modèles de mails prêts à copier-coller vers le client mail réel de
// l'agent (pas d'envoi depuis le CRM — juste un copier/coller rapide).
export default function ModelesMailsContenu() {
  const { data, erreur } = useContenuAide("modeles-mails", api.getModelesMails);
  const [copie, setCopie] = useState(null);

  function copier(modele) {
    const texte = `Objet : ${modele.objet}\n\n${modele.corps}`;
    navigator.clipboard
      ?.writeText(texte)
      .then(() => {
        setCopie(modele.cle);
        setTimeout(() => setCopie((c) => (c === modele.cle ? null : c)), 2000);
      })
      .catch(() => {});
  }

  if (erreur) return <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>;
  if (!data) return <p className="text-sm text-slate-400 dark:text-slate-500">Chargement des modèles…</p>;

  return (
    <div className="space-y-4">
      {data.modeles.map((m) => (
        <div key={m.cle} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">{m.titre}</h3>
            <button
              onClick={() => copier(m)}
              className="shrink-0 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
            >
              {copie === m.cle ? "Copié !" : "Copier"}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <strong>Objet :</strong> {m.objet}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">{m.corps}</p>
        </div>
      ))}
    </div>
  );
}
