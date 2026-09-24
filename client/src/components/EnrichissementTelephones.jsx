import { useEffect, useState } from "react";
import { api } from "../api.js";

// Enrichissement en lot des fiches déjà présentes dans le CRM qui n'ont
// toujours aucun numéro de téléphone — typiquement les leads importés par
// secteur avant l'ajout de la recherche automatique à l'import (voir
// ImportLot.jsx), ou dont cette recherche automatique n'a rien trouvé à
// l'époque. Action admin explicite (bouton) plutôt qu'automatique : elle peut
// déclencher des dizaines/centaines d'appels Gemini sur tout le pipeline
// existant, à ne pas lancer sans le vouloir. Le traitement tourne en
// arrière-plan côté serveur ; ce composant se contente d'interroger
// périodiquement /api/leads/enrichir-telephones/statut pendant qu'il tourne.
export default function EnrichissementTelephones({ manquants, onMaj }) {
  const [iaConfiguree, setIaConfiguree] = useState(null);
  const [statut, setStatut] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [modelesDisponibles, setModelesDisponibles] = useState(null);
  const [erreurModeles, setErreurModeles] = useState(null);
  const [chargementModeles, setChargementModeles] = useState(false);

  useEffect(() => {
    api
      .getStatutIA()
      .then((r) => setIaConfiguree(r.configuree))
      .catch(() => setIaConfiguree(false));
    // Reprend le suivi si un enrichissement était déjà en cours (ex : lancé
    // juste avant un rechargement de page).
    api
      .getStatutEnrichissementTelephones()
      .then((s) => setStatut(s))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!statut?.enCours) return;
    const id = setInterval(async () => {
      try {
        const s = await api.getStatutEnrichissementTelephones();
        setStatut(s);
        onMaj?.();
      } catch {
        // Tick manqué, on retente au prochain intervalle.
      }
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statut?.enCours]);

  async function lancer() {
    setErreur(null);
    try {
      const reponse = await api.lancerEnrichissementTelephones();
      setStatut(reponse);
    } catch (e) {
      setErreur(e.message);
    }
  }

  // Diagnostic pour l'erreur "model X is not found" : plutôt que deviner un
  // nouveau nom de modèle Gemini (Google en retire régulièrement, sans lien
  // avec ce qui est écrit dans le code — voir GEMINI_MODEL dans .env.example),
  // interroge l'API pour la vraie liste disponible pour CETTE clé.
  async function verifierModelesDisponibles() {
    setChargementModeles(true);
    setErreurModeles(null);
    setModelesDisponibles(null);
    try {
      const { modeles } = await api.getModelesDisponiblesIA();
      setModelesDisponibles(modeles);
    } catch (e) {
      setErreurModeles(e.message);
    } finally {
      setChargementModeles(false);
    }
  }

  if (iaConfiguree === false || !manquants) return null;

  return (
    <div className="mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {statut?.enCours ? (
          <>
            🤖 Enrichissement IA en cours… {statut.traites} / {statut.total} fiche{statut.total > 1 ? "s" : ""}{" "}
            traitée{statut.traites > 1 ? "s" : ""} ({statut.trouves} numéro{statut.trouves > 1 ? "s" : ""} trouvé
            {statut.trouves > 1 ? "s" : ""}
            {statut.erreurs > 0 ? `, ${statut.erreurs} échec${statut.erreurs > 1 ? "s" : ""}` : ""}).
          </>
        ) : (
          <>
            <strong>{manquants}</strong> fiche{manquants > 1 ? "s" : ""} sans numéro de téléphone dans le pipeline
            actif.
            {statut?.termine && (
              <>
                {" "}
                Dernier enrichissement : {statut.trouves} numéro{statut.trouves > 1 ? "s" : ""} trouvé
                {statut.trouves > 1 ? "s" : ""} sur {statut.traites} fiche{statut.traites > 1 ? "s" : ""} traitée
                {statut.traites > 1 ? "s" : ""}
                {statut.erreurs > 0 ? `, ${statut.erreurs} échec${statut.erreurs > 1 ? "s" : ""}` : ""}.
              </>
            )}
          </>
        )}
      </p>

      <button
        onClick={lancer}
        disabled={statut?.enCours}
        className="rounded-lg bg-marine-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-40 whitespace-nowrap"
      >
        {statut?.enCours ? "Enrichissement…" : "🤖 Lancer l'enrichissement Gemini des numéros manquants"}
      </button>

      {statut?.interrompu && (
        <div className="w-full">
          <p className="text-sm text-amber-600 dark:text-amber-400">⚠️ {statut.interrompu}</p>
          <button
            onClick={verifierModelesDisponibles}
            disabled={chargementModeles}
            className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
          >
            {chargementModeles ? "Vérification…" : "Voir les modèles Gemini disponibles pour cette clé"}
          </button>
          {erreurModeles && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erreurModeles}</p>}
          {modelesDisponibles && (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              {modelesDisponibles.length === 0 ? (
                <p>Aucun modèle compatible generateContent trouvé pour cette clé.</p>
              ) : (
                <>
                  <p className="mb-1.5">
                    Valeur à mettre dans <strong>GEMINI_MODEL</strong> (variable d'environnement Render du
                    service, pas ce fichier .env.example local) :
                  </p>
                  <ul className="space-y-0.5">
                    {modelesDisponibles.map((m) => (
                      <li key={m.id}>
                        <code className="font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5">
                          {m.id}
                        </code>
                        {m.displayName ? ` — ${m.displayName}` : ""}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {!statut?.interrompu && !statut?.enCours && statut?.derniereErreur && (
        <p className="text-xs text-slate-400 dark:text-slate-500 w-full">
          Dernière erreur rencontrée : {statut.derniereErreur}
        </p>
      )}
      {erreur && <p className="text-sm text-red-600 dark:text-red-400 w-full">{erreur}</p>}
    </div>
  );
}
