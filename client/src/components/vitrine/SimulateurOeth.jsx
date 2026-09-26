import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import CercleProgression from "./CercleProgression.jsx";

const ANNEE_REFERENCE = 2026;
const SMIC_AFFICHE = "12,31 €";
const GUIDE_OFFICIEL_URL = "https://www.urssaf.fr/files/live/sites/urssaffr/files/outils-documentation/guides/Guide-OETH.pdf";
const PAGE_URSSAF_URL = "https://www.urssaf.fr/accueil/employeur/cotisations/liste-cotisations/contribution-annuelle-oeth.html";
const CLE_ENTREPRISE = "simulateur-oeth-entreprise";

const SAISIE_VIDE = {
  effectif: "",
  boeth: "",
  coutMainOeuvreSousTraitance: "",
  nbEcap: "",
  depensesDeductibles: "",
  aEmployeBoeth4Ans: null,
};

function formatMontant(n) {
  return `${Math.round(n || 0).toLocaleString("fr-FR")} €`;
}

function formatNombre(n) {
  return (n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function lireEntrepriseMemorisee() {
  try {
    return localStorage.getItem(CLE_ENTREPRISE) || "";
  } catch {
    return "";
  }
}

// Lecture qualitative du taux d'emploi direct par rapport à l'objectif de 6 %.
function lectureTaux(s) {
  if (s.conforme) {
    return {
      position: "Objectif atteint",
      message: "Votre quota légal est atteint : aucune contribution n'est due. Maintenez cet engagement dans la durée.",
    };
  }
  if (s.tauxEmploi < 2) {
    return {
      position: "Moins de 2 %",
      message:
        "Votre taux est très éloigné de l'objectif légal. Le sujet doit être traité comme une priorité de structuration RH, pas uniquement comme une déclaration annuelle.",
    };
  }
  if (s.tauxEmploi < 4) {
    return {
      position: "Entre 2 et 4 %",
      message:
        "La démarche est engagée mais l'écart reste significatif : un plan d'actions ciblé réduirait nettement votre contribution.",
    };
  }
  return {
    position: "Entre 4 et 6 %",
    message: "Vous êtes proche de l'objectif : quelques actions ciblées peuvent suffire à l'atteindre.",
  };
}

// Simulateur OETH / DOETH intégré à la landing page publique (section
// #simulateur). Le calcul se met à jour en direct à chaque saisie, via
// /api/vitrine/calculer (simulerContributionOeth côté serveur — seule source
// de vérité de la formule légale, jamais dupliquée ici). Lecture seule : rien
// n'est enregistré, sauf si le visiteur envoie lui-même une demande d'analyse.
export default function SimulateurOeth() {
  const [saisie, setSaisie] = useState(SAISIE_VIDE);
  const [nomEntreprise, setNomEntreprise] = useState(lireEntrepriseMemorisee);
  const [entrepriseMemorisee, setEntrepriseMemorisee] = useState(() => Boolean(lireEntrepriseMemorisee()));
  const [simulation, setSimulation] = useState(null);
  const [erreurCalcul, setErreurCalcul] = useState(null);
  const debounceRef = useRef(null);

  const [pdfEnCours, setPdfEnCours] = useState(false);
  const [erreurPdf, setErreurPdf] = useState(null);

  const [contactOuvert, setContactOuvert] = useState(false);
  const [contact, setContact] = useState({ nom: "", email: "", telephone: "", message: "" });
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState(null);
  const [envoye, setEnvoye] = useState(false);

  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState([]);
  const [recherche, setRecherche] = useState(false);
  const [erreurRecherche, setErreurRecherche] = useState(null);
  const debounceRechercheRef = useRef(null);

  const effectifRenseigne = saisie.effectif.trim() !== "";

  // Recherche Sirene optionnelle (pré-remplissage du nom et de l'effectif
  // estimé par tranche INSEE — le visiteur peut ensuite corriger).
  useEffect(() => {
    clearTimeout(debounceRechercheRef.current);
    if (requete.trim().length < 2) {
      setResultats([]);
      setErreurRecherche(null);
      return;
    }
    debounceRechercheRef.current = setTimeout(async () => {
      setRecherche(true);
      setErreurRecherche(null);
      try {
        const { resultats: r } = await api.simulerObligationsOeth(requete.trim());
        setResultats(r);
      } catch (e) {
        setErreurRecherche(e.message);
        setResultats([]);
      } finally {
        setRecherche(false);
      }
    }, 350);
    return () => clearTimeout(debounceRechercheRef.current);
  }, [requete]);

  function preremplirDepuisRecherche(candidat) {
    setNomEntreprise(candidat.nom);
    setEntrepriseMemorisee(false);
    if (candidat.effectifEstime != null) modifier("effectif", String(candidat.effectifEstime));
    setRechercheOuverte(false);
    setRequete("");
    setResultats([]);
  }

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const effectif = Number(saisie.effectif);
    if (!effectifRenseigne || !Number.isFinite(effectif) || effectif < 0) {
      setSimulation(null);
      setErreurCalcul(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { simulation: s } = await api.simulerContributionVitrine(saisie);
        setSimulation(s);
        setErreurCalcul(null);
      } catch (e) {
        setErreurCalcul(e.message);
        setSimulation(null);
      }
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [saisie, effectifRenseigne]);

  function modifier(champ, valeur) {
    setSaisie((s) => ({ ...s, [champ]: valeur }));
  }

  function reinitialiser() {
    setSaisie(SAISIE_VIDE);
    setSimulation(null);
    setContactOuvert(false);
    setEnvoye(false);
    setErreurPdf(null);
  }

  function memoriserEntreprise() {
    try {
      if (nomEntreprise.trim()) localStorage.setItem(CLE_ENTREPRISE, nomEntreprise.trim());
      else localStorage.removeItem(CLE_ENTREPRISE);
    } catch {
      // stockage indisponible : le nom reste utilisé pour cette visite
    }
    setEntrepriseMemorisee(Boolean(nomEntreprise.trim()));
  }

  async function telechargerPdf() {
    setPdfEnCours(true);
    setErreurPdf(null);
    try {
      const blob = await api.telechargerSyntheseSimulation({ ...saisie, nomEntreprise });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "simulation-oeth-2026.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErreurPdf(e.message);
    } finally {
      setPdfEnCours(false);
    }
  }

  function ouvrirContact() {
    const s = simulation;
    const resume = s?.assujetti
      ? `\n\nRésumé de ma simulation ${ANNEE_REFERENCE} : effectif ${formatNombre(s.effectif)}, BOETH ${formatNombre(s.boeth)}, ` +
        `quota ${s.quota}, manque ${formatNombre(s.manque)}, contribution indicative ${formatMontant(s.contributionNette)}.`
      : "";
    setContact((c) => ({
      ...c,
      message: `Bonjour, je souhaite une analyse de notre situation OETH${nomEntreprise ? ` (${nomEntreprise})` : ""}.${resume}`,
    }));
    setEnvoye(false);
    setContactOuvert(true);
  }

  async function envoyerContact(ev) {
    ev.preventDefault();
    if (!contact.nom.trim() || !contact.email.trim()) return;
    setEnvoiEnCours(true);
    setErreurEnvoi(null);
    try {
      await api.contacterConseillerVitrine({ ...contact, entreprise: nomEntreprise });
      setEnvoye(true);
    } catch (e) {
      setErreurEnvoi(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  const s = simulation;
  const actif = Boolean(s?.assujetti);
  const lecture = actif ? lectureTaux(s) : null;
  const pourcentageQuota = actif && s.quota > 0 ? Math.min(100, (s.boeth / s.quota) * 100) : 0;
  const ton = !actif ? "neutre" : s.conforme ? "conforme" : s.surcontribution ? "critique" : "partiel";
  const risque = !actif
    ? "—"
    : s.surcontribution
      ? "Élevé"
      : s.contributionNette > 0
        ? "Modéré"
        : "Faible";
  const dash = (v) => (actif ? v : "—");

  const plafondDepenses = s?.deductions.plafondDepenses || 0;
  const depensesMobilisees = s?.deductions.depenses || 0;
  const encoreMobilisable = Math.max(0, plafondDepenses - depensesMobilisees);
  const partMobilisee = plafondDepenses > 0 ? Math.min(100, (depensesMobilisees / plafondDepenses) * 100) : 0;

  return (
    <section id="simulateur" className="relative bg-black text-white py-20 sm:py-28 scroll-mt-16 overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-marine-500/60 to-transparent" />
      <div aria-hidden className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-marine-600/10 blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Saisie */}
        <div className="rounded-2xl border border-white/10 bg-marine-950 shadow-2xl overflow-hidden">
          {/* Liseré tricolore discret — identité, pas un emblème d'État. */}
          <div className="flex h-1">
            <span className="flex-1 bg-marine-500" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-red-500" />
          </div>

          <div className="p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marine-400">Simulateur OETH / DOETH</p>
          <h2 className="font-bold text-white text-2xl sm:text-3xl mt-1">Simulateur Gratuit OETH / DOETH {ANNEE_REFERENCE}</h2>
          <p className="text-sm sm:text-base text-slate-400 mt-2 max-w-xl">
            Obtenez une estimation immédiate de votre contribution OETH {ANNEE_REFERENCE} à partir des données de votre
            entreprise.
          </p>

          {/* Recherche Sirene — repliée, purement facultative. */}
          <button
            type="button"
            onClick={() => setRechercheOuverte((v) => !v)}
            className="text-sm text-marine-300 hover:text-marine-200 hover:underline mt-6 mb-4 inline-flex items-center gap-1.5"
          >
            <span className="text-xs">{rechercheOuverte ? "▾" : "▸"}</span> Pré-remplir via ma raison sociale ou mon SIREN
            (facultatif)
          </button>
          {rechercheOuverte && (
            <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-3 max-w-xl">
              <input
                type="text"
                value={requete}
                onChange={(e) => setRequete(e.target.value)}
                placeholder="Ex : ESAT Tremplin, ou 123 456 789"
                className={CLASSE_INPUT}
              />
              <p className="text-[11px] text-slate-500 mt-1.5">Répertoire public Sirene (INSEE) — aucune donnée n'est enregistrée.</p>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {recherche && <p className="text-xs text-slate-500">Recherche…</p>}
                {erreurRecherche && <p className="text-xs text-red-400">{erreurRecherche}</p>}
                {resultats.map((r) => (
                  <button
                    key={r.siren}
                    type="button"
                    onClick={() => preremplirDepuisRecherche(r)}
                    className="w-full text-left rounded-lg hover:bg-white/10 transition px-3 py-2"
                  >
                    <p className="text-sm font-medium text-white">{r.nom}</p>
                    <p className="text-[11px] text-slate-400">{[r.ville, r.trancheEffectifLabel].filter(Boolean).join(" · ")}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ChampLecture label="Année concernée" valeur={String(ANNEE_REFERENCE)} />
            <ChampLecture label="SMIC horaire retenu" valeur={SMIC_AFFICHE} />
            <Champ
              label="Effectif d'assujettissement"
              aide="Effectif moyen annuel (EMA OETH)."
              value={saisie.effectif}
              onChange={(v) => modifier("effectif", v)}
              placeholder="Ex : 20"
            />
            <Champ
              label="BOETH déclarés"
              aide="Bénéficiaires de l'obligation d'emploi pris en compte dans la déclaration."
              value={saisie.boeth}
              onChange={(v) => modifier("boeth", v)}
              placeholder="Ex. 0"
            />
            <Champ
              label="Sous-traitance EA / ESAT / TIH (€ HT)"
              aide="Coût de main-d'œuvre facturé — 30 % retenus."
              value={saisie.coutMainOeuvreSousTraitance}
              onChange={(v) => modifier("coutMainOeuvreSousTraitance", v)}
              placeholder="0"
            />
            <Champ
              label="Salariés ECAP (nombre)"
              aide="Conditions d'aptitude particulières — 17 × SMIC chacun."
              value={saisie.nbEcap}
              onChange={(v) => modifier("nbEcap", v)}
              placeholder="0"
              step="1"
            />
            <Champ
              label="Autres dépenses déductibles (€ HT)"
              aide="Accessibilité, maintien dans l'emploi… plafond 10 %."
              value={saisie.depensesDeductibles}
              onChange={(v) => modifier("depensesDeductibles", v)}
              placeholder="0"
            />
            <div className="text-xs text-slate-400">
              BOETH employé ces 4 dernières années ?
              <div className="flex gap-2 mt-1.5">
                {[
                  { v: true, label: "Oui" },
                  { v: false, label: "Non" },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => modifier("aEmployeBoeth4Ans", saisie.aEmployeBoeth4Ans === o.v ? null : o.v)}
                    aria-pressed={saisie.aEmployeBoeth4Ans === o.v}
                    className={`flex-1 rounded-xl py-3 text-sm font-medium border transition ${
                      saisie.aEmployeBoeth4Ans === o.v
                        ? "bg-marine-500 border-marine-400 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <span className="block text-[11px] text-slate-500 mt-1">Nouvelle période DOETH — règle des 4 ans.</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              type="button"
              onClick={reinitialiser}
              className="rounded-full border border-white/15 text-sm font-medium px-5 py-2.5 hover:bg-white/10 transition"
            >
              Nouvelle simulation
            </button>
            <a
              href={GUIDE_OFFICIEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/15 text-sm font-medium px-5 py-2.5 text-marine-200 hover:bg-white/10 transition"
            >
              Guide officiel OETH (URSSAF) ↗
            </a>
            <span className="text-xs text-slate-500 sm:ml-auto">Calcul instantané · aucune donnée enregistrée</span>
          </div>
          {erreurCalcul && <p className="text-sm text-red-400 mt-4">{erreurCalcul}</p>}
          {s && !s.assujetti && (
            <p className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-4 text-sm text-emerald-200">
              Effectif inférieur à {s.seuilAssujettissement} salariés : l'entreprise n'est pas assujettie à la contribution
              OETH (la déclaration mensuelle des bénéficiaires en DSN reste due).
            </p>
          )}
          </div>
        </div>

        {/* Résultats — mis à jour en direct */}
        <div className="mt-6 grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Jauge */}
              <Carte className="flex flex-col">
                <div className="flex justify-center">
                  <CercleProgression
                    pourcentage={pourcentageQuota}
                    ton={ton}
                    taille={184}
                    epaisseur={18}
                    texteCentral={actif ? `${formatNombre(s.tauxEmploi)} %` : "—"}
                  />
                </div>
                <h3 className="text-xl font-semibold mt-6">Objectif de 6 %</h3>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  {lecture
                    ? lecture.message
                    : "Renseignez votre effectif d'assujettissement : votre position par rapport au quota légal s'affiche ici."}
                </p>
              </Carte>

              {/* Contribution */}
              <Carte>
                <h3 className="text-xl font-semibold">Contribution estimée</h3>
                <p className="text-sm text-slate-400 mt-2">Une lecture indicative pour prioriser vos actions sur les prochains mois.</p>
                <div
                  className={`mt-5 rounded-2xl border px-5 py-5 ${
                    actif && s.surcontribution ? "border-red-400/30 bg-red-500/10" : "border-teal-400/25 bg-teal-400/[0.07]"
                  }`}
                >
                  <p className="text-sm text-slate-300">Contribution nette estimée</p>
                  <p
                    className={`text-4xl font-bold tracking-tight mt-2 tabular-nums ${
                      actif && s.surcontribution ? "text-red-300" : "text-white"
                    }`}
                  >
                    {actif ? formatMontant(s.contributionNette) : "— €"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <MiniCarte label="BOETH manquants" valeur={dash(formatNombre(s?.manque))} />
                  <MiniCarte label="Déductions estimées" valeur={dash(formatMontant(s?.deductions.total))} />
                </div>
              </Carte>
            </div>

            {/* Indicateurs */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Indicateur label="Position par rapport à l'objectif" valeur={lecture?.position || "—"} teinte="emerald" />
              <Indicateur label="Risque financier" valeur={risque} teinte="rose" />
              <Indicateur label="Potentiel d'économie" valeur={dash(formatMontant(s?.economie))} teinte="sky" />
            </div>

            {/* Entreprise concernée */}
            <Carte className="flex flex-col md:flex-row md:items-center gap-5">
              <div className="flex-1">
                <span className="inline-block rounded-full border border-teal-400/30 bg-teal-400/10 text-teal-300 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1">
                  Facultatif
                </span>
                <h3 className="text-lg font-semibold mt-3">Cette simulation concerne quelle entreprise ?</h3>
                <p className="text-sm text-slate-400 mt-1.5">
                  Un seul champ, sans bloquer vos résultats. Le nom est repris dans votre synthèse PDF et dans votre
                  demande d'analyse.
                </p>
              </div>
              <div className="md:w-80">
                <label className="text-xs text-slate-400">Entreprise concernée</label>
                <div className="flex gap-2 mt-1.5">
                  <input
                    type="text"
                    value={nomEntreprise}
                    onChange={(e) => {
                      setNomEntreprise(e.target.value);
                      setEntrepriseMemorisee(false);
                    }}
                    placeholder="Ex : Société Dupont"
                    className={CLASSE_INPUT}
                  />
                  <button
                    type="button"
                    onClick={memoriserEntreprise}
                    className="shrink-0 rounded-xl bg-white text-marine-900 hover:bg-marine-100 text-sm font-semibold px-4 transition"
                  >
                    {entrepriseMemorisee ? "✓" : "Mémoriser"}
                  </button>
                </div>
              </div>
            </Carte>

            {/* Alertes & détail du calcul */}
            {actif && (
              <div className="space-y-3 text-sm">
                {s.surcontribution && (
                  <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-red-200">
                    <p className="font-semibold text-red-300">Base majorée retenue par défaut</p>
                    <p className="mt-1">
                      Sans BOETH employé sur les 4 dernières années ni sous-traitance EA/ESAT/TIH d'au moins{" "}
                      {formatMontant(s.seuilSousTraitanceMin)} (600 × SMIC), la contribution est calculée à 1 500 × SMIC par
                      bénéficiaire manquant. Répondez « Oui » ci-dessus si c'est le cas, ou renseignez vos achats auprès du
                      secteur protégé.
                    </p>
                  </div>
                )}
                {s.deductions.sousTraitancePlafonnee && (
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-100">
                    Plafond atteint : la déduction sous-traitance est limitée à {s.deductions.tauxPlafondSousTraitance} % de la
                    contribution brute.
                  </div>
                )}
                <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 group">
                  <summary className="cursor-pointer font-medium text-slate-200 list-none flex justify-between">
                    Détail du calcul
                    <span className="text-slate-500 group-open:rotate-180 transition">▾</span>
                  </summary>
                  <dl className="mt-3 divide-y divide-white/10">
                    {[
                      ["Quota légal (6 %, arrondi inférieur)", formatNombre(s.quota)],
                      ["Coefficient appliqué", s.coefficient ? `${s.coefficient} × SMIC` : "Aucun"],
                      ["Contribution brute", formatMontant(s.contributionBrute)],
                      [`Sous-traitance retenue (plafond ${s.deductions.tauxPlafondSousTraitance} %)`, formatMontant(s.deductions.sousTraitance)],
                      ["Déduction ECAP retenue", formatMontant(s.deductions.ecap)],
                      ["Autres dépenses retenues (plafond 10 %)", formatMontant(s.deductions.depenses)],
                      ["Base réglementaire maximale (1 500 × SMIC)", formatMontant(s.baseMaximale)],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between gap-4 py-2">
                        <dt className="text-slate-400">{l}</dt>
                        <dd className="font-medium tabular-nums text-right">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-xs text-slate-500 mt-3">
                    La contribution {ANNEE_REFERENCE} se déclare dans la DSN d'avril {ANNEE_REFERENCE + 1} (échéance du 5 ou
                    15 mai). Estimation indicative selon les règles de droit commun, hors accord agréé : seule l'URSSAF
                    calcule et recouvre la contribution.{" "}
                    <a href={PAGE_URSSAF_URL} target="_blank" rel="noopener noreferrer" className="text-marine-300 hover:underline">
                      En savoir plus ↗
                    </a>
                  </p>
                </details>
              </div>
            )}
          </div>

          {/* Colonne latérale — synthèse & passage à l'action */}
          <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6 lg:sticky lg:top-24">
            <span
              className={`inline-block rounded-full text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 ${
                actif ? "bg-teal-400/15 text-teal-300" : "bg-white/10 text-slate-400"
              }`}
            >
              {actif ? "Votre simulation est prête" : "En attente de vos données"}
            </span>

            <div className="mt-4 rounded-2xl border border-teal-400/25 bg-teal-400/[0.07] px-4 py-4">
              <p className="text-xs text-slate-300">Contribution nette estimée</p>
              <p className="text-3xl font-bold tracking-tight mt-1 tabular-nums">{actif ? formatMontant(s.contributionNette) : "— €"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <MiniCarte label="taux d'emploi" valeur={dash(`${formatNombre(s?.tauxEmploi)} %`)} compact />
              <MiniCarte label="BOETH manquants" valeur={dash(formatNombre(s?.manque))} compact />
            </div>

            {actif && plafondDepenses > 0 && (
              <div className="mt-2 rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] px-4 py-3">
                <div className="flex justify-between gap-3">
                  <p className="text-xs font-medium text-amber-100">Encore mobilisable via les dépenses déductibles</p>
                  <p className="text-sm font-bold text-amber-200 tabular-nums">{formatMontant(encoreMobilisable)}</p>
                </div>
                <div className="h-1.5 rounded-full bg-amber-200/15 mt-2.5 overflow-hidden">
                  <div className="h-full bg-amber-300 rounded-full transition-all" style={{ width: `${partMobilisee}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-amber-100/70 mt-1.5">
                  <span>Déjà mobilisé : {formatMontant(depensesMobilisees)}</span>
                  <span>Plafond 10 % : {formatMontant(plafondDepenses)}</span>
                </div>
                <p className="text-[11px] text-amber-100/60 mt-1.5">ECAP et sous-traitance suivent d'autres règles.</p>
              </div>
            )}

            <div className="border-t border-white/10 mt-5 pt-5">
              <Etape numero="1" titre="Recevez votre synthèse complète">
                Résultats, détail du calcul et rappel DSN, au format PDF.
              </Etape>
              <button
                type="button"
                onClick={telechargerPdf}
                disabled={!actif || pdfEnCours}
                className="mt-4 w-full rounded-xl bg-teal-400 hover:bg-teal-300 text-marine-950 text-sm font-semibold py-3 transition shadow-[0_8px_30px_rgba(45,212,191,0.25)] disabled:opacity-40 disabled:shadow-none"
              >
                {pdfEnCours ? "Génération…" : "Télécharger ma synthèse PDF"}
              </button>
              {erreurPdf && <p className="text-xs text-red-400 mt-2">{erreurPdf}</p>}

              <div className="flex items-center gap-3 my-5 text-[10px] uppercase tracking-wider text-slate-500">
                <span className="flex-1 h-px bg-white/10" />
                ou
                <span className="flex-1 h-px bg-white/10" />
              </div>

              <Etape numero="2" titre="Analysez-la gratuitement avec un conseiller">
                Un conseiller du pôle vous aide à comprendre les écarts et à identifier vos leviers prioritaires.
              </Etape>

              {!contactOuvert ? (
                <button
                  type="button"
                  onClick={ouvrirContact}
                  className="mt-4 w-full rounded-xl border border-white/25 text-sm font-semibold py-3 hover:bg-white/10 transition"
                >
                  Demander mon analyse gratuite
                </button>
              ) : envoye ? (
                <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
                  <p className="font-semibold text-emerald-300 text-sm">Demande envoyée</p>
                  <p className="text-xs text-slate-400 mt-1">Un conseiller du Pôle OETH / AGEFIPH vous recontacte prochainement.</p>
                </div>
              ) : (
                <form onSubmit={envoyerContact} className="mt-4 space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Votre nom"
                    value={contact.nom}
                    onChange={(e) => setContact((c) => ({ ...c, nom: e.target.value }))}
                    className={CLASSE_INPUT}
                  />
                  <input
                    type="email"
                    required
                    placeholder="Votre e-mail"
                    value={contact.email}
                    onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                    className={CLASSE_INPUT}
                  />
                  <input
                    type="tel"
                    placeholder="Téléphone (facultatif)"
                    value={contact.telephone}
                    onChange={(e) => setContact((c) => ({ ...c, telephone: e.target.value }))}
                    className={CLASSE_INPUT}
                  />
                  <textarea
                    rows={4}
                    value={contact.message}
                    onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))}
                    className={`${CLASSE_INPUT} resize-none`}
                  />
                  {erreurEnvoi && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg p-3">{erreurEnvoi}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={envoiEnCours || !contact.nom.trim() || !contact.email.trim()}
                      className="flex-1 rounded-xl bg-white text-marine-900 hover:bg-marine-100 text-sm font-semibold py-2.5 transition disabled:opacity-40"
                    >
                      {envoiEnCours ? "Envoi…" : "Envoyer ma demande"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactOuvert(false)}
                      className="rounded-xl text-sm text-slate-400 px-3 hover:text-white transition"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}

              <div className="flex gap-4 mt-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Gratuit
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Sans engagement
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

const CLASSE_INPUT =
  "w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-marine-500";

const TEINTES = {
  emerald: "border-emerald-400/25 bg-emerald-400/[0.07]",
  rose: "border-rose-400/25 bg-rose-400/[0.07]",
  sky: "border-sky-400/25 bg-sky-400/[0.07]",
};

function Carte({ className = "", children }) {
  return <div className={`rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-7 ${className}`}>{children}</div>;
}

function MiniCarte({ label, valeur, compact = false }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] ${compact ? "px-3 py-2.5" : "px-4 py-4"}`}>
      {compact ? (
        <>
          <p className="text-sm font-bold tabular-nums">{valeur}</p>
          <p className="text-[11px] text-slate-400">{label}</p>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-2xl font-semibold mt-2 tabular-nums">{valeur}</p>
        </>
      )}
    </div>
  );
}

function Indicateur({ label, valeur, teinte }) {
  return (
    <div className={`rounded-2xl border px-5 py-5 ${TEINTES[teinte]}`}>
      <p className="text-sm text-slate-300">{label}</p>
      <p className="text-xl font-bold mt-2 tabular-nums">{valeur}</p>
    </div>
  );
}

function Etape({ numero, titre, children }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-lg bg-teal-400/15 text-teal-300 text-xs font-bold flex items-center justify-center">
        {numero}
      </span>
      <div>
        <p className="font-semibold">{titre}</p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function Champ({ label, aide, value, onChange, placeholder, step = "any" }) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        type="number"
        min="0"
        step={step}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1.5 ${CLASSE_INPUT}`}
      />
      {aide && <span className="block text-[11px] text-slate-500 mt-1">{aide}</span>}
    </label>
  );
}

function ChampLecture({ label, valeur }) {
  return (
    <div className="text-xs text-slate-400">
      {label}
      <div className="mt-1.5 rounded-xl border border-white/5 bg-white/[0.02] text-slate-300 px-4 py-3 text-sm flex items-center justify-between">
        {valeur}
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Réglementaire</span>
      </div>
    </div>
  );
}
