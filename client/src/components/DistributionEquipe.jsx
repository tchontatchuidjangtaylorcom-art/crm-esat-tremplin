import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { estAdmin } from "../roles.js";

// Distribution en un clic (voir server/src/distributionEquipe.js) : choisir
// QUELLES fiches (Nouveau, NRP 1, NRP 2…), À QUI (toute l'équipe ou des
// personnes cherchées par leur nom) et COMBIEN par personne. Les fiches NRP /
// À relancer… redistribuées repartent en « Nouveau » chez leur nouvel agent.
export default function DistributionEquipe({ onDistribue }) {
  const { utilisateur } = useAuth();
  const [apercu, setApercu] = useState([]);
  const [statut, setStatut] = useState("nouveau");
  const [parPersonne, setParPersonne] = useState(1);
  const [mode, setMode] = useState("tous"); // "tous" | "choix"
  const [inclureAdmins, setInclureAdmins] = useState(true);
  const [equipe, setEquipe] = useState([]);
  const [choisis, setChoisis] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);

  function chargerApercu() {
    fetch("/api/equipe/distribuer/apercu")
      .then((r) => (r.ok ? r.json() : []))
      .then(setApercu)
      .catch(() => {});
  }
  useEffect(() => {
    chargerApercu();
    api
      .listUtilisateurs()
      .then((l) => setEquipe(l.filter((u) => u.statut === "valide")))
      .catch(() => {});
  }, []);

  const nom = (u) => [u.prenom, u.nom].filter(Boolean).join(" ") || u.email;
  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return q ? equipe.filter((u) => `${nom(u)} ${u.email}`.toLowerCase().includes(q)) : equipe;
  }, [equipe, recherche]);

  const destinataires = mode === "tous" ? equipe.filter((u) => inclureAdmins || !estAdmin(u)) : equipe.filter((u) => choisis.includes(u.id));
  const source = apercu.find((a) => a.statut === statut);
  const n = Math.max(1, Number(parPersonne) || 1);

  function basculer(id) {
    setChoisis((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  async function distribuer() {
    if (destinataires.length === 0) return setErreur("Choisissez au moins une personne.");
    const remise = statut !== "nouveau" ? `\nCes fiches « ${source?.label || statut} » repartiront en « Nouveau ».` : "";
    if (
      !window.confirm(
        `Donner ${n} fiche${n > 1 ? "s" : ""} « ${source?.label || statut} » à ${
          mode === "tous" ? "toute l'équipe" : destinataires.map(nom).join(", ")
        } (${destinataires.length} personne${destinataires.length > 1 ? "s" : ""}) ?${remise}`
      )
    )
      return;
    setEnCours(true);
    setErreur(null);
    setResultat(null);
    try {
      const res = await fetch("/api/equipe/distribuer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parPersonne: n,
          statut,
          inclureAdmins,
          membres: mode === "choix" ? choisis : undefined,
        }),
      });
      const donnees = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(donnees.error || `Erreur HTTP ${res.status}`);
      setResultat(donnees);
      chargerApercu();
      onDistribue?.();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  const champ =
    "rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm";
  const onglet = (actif) =>
    `px-3 py-1.5 text-xs font-medium ${
      actif ? "bg-marine-700 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
    }`;

  return (
    <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mr-auto self-center">👥 Distribuer des fiches</p>

        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          Fiches à distribuer
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className={champ}>
            {(apercu.length ? apercu : [{ statut: "nouveau", label: "Nouveau (non assignées)", disponibles: "…" }]).map((a) => (
              <option key={a.statut} value={a.statut}>
                {a.label} — {a.disponibles} dispo.
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          Par personne
          <input type="number" min="1" max="50" value={parPersonne} onChange={(e) => setParPersonne(e.target.value)} className={`w-20 ${champ}`} />
        </label>

        <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          À qui
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
            <button type="button" onClick={() => setMode("tous")} className={onglet(mode === "tous")}>
              Toute l'équipe
            </button>
            <button type="button" onClick={() => setMode("choix")} className={onglet(mode === "choix")}>
              Choisir des personnes{choisis.length ? ` (${choisis.length})` : ""}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={distribuer}
          disabled={enCours || destinataires.length === 0 || source?.disponibles === 0}
          className="rounded-lg bg-marine-700 hover:bg-marine-800 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
        >
          {enCours
            ? "Distribution…"
            : `Distribuer (${n * destinataires.length} fiche${n * destinataires.length > 1 ? "s" : ""})`}
        </button>
      </div>

      {mode === "tous" ? (
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={inclureAdmins} onChange={(e) => setInclureAdmins(e.target.checked)} />
          Administrateurs compris ({destinataires.length} personne{destinataires.length > 1 ? "s" : ""})
        </label>
      ) : (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[12rem]">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Chercher une personne par son nom"
                className={`w-full pl-8 ${champ}`}
              />
            </div>
            <button
              type="button"
              onClick={() => setChoisis((l) => [...new Set([...l, ...filtres.map((u) => u.id)])])}
              className="text-xs text-marine-700 dark:text-marine-300 hover:underline"
            >
              Tout cocher{recherche ? " (résultats)" : ""}
            </button>
            {choisis.length > 0 && (
              <button type="button" onClick={() => setChoisis([])} className="text-xs text-slate-500 hover:underline">
                Tout décocher
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {filtres.map((u) => {
              const actif = choisis.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => basculer(u.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    actif
                      ? "border-marine-500 bg-marine-100 text-marine-800 dark:bg-marine-900/50 dark:text-marine-200"
                      : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {actif ? "✓ " : ""}
                  {u.id === utilisateur?.id ? `Moi (${nom(u)})` : nom(u)}
                </button>
              );
            })}
            {filtres.length === 0 && <span className="text-xs text-slate-400">Aucune personne trouvée.</span>}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {statut === "nouveau"
          ? "Fiches « Nouveau » sans agent, en priorité 20 salariés et plus avec un numéro."
          : `Fiches « ${source?.label || statut} » (de n'importe quel agent) : elles repartent en « Nouveau » chez la personne qui les reçoit, jamais chez celle qui les avait déjà.`}{" "}
        Chacun reçoit une fiche avant que quiconque n'en reçoive une deuxième ; Claude cherche les numéros manquants.
      </p>
      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
      {resultat && (
        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
          <p className="text-emerald-700 dark:text-emerald-400 font-medium">
            ✓ {resultat.total} fiche{resultat.total > 1 ? "s" : ""} « {resultat.statutLabel} » distribuée{resultat.total > 1 ? "s" : ""} à{" "}
            {resultat.repartition.length} personne{resultat.repartition.length > 1 ? "s" : ""}
            {resultat.statut !== "nouveau" ? ", remises en « Nouveau »" : ""}.
          </p>
          {resultat.manque > 0 && (
            <p className="text-amber-600 dark:text-amber-400 text-xs">
              Pas assez de fiches disponibles : il en manquait {resultat.manque}.
            </p>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer">Détail par personne</summary>
            <ul className="mt-1 ml-4 list-disc text-slate-500 dark:text-slate-400">
              {resultat.repartition.map((r) => (
                <li key={r.id}>
                  {r.nom} : {r.fiches.length ? r.fiches.join(", ") : "aucune fiche"}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
