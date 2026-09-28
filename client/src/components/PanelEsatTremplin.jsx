import { useEffect, useState } from "react";
import { api } from "../api.js";

// Les 3 solutions à présenter au client. Chaque fiche répond aux questions
// d'un agent en plein appel : c'est quoi, quelles prestations concrètes, ce
// que le client y gagne, et la phrase à dire. Les chiffres (déduction,
// heures, protection 3 ans) reprennent le script de vente validé (voir
// scriptVente.js, "Présentation des solutions").
const DISPOSITIFS = [
  {
    cle: "classique",
    titre: "ESAT Classique",
    icone: "🌿",
    resume: "Des travailleurs handicapés d'un ESAT interviennent pour l'entreprise.",
    definition:
      "Un ESAT (Établissement et Service d'Aide par le Travail) emploie des personnes en situation de handicap. L'entreprise lui confie une prestation : ses équipes viennent sur site ou travaillent dans leurs ateliers.",
    prestations: ["Espaces verts", "Nettoyage des locaux", "Conditionnement", "Blanchisserie", "Petite logistique"],
    avantages: [
      "Environ 30 % du coût de la prestation déduit de la contribution",
      "Simple à mettre en place, pour des besoins manuels récurrents",
      "À refaire chaque année : aucune protection pluriannuelle",
    ],
    pitch:
      "« Vous avez déjà des besoins d'entretien ou de nettoyage ? En les confiant à un ESAT, une partie de ce que vous payez vient en déduction de votre contribution AGEFIPH. »",
  },
  {
    cle: "tremplin",
    titre: "ESAT Tremplin",
    icone: "💻",
    resume: "Services numériques réalisés par un ESAT : informatique, web, graphisme.",
    definition:
      "Un ESAT spécialisé dans les prestations intellectuelles et numériques. L'entreprise lui commande un volume d'heures de travail (600 h minimum, modulable à 400 h selon les unités déjà couvertes).",
    prestations: ["Services informatiques", "Création de sites web", "Graphisme / identité visuelle", "Saisie et traitement de données"],
    avantages: [
      "Environ 80 % du coût déduit, bien plus qu'un ESAT classique",
      "Protège l'entreprise contre la surcontribution pendant 3 ans",
      "Budget du minimum légal : environ 9 232 € (600 h × SMIC + matières premières)",
    ],
    pitch:
      "« Plutôt que de payer la contribution sans contrepartie, vous investissez dans un vrai service (site web, graphisme, informatique) : environ 80 % est déduit, et vous êtes protégé 3 ans. »",
  },
  {
    cle: "tih",
    titre: "TIH (Travailleur Indépendant Handicapé)",
    icone: "🧑‍💼",
    resume: "Un entrepreneur en situation de handicap, à son compte, réalise la prestation.",
    definition:
      "Un travailleur indépendant reconnu handicapé (auto-entrepreneur, freelance) qui vend ses services directement à l'entreprise, comme n'importe quel prestataire.",
    prestations: ["Informatique", "Développement web", "Graphisme", "Conseil", "Rédaction / traduction"],
    avantages: [
      "Mêmes règles de seuil que l'ESAT/EA pour écarter la surcontribution",
      "Un seul interlocuteur, souple, pour une mission précise",
      "Alternative quand le client préfère travailler avec un indépendant",
    ],
    pitch:
      "« Vous travaillez déjà avec des freelances ? En choisissant un indépendant reconnu handicapé pour la même mission, cette dépense compte pour votre obligation. »",
  },
];

function formatMontant(n) {
  return `${Math.round(n || 0).toLocaleString("fr-FR")} €`;
}

// Parse une étiquette de tranche ("20-249" ou "750+") en bornes numériques.
function effectifDansTranche(effectif, label) {
  if (label.endsWith("+")) return effectif >= Number(label.slice(0, -1));
  const [min, max] = label.split("-").map(Number);
  return effectif >= min && effectif <= max;
}

// Même calcul que server/src/oeth.js (simulerContributionOeth) : obligation
// = 6 % de l'effectif arrondi à l'entier inférieur, dès 20 salariés ;
// contribution = unités manquantes × coefficient de la tranche × SMIC ;
// surcontribution = unités manquantes × 1 500 × SMIC.
function calculer(bareme, effectif, boeth) {
  const eff = Number(effectif);
  if (String(effectif).trim() === "" || !Number.isFinite(eff) || eff <= 0) return null;
  if (eff < 20) return { assujetti: false };
  const exact = eff * 0.06;
  const quota = Math.floor(exact);
  const deja = Math.max(0, Number(boeth) || 0);
  const manque = Math.max(0, quota - deja);
  const tranche = bareme.classique.find((t) => effectifDansTranche(eff, t.tranche)) || bareme.classique.at(-1);
  return {
    assujetti: true,
    exact,
    quota,
    manque,
    tranche,
    contribution: manque * tranche.montantParUnite,
    surcontribution: manque * bareme.majoree.montantParUnite,
  };
}

// Outil "ESAT Tremplin / TIH" de la barre d'outils du CRM : calcul instantané
// de l'obligation et du montant dû à partir de l'effectif, puis les 3
// solutions à proposer, avec de quoi les expliquer simplement au client.
export default function PanelEsatTremplin() {
  const [bareme, setBareme] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [effectif, setEffectif] = useState("");
  const [boeth, setBoeth] = useState("");
  const [situation, setSituation] = useState("contribution"); // contribution | surcontribution
  const [dispositifOuvert, setDispositifOuvert] = useState("tremplin");

  useEffect(() => {
    api.getBaremeOeth().then(setBareme).catch((e) => setErreur(e.message));
  }, []);

  if (erreur) return <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>;
  if (!bareme) return <p className="text-sm text-slate-400 dark:text-slate-500">Chargement du barème…</p>;

  const calcul = calculer(bareme, effectif, boeth);
  const surco = situation === "surcontribution";
  const champ =
    "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-amber-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <div className="space-y-5 text-sm">
      {/* Calcul rapide */}
      <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Calcul rapide</p>
        <div className="flex gap-2">
          <label className="flex-1 min-w-0 text-xs text-slate-600 dark:text-slate-300">
            Effectif (salariés)
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={effectif}
              onChange={(e) => setEffectif(e.target.value)}
              placeholder="Ex : 85"
              className={`mt-1 ${champ}`}
            />
          </label>
          <label className="w-32 shrink-0 text-xs text-slate-600 dark:text-slate-300">
            BOETH déjà employés
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={boeth}
              onChange={(e) => setBoeth(e.target.value)}
              placeholder="0"
              className={`mt-1 ${champ}`}
            />
          </label>
        </div>

        <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSituation("contribution")}
            className={`flex-1 py-2 transition ${
              !surco ? "bg-marine-800 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            Contribution
          </button>
          <button
            type="button"
            onClick={() => setSituation("surcontribution")}
            className={`flex-1 py-2 transition ${
              surco ? "bg-amber-600 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            Surcontribution (zéro effort)
          </button>
        </div>

        {calcul?.assujetti === false && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">Moins de 20 salariés : pas d'obligation d'emploi OETH.</p>
        )}

        {calcul?.assujetti && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 px-3 py-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Obligation 6 %</p>
                <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {calcul.quota} <span className="text-xs font-semibold text-slate-500">BOETH</span>
                </p>
                <p className="text-[11px] text-slate-400 tabular-nums">
                  {calcul.exact.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} arrondi à l'inférieur
                </p>
              </div>
              <div className="rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 px-3 py-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Unités manquantes</p>
                <p
                  className={`text-xl font-bold tabular-nums ${
                    calcul.manque > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {calcul.manque}
                </p>
                <p className="text-[11px] text-slate-400">Tranche {calcul.tranche.tranche} salariés</p>
              </div>
            </div>

            {calcul.manque === 0 ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Obligation déjà remplie par les bénéficiaires employés : rien à payer.
              </p>
            ) : (
              <div className={`rounded-lg px-3 py-2.5 text-white ${surco ? "bg-amber-600" : "bg-marine-800"}`}>
                <p className="text-xs opacity-80">
                  {surco ? "Surcontribution annuelle (aucune action sur 4 ans)" : "Contribution annuelle estimée"}
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {formatMontant(surco ? calcul.surcontribution : calcul.contribution)}
                </p>
                <p className="text-[11px] opacity-80">
                  {calcul.manque} × {formatMontant(surco ? bareme.majoree.montantParUnite : calcul.tranche.montantParUnite)} par
                  unité manquante
                </p>
              </div>
            )}

            {calcul.manque > 0 && (
              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                💬 <strong>À dire au client :</strong>{" "}
                {surco
                  ? `sans aucune action, l'entreprise paie ${formatMontant(calcul.surcontribution)} par an au lieu de ${formatMontant(
                      calcul.contribution
                    )}. Une sous-traitance d'au moins ${formatMontant(
                      bareme.seuilSousTraitance
                    )} de main-d'œuvre (ESAT, EA ou TIH) suffit à écarter la surcontribution.`
                  : `l'entreprise verse ${formatMontant(
                      calcul.contribution
                    )} par an à l'AGEFIPH sans contrepartie. Une partie de ce montant peut être transformée en prestation utile grâce aux solutions ci-dessous.`}
              </p>
            )}
          </>
        )}
      </div>

      {/* Barème de référence */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Barème par unité manquante</p>
        {!surco ? (
          <div className="space-y-1.5">
            {bareme.classique.map((t) => {
              const surlignee = calcul?.assujetti && calcul.tranche.tranche === t.tranche;
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
              <span className="font-bold text-amber-800 dark:text-amber-300">
                {formatMontant(bareme.majoree.montantParUnite)} / unité manquante
              </span>
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5">
              S'applique si, sur les 4 dernières années : aucun bénéficiaire recruté, aucune sous-traitance EA/ESAT/TIH
              suffisante ({formatMontant(bareme.seuilSousTraitance)} minimum de main-d'œuvre), et aucun accord agréé.
            </p>
          </div>
        )}
      </div>

      {/* Solutions à proposer */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Les 3 solutions à proposer</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Besoins manuels sur site → <strong>ESAT Classique</strong> · besoins numériques et protection 3 ans →{" "}
          <strong>ESAT Tremplin</strong> · préfère un prestataire indépendant → <strong>TIH</strong>.
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
                  <span className="flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5" aria-hidden>
                      {d.icone}
                    </span>
                    <span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{d.titre}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{d.resume}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-slate-400 text-xs">{ouvert ? "▲" : "▼"}</span>
                </button>
                {ouvert && (
                  <div className="px-3 pb-3 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>
                      <strong className="text-slate-800 dark:text-slate-100">C'est quoi ? </strong>
                      {d.definition}
                    </p>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Exemples de prestations</p>
                      <div className="flex flex-wrap gap-1">
                        {d.prestations.map((p) => (
                          <span key={p} className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[11px]">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100 mb-0.5">Ce que le client y gagne</p>
                      <ul className="space-y-0.5">
                        {d.avantages.map((a) => (
                          <li key={a}>✓ {a}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="rounded-lg bg-marine-50 dark:bg-marine-900/30 border border-marine-100 dark:border-marine-800/60 px-2.5 py-2 italic text-marine-900 dark:text-marine-100">
                      💬 {d.pitch}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Barème calculé au SMIC en vigueur ({bareme.smicHoraire} €/h) — même moteur que le simulateur public et les
        fiches entreprise, toujours à jour automatiquement. Montants indicatifs, hors déductions éventuelles (ECAP,
        dépenses déductibles).
      </p>
    </div>
  );
}
