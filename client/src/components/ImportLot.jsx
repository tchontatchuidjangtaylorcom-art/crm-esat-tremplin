import { useEffect, useState } from "react";
import { api } from "../api.js";

// Import d'une vague de prospection (Lot 1, Lot 2…), soit à partir d'une
// liste de SIREN saisie à la main, soit générée automatiquement à partir
// d'un secteur du CRM (recherche de VRAIES entreprises dans le répertoire
// Sirene par code NAF — voir GenererVagueSecteur ci-dessous, et la note dans
// server/src/insee.js sur pourquoi ce n'est pas un modèle de langage qui
// choisit les entreprises). Replié par défaut pour ne pas surcharger le
// tableau de bord.
export default function ImportLot({ categories, agents, onImporte }) {
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState("siren");
  const [lot, setLot] = useState("");
  const [sirensTexte, setSirensTexte] = useState("");
  const [assigneA, setAssigneA] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);

  async function soumettre(ev) {
    ev.preventDefault();
    const sirens = sirensTexte
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!lot.trim()) {
      setErreur("Merci de nommer ce lot (ex : « Lot 3 »).");
      return;
    }
    if (sirens.length === 0) {
      setErreur("Collez au moins un SIREN (un par ligne).");
      return;
    }

    setEnCours(true);
    setErreur(null);
    setResultat(null);
    try {
      const reponse = await api.importerLot(lot.trim(), sirens, assigneA || null);
      setResultat(reponse.resultats);
      onImporte?.();
      setSirensTexte("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  const compteurs = resultat?.reduce(
    (acc, r) => ({ ...acc, [r.statut]: (acc[r.statut] || 0) + 1 }),
    {}
  );

  return (
    <div className="mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between"
      >
        <span>+ Importer un lot d'entreprises (vague de prospection)</span>
        <span className="text-slate-400 dark:text-slate-500">{ouvert ? "▲" : "▼"}</span>
      </button>

      {ouvert && (
        // Conteneur défilable indépendant : même avec un aperçu de vague
        // long ou beaucoup de résultats, ce bloc scrolle en interne au lieu
        // de pousser indéfiniment la hauteur de la page (et n'est plus
        // imbriqué dans la barre latérale "sticky", qui bloquait le défilement).
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="px-4 pb-1 flex gap-1 text-xs">
            <button
              onClick={() => setMode("siren")}
              className={`px-3 py-1.5 rounded-t-lg font-medium ${
                mode === "siren"
                  ? "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
              }`}
            >
              Par liste de SIREN
            </button>
            <button
              onClick={() => setMode("secteur")}
              className={`px-3 py-1.5 rounded-t-lg font-medium ${
                mode === "secteur"
                  ? "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
              }`}
            >
              🔎 Générer par secteur
            </button>
          </div>

          {mode === "secteur" && (
            <GenererVagueSecteur categories={categories} agents={agents} onImporte={onImporte} />
          )}

          {mode === "siren" && (
            <form onSubmit={soumettre} className="px-4 pb-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                <label className="block text-xs text-slate-500 dark:text-slate-400">
                  Nom du lot
                  <input
                    type="text"
                    placeholder="Ex : Lot 3 — Octobre"
                    value={lot}
                    onChange={(e) => setLot(e.target.value)}
                    className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
                  />
                </label>

                {agents?.length > 0 && (
                  <label className="block text-xs text-slate-500 dark:text-slate-400">
                    Assigner à (optionnel)
                    <select
                      value={assigneA}
                      onChange={(e) => setAssigneA(e.target.value)}
                      className="mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
                    >
                      <option value="">Non assigné (à distribuer plus tard)</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.prenom || a.email}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Liste de SIREN (un par ligne, jusqu'à 100)
                <textarea
                  value={sirensTexte}
                  onChange={(e) => setSirensTexte(e.target.value)}
                  placeholder={"552100554\n214401093\n..."}
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm font-mono"
                />
              </label>

              <button
                type="submit"
                disabled={enCours}
                className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium px-4 py-2 disabled:opacity-40"
              >
                {enCours ? "Import en cours…" : "Importer le lot"}
              </button>

              {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}

              {resultat && (
                <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
                  <p>
                    {compteurs.cree || 0} créé{(compteurs.cree || 0) > 1 ? "s" : ""} ·{" "}
                    {compteurs.existant || 0} déjà existant{(compteurs.existant || 0) > 1 ? "s" : ""} ·{" "}
                    {compteurs.radiee || 0} radié{(compteurs.radiee || 0) > 1 ? "s" : ""} (archivé
                    {(compteurs.radiee || 0) > 1 ? "s" : ""}) · {compteurs.erreur || 0} erreur
                    {(compteurs.erreur || 0) > 1 ? "s" : ""}
                  </p>
                  {compteurs.erreur > 0 && (
                    <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                      {resultat
                        .filter((r) => r.statut === "erreur")
                        .map((r) => (
                          <li key={r.siren}>
                            {r.siren} : {r.erreur}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

const TAILLE_MAX_APPEL = 100; // même limite anti-abus que l'import manuel (voir server/src/index.js)

// Génère une vague de prospects à partir d'un secteur du CRM : recherche de
// VRAIES entreprises dans le répertoire Sirene (INSEE) par code NAF — voir
// server/src/insee.js pour le détail (délibérément pas une liste inventée
// par un modèle de langage). Prévisualisation obligatoire avant import :
// l'agent voit le nombre et un échantillon avant de créer quoi que ce soit.
function GenererVagueSecteur({ categories, agents, onImporte }) {
  const [categorie, setCategorie] = useState("");
  const [departement, setDepartement] = useState("");
  const [quantite, setQuantite] = useState(100);
  const [lot, setLot] = useState("");
  const [assigneA, setAssigneA] = useState("");
  const [rechercheTelephoneIA, setRechercheTelephoneIA] = useState(true);
  const [iaConfiguree, setIaConfiguree] = useState(null);

  const [enRecherche, setEnRecherche] = useState(false);
  const [apercu, setApercu] = useState(null);
  const [erreur, setErreur] = useState(null);

  const [enImport, setEnImport] = useState(false);
  const [progressionImport, setProgressionImport] = useState(null);
  const [resultatImport, setResultatImport] = useState(null);
  const [dernierImportAvecIa, setDernierImportAvecIa] = useState(false);

  const categoriesChoisissables = (categories || []).filter((c) => c.value !== "autre");

  useEffect(() => {
    api
      .getStatutIA()
      .then((r) => setIaConfiguree(r.configuree))
      .catch(() => setIaConfiguree(false));
  }, []);

  async function rechercher(ev) {
    ev.preventDefault();
    if (!categorie) return;
    setEnRecherche(true);
    setErreur(null);
    setApercu(null);
    setResultatImport(null);
    try {
      const reponse = await api.rechercherProspectsParSecteur(categorie, {
        departement: departement.trim() || null,
        limite: Math.min(Number(quantite) || 100, 300),
      });
      setApercu(reponse);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnRecherche(false);
    }
  }

  async function importer() {
    if (!apercu?.entreprises?.length) return;
    if (!lot.trim()) {
      setErreur("Merci de nommer cette vague (ex : « Construction — Nord »).");
      return;
    }
    setEnImport(true);
    setErreur(null);
    setResultatImport(null);

    const sirens = apercu.entreprises.map((e) => e.siren);
    const tousResultats = [];
    let avecIa = false;
    for (let i = 0; i < sirens.length; i += TAILLE_MAX_APPEL) {
      const morceau = sirens.slice(i, i + TAILLE_MAX_APPEL);
      setProgressionImport(`${tousResultats.length} / ${sirens.length}…`);
      try {
        const reponse = await api.importerProspectsParSecteur(
          categorie,
          lot.trim(),
          morceau,
          assigneA || null,
          rechercheTelephoneIA
        );
        tousResultats.push(...reponse.resultats);
        avecIa = avecIa || reponse.enrichissementTelephoneIA;
      } catch (e) {
        setErreur(e.message);
        break;
      }
    }
    setProgressionImport(null);
    setResultatImport(tousResultats);
    setDernierImportAvecIa(avecIa);
    setApercu(null);
    onImporte?.();
    setEnImport(false);
  }

  const compteursImport = resultatImport?.reduce((acc, r) => ({ ...acc, [r.statut]: (acc[r.statut] || 0) + 1 }), {});

  return (
    <div className="px-4 pb-4 space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Recherche de vraies entreprises dans le répertoire Sirene (INSEE) filtrées par secteur — pas de génération
        par IA : un modèle de langage inventerait des SIREN à l'échelle, inutilisables pour de vrais appels.
      </p>

      <form onSubmit={rechercher} className="flex flex-wrap items-end gap-3">
        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Secteur
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
          >
            <option value="">Choisir…</option>
            {categoriesChoisissables.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Département (optionnel)
          <input
            type="text"
            placeholder="Ex : 59"
            value={departement}
            onChange={(e) => setDepartement(e.target.value)}
            className="mt-1 block w-24 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Quantité (max 300)
          <input
            type="number"
            min={1}
            max={300}
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            className="mt-1 block w-24 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={!categorie || enRecherche}
          className="rounded-lg bg-purple-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
        >
          {enRecherche ? "Recherche…" : "Rechercher des candidats"}
        </button>
      </form>

      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}

      {apercu && (
        <div className="space-y-3 border border-purple-200 dark:border-purple-900/50 rounded-lg p-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            <strong>{apercu.total}</strong> entreprise{apercu.total > 1 ? "s" : ""} trouvée
            {apercu.total > 1 ? "s" : ""} pour « {apercu.categorieLabel} »
            {departement ? ` (département ${departement})` : ""}, pas encore dans le CRM.
          </p>

          {apercu.total > 0 && (
            <>
              <ul className="text-xs text-slate-500 dark:text-slate-400 max-h-32 overflow-y-auto space-y-0.5">
                {apercu.entreprises.slice(0, 15).map((e) => (
                  <li key={e.siren}>
                    {e.nom} — {e.ville}
                  </li>
                ))}
                {apercu.total > 15 && <li>… et {apercu.total - 15} de plus.</li>}
              </ul>

              <label
                className={`flex items-center gap-2 text-xs ${
                  iaConfiguree === false ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-300"
                }`}
                title={
                  iaConfiguree === false
                    ? "Recherche IA non configurée côté serveur (GEMINI_API_KEY manquante)."
                    : undefined
                }
              >
                <input
                  type="checkbox"
                  checked={rechercheTelephoneIA && iaConfiguree !== false}
                  disabled={iaConfiguree === false}
                  onChange={(e) => setRechercheTelephoneIA(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                🤖 Rechercher automatiquement le téléphone officiel de chaque entreprise via IA (Gemini) après
                l'import, pour des fiches prêtes au Power Dialer
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Nom de cette vague (ex : Construction — Nord)"
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  className="flex-1 min-w-[220px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
                />
                {agents?.length > 0 && (
                  <select
                    value={assigneA}
                    onChange={(e) => setAssigneA(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-2 py-2 text-sm"
                  >
                    <option value="">Non assigné</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.prenom || a.email}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={importer}
                  disabled={enImport || !lot.trim()}
                  className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium px-4 py-2 disabled:opacity-40 whitespace-nowrap"
                >
                  {enImport ? progressionImport || "Import…" : `Importer cette vague (${apercu.total})`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {resultatImport && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {compteursImport.cree || 0} créé{(compteursImport.cree || 0) > 1 ? "s" : ""} ·{" "}
          {compteursImport.existant || 0} déjà existant{(compteursImport.existant || 0) > 1 ? "s" : ""} ·{" "}
          {compteursImport.radiee || 0} radié{(compteursImport.radiee || 0) > 1 ? "s" : ""} ·{" "}
          {compteursImport.erreur || 0} erreur{(compteursImport.erreur || 0) > 1 ? "s" : ""} — catégorie assignée
          automatiquement, à vérifier au premier appel.
          {dernierImportAvecIa && (
            <>
              {" "}🤖 Recherche des numéros de téléphone via IA lancée en arrière-plan — les fiches se complètent
              progressivement, actualisez la liste dans quelques instants.
            </>
          )}
        </p>
      )}
    </div>
  );
}
