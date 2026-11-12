import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { BoutonThemeVitrine } from "../../components/vitrine/ThemeVitrine.jsx";
import WidgetGraphiqueTradingView from "../../components/academtrade/WidgetGraphiqueTradingView.jsx";
import WidgetActualitesTradingView from "../../components/academtrade/WidgetActualitesTradingView.jsx";
import PanneauProfilAcademtrade from "../../components/academtrade/PanneauProfilAcademtrade.jsx";

const INTERVALLE_MARCHE_MS = 3000;

function formatNombre(n, decimales = 2) {
  return Number(n).toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

// Résultat net estimé = résultat brut (en pips/points × valeur du tick × lots)
// moins le coût du spread déjà payé à l'ouverture et le swap déjà cumulé —
// exactement ce que le solde simulé reflète déjà au fil de l'eau (voir
// academtradePositions.js côté serveur).
function calculerLigne(position, prixActuel) {
  const diff = prixActuel != null ? prixActuel - position.prixOuverture : 0;
  const pips = diff / position.tailleTick;
  const pnlBrut = position.pnlBrut ?? (pips * position.valeurTick * position.lots * (position.sens === "achat" ? 1 : -1));
  const pnlNet = position.pnlNet ?? (pnlBrut - position.coutSpread - position.swapCumule);
  return { pips: pips * (position.sens === "achat" ? 1 : -1), pnlBrut, pnlNet };
}

export default function EspaceAcademtrade() {
  const navigate = useNavigate();
  const [compte, setCompte] = useState(null);
  const [profilOuvert, setProfilOuvert] = useState(false);
  const [actualitesOuvertes, setActualitesOuvertes] = useState(false);
  const [catalogue, setCatalogue] = useState(null);
  const [marche, setMarche] = useState([]);
  const [categorieId, setCategorieId] = useState(null);
  const [groupeId, setGroupeId] = useState(null);
  const [instrumentId, setInstrumentId] = useState(null);
  const [positions, setPositions] = useState([]);
  const [retraits, setRetraits] = useState([]);
  const [sens, setSens] = useState("achat");
  const [lots, setLots] = useState("0.10");
  const [montantRetrait, setMontantRetrait] = useState("");
  const [erreur, setErreur] = useState(null);
  const [actionEnCours, setActionEnCours] = useState(false);
  const minuteur = useRef(null);

  function rafraichir() {
    api.academtradeMoi().then(setCompte).catch(() => navigate("/academtrade/connexion"));
    api.academtradePositions().then(setPositions).catch(() => {});
    api.academtradeRetraits().then(setRetraits).catch(() => {});
  }

  useEffect(() => {
    rafraichir();
    api.academtradeCatalogue().then((c) => {
      setCatalogue(c);
      setCategorieId((v) => v || c.categories[0]?.id || null);
    });
    minuteur.current = setInterval(() => {
      api.academtradeMarche().then(setMarche).catch(() => {});
    }, INTERVALLE_MARCHE_MS);
    api.academtradeMarche().then(setMarche).catch(() => {});
    return () => clearInterval(minuteur.current);
  }, []);

  const instrumentsCategorie = useMemo(
    () => (catalogue ? catalogue.instruments.filter((i) => i.categorie === categorieId) : []),
    [catalogue, categorieId]
  );
  const groupes = useMemo(() => {
    const ids = [...new Set(instrumentsCategorie.map((i) => i.groupe).filter(Boolean))];
    return ids.map((id) => ({ id, nom: id === "majeures" ? "Paires majeures" : id === "mineures" ? "Paires mineures" : id }));
  }, [instrumentsCategorie]);
  const instrumentsAffiches = useMemo(
    () => (groupes.length ? instrumentsCategorie.filter((i) => i.groupe === (groupeId || groupes[0].id)) : instrumentsCategorie),
    [instrumentsCategorie, groupes, groupeId]
  );
  const instrumentSelectionne = catalogue?.instruments.find((i) => i.id === instrumentId) || instrumentsAffiches[0] || null;
  const prixActuel = marche.find((m) => m.id === instrumentSelectionne?.id)?.prix ?? instrumentSelectionne?.prix ?? null;

  function choisirCategorie(id) {
    setCategorieId(id);
    setGroupeId(null);
    setInstrumentId(null);
  }

  async function deconnexion() {
    await api.academtradeDeconnexion().catch(() => {});
    navigate("/academtrade/connexion");
  }

  async function ouvrirPosition(ev) {
    ev.preventDefault();
    if (!instrumentSelectionne) return;
    setErreur(null);
    setActionEnCours(true);
    try {
      await api.academtradeOuvrirPosition({ instrumentId: instrumentSelectionne.id, sens, lots: Number(lots) });
      rafraichir();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setActionEnCours(false);
    }
  }

  async function fermerPosition(id) {
    setErreur(null);
    setActionEnCours(true);
    try {
      await api.academtradeFermerPosition(id);
      rafraichir();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setActionEnCours(false);
    }
  }

  async function demanderRetrait(ev) {
    ev.preventDefault();
    setErreur(null);
    setActionEnCours(true);
    try {
      await api.academtradeDemanderRetrait(Number(montantRetrait));
      setMontantRetrait("");
      rafraichir();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setActionEnCours(false);
    }
  }

  if (!compte || !catalogue) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" aria-busy="true" />;

  const positionsOuvertes = positions.filter((p) => p.statut === "ouverte");
  const positionsFermees = positions.filter((p) => p.statut === "fermee");

  // Aperçu avant ouverture : marge requise (levier 1:100) + coût du spread.
  const apercu = instrumentSelectionne && prixActuel
    ? {
        marge: prixActuel * instrumentSelectionne.tailleContrat * Number(lots || 0) * 0.01,
        spread: instrumentSelectionne.spread * instrumentSelectionne.valeurTick * Number(lots || 0),
      }
    : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {profilOuvert && <PanneauProfilAcademtrade compte={compte} onFermer={() => setProfilOuvert(false)} onMisAJour={setCompte} />}

      <header className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
        <p className="font-bold text-lg tracking-tight">
          Academ<span className="text-violet-600 dark:text-violet-400">Trade</span>
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setProfilOuvert(true)}
            className="text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-900/15 dark:border-white/15 rounded-full px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5"
          >
            {compte.prenom || compte.email}
          </button>
          <BoutonThemeVitrine />
          <button type="button" onClick={deconnexion} className="text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white">
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 space-y-6">
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm px-4 py-3">
          Environnement pédagogique — le graphique affiche de vraies valeurs de marché (TradingView), mais l'exécution de vos
          positions reste simulée : aucun argent réel n'est investi.
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">Solde simulé</p>
            <p className="text-3xl font-bold mt-1">{formatNombre(compte.soldeSimule)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">Disponible (hors marge immobilisée)</p>
            <p className="text-3xl font-bold mt-1">{formatNombre(compte.soldeDisponible)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl p-5">
          <button type="button" onClick={() => setActualitesOuvertes((v) => !v)} className="text-sm font-semibold text-violet-700 dark:text-violet-400">
            {actualitesOuvertes ? "Masquer les actualités du marché" : "Voir les actualités du marché"}
          </button>
          {actualitesOuvertes && (
            <div className="mt-4">
              <WidgetActualitesTradingView hauteur={320} />
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl p-5">
          <div className="flex flex-wrap gap-2 mb-3">
            {catalogue.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => choisirCategorie(c.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  c.id === categorieId ? "bg-violet-600 text-white" : "bg-slate-900/5 dark:bg-white/5 text-slate-600 dark:text-slate-300"
                }`}
              >
                {c.nom}
              </button>
            ))}
          </div>

          {groupes.length > 0 && (
            <div className="flex gap-2 mb-3">
              {groupes.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroupeId(g.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    (groupeId || groupes[0].id) === g.id ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900" : "bg-slate-900/5 dark:bg-white/5 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {g.nom}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-5">
            {instrumentsAffiches.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setInstrumentId(i.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  (instrumentId || instrumentsAffiches[0]?.id) === i.id
                    ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-400"
                    : "bg-slate-900/5 dark:bg-white/5 text-slate-600 dark:text-slate-300"
                }`}
              >
                {i.nom}
              </button>
            ))}
          </div>

          {instrumentSelectionne && <WidgetGraphiqueTradingView symbole={instrumentSelectionne.symboleTradingView} />}

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Prix d'exécution simulé {instrumentSelectionne?.nom} :{" "}
            <span className="font-semibold text-slate-800 dark:text-white">
              {prixActuel != null ? formatNombre(prixActuel, instrumentSelectionne?.decimales || 2) : "…"}
            </span>
          </p>

          <form onSubmit={ouvrirPosition} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex rounded-xl overflow-hidden border border-slate-900/10 dark:border-white/10">
              <button type="button" onClick={() => setSens("achat")} className={`px-4 py-2 text-sm font-semibold ${sens === "achat" ? "bg-emerald-600 text-white" : "bg-transparent"}`}>
                Achat
              </button>
              <button type="button" onClick={() => setSens("vente")} className={`px-4 py-2 text-sm font-semibold ${sens === "vente" ? "bg-red-600 text-white" : "bg-transparent"}`}>
                Vente
              </button>
            </div>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Lots
              <input
                type="number"
                min="0.01"
                max="50"
                step="0.01"
                value={lots}
                onChange={(e) => setLots(e.target.value)}
                className="block w-28 mt-1 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={actionEnCours}
              className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold px-5 py-2.5 transition disabled:opacity-40"
            >
              Ouvrir la position
            </button>
          </form>
          {apercu && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Aperçu : marge requise ≈ {formatNombre(apercu.marge)} · coût du spread ≈ {formatNombre(apercu.spread)} (débité à l'ouverture)
            </p>
          )}
          {erreur && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{erreur}</p>}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl p-5">
          <h2 className="font-bold mb-3">Positions ouvertes</h2>
          {positionsOuvertes.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Aucune position ouverte.</p>}
          <div className="space-y-3">
            {positionsOuvertes.map((p) => {
              const prixCourant = marche.find((m) => m.id === p.instrumentId)?.prix;
              const { pips, pnlNet } = calculerLigne(p, prixCourant);
              return (
                <div key={p.id} className="rounded-xl border border-slate-900/10 dark:border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">
                      {p.instrumentNom} · {p.sens === "achat" ? "Achat" : "Vente"} · {p.lots} lot(s)
                    </div>
                    <button
                      type="button"
                      onClick={() => fermerPosition(p.id)}
                      disabled={actionEnCours}
                      className="text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1.5 disabled:opacity-40"
                    >
                      Fermer
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div>
                      {p.unite === "pip" ? "Pips" : "Points"} : <span className={pips >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{formatNombre(pips, 1)}</span>
                    </div>
                    <div>Spread payé : {formatNombre(p.coutSpread)}</div>
                    <div>
                      Swap/jour : {formatNombre(p.swapParJour)} · cumulé {formatNombre(p.swapCumule)}
                    </div>
                    <div>
                      Net estimé :{" "}
                      <span className={pnlNet >= 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
                        {pnlNet >= 0 ? "+" : ""}
                        {formatNombre(pnlNet)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {positionsFermees.length > 0 && (
            <>
              <h3 className="font-semibold mt-5 mb-2 text-sm text-slate-500 dark:text-slate-400">Historique</h3>
              <div className="space-y-2">
                {positionsFermees.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-900/10 dark:border-white/10 px-4 py-2.5 text-sm">
                    <span>
                      {p.instrumentNom} · {p.sens === "achat" ? "Achat" : "Vente"} · {p.lots} lot(s)
                    </span>
                    <span className={p.pnlNet >= 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
                      {p.pnlNet >= 0 ? "+" : ""}
                      {formatNombre(p.pnlNet)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl p-5">
          <h2 className="font-bold mb-3">Demandes de retrait</h2>
          <form onSubmit={demanderRetrait} className="flex flex-wrap items-end gap-3 mb-4">
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Montant"
              value={montantRetrait}
              onChange={(e) => setMontantRetrait(e.target.value)}
              className="w-32 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={actionEnCours}
              className="rounded-xl border border-slate-900/15 dark:border-white/15 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-bold px-5 py-2.5 transition disabled:opacity-40"
            >
              Demander un retrait
            </button>
          </form>
          {retraits.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Aucune demande pour le moment.</p>}
          <div className="space-y-2">
            {retraits.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-900/10 dark:border-white/10 px-4 py-2.5 text-sm">
                <span>{d.montant}</span>
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  {d.statut === "en_attente" ? "En attente" : d.statut === "validee" ? "Validée" : "Refusée"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
