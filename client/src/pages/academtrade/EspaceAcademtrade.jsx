import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { BoutonThemeVitrine } from "../../components/vitrine/ThemeVitrine.jsx";

const INTERVALLE_MARCHE_MS = 3000;

function Graphique({ historique }) {
  const points = useMemo(() => {
    if (!historique || historique.length < 2) return null;
    const prix = historique.map((h) => h.p);
    const min = Math.min(...prix);
    const max = Math.max(...prix);
    const amplitude = max - min || 1;
    const largeur = 600;
    const hauteur = 160;
    return historique
      .map((h, i) => {
        const x = (i / (historique.length - 1)) * largeur;
        const y = hauteur - ((h.p - min) / amplitude) * hauteur;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [historique]);

  if (!points) return <div className="h-40 flex items-center justify-center text-sm text-slate-400">Chargement du marché…</div>;
  return (
    <svg viewBox="0 0 600 160" className="w-full h-40" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-500" />
    </svg>
  );
}

export default function EspaceAcademtrade() {
  const navigate = useNavigate();
  const [compte, setCompte] = useState(null);
  const [marche, setMarche] = useState([]);
  const [instrumentId, setInstrumentId] = useState(null);
  const [positions, setPositions] = useState([]);
  const [retraits, setRetraits] = useState([]);
  const [sens, setSens] = useState("achat");
  const [montant, setMontant] = useState("100");
  const [montantRetrait, setMontantRetrait] = useState("");
  const [erreur, setErreur] = useState(null);
  const [actionEnCours, setActionEnCours] = useState(false);
  const minuteur = useRef(null);

  function rafraichir() {
    api.academtradeMoi().then(setCompte).catch(() => navigate("/academtrade/connexion"));
    api.academtradeMarche().then((d) => {
      setMarche(d);
      setInstrumentId((courant) => courant || d[0]?.id || null);
    });
    api.academtradePositions().then(setPositions).catch(() => {});
    api.academtradeRetraits().then(setRetraits).catch(() => {});
  }

  useEffect(() => {
    rafraichir();
    minuteur.current = setInterval(() => {
      api.academtradeMarche().then(setMarche).catch(() => {});
    }, INTERVALLE_MARCHE_MS);
    return () => clearInterval(minuteur.current);
  }, []);

  const instrumentActuel = marche.find((m) => m.id === instrumentId) || null;

  async function deconnexion() {
    await api.academtradeDeconnexion().catch(() => {});
    navigate("/academtrade/connexion");
  }

  async function ouvrirPosition(ev) {
    ev.preventDefault();
    setErreur(null);
    setActionEnCours(true);
    try {
      await api.academtradeOuvrirPosition({ instrumentId, sens, montant: Number(montant) });
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

  if (!compte) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" aria-busy="true" />;

  const positionsOuvertes = positions.filter((p) => p.statut === "ouverte");
  const positionsFermees = positions.filter((p) => p.statut === "fermee");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      <header className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
        <p className="font-bold text-lg tracking-tight">
          Academ<span className="text-violet-600 dark:text-violet-400">Trade</span>
        </p>
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">{compte.email}</p>
          <BoutonThemeVitrine />
          <button type="button" onClick={deconnexion} className="text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white">
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 space-y-6">
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm px-4 py-3">
          Environnement pédagogique — les positions et le solde ci-dessous sont simulés, aucun argent réel n'est investi sur un marché.
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">Solde simulé</p>
            <p className="text-3xl font-bold mt-1">{compte.soldeSimule.toFixed(2)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">Disponible (hors positions ouvertes)</p>
            <p className="text-3xl font-bold mt-1">{compte.soldeDisponible.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl p-5">
          <div className="flex flex-wrap gap-2 mb-4">
            {marche.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setInstrumentId(m.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  m.id === instrumentId
                    ? "bg-violet-600 text-white"
                    : "bg-slate-900/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-white/10"
                }`}
              >
                {m.nom}
              </button>
            ))}
          </div>
          <Graphique historique={instrumentActuel?.historique} />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Prix actuel {instrumentActuel?.nom} : <span className="font-semibold text-slate-800 dark:text-white">{instrumentActuel?.prix?.toFixed(4)}</span>
          </p>

          <form onSubmit={ouvrirPosition} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex rounded-xl overflow-hidden border border-slate-900/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => setSens("achat")}
                className={`px-4 py-2 text-sm font-semibold ${sens === "achat" ? "bg-emerald-600 text-white" : "bg-transparent"}`}
              >
                Achat
              </button>
              <button
                type="button"
                onClick={() => setSens("vente")}
                className={`px-4 py-2 text-sm font-semibold ${sens === "vente" ? "bg-red-600 text-white" : "bg-transparent"}`}
              >
                Vente
              </button>
            </div>
            <input
              type="number"
              min="1"
              step="1"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className="w-32 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={actionEnCours}
              className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold px-5 py-2.5 transition disabled:opacity-40"
            >
              Ouvrir la position
            </button>
          </form>
          {erreur && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{erreur}</p>}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl p-5">
          <h2 className="font-bold mb-3">Positions ouvertes</h2>
          {positionsOuvertes.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Aucune position ouverte.</p>}
          <div className="space-y-2">
            {positionsOuvertes.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-900/10 dark:border-white/10 px-4 py-2.5">
                <div className="text-sm">
                  <span className="font-semibold">{p.instrumentNom}</span> · {p.sens === "achat" ? "Achat" : "Vente"} · {p.montant}
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
            ))}
          </div>

          {positionsFermees.length > 0 && (
            <>
              <h3 className="font-semibold mt-5 mb-2 text-sm text-slate-500 dark:text-slate-400">Historique</h3>
              <div className="space-y-2">
                {positionsFermees.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-900/10 dark:border-white/10 px-4 py-2.5 text-sm">
                    <span>
                      {p.instrumentNom} · {p.sens === "achat" ? "Achat" : "Vente"} · {p.montant}
                    </span>
                    <span className={p.pnl >= 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
                      {p.pnl >= 0 ? "+" : ""}
                      {p.pnl.toFixed(2)}
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
