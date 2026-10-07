import { useEffect, useState } from "react";
import { api } from "../api.js";
import { TERRITOIRES } from "../territoires.js";
import { TAILLES_EFFECTIF } from "../taillesEffectif.js";

// Demande de leads en libre-service (agents) : attribue des fiches non
// assignées du secteur choisi, puis génère le complément depuis Sirene en
// arrière-plan s'il en manque (voir /api/leads/demande côté serveur). Évite
// qu'un agent reste sans fiches quand aucun manager n'est disponible.
// `pourAgent` : { id, prenom } — un administrateur en Mode Manager demande
// des fiches pour l'agent consulté.
// `onVoirNouveaux` : affiche dans la liste toutes les fiches « Nouveau » de
// l'agent (filtres retirés) — utile quand la demande est bloquée par des
// fiches cachées par un filtre (taille, territoire, prioritaires).
export default function DemandeLeads({
  categories,
  onMaj,
  onDemandeEnvoyee,
  territoire: territoireDuTableau = "",
  pourAgent = null,
  onVoirNouveaux,
}) {
  const [etat, setEtat] = useState(null);
  // Nombre de fiches demandées : 50, 100 ou 150.
  const [nombre, setNombre] = useState(50);
  const pourAgentId = pourAgent?.id || null;
  const [categorie, setCategorie] = useState("");
  const [departement, setDepartement] = useState("");
  // Taille des entreprises demandées : 20 à 249 salariés par défaut.
  const [taille, setTaille] = useState("20-249");
  // Territoire des fiches demandées : par défaut celui choisi sur le tableau
  // de bord (l'agent qui travaille La Réunion reçoit des fiches de La Réunion).
  const [territoire, setTerritoire] = useState(territoireDuTableau);
  useEffect(() => setTerritoire(territoireDuTableau), [territoireDuTableau]);
  const territoireOutreMer = territoire && territoire !== "metropole";
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    setEtat(null);
    api.getDemandeLeads(pourAgentId).then(setEtat).catch(() => {});
  }, [pourAgentId]);

  // Suivi de la génération et de la recherche des numéros en arrière-plan :
  // le tableau de bord se met à jour à chaque tick (numéros trouvés inclus).
  const suiviActif = Boolean(etat?.enCours || etat?.numeros?.enCours);
  useEffect(() => {
    if (!suiviActif) return;
    const id = setInterval(async () => {
      try {
        const e = await api.getDemandeLeads(pourAgentId);
        setEtat(e);
        onMaj?.();
      } catch {
        // Tick manqué, on retente au prochain intervalle.
      }
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suiviActif]);

  async function demander(ev) {
    ev.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const e = await api.demanderLeads(categorie, territoireOutreMer ? "" : departement.trim(), territoire, taille, nombre, pourAgentId);
      setEtat(e);
      onMaj?.();
      onDemandeEnvoyee?.();
    } catch (e) {
      // 502/503/504 ou coupure réseau : le serveur redémarre (déploiement) ou
      // ne répond plus — message compréhensible plutôt qu'un code HTTP brut.
      const indisponible = /HTTP 50[234]|Failed to fetch|NetworkError/i.test(e.message);
      setErreur(
        indisponible
          ? "Le serveur redémarre ou ne répond pas pour le moment. Réessayez dans une minute."
          : e.message
      );
      api.getDemandeLeads(pourAgentId).then(setEtat).catch(() => {});
    } finally {
      setEnvoi(false);
    }
  }

  if (!etat) return null;

  const choisissables = (categories || []).filter((c) => c.value !== "autre");
  const bloque = !etat.peutDemander || etat.enCours || envoi;

  return (
    <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-4 py-3">
      <form onSubmit={demander} className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {pourAgent ? `Demander des fiches pour ${pourAgent.prenom || "cet agent"}` : "Besoin de nouvelles fiches ?"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {etat.peutDemander
              ? `Fiches libres d'abord, puis NRP d'autres agents remises en Nouveau, puis nouvelles fiches générées s'il en manque (secteur choisi).`
              : `Encore ${etat.nouveauxNonTraites} fiches « Nouveau » à traiter : nouvelle demande possible sous ${etat.seuil}.`}
          </p>
          {!etat.peutDemander && onVoirNouveaux && (
            <button
              type="button"
              onClick={onVoirNouveaux}
              className="mt-1 text-xs font-medium text-marine-700 dark:text-marine-300 hover:underline"
            >
              👁 Voir {pourAgent ? "ses" : "mes"} {etat.nouveauxNonTraites} fiches « Nouveau » (tous filtres retirés)
            </button>
          )}
        </div>

        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Nombre
          <select
            value={nombre}
            onChange={(e) => setNombre(Number(e.target.value))}
            disabled={bloque}
            className="mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 px-3 py-2 disabled:opacity-50"
          >
            {(etat.choix || [50, 100, 150]).map((n) => (
              <option key={n} value={n}>
                {n} fiches
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Secteur
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            disabled={bloque}
            className="mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 px-3 py-2 disabled:opacity-50"
          >
            <option value="">Tous secteurs (fiches existantes)</option>
            {choisissables.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Territoire
          <select
            value={territoire}
            onChange={(e) => setTerritoire(e.target.value)}
            disabled={bloque}
            className="mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 px-3 py-2 disabled:opacity-50"
          >
            <option value="">Tous territoires</option>
            {TERRITOIRES.map((t) => (
              <option key={t.cle} value={t.cle}>
                {t.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Taille des entreprises
          <select
            value={taille}
            onChange={(e) => setTaille(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 px-3 py-2"
          >
            {TAILLES_EFFECTIF.map((t) => (
              <option key={t.cle} value={t.cle}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Département (facultatif)
          <input
            value={territoireOutreMer ? territoire : departement}
            onChange={(e) => setDepartement(e.target.value)}
            disabled={bloque || Boolean(territoireOutreMer)}
            placeholder="ex : 75"
            maxLength={3}
            className="mt-1 block w-28 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 px-3 py-2 disabled:opacity-50"
          />
        </label>

        <button
          type="submit"
          disabled={bloque}
          className="rounded-lg bg-marine-600 hover:bg-marine-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-40 whitespace-nowrap"
        >
          {etat.enCours || envoi ? "Préparation…" : `Demander ${nombre} fiches`}
        </button>
      </form>

      {(etat.enCours || etat.termine) && (
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
          {etat.enCours ? "⏳ " : "✓ "}
          {etat.attribues} fiche{etat.attribues > 1 ? "s" : ""} attribuée{etat.attribues > 1 ? "s" : ""}
          {etat.recyclees > 0 && ` (dont ${etat.recyclees} NRP remise${etat.recyclees > 1 ? "s" : ""} en Nouveau)`}
          {etat.aGenerer > 0 &&
            ` + ${etat.generes} / ${etat.aGenerer} nouvelle${etat.aGenerer > 1 ? "s" : ""} fiche${
              etat.aGenerer > 1 ? "s" : ""
            } générée${etat.aGenerer > 1 ? "s" : ""}${etat.categorieLabel ? ` (${etat.categorieLabel})` : ""}`}
          {etat.enCours ? "…" : "."}
        </p>
      )}
      {etat.numeros?.total > 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          {etat.numeros.enCours ? "📞 Recherche des numéros par Claude : " : "📞 Numéros : "}
          {etat.numeros.traites} / {etat.numeros.total} fiche{etat.numeros.total > 1 ? "s" : ""} sans numéro traitée
          {etat.numeros.traites > 1 ? "s" : ""} — <strong>{etat.numeros.trouves}</strong> numéro
          {etat.numeros.trouves > 1 ? "s" : ""} trouvé{etat.numeros.trouves > 1 ? "s" : ""}
          {etat.numeros.enCours
            ? "… (ils apparaissent dans le tableau au fur et à mesure)"
            : etat.numeros.trouves < etat.numeros.total
              ? ". Pour les autres, utilisez « Rechercher sur Google » sur la fiche."
              : "."}
        </p>
      )}
      {etat.numeros?.interrompu && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">⚠️ {etat.numeros.interrompu}</p>
      )}
      {etat.message && <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">{etat.message}</p>}
      {etat.erreur && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{etat.erreur}</p>}
      {erreur && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{erreur}</p>}
    </div>
  );
}
