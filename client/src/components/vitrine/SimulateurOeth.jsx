import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import CercleProgression from "./CercleProgression.jsx";

const ANNEE_REFERENCE = 2026;
const SMIC_AFFICHE = "12,31 €";
const GUIDE_OFFICIEL_URL = "https://www.urssaf.fr/files/live/sites/urssaffr/files/outils-documentation/guides/Guide-OETH.pdf";
const PAGE_URSSAF_URL = "https://www.urssaf.fr/accueil/employeur/cotisations/liste-cotisations/contribution-annuelle-oeth.html";

const SAISIE_VIDE = {
  effectif: "",
  boeth: "",
  coutMainOeuvreSousTraitance: "",
  nbEcap: "",
  depensesDeductibles: "",
  aEmployeBoeth4Ans: null,
};

function formatMontant(n) {
  return `${(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
}

function formatNombre(n) {
  return (n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

// Simulateur OETH / DOETH intégré à la landing page publique (section
// #simulateur). Le calcul se met à jour en direct à chaque saisie, via
// /api/vitrine/calculer (simulerContributionOeth côté serveur — seule source
// de vérité de la formule légale, jamais dupliquée ici). Lecture seule : rien
// n'est enregistré, sauf si le visiteur envoie lui-même une demande d'analyse.
export default function SimulateurOeth() {
  const [saisie, setSaisie] = useState(SAISIE_VIDE);
  const [nomEntreprise, setNomEntreprise] = useState("");
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
  const contactRef = useRef(null);

  const effectifRenseigne = saisie.effectif.trim() !== "";

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
    setNomEntreprise("");
    setSimulation(null);
    setContactOuvert(false);
    setEnvoye(false);
    setErreurPdf(null);
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
    setTimeout(() => contactRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
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
  const actif = s?.assujetti;
  const tuile = (v) => (actif ? v : "—");
  const pourcentageQuota = actif && s.quota > 0 ? Math.min(100, (s.boeth / s.quota) * 100) : 0;
  const ton = !actif ? "neutre" : s.conforme ? "conforme" : s.surcontribution ? "critique" : "partiel";

  const TUILES = [
    { label: "Quota légal retenu", valeur: tuile(formatNombre(s?.quota)) },
    { label: "BOETH déclarés", valeur: tuile(formatNombre(s?.boeth)) },
    { label: "Manque estimé", valeur: tuile(formatNombre(s?.manque)), accent: actif && s.manque > 0 },
    { label: "Taux actuel", valeur: tuile(`${formatNombre(s?.tauxEmploi)} %`) },
    { label: "Coefficient", valeur: actif ? (s.coefficient ? `${s.coefficient} × SMIC` : "Aucun") : "—" },
    { label: "Contribution brute", valeur: tuile(formatMontant(s?.contributionBrute)) },
    { label: "Déductions retenues", valeur: tuile(formatMontant(s?.deductions.total)) },
    { label: "Risque majoration", valeur: actif ? (s.surcontribution ? "Élevé" : "Non") : "—", accent: actif && s.surcontribution },
  ];

  return (
    <section id="simulateur" className="relative bg-marine-950 text-white py-20 sm:py-28 scroll-mt-16 overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-marine-500/60 to-transparent" />
      <div aria-hidden className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-marine-600/10 blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-marine-400">
            OETH · DOETH · BOETH · EA · ESAT · TIH
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 tracking-tight">
            Simulateur Gratuit OETH / DOETH {ANNEE_REFERENCE}
          </h2>
          <p className="text-slate-400 mt-4">
            Obtenez une estimation immédiate de votre contribution OETH {ANNEE_REFERENCE} à partir des données de votre
            entreprise.
          </p>
        </div>

        {/* Saisie */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ChampLecture label="Année concernée" valeur={String(ANNEE_REFERENCE)} />
            <ChampLecture label="SMIC horaire retenu" valeur={SMIC_AFFICHE} />
            <Champ
              label="Nom de l'entreprise (facultatif)"
              type="text"
              value={nomEntreprise}
              onChange={setNomEntreprise}
              placeholder="Ex : Société Dupont"
            />
            <Champ
              label="Effectif d'assujettissement"
              aide="Effectif moyen annuel (EMA OETH)."
              value={saisie.effectif}
              onChange={(v) => modifier("effectif", v)}
              placeholder="Ex : 20"
            />
            <Champ
              label="BOETH déclarés"
              aide="Effectif moyen annuel, décimales possibles."
              value={saisie.boeth}
              onChange={(v) => modifier("boeth", v)}
              placeholder="0"
              step="0.01"
            />
            <Champ
              label="Sous-traitance EA / ESAT / TIH (€ HT)"
              aide="Coût de main-d'œuvre facturé — le simulateur retient 30 %."
              value={saisie.coutMainOeuvreSousTraitance}
              onChange={(v) => modifier("coutMainOeuvreSousTraitance", v)}
              placeholder="0"
            />
            <Champ
              label="Salariés ECAP (nombre)"
              aide="Emplois exigeant des conditions d'aptitude particulières — 17 × SMIC chacun."
              value={saisie.nbEcap}
              onChange={(v) => modifier("nbEcap", v)}
              placeholder="0"
              step="1"
            />
            <Champ
              label="Autres dépenses déductibles (€ HT)"
              aide="Accessibilité, maintien dans l'emploi… plafonnées à 10 %."
              value={saisie.depensesDeductibles}
              onChange={(v) => modifier("depensesDeductibles", v)}
              placeholder="0"
            />
          </div>

          <fieldset className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4">
            <legend className="px-2 text-xs text-slate-400">Règle des 4 ans</legend>
            <p className="text-sm text-slate-200">
              Au cours des 4 dernières années, l'entreprise a-t-elle employé au moins un bénéficiaire de l'obligation
              d'emploi ?
            </p>
            <div className="flex gap-3 mt-3">
              {[
                { v: true, label: "Oui" },
                { v: false, label: "Non" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => modifier("aEmployeBoeth4Ans", saisie.aEmployeBoeth4Ans === o.v ? null : o.v)}
                  aria-pressed={saisie.aEmployeBoeth4Ans === o.v}
                  className={`rounded-full px-5 py-2 text-sm font-medium border transition ${
                    saisie.aEmployeBoeth4Ans === o.v
                      ? "bg-marine-500 border-marine-400 text-white"
                      : "border-white/15 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

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
        </div>

        {/* Résultats — mis à jour en direct */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-b from-marine-900/70 to-marine-950 p-6 sm:p-8">
          {erreurCalcul && <p className="text-sm text-red-400 mb-4">{erreurCalcul}</p>}

          {s && !s.assujetti && (
            <div className="mb-6 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-4 text-sm text-emerald-200">
              Effectif inférieur à {s.seuilAssujettissement} salariés : l'entreprise n'est pas assujettie à la
              contribution OETH (la déclaration mensuelle des bénéficiaires en DSN reste due).
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Contribution indicative après déductions</p>
              <p
                className={`text-5xl sm:text-6xl font-bold tracking-tight mt-3 tabular-nums ${
                  !actif ? "text-slate-600" : s.contributionNette > 0 ? (s.surcontribution ? "text-red-400" : "text-orange-300") : "text-emerald-400"
                }`}
              >
                {actif ? formatMontant(s.contributionNette) : "— €"}
              </p>
              <p className="text-sm text-slate-400 mt-3">
                {!effectifRenseigne
                  ? "Renseignez l'effectif d'assujettissement : le résultat s'affiche instantanément."
                  : !actif
                    ? "Aucune contribution calculée."
                    : s.conforme
                      ? "Quota de 6 % atteint : aucune contribution due."
                      : `Pour ${formatNombre(s.manque)} unité(s) bénéficiaire(s) manquante(s) sur un quota de ${s.quota}.`}
              </p>
            </div>
            <div className="flex items-center gap-5">
              <CercleProgression pourcentage={pourcentageQuota} ton={ton} libelle="du quota atteint" />
              <div className="text-sm">
                <p className="text-slate-400">Progression vers le quota de 6 %</p>
                <p className="text-2xl font-semibold mt-1 tabular-nums">
                  {actif ? `${formatNombre(s.tauxEmploi)} %` : "—"} <span className="text-slate-500 text-base">/ 6 %</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
            {TUILES.map((t) => (
              <div
                key={t.label}
                className={`rounded-xl border px-4 py-3.5 ${t.accent ? "border-red-400/30 bg-red-500/10" : "border-white/10 bg-white/[0.04]"}`}
              >
                <p className="text-[11px] uppercase tracking-wider text-slate-400">{t.label}</p>
                <p className={`text-lg font-semibold mt-1 tabular-nums ${t.accent ? "text-red-300" : "text-white"}`}>{t.valeur}</p>
              </div>
            ))}
          </div>

          {actif && (
            <div className="grid lg:grid-cols-2 gap-6 mt-8">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm font-semibold mb-3">Lecture administrative</p>
                <dl className="text-sm divide-y divide-white/10">
                  {[
                    ["Base réglementaire maximale (1 500 × SMIC)", formatMontant(s.baseMaximale)],
                    [`Sous-traitance retenue (plafond ${s.deductions.tauxPlafondSousTraitance} %)`, formatMontant(s.deductions.sousTraitance)],
                    ["Déduction ECAP retenue", formatMontant(s.deductions.ecap)],
                    ["Autres dépenses retenues (plafond 10 %)", formatMontant(s.deductions.depenses)],
                    ["Effet des actions renseignées", `− ${formatMontant(s.baseMaximale - s.contributionNette)}`],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between gap-4 py-2">
                      <dt className="text-slate-400">{l}</dt>
                      <dd className="font-medium tabular-nums text-right">{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 pt-3">
                    <dt className="font-semibold text-emerald-300">Économie estimée</dt>
                    <dd className="font-bold text-emerald-300 tabular-nums">{formatMontant(s.economie)}</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-3 text-sm">
                {s.surcontribution && (
                  <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-red-200">
                    <p className="font-semibold text-red-300">Base majorée retenue par défaut</p>
                    <p className="mt-1">
                      Sans BOETH employé sur les 4 dernières années ni sous-traitance EA/ESAT/TIH d'au moins{" "}
                      {formatMontant(s.seuilSousTraitanceMin)} (600 × SMIC), la contribution est calculée à 1 500 × SMIC par
                      bénéficiaire manquant. Répondez « Oui » ci-dessus si c'est le cas, ou renseignez vos achats auprès du
                      secteur protégé.
                    </p>
                  </div>
                )}
                {(s.deductions.sousTraitancePlafonnee || s.deductions.depensesPlafonnees) && (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-100">
                    Plafond atteint :{" "}
                    {[
                      s.deductions.sousTraitancePlafonnee && `sous-traitance limitée à ${s.deductions.tauxPlafondSousTraitance} % de la contribution brute`,
                      s.deductions.depensesPlafonnees && "dépenses déductibles limitées à 10 % de la contribution brute",
                    ]
                      .filter(Boolean)
                      .join(" ; ")}
                    .
                  </div>
                )}
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-slate-300 flex gap-2">
                  <span aria-hidden>📅</span>
                  <span>
                    La contribution {ANNEE_REFERENCE} se déclare dans la DSN d'avril {ANNEE_REFERENCE + 1} (échéance du 5 ou
                    15 mai {ANNEE_REFERENCE + 1}), à partir des effectifs notifiés par l'URSSAF.
                  </span>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-slate-300 flex gap-2">
                  <span aria-hidden>⚠️</span>
                  <span>
                    Estimation indicative selon les règles de droit commun (hors accord agréé). Elle ne remplace pas votre
                    déclaration : seule l'URSSAF calcule et recouvre la contribution.{" "}
                    <a href={PAGE_URSSAF_URL} target="_blank" rel="noopener noreferrer" className="text-marine-300 hover:underline">
                      En savoir plus ↗
                    </a>
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-8">
            <button
              type="button"
              onClick={ouvrirContact}
              className="rounded-full bg-white text-marine-900 hover:bg-marine-100 text-sm font-semibold px-6 py-3 transition"
            >
              Demander une analyse
            </button>
            <button
              type="button"
              onClick={telechargerPdf}
              disabled={!actif || pdfEnCours}
              className="rounded-full border border-white/20 text-sm font-semibold px-6 py-3 hover:bg-white/10 transition disabled:opacity-40"
            >
              {pdfEnCours ? "Génération…" : "Télécharger la synthèse PDF"}
            </button>
            {erreurPdf && <p className="text-sm text-red-400 self-center">{erreurPdf}</p>}
          </div>

          {contactOuvert && (
            <div ref={contactRef} className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              {envoye ? (
                <div className="text-center py-4">
                  <p className="font-semibold text-emerald-300">Demande envoyée</p>
                  <p className="text-sm text-slate-400 mt-1.5">
                    Un conseiller du Pôle OETH / AGEFIPH vous recontacte prochainement.
                  </p>
                </div>
              ) : (
                <form onSubmit={envoyerContact} className="grid sm:grid-cols-3 gap-3">
                  <p className="sm:col-span-3 text-sm text-slate-300">
                    Un conseiller analyse votre situation et vos leviers (recrutement direct, EA / ESAT / TIH, accord agréé).
                  </p>
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
                    className={`${CLASSE_INPUT} sm:col-span-3 resize-none`}
                  />
                  {erreurEnvoi && (
                    <p className="sm:col-span-3 text-sm text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg p-3">
                      {erreurEnvoi}
                    </p>
                  )}
                  <div className="sm:col-span-3 flex gap-3">
                    <button
                      type="submit"
                      disabled={envoiEnCours || !contact.nom.trim() || !contact.email.trim()}
                      className="rounded-full bg-white text-marine-900 hover:bg-marine-100 text-sm font-semibold px-6 py-2.5 transition disabled:opacity-40"
                    >
                      {envoiEnCours ? "Envoi…" : "Envoyer ma demande"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactOuvert(false)}
                      className="rounded-full text-sm text-slate-400 px-4 py-2.5 hover:text-white transition"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const CLASSE_INPUT =
  "w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-marine-500";

function Champ({ label, aide, value, onChange, placeholder, type = "number", step = "any" }) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? step : undefined}
        inputMode={type === "number" ? "decimal" : undefined}
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
