import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import CercleProgression from "./CercleProgression.jsx";
import AideModale, { InfoBouton } from "./AideModale.jsx";

const ANNEE_REFERENCE = 2026;
const SMIC_AFFICHE = "12,31";
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
  sousTraitance4Ans: null,
  montantSousTraitance4Ans: "",
  accordAgree: null,
};

function formatMontant(n) {
  return `${Math.round(n || 0).toLocaleString("fr-FR")} €`;
}

function formatNombre(n) {
  return (n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

const arrondi2 = (n) => Math.round(n * 100) / 100;
const versTexte = (n) => (Number.isFinite(n) ? String(arrondi2(n)) : "");

function lireEntrepriseMemorisee() {
  try {
    return localStorage.getItem(CLE_ENTREPRISE) || "";
  } catch {
    return "";
  }
}

// Lecture qualitative du taux d'emploi direct par rapport à l'objectif de 6 %.
function lectureTaux(s) {
  if (s.conforme)
    return { position: "Objectif atteint", message: "Votre quota légal est atteint : aucune contribution n'est due. Maintenez cet engagement dans la durée." };
  if (s.tauxEmploi < 2)
    return {
      position: "Moins de 2 %",
      message:
        "Votre taux est très éloigné de l'objectif légal. Le sujet doit être traité comme une priorité de structuration RH, pas uniquement comme une déclaration annuelle.",
    };
  if (s.tauxEmploi < 4)
    return {
      position: "Entre 2 et 4 %",
      message: "La démarche est engagée mais l'écart reste significatif : un plan d'actions ciblé réduirait nettement votre contribution.",
    };
  return { position: "Entre 4 et 6 %", message: "Vous êtes proche de l'objectif : quelques actions ciblées peuvent suffire à l'atteindre." };
}

// Simulateur OETH / DOETH de la landing page publique (section #simulateur),
// en parcours par étapes :
//   01 — 3 informations essentielles (effectif, taux d'emploi ⇄ EMA BOETH
//        liés, SMIC) ;
//   02 — déductions et cas particuliers, repliés par défaut (facultatif) ;
//   03 — résultats, révélés par "Calculer ma contribution" puis mis à jour
//        en direct à chaque modification. Pas de défilement interne : tout
//        le bloc résultats tient dans la page.
// Calcul via /api/vitrine/calculer (simulerContributionOeth côté serveur —
// seule source de vérité de la formule légale, jamais dupliquée ici).
export default function SimulateurOeth() {
  const [saisie, setSaisie] = useState(SAISIE_VIDE);
  const [tauxSaisi, setTauxSaisi] = useState("");
  const [nomEntreprise, setNomEntreprise] = useState(lireEntrepriseMemorisee);
  const [entrepriseMemorisee, setEntrepriseMemorisee] = useState(() => Boolean(lireEntrepriseMemorisee()));
  const [simulation, setSimulation] = useState(null);
  const [erreurCalcul, setErreurCalcul] = useState(null);
  const debounceRef = useRef(null);

  const [aideEssentielOuverte, setAideEssentielOuverte] = useState(false);
  const [deductionsOuvertes, setDeductionsOuvertes] = useState(true);
  const [erreurEffectif, setErreurEffectif] = useState(false);

  const [pdfEnCours, setPdfEnCours] = useState(false);
  const [erreurPdf, setErreurPdf] = useState(null);

  const [contactOuvert, setContactOuvert] = useState(false);
  const [contact, setContact] = useState({ nom: "", email: "", telephone: "", message: "" });
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState(null);
  const [envoye, setEnvoye] = useState(false);

  const [sousTraitance, setSousTraitance] = useState(null); // null | true | false
  const [aideOuverte, setAideOuverte] = useState(null); // clé de fiche (aideSimulateur.js)
  const fermerAide = useCallback(() => setAideOuverte(null), []);
  const i = (cle) => <InfoBouton cle={cle} onOuvrir={setAideOuverte} />;

  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState([]);
  const [recherche, setRecherche] = useState(false);
  const [erreurRecherche, setErreurRecherche] = useState(null);
  const debounceRechercheRef = useRef(null);

  const sectionRef = useRef(null);
  const resultatsRef = useRef(null);
  const deductionsRef = useRef(null);
  const [sectionVisible, setSectionVisible] = useState(false);
  const [resultatsVisibles, setResultatsVisibles] = useState(false);

  const effectifRenseigne = saisie.effectif.trim() !== "";

  // Barre mobile : affichée quand le simulateur est à l'écran mais que le
  // bloc résultats ne l'est pas.
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const obsSection = new IntersectionObserver(([e]) => setSectionVisible(e.isIntersecting));
    const obsResultats = new IntersectionObserver(([e]) => setResultatsVisibles(e.isIntersecting));
    if (sectionRef.current) obsSection.observe(sectionRef.current);
    if (resultatsRef.current) obsResultats.observe(resultatsRef.current);
    return () => {
      obsSection.disconnect();
      obsResultats.disconnect();
    };
  }, []);

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
        const { simulation: r } = await api.simulerContributionVitrine(saisie);
        setSimulation(r);
        setErreurCalcul(null);
      } catch (e) {
        setErreurCalcul(e.message);
        setSimulation(null);
      }
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [saisie, effectifRenseigne]);

  function modifier(champ, valeur) {
    setSaisie((prec) => ({ ...prec, [champ]: valeur }));
  }

  // Effectif, taux d'emploi et EMA BOETH sont liés : saisir l'un recalcule
  // l'autre (BOETH = effectif × taux ÷ 100). Le nombre de BOETH reste la
  // donnée de référence envoyée au calcul.
  function changerEffectif(v) {
    setErreurEffectif(false);
    const eff = Number(v);
    setSaisie((prec) => {
      const suivant = { ...prec, effectif: v };
      if (tauxSaisi.trim() !== "" && prec.boeth.trim() === "" && eff > 0) {
        suivant.boeth = versTexte((eff * Number(tauxSaisi)) / 100);
      }
      return suivant;
    });
    if (saisie.boeth.trim() !== "" && eff > 0) setTauxSaisi(versTexte((Number(saisie.boeth) / eff) * 100));
  }

  function changerTaux(v) {
    setTauxSaisi(v);
    const eff = Number(saisie.effectif);
    if (v.trim() === "") return modifier("boeth", "");
    if (eff > 0 && Number.isFinite(Number(v))) modifier("boeth", versTexte((eff * Number(v)) / 100));
  }

  function changerBoeth(v) {
    modifier("boeth", v);
    const eff = Number(saisie.effectif);
    if (v.trim() === "") return setTauxSaisi("");
    if (eff > 0 && Number.isFinite(Number(v))) setTauxSaisi(versTexte((Number(v) / eff) * 100));
  }

  function preremplirDepuisRecherche(candidat) {
    setNomEntreprise(candidat.nom);
    setEntrepriseMemorisee(false);
    if (candidat.effectifEstime != null) changerEffectif(String(candidat.effectifEstime));
    setRechercheOuverte(false);
    setRequete("");
    setResultats([]);
  }

  function choisirSousTraitance(v) {
    setSousTraitance(v);
    if (v !== true) modifier("coutMainOeuvreSousTraitance", "");
  }

  function calculer() {
    if (!effectifRenseigne) {
      setErreurEffectif(true);
      return;
    }
    setTimeout(() => resultatsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function ouvrirDeductions() {
    setDeductionsOuvertes(true);
    setTimeout(() => deductionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function reinitialiser() {
    setSaisie(SAISIE_VIDE);
    setTauxSaisi("");
    setSousTraitance(null);
    setSimulation(null);
    setContactOuvert(false);
    setEnvoye(false);
    setErreurPdf(null);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    const r = simulation;
    const resume = r?.assujetti
      ? `\n\nRésumé de ma simulation ${ANNEE_REFERENCE} : effectif ${formatNombre(r.effectif)}, BOETH ${formatNombre(r.boeth)}, ` +
        `quota ${r.quota}, manque ${formatNombre(r.manque)}, contribution indicative ${formatMontant(r.contributionNette)}.`
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
  const dash = (v) => (actif ? v : "—");
  const lecture = actif ? lectureTaux(s) : null;
  const statutLecture = !actif
    ? { texte: "En attente", classe: "bg-white/10 text-slate-400" }
    : s.conforme
      ? { texte: "Quota atteint", classe: "bg-emerald-400/15 text-emerald-300" }
      : s.surcontribution
        ? { texte: "Base majorée", classe: "bg-red-400/15 text-red-300" }
        : { texte: "Contribution réduite", classe: "bg-teal-400/15 text-teal-300" };

  // Leviers pris en compte dans le calcul (ligne "Effet des actions").
  const actionsRenseignees =
    [
      (s?.boeth > 0 || saisie.aEmployeBoeth4Ans === true) && "BOETH",
      (s?.deductions.sousTraitance > 0 || (saisie.sousTraitance4Ans === true && !s?.sousTraitance4AnsInsuffisante)) && "EA / ESAT / TIH",
      s?.deductions.ecap > 0 && "ECAP",
      s?.deductions.depenses > 0 && "Dépenses",
      saisie.accordAgree === true && "Accord agréé",
    ]
      .filter(Boolean)
      .join(" + ") || "Aucune";
  const risque = !actif ? "—" : s.surcontribution ? "Élevé" : s.contributionNette > 0 ? "Modéré" : "Faible";

  const nbDeductionsRenseignees = [
    saisie.coutMainOeuvreSousTraitance,
    saisie.nbEcap,
    saisie.depensesDeductibles,
  ].filter((v) => String(v).trim() !== "").length + [saisie.aEmployeBoeth4Ans, saisie.sousTraitance4Ans, saisie.accordAgree].filter((v) => v !== null).length;

  const plafondDepenses = s?.deductions.plafondDepenses || 0;
  const depensesMobilisees = s?.deductions.depenses || 0;
  const encoreMobilisable = Math.max(0, plafondDepenses - depensesMobilisees);
  const partMobilisee = plafondDepenses > 0 ? Math.min(100, (depensesMobilisees / plafondDepenses) * 100) : 0;

  return (
    <section ref={sectionRef} id="simulateur" className="relative bg-black text-white py-16 sm:py-24 scroll-mt-16">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-marine-500/60 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] max-w-full h-[500px] rounded-full bg-marine-600/10 blur-3xl" />

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 space-y-5">
        {/* ─────────── En-tête ─────────── */}
        <div className="rounded-2xl border border-white/10 bg-marine-950 shadow-2xl overflow-hidden">
          <div className="flex h-1">
            <span className="flex-1 bg-marine-500" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-red-500" />
          </div>
          <div className="px-6 sm:px-8 py-7 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marine-400">Simulateur OETH / DOETH</p>
              <h2 className="font-bold text-white text-2xl sm:text-3xl mt-1">Simulateur Gratuit OETH / DOETH {ANNEE_REFERENCE}</h2>
              <p className="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl">
                Obtenez une estimation immédiate de votre contribution OETH {ANNEE_REFERENCE} à partir des données de votre
                entreprise.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Pastille couleur="bg-teal-400">Environ 2 minutes</Pastille>
              <Pastille couleur="bg-sky-400">Aucune pièce à joindre</Pastille>
              <Pastille couleur="bg-amber-400">Résultat immédiat</Pastille>
            </div>
          </div>
        </div>

        {/* ─────────── Étape 01 : l'essentiel ─────────── */}
        <div className="rounded-2xl border border-white/10 bg-marine-950/80 px-6 sm:px-8 py-7">
          <EnteteEtape
            numero="01"
            titre="Commencez avec 3 informations essentielles"
            sousTitre="Renseignez votre effectif, puis votre taux d'emploi ou votre EMA BOETH : les deux sont liés, saisir l'un calcule l'autre."
          >
            <button
              type="button"
              onClick={() => setRechercheOuverte((v) => !v)}
              className="text-xs text-marine-300 hover:text-marine-200 hover:underline inline-flex items-center gap-1.5"
            >
              <span>{rechercheOuverte ? "▾" : "▸"}</span> Pré-remplir via ma raison sociale ou mon SIREN (facultatif)
            </button>
          </EnteteEtape>

          {rechercheOuverte && (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 max-w-xl">
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

          {/* Référentiel appliqué : année et SMIC, au-dessus des saisies. */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-marine-400/40 bg-marine-500/10 px-3.5 py-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-marine-300">Année concernée</span>
              <span className="font-semibold text-white">{ANNEE_REFERENCE}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SMIC horaire brut retenu</span>
              <span className="font-semibold text-white">{SMIC_AFFICHE} €</span>
            </span>
            <span className="text-[11px] text-slate-500">Référentiel réglementaire appliqué par le simulateur.</span>
          </div>

          <div className="mt-3 grid md:grid-cols-3 gap-3">
            <CaseSaisie
              titre={<>Effectif d'assujettissement{i("effectif")}</>}
              unite="salariés"
              value={saisie.effectif}
              onChange={changerEffectif}
              placeholder="Ex. 34"
              aide="Effectif moyen annuel retenu pour l'OETH."
              erreur={erreurEffectif ? "Renseignez votre effectif pour calculer." : null}
            />
            <CaseSaisie
              titre={<>Taux d'emploi BOETH{i("objectif")}</>}
              badge="Lié"
              unite="%"
              value={tauxSaisi}
              onChange={changerTaux}
              placeholder="Ex. 1"
              aide="Taux légal, valorisation seniors incluse."
              accent
            />
            <CaseSaisie
              titre={<>EMA BOETH pris en compte{i("boeth")}</>}
              badge="Lié"
              unite="BOETH"
              value={saisie.boeth}
              onChange={changerBoeth}
              placeholder="Ex. 0,34"
              aide="Bénéficiaires de l'obligation d'emploi pris en compte dans la déclaration."
              accent
            />
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setAideEssentielOuverte((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-slate-300 hover:text-white"
            >
              Besoin d'aide pour identifier ces informations ?
              <span className="text-marine-300 text-base leading-none">{aideEssentielOuverte ? "−" : "+"}</span>
            </button>
            {aideEssentielOuverte && (
              <p className="px-4 pb-4 text-xs text-slate-400 leading-relaxed">
                L'effectif correspond à l'EMA OETH d'assujettissement communiqué par l'URSSAF (ou la MSA). Vous pouvez
                ensuite renseigner soit votre taux d'emploi légal, soit votre EMA BOETH : le simulateur calcule
                automatiquement l'autre valeur. Lorsque ces données proviennent de l'URSSAF ou de la MSA, elles intègrent
                déjà la valorisation applicable aux BOETH de 50 ans et plus. Cliquez sur les icônes ⓘ pour une explication
                détaillée de chaque terme, à lire ou à écouter.
              </p>
            )}
          </div>
        </div>

        {/* ─────────── Étape 02 : déductions & cas particuliers ─────────── */}
        <div ref={deductionsRef} className="rounded-2xl border border-white/10 bg-marine-950/80 scroll-mt-24">
          <button
            type="button"
            onClick={() => setDeductionsOuvertes((v) => !v)}
            className="w-full flex items-center gap-4 px-6 sm:px-8 py-5 text-left"
            aria-expanded={deductionsOuvertes}
          >
            <span className="shrink-0 w-10 h-10 rounded-xl bg-marine-500/15 border border-marine-400/30 text-marine-300 text-sm font-bold flex items-center justify-center">
              02
            </span>
            <span className="flex-1">
              <span className="block font-semibold">J'ai des déductions ou un cas particulier à renseigner</span>
              <span className="block text-xs text-slate-400 mt-0.5">
                Sous-traitance EA / ESAT / TIH, ECAP, dépenses déductibles, règle des 4 ans.
              </span>
            </span>
            {nbDeductionsRenseignees > 0 && (
              <span className="hidden sm:inline rounded-full bg-teal-400/15 text-teal-300 text-[10px] font-semibold px-2.5 py-1">
                {nbDeductionsRenseignees} renseigné{nbDeductionsRenseignees > 1 ? "s" : ""}
              </span>
            )}
            <span className="hidden sm:inline rounded-full border border-white/15 text-slate-400 text-[10px] font-semibold px-2.5 py-1">
              Facultatif
            </span>
            <span className={`text-marine-300 text-xl leading-none transition-transform ${deductionsOuvertes ? "rotate-45" : ""}`}>+</span>
          </button>

          {deductionsOuvertes && (
            <div className="px-6 sm:px-8 pb-7 border-t border-white/10 pt-6">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Oui / Non d'abord : beaucoup d'entreprises n'ont aucun achat
                    auprès du secteur protégé, elles passent sans rien saisir. */}
                <div className="text-xs text-slate-400">
                  Montant de sous-traitance EA / ESAT / TIH{i("sousTraitance")}
                  {sousTraitance !== true ? (
                    <>
                      <OuiNon valeur={sousTraitance} onChange={choisirSousTraitance} />
                      <span className="block text-[11px] text-slate-500 mt-1">Travaillez-vous avec un EA, un ESAT ou un TIH ?</span>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-2 mt-1.5">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          autoFocus
                          value={saisie.coutMainOeuvreSousTraitance}
                          onChange={(e) => modifier("coutMainOeuvreSousTraitance", e.target.value)}
                          placeholder="Ex. 7386"
                          className={CLASSE_INPUT}
                        />
                        <button
                          type="button"
                          onClick={() => choisirSousTraitance(false)}
                          title="Pas de sous-traitance"
                          className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 text-slate-400 hover:bg-white/10 hover:text-white transition"
                        >
                          ✕
                        </button>
                      </div>
                      <span className="block text-[11px] text-slate-500 mt-1">
                        Montant de main-d'œuvre valorisable. Le simulateur applique 30 %.
                      </span>
                    </>
                  )}
                </div>
                <Champ
                  label={<>Salariés ECAP (nombre){i("ecap")}</>}
                  aide="Emplois exigeant des conditions d'aptitude particulières (chauffeurs routiers, BTP, sécurité…). Laissez vide si non concerné."
                  value={saisie.nbEcap}
                  onChange={(v) => modifier("nbEcap", v)}
                  placeholder="Facultatif"
                  step="1"
                />
                <Champ
                  label={<>Autres dépenses déductibles{i("depenses")}</>}
                  aide="Accessibilité, maintien dans l'emploi… plafond 10 %."
                  value={saisie.depensesDeductibles}
                  onChange={(v) => modifier("depensesDeductibles", v)}
                  placeholder="Ex. 1 000"
                />
              </div>

              {/* Règle des 4 ans — questions en cascade : chaque réponse (Oui ou
                  Non) ouvre la question suivante (conditions de la base
                  majorée à 1 500 × SMIC, voir simulerContributionOeth). */}
              <div className="mt-6 space-y-3">
                <Question
                  actif={saisie.aEmployeBoeth4Ans === null}
                  intitule={
                    <>
                      Au cours des 4 dernières années, l'entreprise a-t-elle employé au moins un bénéficiaire de
                      l'obligation d'emploi ? <span className="text-slate-500">(nouvelle période DOETH)</span>
                      {i("regle4ans")}
                    </>
                  }
                  nom="q-boeth-4ans"
                  valeur={saisie.aEmployeBoeth4Ans}
                  onChange={(v) => modifier("aEmployeBoeth4Ans", v)}
                />

                {saisie.aEmployeBoeth4Ans !== null && (
                  <Question
                    actif={saisie.sousTraitance4Ans === null}
                    intitule="Au cours des 4 dernières années, l'entreprise a-t-elle réalisé des achats ou de la sous-traitance auprès d'une EA, d'un ESAT ou d'un TIH pour un montant supérieur ou égal à 600 × SMIC horaire ?"
                    nom="q-st-4ans"
                    valeur={saisie.sousTraitance4Ans}
                    onChange={(v) =>
                      setSaisie((prec) => ({
                        ...prec,
                        sousTraitance4Ans: v,
                        ...(v === false ? { montantSousTraitance4Ans: "" } : {}),
                      }))
                    }
                  >
                    {saisie.sousTraitance4Ans === true && (
                      <label className="block mt-4 text-sm font-medium text-slate-200 max-w-md">
                        Montant cumulé de main-d'œuvre sur 4 ans
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={saisie.montantSousTraitance4Ans}
                          onChange={(e) => modifier("montantSousTraitance4Ans", e.target.value)}
                          placeholder="Ex. 7386"
                          className={`mt-1.5 ${CLASSE_INPUT}`}
                        />
                        <span className="block text-[11px] font-normal text-slate-500 mt-1">
                          Seuil {ANNEE_REFERENCE} : 7 386 €.
                          {s?.sousTraitance4AnsInsuffisante && (
                            <span className="text-orange-300"> Montant inférieur au seuil : la base majorée reste appliquée.</span>
                          )}
                        </span>
                      </label>
                    )}
                  </Question>
                )}

                {saisie.aEmployeBoeth4Ans !== null && saisie.sousTraitance4Ans !== null && (
                  <Question
                    actif={saisie.accordAgree === null}
                    intitule="L'entreprise dispose-t-elle d'un accord agréé applicable sur la période concernée ?"
                    nom="q-accord"
                    valeur={saisie.accordAgree}
                    onChange={(v) => modifier("accordAgree", v)}
                  >
                    {saisie.accordAgree === true && (
                      <p className="mt-3 text-xs text-slate-400">
                        Avec un accord agréé, l'obligation est remplie par la mise en œuvre de son programme : le budget
                        correspondant finance les actions de l'accord au lieu d'être versé à l'URSSAF.
                      </p>
                    )}
                  </Question>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─────────── Appel à l'action ─────────── */}
        <div className="rounded-2xl border border-teal-400/20 bg-gradient-to-b from-teal-400/[0.07] to-transparent px-6 py-7 text-center">
          <button
            type="button"
            onClick={calculer}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-marine-950 text-sm font-bold px-7 py-3.5 transition shadow-[0_10px_40px_rgba(45,212,191,0.3)]"
          >
            Calculer ma contribution ↓
          </button>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-3 text-[11px] text-slate-400">
            <span>● Résultat immédiat</span>
            <span>● Sans coordonnées</span>
            <span>● Sans engagement</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
            <button type="button" onClick={reinitialiser} className="text-slate-400 hover:text-white underline-offset-4 hover:underline">
              Nouvelle simulation
            </button>
            <a href={GUIDE_OFFICIEL_URL} target="_blank" rel="noopener noreferrer" className="text-marine-300 hover:text-marine-200 hover:underline">
              Guide officiel OETH (URSSAF · PDF) ↗
            </a>
          </div>
        </div>

        {/* ─────────── Étape 03 : résultats ─────────── */}
        {/* Toujours visible, même vide : le visiteur voit d'emblée ce qu'il
            va obtenir, et chaque saisie met les chiffres à jour en direct. */}
        {(
          <div ref={resultatsRef} className="scroll-mt-20 pt-4">
            <div className="flex items-center gap-4 mb-5">
              <span className="shrink-0 w-10 h-10 rounded-xl bg-teal-400/15 border border-teal-400/30 text-teal-300 text-sm font-bold flex items-center justify-center">
                03
              </span>
              <div>
                <p className="font-semibold text-lg">Vos résultats</p>
                <p className="text-xs text-slate-400">Mis à jour en direct : modifiez une donnée ci-dessus, les chiffres suivent.</p>
              </div>
            </div>

            {erreurCalcul && <p className="text-sm text-red-400 mb-4">{erreurCalcul}</p>}
            {s && !s.assujetti && (
              <p className="mb-5 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-4 text-sm text-emerald-200">
                Effectif inférieur à {s.seuilAssujettissement} salariés : l'entreprise n'est pas assujettie à la
                contribution OETH (la déclaration mensuelle des bénéficiaires en DSN reste due).
              </p>
            )}

            <div className="grid lg:grid-cols-3 gap-5 items-start">
              <div className="lg:col-span-2 space-y-5">
                {/* Montant principal + répartition graphique de la contribution brute */}
                <Carte className="relative overflow-hidden">
                  <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-teal-400/10 blur-3xl" />
                  <div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-center">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 flex items-center">
                        Contribution indicative après déductions{i("contribution")}
                      </p>
                      <p
                        className={`text-5xl sm:text-6xl font-bold tracking-tight mt-2 tabular-nums ${
                          !actif ? "text-slate-600" : s.surcontribution ? "text-red-300" : s.contributionNette === 0 ? "text-emerald-300" : "text-white"
                        }`}
                      >
                        {actif ? formatMontant(s.contributionNette) : "— €"}
                      </p>
                      <p className="text-sm text-slate-400 mt-2 max-w-md leading-relaxed">
                        {lecture
                          ? lecture.message
                          : "Renseignez votre effectif ci-dessus : vos résultats s'affichent ici instantanément, à chaque saisie."}
                      </p>
                    </div>
                    {actif && s.contributionBrute > 0 && (
                      <DonutRepartition
                        total={s.contributionBrute}
                        segments={[
                          { label: "Reste à payer", valeur: s.contributionNette, couleur: s.surcontribution ? "#f87171" : "#fb923c" },
                          { label: "Sous-traitance", valeur: s.deductions.sousTraitance, couleur: "#38bdf8" },
                          { label: "ECAP", valeur: s.deductions.ecap, couleur: "#a78bfa" },
                          { label: "Dépenses", valeur: s.deductions.depenses, couleur: "#fbbf24" },
                        ]}
                      />
                    )}
                  </div>
                </Carte>

                {/* Anneaux de pourcentages */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Anneau
                    pourcentage={actif && s.quota > 0 ? (s.boeth / s.quota) * 100 : 0}
                    couleur="#2dd4bf"
                    titre="Quota atteint"
                    detail={actif ? `${formatNombre(s.boeth)} / ${s.quota} BOETH` : "—"}
                    actif={actif}
                  />
                  <Anneau
                    pourcentage={actif && s.quota > 0 ? (s.manque / s.quota) * 100 : 0}
                    couleur={actif && s.surcontribution ? "#f87171" : "#fb923c"}
                    titre="Reste à couvrir"
                    detail={actif ? `${formatNombre(s.manque)} BOETH manquant(s)` : "—"}
                    actif={actif}
                  />
                  <Anneau
                    pourcentage={actif && s.contributionBrute > 0 ? (s.deductions.total / s.contributionBrute) * 100 : 0}
                    couleur="#38bdf8"
                    titre="Brute déduite"
                    detail={actif ? `${formatMontant(s.deductions.total)} de déductions` : "—"}
                    actif={actif}
                  />
                  <Anneau
                    pourcentage={actif && s.baseMaximale > 0 ? (s.economie / s.baseMaximale) * 100 : 0}
                    couleur="#a78bfa"
                    titre="Économie vs maximum"
                    detail={actif ? `${formatMontant(s.economie)} économisés` : "—"}
                    actif={actif}
                  />
                </div>

                {/* Indicateurs clés */}
                <div className="grid sm:grid-cols-3 gap-3">
                  <Indicateur label={<>Position par rapport à l'objectif{i("objectif")}</>} valeur={lecture?.position || "—"} teinte="emerald" />
                  <Indicateur label={<>Risque financier{i("regle4ans")}</>} valeur={risque} teinte="rose" />
                  <Indicateur label={<>Potentiel d'économie{i("economie")}</>} valeur={dash(formatMontant(s?.economie))} teinte="sky" />
                </div>

                {/* Détail chiffré */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    ["Quota légal retenu", dash(`${formatNombre(s?.quota)} bénéficiaire(s)`), "effectif"],
                    ["BOETH déclarés", dash(formatNombre(s?.boeth)), "boeth"],
                    ["Manque estimé", dash(formatNombre(s?.manque)), null, actif && s.manque > 0],
                    ["Taux actuel", dash(`${formatNombre(s?.tauxEmploi)} %`), "objectif"],
                    ["Coefficient", actif ? (s.coefficient ? `${s.coefficient} × SMIC` : "Aucun") : "—", "coefficient"],
                    ["Contribution brute", dash(formatMontant(s?.contributionBrute)), "contribution"],
                    ["Déductions retenues", dash(formatMontant(s?.deductions.total))],
                    ["Risque majoration", actif ? (s.surcontribution ? "Oui" : "Non") : "—", "regle4ans", actif && s.surcontribution],
                  ].map(([l, v, info, alerte]) => (
                    <div
                      key={l}
                      className={`rounded-xl border px-3.5 py-3 ${alerte ? "border-red-400/30 bg-red-500/10" : "border-white/10 bg-white/[0.03]"}`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center">
                        {l}
                        {info && i(info)}
                      </p>
                      <p className={`text-base font-semibold mt-1 tabular-nums ${alerte ? "text-red-300" : "text-white"}`}>{v}</p>
                    </div>
                  ))}
                </div>

                {/* Messages de situation */}
                {actif && s.surcontribution && (
                  <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-red-300 flex items-center">Base majorée retenue par défaut{i("regle4ans")}</p>
                      <p className="mt-1 text-xs leading-relaxed">
                        Sans BOETH employé sur les 4 dernières années, ni sous-traitance EA/ESAT/TIH d'au moins{" "}
                        {formatMontant(s.seuilSousTraitanceMin)} (600 × SMIC), ni accord agréé, la contribution est calculée
                        à 1 500 × SMIC par bénéficiaire manquant.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={ouvrirDeductions}
                      className="shrink-0 rounded-lg border border-red-300/40 text-red-100 text-xs font-semibold px-3.5 py-2 hover:bg-red-400/15 transition"
                    >
                      Préciser ma situation
                    </button>
                  </div>
                )}
                {actif && !s.surcontribution && s.economie > 0 && (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] p-4 text-sm">
                    <p className="font-semibold text-emerald-300">Effet positif des actions renseignées</p>
                    <p className="mt-1 text-xs text-emerald-100/80 leading-relaxed">
                      Les éléments renseignés réduisent l'estimation de {formatMontant(s.economie)} par rapport à une
                      situation maximale avec coefficient 1 500 × SMIC.
                    </p>
                  </div>
                )}
                {actif && !s.surcontribution && !s.conforme && (
                  <div className="rounded-xl border border-amber-400/30 border-l-4 border-l-amber-400 bg-amber-500/[0.08] p-4 text-sm">
                    <p className="font-semibold text-amber-200">Quota légal non atteint, contribution réduite</p>
                    <p className="mt-1 text-xs text-amber-100/80 leading-relaxed">
                      L'entreprise présente un manque estimé de {formatNombre(s.manque)} bénéficiaire(s). Les actions
                      renseignées écartent la majoration et les déductions applicables sont intégrées à l'estimation.
                    </p>
                  </div>
                )}
                {actif && s.conforme && (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] p-4 text-sm">
                    <p className="font-semibold text-emerald-300">Quota légal atteint</p>
                    <p className="mt-1 text-xs text-emerald-100/80">Aucune contribution n'est due au titre de l'année {ANNEE_REFERENCE}.</p>
                  </div>
                )}

                {/* Lecture administrative */}
                <Carte>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold flex items-center">Lecture administrative{i("economie")}</p>
                    <span className={`rounded-full text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 ${statutLecture.classe}`}>
                      {statutLecture.texte}
                    </span>
                  </div>
                  <dl className="mt-3 text-sm divide-y divide-white/[0.07]">
                    {[
                      ["Base réglementaire maximale", dash(formatMontant(s?.baseMaximale))],
                      [
                        `Sous-traitance retenue${actif ? ` (plafond ${s.deductions.tauxPlafondSousTraitance} %)` : ""}`,
                        dash(formatMontant(s?.deductions.sousTraitance)),
                      ],
                      ["Déduction ECAP retenue", dash(formatMontant(s?.deductions.ecap))],
                      ["Autres dépenses retenues (plafond 10 %)", dash(formatMontant(s?.deductions.depenses))],
                      ["Effet des actions renseignées", actif ? actionsRenseignees : "—"],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between gap-4 py-2.5">
                        <dt className="text-slate-400">{l}</dt>
                        <dd className="font-medium tabular-nums text-right">{v}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between gap-4 pt-3">
                      <dt className="font-semibold text-emerald-300">Économie estimée</dt>
                      <dd className="font-bold text-emerald-300 tabular-nums">{dash(formatMontant(s?.economie))}</dd>
                    </div>
                  </dl>
                  <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
                    La contribution {ANNEE_REFERENCE} se déclare dans la DSN d'avril {ANNEE_REFERENCE + 1} (échéance du 5 ou 15
                    mai). Estimation indicative selon les règles de droit commun : seule l'URSSAF calcule et recouvre la
                    contribution.{" "}
                    <a href={PAGE_URSSAF_URL} target="_blank" rel="noopener noreferrer" className="text-marine-300 hover:underline">
                      En savoir plus ↗
                    </a>
                  </p>
                </Carte>

                {/* Entreprise concernée */}
                <Carte className="flex flex-col md:flex-row md:items-center gap-5">
                  <div className="flex-1">
                    <span className="inline-block rounded-full border border-teal-400/30 bg-teal-400/10 text-teal-300 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1">
                      Facultatif
                    </span>
                    <h3 className="font-semibold mt-2.5">Cette simulation concerne quelle entreprise ?</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Un seul champ, sans bloquer vos résultats. Le nom est repris dans votre synthèse PDF et votre demande
                      d'analyse.
                    </p>
                  </div>
                  <div className="md:w-80">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nomEntreprise}
                        onChange={(e) => {
                          setNomEntreprise(e.target.value);
                          setEntrepriseMemorisee(false);
                        }}
                        placeholder="Ex. Société Dupont"
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
              </div>

              {/* Colonne synthèse & passage à l'action */}
              <aside className="rounded-2xl border border-white/10 bg-marine-950 p-5 sm:p-6">
                <span
                  className={`inline-block rounded-full text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 ${
                    actif ? "bg-teal-400/15 text-teal-300" : "bg-white/10 text-slate-400"
                  }`}
                >
                  {actif ? "Votre simulation est prête" : "En attente de vos données"}
                </span>

                <div className="mt-4 rounded-xl border border-teal-400/25 bg-teal-400/[0.07] px-4 py-4">
                  <p className="text-xs text-slate-300">Contribution nette estimée</p>
                  <p className="text-3xl font-bold tracking-tight mt-1 tabular-nums">{actif ? formatMontant(s.contributionNette) : "— €"}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <MiniCarte label="taux d'emploi" valeur={dash(`${formatNombre(s?.tauxEmploi)} %`)} compact />
                  <MiniCarte label="BOETH manquants" valeur={dash(formatNombre(s?.manque))} compact />
                </div>

                {actif && plafondDepenses > 0 && (
                  <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/[0.08] px-4 py-3">
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
                        rows={3}
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
        )}
      </div>

      {/* Barre mobile : rappel du montant tant que le bloc résultats n'est
          pas à l'écran. */}
      {actif && sectionVisible && !resultatsVisibles && (
        <button
          type="button"
          onClick={() => resultatsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex items-center justify-between gap-3 bg-marine-950/95 backdrop-blur border-t border-white/15 px-5 py-3 text-left"
        >
          <span>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400">Contribution estimée</span>
            <span className={`block text-lg font-bold tabular-nums ${s.surcontribution ? "text-red-300" : "text-white"}`}>
              {formatMontant(s.contributionNette)}
            </span>
          </span>
          <span className="text-xs font-semibold text-marine-200">Voir le détail ↓</span>
        </button>
      )}

      {aideOuverte && <AideModale cle={aideOuverte} onFermer={fermerAide} />}
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

function Pastille({ couleur, children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] text-[11px] text-slate-300 px-3 py-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${couleur}`} />
      {children}
    </span>
  );
}

function EnteteEtape({ numero, titre, sousTitre, children }) {
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-4">
      <span className="shrink-0 w-10 h-10 rounded-xl bg-marine-500/15 border border-marine-400/30 text-marine-300 text-sm font-bold flex items-center justify-center">
        {numero}
      </span>
      <div className="flex-1">
        <h3 className="text-lg sm:text-xl font-semibold">{titre}</h3>
        <p className="text-sm text-slate-400 mt-1">{sousTitre}</p>
      </div>
      <div className="md:pt-1.5">{children}</div>
    </div>
  );
}

// Case de saisie de l'étape 01 (titre, badge "Lié", unité dans le champ).
function CaseSaisie({ titre, badge, unite, value, onChange, placeholder, aide, accent = false, erreur = null }) {
  return (
    <div
      className={`rounded-xl border p-4 transition ${
        erreur ? "border-red-400/50 bg-red-500/[0.05]" : accent ? "border-teal-400/20 bg-teal-400/[0.03]" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-200 flex items-center">{titre}</p>
        {badge && (
          <span className="rounded-full bg-teal-400/15 text-teal-300 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">{badge}</span>
        )}
      </div>
      <div className="relative mt-2.5">
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/10 bg-black/30 text-white placeholder:text-slate-600 pl-3 pr-16 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-marine-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">{unite}</span>
      </div>
      <p className={`text-[11px] mt-2 leading-snug ${erreur ? "text-red-300" : "text-slate-500"}`}>{erreur || aide}</p>
    </div>
  );
}

// Anneau de pourcentage coloré (tableau de bord des résultats).
function Anneau({ pourcentage, couleur, titre, detail, actif }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-marine-950 px-3 py-4 flex flex-col items-center text-center">
      <CercleProgression
        pourcentage={actif ? pourcentage : 0}
        couleur={couleur}
        taille={108}
        epaisseur={10}
        texteCentral={actif ? `${Math.round(Math.min(999, pourcentage))} %` : "—"}
      />
      <p className="text-sm font-semibold mt-3">{titre}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{detail}</p>
    </div>
  );
}

// Donut SVG : répartition de la contribution brute entre ce qui reste à
// payer et chaque déduction retenue, avec légende chiffrée.
function DonutRepartition({ total, segments }) {
  const taille = 150;
  const epaisseur = 18;
  const rayon = (taille - epaisseur) / 2;
  const circonference = 2 * Math.PI * rayon;
  const visibles = segments.filter((seg) => seg.valeur > 0);
  let cumul = 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: taille, height: taille }}>
        <svg width={taille} height={taille} className="-rotate-90">
          <circle cx={taille / 2} cy={taille / 2} r={rayon} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={epaisseur} />
          {visibles.map((seg) => {
            const longueur = (seg.valeur / total) * circonference;
            const cercle = (
              <circle
                key={seg.label}
                cx={taille / 2}
                cy={taille / 2}
                r={rayon}
                fill="none"
                stroke={seg.couleur}
                strokeWidth={epaisseur}
                strokeDasharray={`${longueur} ${circonference - longueur}`}
                strokeDashoffset={-cumul}
                style={{ filter: `drop-shadow(0 0 6px ${seg.couleur}66)`, transition: "stroke-dasharray 0.6s ease-out" }}
              />
            );
            cumul += longueur;
            return cercle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Brute</span>
          <span className="text-sm font-bold tabular-nums">{formatMontant(total)}</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.couleur }} />
            <span className="text-slate-400 w-24">{seg.label}</span>
            <span className="font-semibold tabular-nums">{Math.round((seg.valeur / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Carte({ className = "", children }) {
  return <div className={`rounded-2xl border border-white/10 bg-marine-950 p-6 ${className}`}>{children}</div>;
}

function MiniCarte({ label, valeur, compact = false }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.03] ${compact ? "px-3 py-2.5" : "px-4 py-3.5"}`}>
      {compact ? (
        <>
          <p className="text-sm font-bold tabular-nums">{valeur}</p>
          <p className="text-[11px] text-slate-400">{label}</p>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-xl font-semibold mt-1 tabular-nums">{valeur}</p>
        </>
      )}
    </div>
  );
}

function Indicateur({ label, valeur, teinte }) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${TEINTES[teinte]}`}>
      <p className="text-xs text-slate-300 flex items-center">{label}</p>
      <p className="text-xl font-bold mt-1.5 tabular-nums">{valeur}</p>
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

// Carte de question Oui / Non à boutons radio ronds ; liseré gauche bleu
// tant que la question attend une réponse.
function Question({ intitule, nom, valeur, onChange, actif, children }) {
  return (
    <fieldset
      className={`rounded-xl border bg-white/[0.03] px-5 py-4 transition ${
        actif ? "border-white/10 border-l-4 border-l-marine-400" : "border-white/10"
      }`}
    >
      <legend className="sr-only">{typeof intitule === "string" ? intitule : nom}</legend>
      <p className="text-sm text-slate-200 leading-relaxed">{intitule}</p>
      <div className="flex gap-6 mt-3">
        {[
          { v: true, label: "Oui" },
          { v: false, label: "Non" },
        ].map((o) => (
          <label key={o.label} className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-200">
            <input type="radio" name={nom} checked={valeur === o.v} onChange={() => onChange(o.v)} className="peer sr-only" />
            <span className="w-5 h-5 rounded-full border-2 border-slate-500 flex items-center justify-center peer-checked:border-marine-300 peer-focus-visible:ring-2 peer-focus-visible:ring-marine-500">
              <span className={`w-2.5 h-2.5 rounded-full ${valeur === o.v ? "bg-marine-300" : "bg-transparent"}`} />
            </span>
            {o.label}
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}

function OuiNon({ valeur, onChange }) {
  return (
    <div className="flex gap-2 mt-1.5">
      {[
        { v: true, label: "Oui" },
        { v: false, label: "Non" },
      ].map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(valeur === o.v ? null : o.v)}
          aria-pressed={valeur === o.v}
          className={`flex-1 rounded-xl py-3 text-sm font-medium border transition ${
            valeur === o.v ? "bg-marine-500 border-marine-400 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
          }`}
        >
          {o.label}
        </button>
      ))}
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
