import { useEffect, useState } from "react";
import { api } from "../api.js";
import { TERRITOIRES } from "../territoires.js";
import SelecteurPersonne from "./SelecteurPersonne.jsx";
import { extraireDepuisFichier, extraireDepuisTexte } from "../extractionEntreprises.js";

// Import par fichier / liste : petits appels (le serveur interroge Sirene
// pour chaque entrée), 300 entreprises maximum par import.
const TAILLE_APPEL_FICHIER = 10;
const MAX_ENTREES_FICHIER = 300;

// Import d'une vague de prospection (Lot 1, Lot 2…), soit à partir d'une
// liste de SIREN saisie à la main, soit générée automatiquement à partir
// d'un secteur du CRM (recherche de VRAIES entreprises dans le répertoire
// Sirene par code NAF — voir GenererVagueSecteur ci-dessous, et la note dans
// server/src/insee.js sur pourquoi ce n'est pas un modèle de langage qui
// choisit les entreprises). Replié par défaut pour ne pas surcharger le
// tableau de bord.
export default function ImportLot({ categories, agents, moiId, lots = [], lotsParSecteur = {}, onImporte }) {
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState("siren");
  const [lot, setLot] = useState("");
  const [sirensTexte, setSirensTexte] = useState("");
  const [assigneA, setAssigneA] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);
  // Entreprises lues dans un fichier (Excel, CSV, Word…) : { siren } ou { nom }.
  const [depuisFichier, setDepuisFichier] = useState(null);
  const [nomFichier, setNomFichier] = useState("");
  const [lectureFichier, setLectureFichier] = useState(false);
  const [rechercheIA, setRechercheIA] = useState(true);
  const [progression, setProgression] = useState(null);
  const [iaLancee, setIaLancee] = useState(false);

  // Entrées à importer : fichier chargé, sinon texte collé (SIREN, SIRET ou
  // nom d'entreprise, un par ligne).
  const entrees = depuisFichier || extraireDepuisTexte(sirensTexte);

  async function lireFichier(ev) {
    const fichier = ev.target.files?.[0];
    ev.target.value = "";
    if (!fichier) return;
    setLectureFichier(true);
    setErreur(null);
    setResultat(null);
    try {
      const lues = await extraireDepuisFichier(fichier);
      if (lues.length === 0) throw new Error("Aucun SIREN, SIRET ni nom d'entreprise trouvé dans ce fichier.");
      setDepuisFichier(lues);
      setNomFichier(fichier.name);
      if (!lot.trim()) setLot(fichier.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setLectureFichier(false);
    }
  }

  async function soumettre(ev) {
    ev.preventDefault();
    if (!lot.trim()) {
      setErreur("Merci de nommer ce lot (ex : « Lot 3 »).");
      return;
    }
    if (entrees.length === 0) {
      setErreur("Ajoutez un fichier, ou collez des SIREN / noms d'entreprise (un par ligne).");
      return;
    }
    if (entrees.length > MAX_ENTREES_FICHIER) {
      setErreur(`${entrees.length} entreprises détectées : ${MAX_ENTREES_FICHIER} maximum par import, découpez le fichier.`);
      return;
    }

    setEnCours(true);
    setErreur(null);
    setResultat(null);
    setIaLancee(false);
    const tous = [];
    try {
      for (let i = 0; i < entrees.length; i += TAILLE_APPEL_FICHIER) {
        setProgression(`${i} / ${entrees.length}`);
        const morceau = entrees.slice(i, i + TAILLE_APPEL_FICHIER);
        let reponse = null;
        for (let essai = 0; essai <= DELAIS_REESSAI_MS.length && !reponse; essai++) {
          try {
            const res = await fetch("/api/leads/import-fichier", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ entrees: morceau, lot: lot.trim(), assigneA: assigneA || null, rechercheIA }),
            });
            const donnees = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(donnees.error || `Erreur HTTP ${res.status}`);
            reponse = donnees;
          } catch (e) {
            if (essai === DELAIS_REESSAI_MS.length) throw e;
            await new Promise((r) => setTimeout(r, DELAIS_REESSAI_MS[essai]));
          }
        }
        tous.push(...reponse.resultats);
        if (reponse.rechercheIA) setIaLancee(true);
        setResultat([...tous]);
      }
      setDepuisFichier(null);
      setNomFichier("");
      setSirensTexte("");
    } catch (e) {
      setErreur(
        `Import interrompu après ${tous.length} / ${entrees.length} (${e.message}). Relancez : les entreprises déjà importées seront simplement ignorées.`
      );
    } finally {
      setProgression(null);
      setEnCours(false);
      onImporte?.();
    }
  }

  const compteurs = resultat?.reduce(
    (acc, r) => ({ ...acc, [r.statut]: (acc[r.statut] || 0) + 1 }),
    {}
  );
  // Motifs d'écartement regroupés ("moins de 20 salariés" : 12…).
  const motifsEcartes = Object.entries(
    (resultat || [])
      .filter((r) => r.statut === "ecartee" || r.statut === "introuvable")
      .reduce((acc, r) => {
        const motif = r.motif.replace(/\s*\(.*\)$/, "");
        (acc[motif] ||= []).push(r);
        return acc;
      }, {})
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
            <GenererVagueSecteur
              categories={categories}
              agents={agents}
              moiId={moiId}
              lots={lots}
              lotsParSecteur={lotsParSecteur}
              onImporte={onImporte}
            />
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
                    <span className="mt-1 block">
                      <SelecteurPersonne
                        personnes={agents}
                        moiId={moiId}
                        valeur={assigneA}
                        onChange={setAssigneA}
                        optionsSpeciales={[{ valeur: "", label: "Non assigné (à distribuer plus tard)" }]}
                        placeholder="Non assigné (à distribuer plus tard)"
                        className="px-3 py-2 text-sm w-64"
                      />
                    </span>
                  </label>
                )}
              </div>

              {/* Fichier : Excel, OpenDocument, CSV, texte ou Word. */}
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-2.5">
                <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg bg-marine-700 hover:bg-marine-800 text-white text-sm font-medium px-3 py-1.5">
                  📄 Choisir un fichier
                  <input
                    type="file"
                    accept=".xlsx,.xlsm,.xls,.ods,.csv,.txt,.tsv,.docx"
                    onChange={lireFichier}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {lectureFichier
                    ? "Lecture du fichier…"
                    : depuisFichier
                      ? `${nomFichier} : ${depuisFichier.length} entreprise${depuisFichier.length > 1 ? "s" : ""} détectée${depuisFichier.length > 1 ? "s" : ""}`
                      : "Excel, CSV, Word ou texte — SIREN, SIRET ou simplement le nom des entreprises."}
                </span>
                {depuisFichier && (
                  <button
                    type="button"
                    onClick={() => {
                      setDepuisFichier(null);
                      setNomFichier("");
                    }}
                    className="text-xs text-slate-500 hover:text-red-600"
                  >
                    Retirer le fichier
                  </button>
                )}
              </div>

              {!depuisFichier && (
                <label className="block text-xs text-slate-500 dark:text-slate-400">
                  … ou collez une liste : SIREN, SIRET ou nom d'entreprise (un par ligne)
                  <textarea
                    value={sirensTexte}
                    onChange={(e) => setSirensTexte(e.target.value)}
                    placeholder={"552100554\nDalkia Froid Solutions\n214401093\n..."}
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm font-mono"
                  />
                </label>
              )}

              {entrees.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {entrees.filter((e) => e.siren).length} numéro(s) SIREN / SIRET · {entrees.filter((e) => e.nom).length} nom(s)
                  d'entreprise (retrouvés dans Sirene). Écartées automatiquement : moins de 20 salariés, entreprises fermées,
                  créées il y a moins de 5 ans, déjà dans le CRM.
                </p>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={rechercheIA} onChange={(e) => setRechercheIA(e.target.checked)} />
                Rechercher automatiquement les numéros de téléphone et le contact RH (IA, en arrière-plan)
              </label>

              <button
                type="submit"
                disabled={enCours || lectureFichier || entrees.length === 0}
                className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium px-4 py-2 disabled:opacity-40"
              >
                {enCours ? `Import en cours… ${progression || ""}` : `Importer ${entrees.length || ""} entreprise${entrees.length > 1 ? "s" : ""}`}
              </button>

              {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}

              {resultat && (
                <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
                  <p>
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {compteurs.cree || 0} fiche{(compteurs.cree || 0) > 1 ? "s" : ""} créée{(compteurs.cree || 0) > 1 ? "s" : ""}
                    </strong>{" "}
                    · {compteurs.existant || 0} déjà dans le CRM · {compteurs.ecartee || 0} écartée
                    {(compteurs.ecartee || 0) > 1 ? "s" : ""} · {compteurs.introuvable || 0} introuvable
                    {(compteurs.introuvable || 0) > 1 ? "s" : ""}
                    {compteurs.erreur ? ` · ${compteurs.erreur} erreur${compteurs.erreur > 1 ? "s" : ""}` : ""}
                  </p>
                  {iaLancee && (
                    <p className="text-xs text-marine-700 dark:text-marine-300">
                      🔎 Recherche des numéros et du contact RH lancée en arrière-plan pour les fiches créées.
                    </p>
                  )}
                  {motifsEcartes.map(([motif, lignes]) => (
                    <details key={motif} className="text-xs">
                      <summary className="cursor-pointer">
                        {motif} : {lignes.length}
                      </summary>
                      <ul className="mt-1 ml-4 list-disc text-slate-500 dark:text-slate-400">
                        {lignes.map((r, i) => (
                          <li key={i}>
                            {r.nom ? `${r.nom}${r.nom !== r.saisie ? ` (${r.saisie})` : ""}` : r.saisie}
                            {/\(.*\)$/.test(r.motif) ? ` — ${r.motif.match(/\((.*)\)$/)[1]}` : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                  {compteurs.erreur > 0 && (
                    <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                      {resultat
                        .filter((r) => r.statut === "erreur")
                        .map((r, i) => (
                          <li key={i}>
                            {r.saisie} : {r.motif}
                          </li>
                        ))}
                    </ul>
                  )}
                  {compteurs.cree > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer">Fiches créées : {compteurs.cree}</summary>
                      <ul className="mt-1 ml-4 list-disc text-slate-500 dark:text-slate-400">
                        {resultat
                          .filter((r) => r.statut === "cree")
                          .map((r, i) => (
                            <li key={i}>
                              {r.nom} — {r.ville} · {r.effectif}
                            </li>
                          ))}
                      </ul>
                    </details>
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

// Petits morceaux plutôt qu'un seul appel de 100 SIREN : côté serveur chaque
// SIREN coûte un appel Sirene + une pause, un appel de 100 restait ouvert
// une à deux minutes et tombait en 502 au moindre redémarrage de l'instance
// Render. Des morceaux de 10 gardent chaque requête courte, donnent une vraie
// progression et, en cas d'échec transitoire, sont simplement renvoyés :
// l'import est idempotent (les SIREN déjà créés reviennent "existant").
const TAILLE_MAX_APPEL = 10;
const DELAIS_REESSAI_MS = [3000, 10000, 30000];

// Génère une vague de prospects à partir d'un secteur du CRM : recherche de
// VRAIES entreprises dans le répertoire Sirene (INSEE) par code NAF — voir
// server/src/insee.js pour le détail (délibérément pas une liste inventée
// par un modèle de langage). Prévisualisation obligatoire avant import :
// l'agent voit le nombre et un échantillon avant de créer quoi que ce soit.
// Nom proposé pour une nouvelle vague : « <Secteur> <n> », n étant le
// numéro suivant. Tient compte des vagues « <Secteur> n » existantes ET du
// nombre de vagues déjà présentes dans ce secteur (y compris celles nommées
// à la main, ex. « nettoyage 1 »), et évite tout nom déjà utilisé.
function prochainNomVague(label, dejaDansSecteur, tousLesLots) {
  if (!label) return "";
  const prefixe = `${label} `.toLowerCase();
  let max = dejaDansSecteur.length;
  for (const l of tousLesLots) {
    const nom = String(l).toLowerCase();
    if (nom.startsWith(prefixe) && /^\d+$/.test(nom.slice(prefixe.length))) {
      max = Math.max(max, Number(nom.slice(prefixe.length)));
    }
  }
  const utilises = new Set(tousLesLots.map((l) => String(l).toLowerCase()));
  let n = max + 1;
  while (utilises.has(`${prefixe}${n}`)) n += 1;
  return `${label} ${n}`;
}

function GenererVagueSecteur({ categories, agents, moiId, lots = [], lotsParSecteur = {}, onImporte }) {
  const [categorie, setCategorie] = useState("");

  function nomPropose(cle, enPlus = []) {
    const label = categories.find((c) => c.value === cle)?.label;
    const dejaDansSecteur = [...new Set([...(lotsParSecteur[cle] || []), ...enPlus])];
    return prochainNomVague(label, dejaDansSecteur, [...lots, ...dejaDansSecteur]);
  }

  // Changer de secteur remplace le nom de vague par le suivant pour ce
  // secteur : évite de réutiliser par erreur le nom de la vague précédente.
  function choisirCategorie(cle) {
    setCategorie(cle);
    setLot(nomPropose(cle));
  }
  const [departement, setDepartement] = useState("");
  // Territoire ("" = tous) : un DOM (974…) sert de filtre, la métropole
  // exclut l'outre-mer ; seules les entreprises dont le siège est dans le
  // territoire sont retenues (voir /api/leads/secteur/rechercher).
  const [territoire, setTerritoire] = useState("");
  const territoireOutreMer = territoire && territoire !== "metropole";
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
        departement: territoireOutreMer ? null : departement.trim() || null,
        limite: Math.min(Number(quantite) || 100, 300),
        territoire: territoire || null,
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
      let reponse = null;
      let derniereErreur = null;
      for (let essai = 0; essai <= DELAIS_REESSAI_MS.length; essai++) {
        try {
          reponse = await api.importerProspectsParSecteur(
            categorie,
            lot.trim(),
            morceau,
            assigneA || null,
            rechercheTelephoneIA
          );
          break;
        } catch (e) {
          derniereErreur = e;
          if (essai === DELAIS_REESSAI_MS.length) break;
          setProgressionImport(`${tousResultats.length} / ${sirens.length} — nouvel essai…`);
          await new Promise((resolve) => setTimeout(resolve, DELAIS_REESSAI_MS[essai]));
        }
      }
      if (!reponse) {
        setErreur(
          `Import interrompu après ${tousResultats.length} / ${sirens.length} fiches (${derniereErreur?.message}). ` +
            "Relancez la même vague : les fiches déjà importées seront simplement ignorées."
        );
        break;
      }
      tousResultats.push(...reponse.resultats);
      avecIa = avecIa || reponse.enrichissementTelephoneIA;
    }
    setProgressionImport(null);
    setResultatImport(tousResultats);
    setDernierImportAvecIa(avecIa);
    // Prochaine génération dans ce secteur : numéro suivant.
    setLot(nomPropose(categorie, [lot.trim()]));
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
            onChange={(e) => choisirCategorie(e.target.value)}
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
          Territoire
          <select
            value={territoire}
            onChange={(e) => setTerritoire(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
          >
            <option value="">Tous territoires</option>
            {TERRITOIRES.map((t) => (
              <option key={t.cle} value={t.cle}>
                {t.nom}
                {t.cle !== "metropole" ? ` (${t.cle})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-500 dark:text-slate-400">
          Département (optionnel)
          <input
            type="text"
            placeholder={territoireOutreMer ? territoire : "Ex : 59"}
            value={territoireOutreMer ? territoire : departement}
            disabled={Boolean(territoireOutreMer)}
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
          className="rounded-lg bg-marine-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
        >
          {enRecherche ? "Recherche…" : "Rechercher des candidats"}
        </button>
      </form>

      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}

      {apercu && (
        <div className="space-y-3 border border-marine-200 dark:border-marine-900/50 rounded-lg p-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            <strong>{apercu.total}</strong> entreprise{apercu.total > 1 ? "s" : ""} trouvée
            {apercu.total > 1 ? "s" : ""} pour « {apercu.categorieLabel} »
            {territoire ? ` — ${TERRITOIRES.find((t) => t.cle === territoire)?.nom}` : ""}
            {departement && !territoireOutreMer ? ` (département ${departement})` : ""}, pas encore dans le CRM.
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
                    ? "Recherche IA non configurée côté serveur (ANTHROPIC_API_KEY manquante)."
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
                🤖 Rechercher automatiquement le téléphone officiel de chaque entreprise via IA (Claude) après
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
                  <SelecteurPersonne
                    personnes={agents}
                    moiId={moiId}
                    valeur={assigneA}
                    onChange={setAssigneA}
                    optionsSpeciales={[{ valeur: "", label: "Non assigné" }]}
                    placeholder="Non assigné"
                    className="px-2 py-2 text-sm w-52"
                  />
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
