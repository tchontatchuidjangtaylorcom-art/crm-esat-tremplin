import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import Header from "../components/Header.jsx";
import StatCard from "../components/StatCard.jsx";
import EntrepriseTable from "../components/EntrepriseTable.jsx";
import RechercheSiren from "../components/RechercheSiren.jsx";
import DialerPanel from "../components/DialerPanel.jsx";
import UserMenu from "../components/UserMenu.jsx";
import Sidebar from "../components/Sidebar.jsx";
import ImportLot from "../components/ImportLot.jsx";
import EnrichissementTelephones from "../components/EnrichissementTelephones.jsx";
import KpiObjectifMensuel from "../components/KpiObjectifMensuel.jsx";
import BanniereSupervision from "../components/BanniereSupervision.jsx";
import { useTheme } from "../useTheme.js";
import { useAuth } from "../AuthContext.jsx";
import { useSupervision } from "../SupervisionContext.jsx";
import { ORDRE_STATUTS } from "../constants.js";

const TAILLES_PAGE = [10, 20, 50];

// Sorties considérées comme des fiches "qualifiées" pour l'objectif mensuel
// de prospection (dossier envoyé en atelier ou réglé, pas un abandon).
const STATUTS_QUALIFIES = new Set(["fiche", "fiche_one_shot", "conforme"]);
const OBJECTIF_MENSUEL_MIN = 20;
const OBJECTIF_MENSUEL_MAX = 30;

function correspondRecherche(e, recherche) {
  if (!recherche.trim()) return true;
  const q = recherche.trim().toLowerCase();
  return e.nom.toLowerCase().includes(q) || e.siret.includes(q) || e.codePostal.includes(q);
}

export default function Dashboard() {
  const { theme, basculer } = useTheme();
  const { utilisateur } = useAuth();
  const { agentSupervise } = useSupervision();
  const estAdmin = utilisateur?.role === "admin";
  // Mode Manager : un admin consulte le pipeline "comme si" il était l'agent
  // choisi (voir UserMenu > "Voir le compte de…") — jamais l'inverse.
  const commeAgentId = estAdmin ? agentSupervise?.id : null;
  const [entreprises, setEntreprises] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lots, setLots] = useState([]);
  const [agents, setAgents] = useState([]);
  const [archives, setArchives] = useState([]);
  const [nbArchivees, setNbArchivees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState(null);
  const [filtreCategorie, setFiltreCategorie] = useState("");
  const [filtreLot, setFiltreLot] = useState("");
  const [prioritairesUniquement, setPrioritairesUniquement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [tailleParPage, setTailleParPage] = useState(20);
  const [page, setPage] = useState(1);

  function charger() {
    const appels = [
      api.listEntreprises(commeAgentId),
      api.listCategories(),
      api.listLots(),
      api.listArchives(commeAgentId),
    ];
    if (estAdmin) appels.push(api.listUtilisateurs());
    return Promise.all(appels)
      .then(([e, c, l, a, u]) => {
        setEntreprises(e);
        setCategories(c);
        setLots(l);
        setArchives(a);
        setNbArchivees(a.length);
        if (u) setAgents(u.filter((util) => util.statut === "valide"));
        setErreur(null);
      })
      .catch((e) => setErreur(e.message));
  }

  useEffect(() => {
    setLoading(true);
    charger().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estAdmin, commeAgentId]);

  // Revient à la première page dès qu'un filtre ou la taille de page change,
  // pour ne jamais rester bloqué sur une page qui n'a plus de résultats.
  useEffect(() => {
    setPage(1);
  }, [filtreStatut, filtreCategorie, filtreLot, prioritairesUniquement, recherche, tailleParPage]);

  // Reçoit les mises à jour émises par le panneau d'appel (module AGIR / VoIP)
  // sans avoir à tout recharger depuis l'API.
  useEffect(() => {
    function onMaj(ev) {
      const maj = ev.detail;
      setEntreprises((prev) => prev.map((e) => (e.id === maj.id ? maj : e)));
    }
    function onArchive(ev) {
      setEntreprises((prev) => prev.filter((e) => e.id !== ev.detail.id));
      setArchives((prev) => [ev.detail, ...prev]);
      setNbArchivees((n) => n + 1);
    }
    window.addEventListener("entreprise:maj", onMaj);
    window.addEventListener("entreprise:archivee", onArchive);
    return () => {
      window.removeEventListener("entreprise:maj", onMaj);
      window.removeEventListener("entreprise:archivee", onArchive);
    };
  }, []);

  // Chaque compteur de facette (statut, catégorie, lot) s'appuie sur les
  // MÊMES filtres actifs que la liste, à l'exception de sa propre dimension —
  // sinon un compteur peut afficher un nombre que la liste, elle, filtre à
  // zéro (ex. "À relancer : 2" alors que ces 2 dossiers sont exclus par
  // "Prioritaires uniquement"), ce qui donne l'impression d'un filtre cassé.
  const compteurs = useMemo(() => {
    const c = Object.fromEntries(ORDRE_STATUTS.map((s) => [s, 0]));
    for (const e of entreprises) {
      if (prioritairesUniquement && !e.oeth?.assujetti) continue;
      if (filtreCategorie && e.categorie?.cle !== filtreCategorie) continue;
      if (filtreLot && e.lot !== filtreLot) continue;
      if (!correspondRecherche(e, recherche)) continue;
      if (c[e.statut] !== undefined) c[e.statut] += 1;
    }
    return c;
  }, [entreprises, prioritairesUniquement, filtreCategorie, filtreLot, recherche]);

  const compteursCategorie = useMemo(() => {
    const c = {};
    for (const e of entreprises) {
      if (prioritairesUniquement && !e.oeth?.assujetti) continue;
      if (filtreStatut && e.statut !== filtreStatut) continue;
      if (filtreLot && e.lot !== filtreLot) continue;
      if (!correspondRecherche(e, recherche)) continue;
      const cle = e.categorie?.cle;
      if (cle) c[cle] = (c[cle] || 0) + 1;
    }
    return c;
  }, [entreprises, prioritairesUniquement, filtreStatut, filtreLot, recherche]);

  const compteursLot = useMemo(() => {
    const c = {};
    for (const e of entreprises) {
      if (prioritairesUniquement && !e.oeth?.assujetti) continue;
      if (filtreStatut && e.statut !== filtreStatut) continue;
      if (filtreCategorie && e.categorie?.cle !== filtreCategorie) continue;
      if (!correspondRecherche(e, recherche)) continue;
      if (e.lot) c[e.lot] = (c[e.lot] || 0) + 1;
    }
    return c;
  }, [entreprises, prioritairesUniquement, filtreStatut, filtreCategorie, recherche]);

  // Fiches qualifiées ce mois-ci : une sortie "fiche"/"fiche one-shot"/
  // "conforme" journalisée dans le mois courant, comptée une seule fois par
  // entreprise même si plusieurs sorties qualifiées s'y sont enchaînées.
  const nbQualifieesCeMois = useMemo(() => {
    const maintenant = new Date();
    let n = 0;
    for (const e of [...entreprises, ...archives]) {
      const aUneSortieQualifieeCeMois = (e.historiqueAppels || []).some((h) => {
        if (h.type !== "sortie" || !STATUTS_QUALIFIES.has(h.issue)) return false;
        const d = new Date(h.date);
        return d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth();
      });
      if (aUneSortieQualifieeCeMois) n++;
    }
    return n;
  }, [entreprises, archives]);

  const nbPrioritaires = useMemo(() => entreprises.filter((e) => e.oeth?.assujetti).length, [entreprises]);

  const nbSansTelephone = useMemo(() => entreprises.filter((e) => !e.contact?.telephone).length, [entreprises]);

  const entreprisesFiltrees = useMemo(() => {
    let liste = entreprises.filter((e) => {
      if (prioritairesUniquement && !e.oeth?.assujetti) return false;
      if (filtreStatut && e.statut !== filtreStatut) return false;
      if (filtreCategorie && e.categorie?.cle !== filtreCategorie) return false;
      if (filtreLot && e.lot !== filtreLot) return false;
      return correspondRecherche(e, recherche);
    });

    // Priorité : déficit d'unités bénéficiaires le plus élevé en tête.
    liste = [...liste].sort((a, b) => (b.oeth?.deficit || 0) - (a.oeth?.deficit || 0));
    return liste;
  }, [entreprises, filtreStatut, filtreCategorie, filtreLot, prioritairesUniquement, recherche]);

  const nbPages = Math.max(1, Math.ceil(entreprisesFiltrees.length / tailleParPage));
  const pageCourante = Math.min(page, nbPages);
  const entreprisesPage = useMemo(
    () => entreprisesFiltrees.slice((pageCourante - 1) * tailleParPage, pageCourante * tailleParPage),
    [entreprisesFiltrees, pageCourante, tailleParPage]
  );

  function assignerEntreprise(id, utilisateurId) {
    return api.assignerEntreprise(id, utilisateurId).then((maj) => {
      setEntreprises((prev) => prev.map((e) => (e.id === id ? maj : e)));
    });
  }

  function assignerLotEntier(utilisateurId) {
    if (!filtreLot) return;
    return api.assignerLot(filtreLot, utilisateurId).then(charger);
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
        <Header />
        <UserMenu theme={theme} onBasculerTheme={basculer} />
      </div>

      <BanniereSupervision />

      <KpiObjectifMensuel valeur={nbQualifieesCeMois} min={OBJECTIF_MENSUEL_MIN} max={OBJECTIF_MENSUEL_MAX} />

      {erreur && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          Impossible de charger les données ({erreur}). Vérifiez que le serveur API tourne sur le port 4000.
        </div>
      )}

      {/* Bloc d'import indépendant, pleine largeur : ni imbriqué dans la barre
          latérale (qui reste "sticky" et courte), ni limité à sa largeur
          étroite — ses propres onglets/listes défilent au besoin sans jamais
          bloquer le défilement général de la page. Réservé aux admins :
          l'import en masse est une décision de constitution de pipeline. */}
      {estAdmin && !commeAgentId && (
        <div className="mb-4">
          <EnrichissementTelephones manquants={nbSansTelephone} onMaj={charger} />
          <ImportLot categories={categories} agents={agents} onImporte={charger} />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <Sidebar
          categories={categories}
          compteursCategorie={compteursCategorie}
          filtreCategorie={filtreCategorie}
          onFiltreCategorie={setFiltreCategorie}
          lots={lots}
          compteursLot={compteursLot}
          filtreLot={filtreLot}
          onFiltreLot={setFiltreLot}
        />

        <div className="flex-1 min-w-0">
          <RechercheSiren
            onEntreprise={(entreprise, existant, archive) => {
              if (archive) {
                setNbArchivees((n) => n + (existant ? 0 : 1));
                return;
              }
              setEntreprises((prev) => {
                const dejaPresente = prev.some((e) => e.id === entreprise.id);
                if (dejaPresente) return prev.map((e) => (e.id === entreprise.id ? entreprise : e));
                return existant ? prev : [entreprise, ...prev];
              });
            }}
          />

          <DialerPanel entreprises={entreprisesFiltrees} />

          <div className="flex flex-wrap gap-2 mb-3">
            {ORDRE_STATUTS.map((statut) => (
              <StatCard
                key={statut}
                statut={statut}
                count={compteurs[statut]}
                active={filtreStatut === statut}
                onClick={() => setFiltreStatut(filtreStatut === statut ? null : statut)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Entreprises
              {filtreStatut ? ` — statut : ${filtreStatut}` : ""}
              {filtreCategorie ? ` — secteur filtré` : ""}
              {filtreLot ? ` — ${filtreLot}` : ""}
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={prioritairesUniquement}
                  onChange={(e) => setPrioritairesUniquement(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Prioritaires uniquement (effectif ≥ 20) — {nbPrioritaires}/{entreprises.length}
              </label>

              <span
                className="text-sm text-slate-400 dark:text-slate-500"
                title="Dossiers 'conforme'/'refus'/'mort' archivés automatiquement, hors pipeline actif"
              >
                Archivées : {nbArchivees}
              </span>

              <input
                type="text"
                placeholder="Rechercher (société, SIRET, code postal)…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="w-72 max-w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>

          {estAdmin && filtreLot && (
            <div className="flex flex-wrap items-center gap-2 mb-3 text-sm bg-marine-50 dark:bg-marine-950/30 border border-marine-200 dark:border-marine-900/50 rounded-lg px-3 py-2">
              <span className="text-slate-600 dark:text-slate-300">
                Assigner toute la vague « {filtreLot} » à :
              </span>
              <select
                onChange={(e) => e.target.value && assignerLotEntier(e.target.value).then(() => (e.target.value = ""))}
                defaultValue=""
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-2 py-1 text-sm"
              >
                <option value="" disabled>
                  Choisir un agent…
                </option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.prenom || a.email} {a.role === "admin" ? "(admin)" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={() => assignerLotEntier(null)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
              >
                Retirer l'assignation
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-slate-400 dark:text-slate-500 text-sm">Chargement…</div>
          ) : (
            <>
              <EntrepriseTable entreprises={entreprisesPage} estAdmin={estAdmin} agents={agents} onAssigner={assignerEntreprise} />

              <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-sm text-slate-500 dark:text-slate-400">
                <label className="flex items-center gap-2">
                  Afficher
                  <select
                    value={tailleParPage}
                    onChange={(e) => setTailleParPage(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
                  >
                    {TAILLES_PAGE.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  par page — {entreprisesFiltrees.length} au total
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pageCourante <= 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-40"
                  >
                    Précédent
                  </button>
                  <span>
                    Page {pageCourante} / {nbPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(nbPages, p + 1))}
                    disabled={pageCourante >= nbPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-40"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
