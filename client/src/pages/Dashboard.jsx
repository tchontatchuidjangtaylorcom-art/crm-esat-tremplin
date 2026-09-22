import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import Header from "../components/Header.jsx";
import StatCard from "../components/StatCard.jsx";
import EntrepriseTable from "../components/EntrepriseTable.jsx";
import RechercheSiren from "../components/RechercheSiren.jsx";
import ImportLot from "../components/ImportLot.jsx";
import { ORDRE_STATUTS } from "../constants.js";

export default function Dashboard() {
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
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <Header prenom="Philippe" />

      {erreur && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          Impossible de charger les données ({erreur}). Vérifiez que le serveur API tourne sur le port 4000.
        </div>
      )}

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

      <ImportLot onImporte={charger} />

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
        <h2 className="text-lg font-semibold text-slate-800">
          Entreprises {filtreStatut ? `— filtre : ${filtreStatut}` : ""}
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
            <input
              type="checkbox"
              checked={prioritairesUniquement}
              onChange={(e) => setPrioritairesUniquement(e.target.checked)}
              className="rounded border-slate-300"
            />
            Prioritaires uniquement (effectif ≥ 20) — {nbPrioritaires}/{entreprises.length}
          </label>

          <select
            value={filtreCategorie}
            onChange={(e) => setFiltreCategorie(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Toutes catégories</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          {lots.length > 0 && (
            <select
              value={filtreLot}
              onChange={(e) => setFiltreLot(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Toutes les vagues</option>
              {lots.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}

          <span className="text-sm text-slate-400" title="Dossiers 'mort' archivés automatiquement, hors pipeline actif">
            Archivées : {nbArchivees}
          </span>

          <input
            type="text"
            placeholder="Rechercher (société, SIRET, code postal)…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-72 max-w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Chargement…</div>
      ) : (
        <EntrepriseTable entreprises={entreprisesFiltrees} />
      )}
    </div>
  );
}
