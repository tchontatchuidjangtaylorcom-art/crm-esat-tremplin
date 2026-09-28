import { useEffect, useState } from "react";
import { api } from "../api.js";

// Description courte + explication dépliable pour chaque dispositif. Reprend
// le contenu déjà validé du script de vente (voir scriptVente.js, section
// "Présentation des solutions") — première version fonctionnelle : le visuel
// (icônes dédiées) sera aligné sur la landing page une fois la référence
// visuelle fournie, sans changer cette logique de calcul.
const DISPOSITIFS = [
  {
    cle: "classique",
    titre: "ESAT Classique",
    resume: "Sous-traitance simple, ~30 % de déduction, à refaire chaque année.",
    explication:
      "Plutôt qu'un investissement structurant, l'entreprise sous-traite ponctuellement à un ESAT classique. La déduction n'est que d'environ 30 % du coût de la prestation, et l'effort doit être renouvelé chaque année pour continuer à écarter la surcontribution — aucune protection pluriannuelle.",
  },
  {
    cle: "tremplin",
    titre: "ESAT Tremplin",
    resume: "600 h minimum (ou 400 h), ~80 % de déduction, protégé 3 ans.",
    explication:
      "Minimum légal de 600 heures de prestation (modulable à 400 heures selon les unités déjà couvertes). Déduit environ 80 % du coût — bien plus qu'un ESAT classique — et protège l'entreprise contre la surcontribution pendant 3 ans. Investissement total approximatif pour le minimum légal (600 h × SMIC + matières premières) : environ 9 232 €.",
  },
  {
    cle: "tih",
    titre: "TIH (Travailleur Indépendant Handicapé)",
    resume: "Sous-traitance à un indépendant handicapé, mêmes règles de seuil.",
    explication:
      "Alternative à l'ESAT/EA : l'entreprise sous-traite directement à un travailleur indépendant reconnu handicapé. Soumis aux mêmes règles de seuil (coût de main-d'œuvre sur la période) que l'EA/ESAT pour écarter la surcontribution.",
  },
];

function formatMontant(n) {
  return `${Math.round(n || 0).toLocaleString("fr-FR")} €`;
}

// Parse une étiquette de tranche ("20-249" ou "750+") en bornes numériques,
// pour savoir si un effectif saisi par l'agent y correspond.
function effectifDansTranche(effectif, label) {
  if (label.endsWith("+")) return effectif >= Number(label.slice(0, -1));
  const [min, max] = label.split("-").map(Number);
  return effectif >= min && effectif <= max;
}

// Outil "ESAT Tremplin / TIH" de la barre d'outils du CRM : rappelle en un
// coup d'œil le barème de contribution par unité manquante (même moteur que
// le simulateur public et les fiches entreprise, voir /api/oeth/bareme), et
// explique les 3 dispositifs de sous-traitance à proposer selon la situation
// — pour que les agents citent le bon chiffre et le bon argumentaire sans
// avoir à rouvrir le script de vente en pleine conversation.
export default function PanelEsatTremplin() {
  const [bareme, setBareme] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [effectif, setEffectif] = useState("");
  const [situation, setSituation] = useState("contribution"); // contribution | surcontribution
  const [dispositifOuvert, setDispositifOuvert] = useState(null);

  useEffect(() => {
    api.getBaremeOeth().then(setBareme).catch((e) => setErreur(e.message));
  }, []);

  if (erreur) return <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>;
  if (!bareme) return <p className="text-sm text-slate-400 dark:text-slate-500">Chargement du barème…</p>;

  const effNum = Number(effectif);
  const effValide = effectif.trim() !== "" && Number.isFinite(effNum) && effNum > 0;
  const assujetti = effValide && effNum >= 20;

  return (
    <div className="space-y-5 text-sm">
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
          Effectif de l'entreprise (optionnel — pour surligner la bonne tranche)
        </label>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={effectif}
          onChange={(e) => setEffectif(e.target.value)}
          placeholder="Ex : 85"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
        {effValide && !assujetti && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Moins de 20 salariés : pas d'obligation OETH.</p>
        )}
      </div>

      <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-xs font-semibold">
        <button
          type="button"
          onClick={() => setSituation("contribution")}
          className={`flex-1 py-2 transition ${
            situation === "contribution"
              ? "bg-marine-800 text-white"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          Contribution
        </button>
        <button
          type="button"
          onClick={() => setSituation("surcontribution")}
          className={`flex-1 py-2 transition ${
            situation === "surcontribution"
              ? "bg-amber-600 text-white"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          Surcontribution (zéro effort)
        </button>
      </div>

      {situation === "contribution" ? (
        <div className="space-y-1.5">
          {bareme.classique.map((t) => {
            const surlignee = assujetti && effectifDansTranche(effNum, t.tranche);
            return (
              <div
                key={t.tranche}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  surlignee ? "bg-marine-100 dark:bg-marine-900/50 ring-1 ring-marine-400" : "bg-slate-50 dark:bg-slate-900"
                }`}
              >
                <span className="text-slate-600 dark:text-slate-300">{t.tranche} salariés</span>
                <span className={`font-bold ${surlignee ? "text-marine-800 dark:text-marine-200" : "text-slate-700 dark:text-slate-300"}`}>
                  {formatMontant(t.montantParUnite)} / unité manquante
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 px-3 py-3">
          <p className="flex items-center justify-between">
            <span className="text-amber-800 dark:text-amber-300">Aucune action sur 4 ans</span>
            <span className="font-bold text-amber-800 dark:text-amber-300">{formatMontant(bareme.majoree.montantParUnite)} / unité manquante</span>
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5">
            S'applique si, sur les 4 dernières années : aucun bénéficiaire recruté, aucune sous-traitance EA/ESAT/TIH
            suffisante ({formatMontant(bareme.seuilSousTraitance)} minimum de main-d'œuvre), et aucun accord agréé.
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
          Solutions de sous-traitance à proposer (écartent la surcontribution)
        </p>
        <div className="space-y-2">
          {DISPOSITIFS.map((d) => {
            const ouvert = dispositifOuvert === d.cle;
            return (
              <div key={d.cle} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDispositifOuvert((c) => (c === d.cle ? null : d.cle))}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{d.titre}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{d.resume}</span>
                  </span>
                  <span className="shrink-0 text-slate-400 text-xs">{ouvert ? "▲" : "▼"}</span>
                </button>
                {ouvert && (
                  <p className="px-3 pb-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-2">
                    {d.explication}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Barème calculé au SMIC en vigueur ({bareme.smicHoraire} €/h) — même moteur que le simulateur public et les
        fiches entreprise, toujours à jour automatiquement.
      </p>
    </div>
  );
}
