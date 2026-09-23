import { api } from "../api.js";
import { useContenuAide } from "../useContenuAide.js";
import { AGENT_ACTUEL } from "../agent.js";

// Trame d'appel type (ouverture → clôture), à garder sous les yeux pendant
// l'appel. Contenu chargé depuis le serveur, mis en cache par useContenuAide.
// Le prénom de l'agent connecté est injecté à la volée dans le "[Prénom]" du
// script, pour qu'il soit directement lisible et pitchable mot pour mot —
// "[Nom]" reste à la charge de l'agent (nom du prospect, propre à chaque appel).
export default function ScriptVenteContenu() {
  const { data, erreur } = useContenuAide("script-vente", api.getScriptVente);

  if (erreur) return <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>;
  if (!data) return <p className="text-sm text-slate-400 dark:text-slate-500">Chargement du script…</p>;

  function personnaliser(texte) {
    return texte.replaceAll("[Prénom]", AGENT_ACTUEL.prenom);
  }

  return (
    <div className="space-y-5 text-sm">
      <p className="text-xs text-slate-400 dark:text-slate-500 italic">
        Script personnalisé pour {AGENT_ACTUEL.prenom} — prêt à être lu tel quel.
      </p>
      {data.sections.map((s) => (
        <div key={s.titre}>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1.5">{s.titre}</h3>
          <div className="space-y-1.5">
            {s.lignes.map((l, i) => (
              <p key={i} className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {personnaliser(l)}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
