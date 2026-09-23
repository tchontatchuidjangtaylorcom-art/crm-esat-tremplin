import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import Header from "../components/Header.jsx";
import StatCard from "../components/StatCard.jsx";
import EntrepriseTable from "../components/EntrepriseTable.jsx";
import RechercheSiren from "../components/RechercheSiren.jsx";
import DialerPanel from "../components/DialerPanel.jsx";
import UserMenu from "../components/UserMenu.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useTheme } from "../useTheme.js";
import { ORDRE_STATUTS } from "../constants.js";

export default function Dashboard() {
  const { theme, basculer } = useTheme();
  const [entreprises, setEntreprises] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lots, setLots] = useState([]);
  const [nbArchivees, setNbArchivees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState(null);
  const [filtreCategorie, setFiltreCategorie] = useState("");
  const [filtreLot, setFiltreLot] = useState("");
  const [prioritairesUniquement, setPrioritairesUniquement] = useState(true);
  const [recherche, setRecherche] = useState("");

  function charger() {
    return Promise.all([api.listEntreprises(), api.listCategories(), api.listLots(), api.listArchives()])
      .then(([e, c, l, a]) => {
        setEntreprises(e);
        setCategories(c);
        setLots(l);
        setNbArchivees(a.length);
        setErreur(null);
      })
      .catch((e) => setErreur(e.message));
  }

  useEffect(() => {
    charger().finally(() => setLoading(false));
  }, []);

  // Reçoit les mises à jour émises par le panneau d'appel (module AGIR / VoIP)
  // sans avoir à tout recharger depuis l'API.
  useEffect(() => {
    function onMaj(ev) {
      const maj = ev.detail;
      setEntreprises((prev) => prev.map((e) => (e.id === maj.id ? maj : e)));
    }
    function onArchive(ev) {
      setEntreprises((prev) => prev.filter((e) => e.id !== ev.detail.id));
      setNbArchivees((n) => n + 1);
    }
    window.addEventListener("entreprise:maj", onMaj);
    window.addEventListener("entreprise:archivee", onArchive);
    return () => {
      window.removeEventListener("entreprise:maj", onMaj);
      window.removeEventListener("entreprise:archivee", onArchive);
    };
  }, []);

  const compteurs = useMemo(() => {
    const c = Object.fromEntries(ORDRE_STATUTS.map((s) => [s, 0]));
    for (const e of entreprises) {
      if (c[e.statut] !== undefined) c[e.statut] += 1;
    }
    return c;
  }, [entreprises]);

  const compteursCategorie = useMemo(() => {
    const c = {};
    for (const e of entreprises) {
      const cle = e.categorie?.cle;
      if (cle) c[cle] = (c[cle] || 0) + 1;
    }
    return c;
  }, [entreprises]);

  const compteursLot = useMemo(() => {
    const c = {};
    for (const e of entreprises) {
      if (e.lot) c[e.lot] = (c[e.lot] || 0) + 1;
    }
    return c;
  }, [entreprises]);

  const nbPrioritaires = useMemo(() => entreprises.filter((e) => e.oeth?.assujetti).length, [entreprises]);

  const entreprisesFiltrees = useMemo(() => {
    let liste = entreprises.filter((e) => {
      if (prioritairesUniquement && !e.oeth?.assujetti) return false;
      if (filtreStatut && e.statut !== filtreStatut) return false;
      if (filtreCategorie && e.categorie?.cle !== filtreCategorie) return false;
      if (filtreLot && e.lot !== filtreLot) return false;
      if (recherche.trim()) {
        const q = recherche.trim().toLowerCase();
        return e.nom.toLowerCase().includes(q) || e.siret.includes(q) || e.codePostal.includes(q);
      }
      return true;
    });

    // Priorité : déficit d'unités bénéficiaires le plus élevé en tête.
    liste = [...liste].sort((a, b) => (b.oeth?.deficit || 0) - (a.oeth?.deficit || 0));
    return liste;
  }, [entreprises, filtreStatut, filtreCategorie, filtreLot, prioritairesUniquement, recherche]);

  return (
    <div className="min-h-screen p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <Header prenom="Philippe" />
        <UserMenu theme={theme} onBasculerTheme={basculer} />
      </div>

      {erreur && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          Impossible de charger les données ({erreur}). Vérifiez que le serveur API tourne sur le port 4000.
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
          onImporte={charger}
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

          <div className="flex flex-wrap gap-3 mb-6">
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

          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
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
                title="Dossiers 'mort'/'refus' archivés automatiquement, hors pipeline actif"
              >
                Archivées : {nbArchivees}
              </span>

              <input
                type="text"
                placeholder="Rechercher (société, SIRET, code postal)…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="w-72 max-w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-slate-400 dark:text-slate-500 text-sm">Chargement…</div>
          ) : (
            <EntrepriseTable entreprises={entreprisesFiltrees} />
          )}
        </div>
      </div>
    </div>
  );
}
