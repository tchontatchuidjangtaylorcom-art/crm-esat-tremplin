import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useContenuAide } from "../useContenuAide.js";
import { construireSignature } from "../mailSignature.js";

// Modèles de mails prêts à copier-coller vers le client mail réel de
// l'agent (pas d'envoi depuis le CRM — juste un copier/coller rapide). Sans
// fiche entreprise ouverte ici, le collecteur (privé/public) n'est pas
// connu : la signature générique utilise par défaut le libellé privé
// (Pôle OETH / AGEFIPH), à ajuster manuellement au collage si le contact
// vise en réalité le secteur public.
export default function ModelesMailsContenu() {
  const { utilisateur } = useAuth();
  const { data, erreur } = useContenuAide("modeles-mails", api.getModelesMails);
  const [copie, setCopie] = useState(null);
  const [statutMail, setStatutMail] = useState(null);

  useEffect(() => {
    api.getStatutMail().then(setStatutMail).catch(() => {});
  }, []);

  function copier(modele) {
    const corps = modele.corps.replaceAll("{{SIGNATURE}}", construireSignature({ utilisateur, statutMail, collecteur: null }));
    const texte = `Objet : ${modele.objet}\n\n${corps}`;
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

  const signature = construireSignature({ utilisateur, statutMail, collecteur: null });

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
          <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">
            {m.corps.replaceAll("{{SIGNATURE}}", signature)}
          </p>
        </div>
      ))}
    </div>
  );
}
