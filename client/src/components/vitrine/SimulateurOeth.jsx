import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api.js";
import CercleProgression from "./CercleProgression.jsx";
import AideModale, { InfoBouton } from "./AideModale.jsx";
import PriseRendezVous from "./PriseRendezVous.jsx";

// Exercices proposés et SMIC retenu : fournis par le serveur
// (/api/vitrine/referentiel, calculés d'après la date du jour et
// l'historique REVALORISATIONS_SMIC de oeth.js). Cette liste locale ne sert
// que de secours si l'appel échoue ; le calcul serveur choisit toujours
// lui-même le SMIC d'après l'année transmise.
const EXERCICES_SECOURS = [
  { annee: 2025, smic: 11.88, provisoire: false, note: "SMIC en vigueur au 31 décembre 2025, retenu pour l'exercice 2025." },
  { annee: 2026, smic: 12.31, provisoire: true, note: "SMIC en vigueur depuis le 1er juin 2026, retenu pour l'exercice 2026." },
];
const EXERCICE_PAR_DEFAUT = new Date().getFullYear();
const GUIDE_OFFICIEL_URL = "https://www.urssaf.fr/files/live/sites/urssaffr/files/outils-documentation/guides/Guide-OETH.pdf";
const PAGE_URSSAF_URL = "https://www.urssaf.fr/accueil/employeur/cotisations/liste-cotisations/contribution-annuelle-oeth.html";
const CLE_ENTREPRISE = "simulateur-oeth-entreprise";

const SAISIE_VIDE = {
  effectif: "",
  boeth: "",
  coutMainOeuvreSousTraitance: "",
  nbEcap: "",
  depAccessibilite: "",
  depMaintien: "",
  depAccompagnement: "",
  depPartenariats: "",
  aEmployeBoeth4Ans: null,
  sousTraitance4Ans: null,
  montantSousTraitance4Ans: "",
  accordAgree: null,
  surcontributionDeclaree: null,
  annee: EXERCICE_PAR_DEFAUT,
  anneeSeuil20: null, // partie 1 : première année à 20 salariés ou plus
  moinsDe20: false,
};

// declarations : déclarations OETH des années précédentes effectuées ?
// true | false | "inconnu" | null (non répondu).
const SITUATION_VIDE = { seuil: "", annees: {}, action: "", declarations: null };

// Dépenses déductibles ventilées par code DSN (bloc S21.G00.82), plafond
// global de 10 % de la contribution brute appliqué côté serveur.
const DEPENSES = [
  {
    champ: "depAccessibilite",
    titre: "Accessibilité",
    dsn: "062",
    exemples: "Diagnostics, travaux, stationnement ou équipements allant au-delà des obligations légales.",
  },
  {
    champ: "depMaintien",
    titre: "Maintien et reconversion",
    dsn: "063",
    exemples: "Adaptation du poste, moyens humains, techniques ou organisationnels et reconversion interne.",
  },
  {
    champ: "depAccompagnement",
    titre: "Accompagnement, formation et sensibilisation",
    dsn: "064",
    exemples: "Pair-aidance, démarches RQTH, accompagnement de BOETH, formation des managers et sensibilisation.",
  },
  {
    champ: "depPartenariats",
    titre: "Partenariats associatifs",
    dsn: "072",
    exemples: "Conventions ou adhésions liées à la formation, à l'insertion ou au maintien dans l'emploi, hors mécénat.",
  },
];

// Leviers d'action affichés sur une ligne sous les résultats. Textes
// originaux : l'encadré "Comment nous pouvons vous accompagner" ne décrit
// que du conseil et de l'orientation par les conseillers du pôle — aucune
// plateforme, formation ou prestation que le pôle ne fournirait pas. Le
// bouton mène à la demande d'analyse gratuite.
const RECOMMANDATIONS = [
  {
    titre: "Structurer une feuille de route handicap",
    couleur: "#2dd4bf",
    texte:
      "Fixer des priorités, des responsables et des échéances pour que les actions ponctuelles deviennent une démarche suivie d'année en année.",
    accompagnement:
      "Un conseiller fait le point avec vous sur votre situation OETH, identifie les leviers les plus utiles et vous aide à les organiser en un plan d'actions réaliste.",
    tags: ["Impact fort", "Effort moyen", "1 à 2 mois"],
    bouton: "Découvrir le pilotage handicap",
    lien: "/vitrine/pilotage#feuille-de-route",
  },
  {
    titre: "Accompagner les démarches RQTH",
    couleur: "#f472b6",
    texte:
      "Des salariés déjà en poste peuvent être concernés sans l'avoir déclaré. Une démarche confidentielle et bien expliquée lève souvent les freins.",
    accompagnement:
      "Nous vous aidons à informer vos équipes sur la RQTH, ses effets et sa confidentialité, et vous orientons vers les bons interlocuteurs (MDPH, Cap emploi).",
    tags: ["Impact très fort", "Effort moyen", "3 à 6 mois"],
    bouton: "Découvrir notre solution",
    lien: "/vitrine/pilotage#suivi",
  },
  {
    titre: "Développer les achats inclusifs",
    couleur: "#38bdf8",
    texte:
      "Confier des prestations à une EA, un ESAT ou un TIH réduit la contribution (DSN 061) et fait sortir de la base majorée dès 600 × SMIC d'achats.",
    accompagnement:
      "Nous vous aidons à repérer les prestations que vous pourriez confier au secteur protégé et adapté, et à entrer en contact avec des structures proches de vous.",
    tags: ["Impact moyen", "Effort faible", "1 à 2 mois"],
    bouton: "Découvrir le pilotage handicap",
    lien: "/vitrine/pilotage#achats",
  },
  {
    titre: "Sensibiliser les équipes",
    couleur: "#fbbf24",
    texte:
      "Rendre le sujet visible réduit les tabous et crée un climat de confiance, propice aux déclarations comme aux aménagements de poste.",
    accompagnement:
      "Nous vous orientons vers des actions de sensibilisation adaptées à votre entreprise. Ces dépenses peuvent être déductibles de la contribution (DSN 064).",
    tags: ["Impact moyen", "Effort faible", "Immédiat"],
    bouton: "Découvrir les conférences",
    lien: "/vitrine/pilotage#sensibilisation",
  },
];

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
// en parcours progressif, du haut vers le bas — chaque partie s'ouvre quand
// la précédente est complète :
//   en tête — recherche d'entreprise (Sirene) : pré-remplit nom, effectif,
//             secteur et année de création (règle des 5 ans) ;
//   01 — votre situation au regard de la loi (assujettissement, règle des
//        4 ans, BOETH de l'exercice, déclarations passées) ;
//   02 — vos effectifs (effectif, taux ⇄ EMA BOETH liés ; BOETH verrouillé
//        à 0 si la partie 1 indique aucun BOETH sur l'exercice) ;
//   03 — déductions et cas particuliers (masquée si aucune action déclarée) ;
//   puis les résultats, mis à jour en direct.
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
  const [deductionsOuvertes, setDeductionsOuvertes] = useState(false);
  const [erreurEffectif, setErreurEffectif] = useState(false);
  const [messageSynthese, setMessageSynthese] = useState(null);

  const [pdfEnCours, setPdfEnCours] = useState(false);
  const [erreurPdf, setErreurPdf] = useState(null);

  const [contactOuvert, setContactOuvert] = useState(false);
  const [contact, setContact] = useState({ nom: "", email: "", telephone: "", message: "" });
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState(null);
  const [envoye, setEnvoye] = useState(false);

  const [sousTraitance, setSousTraitance] = useState(null); // null | true | false
  // Employeur privé (AGEFIPH / URSSAF) ou public (FIPHFP) : détecté via la
  // recherche Sirene, modifiable par le visiteur.
  const [secteur, setSecteur] = useState("prive"); // "prive" | "public"
  const [surcontributionChoix, setSurcontributionChoix] = useState(""); // "" | "oui" | "non" | "inconnu"
  // Partie 1 obligatoire : { seuil: "" | "moins20" | "AAAA", annees: {AAAA: bool}, action: "" | "st" | "accord" | "aucune" }
  const [situation, setSituation] = useState(SITUATION_VIDE);
  // Entreprise retrouvée via Sirene : { nom, siren, ville, dateCreation }.
  const [entrepriseTrouvee, setEntrepriseTrouvee] = useState(null);
  const [rdvOuvert, setRdvOuvert] = useState(false);
  const fermerRdv = useCallback(() => setRdvOuvert(false), []);
  // Partie 3 masquée quand aucune action n'est déclarée ; le visiteur peut
  // tout de même l'afficher (ECAP, dépenses).
  const [partie3Forcee, setPartie3Forcee] = useState(false);
  const [syntheseCopiee, setSyntheseCopiee] = useState(false);
  const asideRef = useRef(null);
  const [aideOuverte, setAideOuverte] = useState(null); // clé de fiche (aideSimulateur.js)
  const fermerAide = useCallback(() => setAideOuverte(null), []);
  const i = (cle) => <InfoBouton cle={cle} onOuvrir={setAideOuverte} />;

  const [exercices, setExercices] = useState(EXERCICES_SECOURS);

  useEffect(() => {
    api
      .getReferentielVitrine()
      .then(({ exercices: liste, parDefaut }) => {
        if (!Array.isArray(liste) || liste.length === 0) return;
        setExercices(liste);
        setSaisie((prec) => (liste.some((e) => e.annee === prec.annee) ? prec : { ...prec, annee: parDefaut }));
      })
      .catch(() => {});
  }, []);
  const [requete, setRequete] = useState("");
  // Recherche d'entreprise repliée en un bandeau compact, ouverte au clic.
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  // Message du bouton flottant quand le parcours n'est pas encore complet.
  const [messageFlottant, setMessageFlottant] = useState(false);
  const champRechercheRef = useRef(null);
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
  const ANNEE_REFERENCE = saisie.annee;
  const exercice = exercices.find((e) => e.annee === ANNEE_REFERENCE) || exercices[exercices.length - 1];
  const smicTexte = exercice.smic.toLocaleString("fr-FR", { minimumFractionDigits: 2 });
  const seuilSousTraitance = Math.round(600 * exercice.smic);

  // ── Partie 1 (obligatoire) : assujettissement puis régime ──────────────
  // Règle des 5 ans (loi PACTE) : seuil atteint l'année A → assujettie à
  // partir de A + 5. Règle des 4 ans : 4 années sans aucun BOETH (ni
  // sous-traitance ≥ 600 × SMIC, ni accord agréé) → surcontribution.
  const anneeSeuilNum = /^\d{4}$/.test(situation.seuil) ? Number(situation.seuil) : null;
  const neutralisee = Boolean(anneeSeuilNum && anneeSeuilNum + 5 > ANNEE_REFERENCE);
  const anneesRegle = [ANNEE_REFERENCE - 3, ANNEE_REFERENCE - 2, ANNEE_REFERENCE - 1, ANNEE_REFERENCE];
  const reponsesAnnees = anneesRegle.map((a) => situation.annees[a]);
  const toutesAnneesRepondues = reponsesAnnees.every((v) => v === true || v === false);
  const auMoinsUneAnneeOui = reponsesAnnees.some((v) => v === true);
  const toutesAnneesNon = toutesAnneesRepondues && !auMoinsUneAnneeOui;
  const assujettie = Boolean(anneeSeuilNum && !neutralisee);
  // Réponse pour l'exercice simulé lui-même : "Oui" → on demande le nombre
  // de BOETH ; "Non" → BOETH verrouillé à 0 en partie 2.
  const reponseExercice = situation.annees[ANNEE_REFERENCE];
  const boethVerrouille = assujettie && reponseExercice === false;
  const boethExerciceRenseigne = saisie.boeth.trim() !== "" && Number(saisie.boeth) > 0;
  const regimeConnu = toutesAnneesRepondues && (auMoinsUneAnneeOui || Boolean(situation.action));
  const situationComplete =
    situation.seuil === "moins20" ||
    neutralisee ||
    Boolean(
      assujettie &&
        regimeConnu &&
        (reponseExercice !== true || boethExerciceRenseigne) &&
        situation.declarations !== null
    );
  const effectifValide = effectifRenseigne && Number(saisie.effectif) >= 20;
  const partie2Complete = situationComplete && effectifValide;
  // Aucune action sur les 4 ans (ni BOETH, ni sous-traitance, ni accord) :
  // la partie 3 est masquée, le visiteur l'a déjà dit.
  const aucuneAction = assujettie && toutesAnneesNon && situation.action === "aucune";
  const partie3Visible = !aucuneAction || partie3Forcee;

  // Premier élément manquant du parcours (bouton flottant) : tant qu'il en
  // reste un, aucun montant n'est affiché — il ne serait pas cohérent.
  const elementManquant = !situation.seuil
    ? { cible: "etape-situation", texte: "Partie 1, question 1 : indiquez depuis quand l'entreprise compte au moins 20 salariés." }
    : assujettie && !toutesAnneesRepondues
      ? { cible: "etape-situation", texte: `Partie 1, question 2 : répondez Oui ou Non pour chacune des années ${anneesRegle[0]} à ${anneesRegle[3]}.` }
      : assujettie && toutesAnneesNon && !situation.action
        ? { cible: "etape-situation", texte: "Partie 1 : précisez si l'entreprise a eu une autre action reconnue (sous-traitance, accord agréé ou aucune)." }
        : assujettie && reponseExercice === true && !boethExerciceRenseigne
          ? { cible: "etape-situation", texte: `Partie 1, question 3 : indiquez le nombre de BOETH employés en ${ANNEE_REFERENCE}.` }
          : assujettie && situation.declarations === null
            ? { cible: "etape-situation", texte: "Partie 1 : indiquez si vos déclarations des années précédentes ont été effectuées." }
            : !effectifValide
              ? { cible: "etape-essentiel", texte: "Partie 2 : renseignez votre effectif d'assujettissement (minimum 20 salariés)." }
              : null;
  const parcoursComplet = !elementManquant;

  // Cases BOETH verrouillées en partie 2 : on rappelle la réponse donnée
  // plus haut, dans la case même, avec un lien pour la modifier.
  const messageBoethVerrouille = toutesAnneesNon
    ? `Vous avez indiqué plus haut : aucun BOETH de ${anneesRegle[0]} à ${anneesRegle[3]}.`
    : `Vous avez indiqué plus haut : aucun BOETH en ${ANNEE_REFERENCE}.`;
  const lienModifierPartie1 = (
    <>
      Valeur reprise de la partie 1.{" "}
      <button
        type="button"
        onClick={() => document.getElementById("etape-situation")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className="font-semibold text-marine-600 dark:text-marine-300 hover:underline"
      >
        Modifier ma réponse ↑
      </button>
    </>
  );
  useEffect(() => {
    if (parcoursComplet) setMessageFlottant(false);
  }, [parcoursComplet]);

  const regime =
    situation.seuil === "moins20"
      ? { ton: "vert", titre: "Non assujettie", texte: "Moins de 20 salariés : pas de contribution OETH. Vous pouvez tout de même simuler pour anticiper." }
      : neutralisee
        ? {
            ton: "vert",
            titre: `Pas encore assujettie en ${ANNEE_REFERENCE}`,
            texte: `Assujettissement à partir de ${anneeSeuilNum + 5}. La simulation ci-dessous vous montre ce que représenterait l'obligation.`,
          }
        : auMoinsUneAnneeOui || (toutesAnneesNon && situation.action && situation.action !== "aucune")
          ? {
              ton: "orange",
              titre: "Régime : contribution classique",
              texte: "Une action a eu lieu sur les 4 dernières années : coefficient de 400, 500 ou 600 × SMIC selon l'effectif, par unité manquante.",
            }
          : {
              ton: "rouge",
              titre: "Régime : surcontribution (1 500 × SMIC)",
              texte: `Aucune action de ${anneesRegle[0]} à ${anneesRegle[3]} : chaque unité manquante coûte 1 500 × SMIC. Une seule action (un recrutement, de la sous-traitance EA/ESAT/TIH d'au moins ${formatMontant(seuilSousTraitance)} ou un accord agréé) suffit à revenir au régime classique.`,
            };

  // Réponses de la partie 1 → données transmises au calcul serveur.
  useEffect(() => {
    setSaisie((prec) => ({
      ...prec,
      moinsDe20: situation.seuil === "moins20",
      anneeSeuil20: anneeSeuilNum,
      aEmployeBoeth4Ans: auMoinsUneAnneeOui ? true : toutesAnneesNon ? false : null,
      sousTraitance4Ans: toutesAnneesNon && situation.action ? situation.action === "st" : null,
      accordAgree: toutesAnneesNon && situation.action ? situation.action === "accord" : null,
      surcontributionDeclaree: null,
    }));
  }, [situation.seuil, anneeSeuilNum, auMoinsUneAnneeOui, toutesAnneesNon, situation.action]);

  // Changer d'exercice change les 4 années de la règle : on redemande.
  useEffect(() => {
    setSituation((st) => ({ ...st, annees: {}, action: "" }));
  }, [ANNEE_REFERENCE]);

  // Synchronisation partie 1 → partie 2 : "Non" pour l'exercice = aucun
  // BOETH, donc taux et EMA BOETH fixés à 0 (non modifiables). Repasser à
  // "Oui" libère les champs pour saisir le nombre réel.
  useEffect(() => {
    if (boethVerrouille) {
      setSaisie((prec) => ({ ...prec, boeth: "0" }));
      setTauxSaisi("0");
    } else {
      setSaisie((prec) => (prec.boeth === "0" ? { ...prec, boeth: "" } : prec));
      setTauxSaisi((t) => (t === "0" ? "" : t));
    }
  }, [boethVerrouille]);

  // Sous-traitance déclarée en partie 1 → la carte correspondante de la
  // partie 3 s'ouvre directement sur le montant.
  useEffect(() => {
    if (situation.action === "st") setSousTraitance((v) => (v === null ? true : v));
    if (situation.action === "aucune") setSousTraitance((v) => (v === true ? v : false));
  }, [situation.action]);

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
    setMessageSynthese(null);
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
    setSecteur(candidat.secteurPublic ? "public" : "prive");
    setEntrepriseTrouvee({
      nom: candidat.nom,
      siren: candidat.siren,
      ville: candidat.ville,
      dateCreation: candidat.dateCreation || null,
      trancheEffectifLabel: candidat.trancheEffectifLabel || null,
      effectifEstime: candidat.effectifEstime ?? null,
      anneeTrancheEffectif: candidat.anneeTrancheEffectif || null,
    });
    // Règle des 5 ans : hypothèse d'un effectif d'au moins 20 salariés dès
    // la création (modifiable en partie 1). Tranche INSEE < 20 → moins de 20.
    const anneeCreation = Number(String(candidat.dateCreation || "").slice(0, 4));
    let seuil = "";
    if (candidat.effectifEstime != null && candidat.effectifEstime < 20) seuil = "moins20";
    else if (anneeCreation >= 1900) seuil = String(Math.max(anneeCreation, ANNEE_REFERENCE - 11));
    if (seuil) setSituation((st) => ({ ...st, seuil }));
    setRechercheOuverte(false);
    setRequete("");
    setResultats([]);
  }

  // Verdict affiché sous l'entreprise retrouvée (date de création Sirene).
  function verdictCreation(dateCreation) {
    const annee = Number(String(dateCreation || "").slice(0, 4));
    if (!annee) return null;
    if (annee + 5 > ANNEE_REFERENCE)
      return {
        ok: false,
        texte: `Créée en ${annee} : moins de 5 ans d'existence. L'entreprise n'est pas encore assujettie à la contribution en ${ANNEE_REFERENCE} ; elle le sera au plus tôt à partir de ${annee + 5}, si l'effectif atteint au moins 20 salariés.`,
      };
    return {
      ok: true,
      texte: `Créée en ${annee} : plus de 5 ans d'existence. Avec au moins 20 salariés depuis 5 ans, l'entreprise est assujettie à l'OETH en ${ANNEE_REFERENCE}.`,
    };
  }

  // "Oui" / "Non" : réponse directe transmise au calcul. "Je ne sais pas" :
  // le calcul se fonde sur les 3 questions de la règle des 4 ans.
  function choisirSurcontribution(choix) {
    setSurcontributionChoix(choix);
    setSaisie((prec) => ({
      ...prec,
      surcontributionDeclaree: choix === "oui" ? true : choix === "non" ? false : null,
      ...(choix === "inconnu" ? {} : { aEmployeBoeth4Ans: null, sousTraitance4Ans: null, montantSousTraitance4Ans: "", accordAgree: null }),
    }));
  }

  function choisirSousTraitance(v) {
    setSousTraitance(v);
    if (v !== true) modifier("coutMainOeuvreSousTraitance", "");
  }

  function calculer() {
    if (!situationComplete) {
      document.getElementById("etape-situation")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
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
    setSecteur("prive");
    setSurcontributionChoix("");
    setSituation(SITUATION_VIDE);
    setEntrepriseTrouvee(null);
    setPartie3Forcee(false);
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

  // Bouton de fin de page : vérifie les champs nécessaires avant de
  // télécharger ; sinon remonte à la partie 2 et signale le champ manquant.
  function telechargerSyntheseFinale() {
    if (!situationComplete) {
      setMessageSynthese("Pour télécharger votre synthèse, complétez d'abord la partie 1 « Votre situation au regard de la loi ».");
      document.getElementById("etape-situation")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const effectif = Number(saisie.effectif);
    if (!effectifRenseigne || !Number.isFinite(effectif) || effectif < 20) {
      setErreurEffectif(true);
      setMessageSynthese(
        "Pour télécharger votre synthèse, renseignez d'abord votre effectif d'assujettissement (minimum 20 salariés) et, si vous les connaissez, vos BOETH."
      );
      document.getElementById("etape-essentiel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setMessageSynthese(null);
    telechargerPdf();
  }

  async function telechargerPdf() {
    setPdfEnCours(true);
    setErreurPdf(null);
    try {
      const blob = await api.telechargerSyntheseSimulation({ ...saisie, nomEntreprise });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `simulation-oeth-${ANNEE_REFERENCE}.pdf`;
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
    ? { texte: "En attente", classe: "bg-slate-900/10 dark:bg-white/10 text-slate-500 dark:text-slate-400" }
    : s.conforme
      ? { texte: "Quota atteint", classe: "bg-emerald-400/15 text-emerald-700 dark:text-emerald-300" }
      : s.surcontribution
        ? { texte: "Base majorée", classe: "bg-red-400/15 text-red-700 dark:text-red-300" }
        : { texte: "Contribution réduite", classe: "bg-teal-400/15 text-teal-700 dark:text-teal-300" };

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

  const nbDeductionsRenseignees =
    [saisie.coutMainOeuvreSousTraitance, saisie.nbEcap, ...DEPENSES.map((d) => saisie[d.champ])].filter(
      (v) => String(v).trim() !== "" && Number(v) > 0
    ).length + (surcontributionChoix ? 1 : 0);

  // Synthèse DSN (bloc Cotisation établissement S21.G00.82, rubrique
  // S21.G00.82.002). 065 à 068 se déclarent ensemble ; l'écrêtement
  // transitoire ayant pris fin, 067 reprend 066.
  const lignesDsn = [
    { code: "060", element: "Déduction ECAP", note: "17 × SMIC par salarié ECAP", valeur: s?.deductions.ecap || 0, calcule: true },
    {
      code: "061",
      element: "Déduction sous-traitance EA / ESAT / TIH / EPS",
      note: "30 % du coût de main-d'œuvre, plafonné",
      valeur: s?.deductions.sousTraitance || 0,
      calcule: true,
    },
    ...DEPENSES.map((d) => ({ code: d.dsn, element: d.titre, note: "Dépense HT saisie — justificatifs à conserver", valeur: Number(saisie[d.champ]) || 0 })),
    { code: "065", element: "Contribution brute avant déductions", note: "Manque × coefficient × SMIC", valeur: s?.contributionBrute || 0, calcule: true, total: true },
    { code: "066", element: "Contribution nette avant écrêtement", note: "Brute − déductions", valeur: s?.contributionNette || 0, calcule: true, total: true },
    { code: "067", element: "Contribution nette après écrêtement", note: "Identique au 066", valeur: s?.contributionNette || 0, calcule: true, total: true },
    { code: "068", element: "Contribution réelle due", note: "Montant estimé à régler", valeur: s?.contributionNette || 0, calcule: true, total: true },
  ].map((l) => ({ ...l, statut: l.calcule ? "Prérempli" : l.valeur > 0 ? "À valider" : "Non concerné" }));

  function texteSyntheseDsn() {
    return [
      `Synthèse DSN OETH — exercice ${ANNEE_REFERENCE}${nomEntreprise ? ` — ${nomEntreprise}` : ""}`,
      "Bloc S21.G00.82 (Cotisation établissement), rubrique S21.G00.82.002",
      ...lignesDsn.map((l) => `${l.code} — ${l.element} : ${Math.round(l.valeur)} € (${l.statut})`),
      "Estimation indicative — seule l'URSSAF (ou la MSA) calcule et recouvre la contribution.",
    ].join("\n");
  }

  async function copierSyntheseDsn() {
    try {
      await navigator.clipboard.writeText(texteSyntheseDsn());
      setSyntheseCopiee(true);
      setTimeout(() => setSyntheseCopiee(false), 2000);
    } catch {
      // presse-papiers indisponible (navigateur ancien, contexte non sécurisé)
    }
  }

  function telechargerCsvDsn() {
    const lignes = [
      ["Élément", "Rubrique DSN", "Code", "Valeur (€)", "Statut"],
      ...lignesDsn.map((l) => [l.element, "S21.G00.82.002", l.code, String(Math.round(l.valeur)), l.statut]),
    ];
    const csv = "﻿" + lignes.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `synthese-dsn-oeth-${ANNEE_REFERENCE}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const plafondDepenses = s?.deductions.plafondDepenses || 0;
  const depensesMobilisees = s?.deductions.depenses || 0;
  const encoreMobilisable = Math.max(0, plafondDepenses - depensesMobilisees);
  const partMobilisee = plafondDepenses > 0 ? Math.min(100, (depensesMobilisees / plafondDepenses) * 100) : 0;

  return (
    <section ref={sectionRef} id="simulateur" className="relative bg-slate-50 dark:bg-black text-slate-900 dark:text-white pt-4 sm:pt-5 pb-16 sm:pb-24 scroll-mt-16">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-marine-500/60 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] max-w-full h-[500px] rounded-full bg-marine-600/10 blur-3xl" />

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 space-y-3">
        {/* ─────────── En-tête ─────────── */}
        <div className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 shadow-2xl overflow-hidden">
          <div className="flex h-1">
            <span className="flex-1 bg-marine-500" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-red-500" />
          </div>
          <div className="px-4 sm:px-8 py-5 flex flex-col items-center text-center gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marine-600 dark:text-marine-400">
                Obligation d'emploi des travailleurs handicapés
              </p>
              {/* Titre principal (H1) de la page /vitrine — mots-clés OETH / DOETH. */}
              <h1 className="font-bold text-slate-900 dark:text-white text-2xl sm:text-4xl mt-1.5">
                Simulateur Gratuit OETH / DOETH {ANNEE_REFERENCE}
              </h1>
            </div>
            {/* Sur une seule ligne sur téléphone (libellés courts). */}
            <div className="flex flex-nowrap sm:flex-wrap justify-center gap-1.5 sm:gap-2">
              <Pastille couleur="bg-teal-400" court="2 min">Environ 2 minutes</Pastille>
              <Pastille couleur="bg-sky-400" court="Sans pièce jointe">Aucune pièce à joindre</Pastille>
              <Pastille couleur="bg-amber-400" court="Immédiat">Résultat immédiat</Pastille>
            </div>
          </div>
        </div>

        {/* ─────────── En tête : retrouvez votre entreprise (Sirene) ───────────
            Pré-remplit le nom, l'effectif estimé, le secteur (privé / public)
            et, via la date de création, la question 1 de la partie 1 (règle
            des 5 ans). Facultatif : tout reste modifiable. */}
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/[0.06] px-4 sm:px-5 py-2">
          <button
            type="button"
            onClick={() => {
              setRechercheOuverte((v) => !v);
              if (!rechercheOuverte) setTimeout(() => champRechercheRef.current?.focus(), 50);
            }}
            aria-expanded={rechercheOuverte}
            className="w-full flex items-center gap-2.5 text-left py-0.5"
          >
            <span className="shrink-0 rounded-full bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5">
              Important
            </span>
            <span className="flex-1 text-sm font-semibold">
              Gagnez du temps : retrouvez votre entreprise
              <span className="hidden sm:inline font-normal text-slate-500 dark:text-slate-400"> — par raison sociale ou SIREN</span>
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 transition-transform ${rechercheOuverte ? "rotate-180" : ""}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <div className={`${rechercheOuverte ? "block" : "hidden"} pt-2 pb-2`}>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Nous pré-remplissons le nom, un effectif estimé et la date de création, qui indique si l'entreprise est
              assujettie. Tout reste modifiable.
            </p>
            <div className="relative">
              <input
                type="text"
                value={requete}
                ref={champRechercheRef}
                onChange={(e) => setRequete(e.target.value)}
                placeholder="Ex : Société Dupont, ou 123 456 789"
                className={`${CLASSE_INPUT} pl-11`}
                aria-label="Rechercher votre entreprise par raison sociale ou SIREN"
              />
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-500 absolute left-4 top-[23px] -translate-y-1/2 pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
              {(recherche || erreurRecherche || resultats.length > 0) && (
                <div className="absolute z-30 inset-x-0 top-full mt-2 rounded-xl border border-slate-900/15 dark:border-white/15 bg-white dark:bg-marine-950 shadow-2xl p-2 max-h-64 overflow-y-auto">
                  {recherche && <p className="text-xs text-slate-500 px-2 py-1.5">Recherche…</p>}
                  {erreurRecherche && <p className="text-xs text-red-600 dark:text-red-400 px-2 py-1.5">{erreurRecherche}</p>}
                  {resultats.map((r) => (
                    <button
                      key={r.siren}
                      type="button"
                      onClick={() => preremplirDepuisRecherche(r)}
                      className="w-full text-left rounded-lg hover:bg-slate-900/10 dark:hover:bg-white/10 transition px-3 py-2"
                    >
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{r.nom}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {[r.ville, r.trancheEffectifLabel, r.dateCreation && `créée en ${String(r.dateCreation).slice(0, 4)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-500 mt-1.5">
                Répertoire public Sirene (INSEE) — aucune donnée n'est enregistrée. Facultatif : vous pouvez répondre
                directement à la partie 1.
              </p>
            </div>
          </div>

          {entrepriseTrouvee &&
            (() => {
              const v = verdictCreation(entrepriseTrouvee.dateCreation);
              return (
                <div
                  className={`mt-1.5 mb-1.5 rounded-lg border px-3.5 py-2.5 text-sm ${
                    !v
                      ? "border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03]"
                      : v.ok
                        ? "border-marine-400/40 bg-marine-500/[0.07]"
                        : "border-emerald-400/40 bg-emerald-500/10"
                  }`}
                >
                  <p className="font-semibold">
                    {entrepriseTrouvee.nom}
                    <span className="ml-2 font-normal text-xs text-slate-500 dark:text-slate-400">
                      {[entrepriseTrouvee.siren && `SIREN ${entrepriseTrouvee.siren}`, entrepriseTrouvee.ville].filter(Boolean).join(" · ")}
                    </span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                    {v ? v.texte : "Date de création non communiquée par le répertoire Sirene : répondez à la question 1 ci-dessous."}
                  </p>
                  {entrepriseTrouvee.effectifEstime != null && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                      Effectif estimé : <strong>{formatNombre(entrepriseTrouvee.effectifEstime)} salariés</strong>
                      {entrepriseTrouvee.trancheEffectifLabel && <> (tranche INSEE « {entrepriseTrouvee.trancheEffectifLabel} »</>}
                      {entrepriseTrouvee.trancheEffectifLabel && entrepriseTrouvee.anneeTrancheEffectif && <>, donnée {entrepriseTrouvee.anneeTrancheEffectif}</>}
                      {entrepriseTrouvee.trancheEffectifLabel && <>)</>}. Repris dans la partie 2 : remplacez-le par votre effectif
                      réel s'il est différent.
                    </p>
                  )}
                  {v && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Question 1 pré-remplie avec l'année de création : corrigez-la si le seuil de 20 salariés a été atteint
                      plus tard.
                    </p>
                  )}
                </div>
              );
            })()}
        </div>

        {/* ─────────── Partie 1 : votre situation au regard de la loi ───────────
            Loi PACTE (art. L130-1 CSS) : le seuil de 20 salariés ne compte
            qu'après 5 années civiles consécutives au-dessus du seuil ; puis
            règle des 4 ans (art. L5212-10 du Code du travail) : sans aucune
            action pendant plus de 3 ans, contribution majorée à 1 500 × SMIC.
            Chaque réponse ouvre la question suivante ; la partie 2 s'ouvre
            quand la partie 1 est complète. */}
        <div
          id="etape-situation"
          className={`scroll-mt-24 rounded-2xl border-2 px-5 sm:px-8 pt-5 pb-6 transition ${
            situationComplete
              ? "border-emerald-400/50 bg-white dark:bg-marine-950/80"
              : "border-amber-400/70 bg-amber-50/60 dark:bg-amber-500/[0.06]"
          }`}
        >
          <EntetePartie
            numero="1"
            titre="Votre situation au regard de la loi"
            sousTitre="Quelques questions pour savoir si votre entreprise est assujettie, et si elle relève de la contribution classique ou de la surcontribution. Chaque réponse ouvre la suivante."
            complete={situationComplete}
            obligatoire
          />

          {/* Exercice simulé, SMIC retenu et type d'employeur. */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Choix de l'exercice (liste fournie par le serveur d'après la
                date du jour) : le SMIC retenu et tout le calcul suivent. */}
            <div
              role="radiogroup"
              aria-label="Année concernée"
              className="inline-flex items-center gap-0.5 sm:gap-1 rounded-full border border-amber-400/40 bg-amber-400/[0.06] pl-2 sm:pl-3.5 pr-1 py-1 text-xs"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mr-1 sm:mr-1.5">
                <span className="sm:hidden">Année</span>
                <span className="hidden sm:inline">Année concernée</span>
              </span>
              {exercices.map((e) => {
                const actifAnnee = e.annee === ANNEE_REFERENCE;
                return (
                  <button
                    key={e.annee}
                    type="button"
                    role="radio"
                    aria-checked={actifAnnee}
                    onClick={() => modifier("annee", e.annee)}
                    className={`rounded-full px-1.5 sm:px-3 py-1 font-semibold transition ${
                      actifAnnee
                        ? "bg-amber-400 text-marine-950 shadow-[0_0_14px_rgba(251,191,36,0.45)]"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-white/10"
                    }`}
                  >
                    {e.annee}
                  </button>
                );
              })}
            </div>
            <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-900/15 dark:border-white/15 bg-slate-900/[0.04] dark:bg-white/[0.04] px-2 sm:px-3.5 py-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span className="sm:hidden">SMIC</span>
                <span className="hidden sm:inline">SMIC horaire brut retenu</span>
              </span>
              <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{smicTexte} €</span>
            </span>
            {/* Type d'employeur : privé (AGEFIPH, déclaration DSN / URSSAF) ou
                public (FIPHFP). Détecté automatiquement via la recherche. */}
            <div
              role="radiogroup"
              aria-label="Type d'employeur"
              className="flex w-full sm:w-auto sm:inline-flex items-center gap-1 rounded-full border border-marine-400/40 bg-marine-500/[0.06] pl-1 sm:pl-3.5 pr-1 py-1 text-xs"
            >
              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-marine-700 dark:text-marine-300 mr-1.5">Employeur</span>
              {[
                { v: "prive", label: "Privé · AGEFIPH" },
                { v: "public", label: "Public · FIPHFP" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={secteur === o.v}
                  onClick={() => setSecteur(o.v)}
                  className={`flex-1 sm:flex-none whitespace-nowrap rounded-full px-3 py-1.5 sm:py-1 font-semibold transition ${
                    secteur === o.v
                      ? "bg-marine-500 text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-white/10"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <span className="w-full text-[11px] text-slate-500">{exercice.note}</span>
          </div>

          {secteur === "public" && (
            <div className="mt-3 rounded-xl border border-sky-400/40 border-l-4 border-l-sky-400 bg-sky-500/[0.08] px-4 py-3 text-sm text-slate-700 dark:text-sky-100">
              <p className="font-semibold text-sky-800 dark:text-sky-200">Employeur public : votre déclaration relève du FIPHFP</p>
              <p className="mt-1 text-xs leading-relaxed">
                Les employeurs publics (État, collectivités territoriales, établissements hospitaliers et autres établissements
                publics) d'au moins 20 agents déclarent chaque année leur obligation d'emploi au FIPHFP, et non dans la DSN
                auprès de l'URSSAF. Le taux de 6 % s'applique aussi, mais le calcul de la contribution suit des règles propres
                à la fonction publique : l'estimation ci-dessous, fondée sur les règles du secteur privé, n'est qu'indicative.{" "}
                <a href="https://www.fiphfp.fr/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  fiphfp.fr ↗
                </a>
              </p>
            </div>
          )}

          {/* Question 1 : assujettissement (règle des 5 ans) */}
          <div className="mt-4 rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
            <label className="block">
              <span className="text-sm font-semibold flex items-center">
                1. Depuis quelle année votre entreprise compte-t-elle au moins 20 salariés sans interruption ?{i("effectif")}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                Si l'entreprise a 20 salariés depuis sa création, indiquez l'année de création. L'obligation ne s'applique
                qu'après 5 années civiles consécutives au-dessus du seuil.
              </span>
              <select
                value={situation.seuil}
                onChange={(e) => setSituation((st) => ({ ...st, seuil: e.target.value }))}
                className={`mt-2 ${CLASSE_INPUT} sm:w-96 cursor-pointer`}
              >
                <option className="bg-white dark:bg-marine-950" value="">
                  Choisir…
                </option>
                <option className="bg-white dark:bg-marine-950" value="moins20">
                  L'entreprise a moins de 20 salariés
                </option>
                {Array.from({ length: 11 }, (_, k) => ANNEE_REFERENCE - k).map((a) => (
                  <option key={a} className="bg-white dark:bg-marine-950" value={String(a)}>
                    Depuis {a}
                  </option>
                ))}
                <option className="bg-white dark:bg-marine-950" value={String(ANNEE_REFERENCE - 11)}>
                  Avant {ANNEE_REFERENCE - 10}
                </option>
              </select>
            </label>
            {situation.seuil === "moins20" && (
              <p className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-400/30 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                Moins de 20 salariés : l'entreprise n'est pas assujettie à l'obligation d'emploi (la déclaration mensuelle des
                bénéficiaires en DSN reste due).
              </p>
            )}
            {anneeSeuilNum && neutralisee && (
              <p className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-400/30 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                Seuil atteint en {anneeSeuilNum} : période de 5 ans en cours. L'entreprise n'est{" "}
                <strong>pas encore assujettie</strong> pour {ANNEE_REFERENCE} ; elle le sera à partir de{" "}
                <strong>{anneeSeuilNum + 5}</strong> si l'effectif reste au moins à 20 salariés. C'est le moment d'anticiper.
              </p>
            )}
          </div>

          {/* Question 2 : régime (règle des 4 ans) — seulement si assujettie */}
          {assujettie && (
            <div className="mt-3 rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
              <p className="text-sm font-semibold flex items-center">
                2. Pour chaque année, l'entreprise a-t-elle employé au moins un travailleur handicapé (BOETH) ?
                {i("surcontribution")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Si la réponse est « Non » pour les 4 années {anneesRegle[0]} à {anneesRegle[3]}, la surcontribution peut
                s'appliquer. Dès qu'une année est à « Oui », l'entreprise reste en contribution classique.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                {anneesRegle.map((a) => (
                  <div
                    key={a}
                    className={`rounded-lg border px-3 py-2.5 ${
                      a === ANNEE_REFERENCE ? "border-amber-400/60 bg-amber-400/[0.05]" : "border-slate-900/10 dark:border-white/10"
                    }`}
                  >
                    <p className="text-sm font-bold">
                      {a}
                      {a === ANNEE_REFERENCE && (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          exercice simulé
                        </span>
                      )}
                    </p>
                    <div className="flex gap-1.5 mt-1.5">
                      {[
                        { v: true, label: "Oui" },
                        { v: false, label: "Non" },
                      ].map((o) => (
                        <button
                          key={o.label}
                          type="button"
                          aria-pressed={situation.annees[a] === o.v}
                          onClick={() => setSituation((st) => ({ ...st, annees: { ...st.annees, [a]: o.v } }))}
                          className={`flex-1 rounded-md py-1.5 text-xs font-semibold border transition ${
                            situation.annees[a] === o.v
                              ? o.v
                                ? "bg-emerald-500 border-emerald-400 text-white"
                                : "bg-red-500 border-red-400 text-white"
                              : "border-slate-900/15 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {toutesAnneesNon && (
                <div className="mt-3">
                  <p className="text-sm font-semibold">
                    Sur cette période, l'entreprise a-t-elle eu une autre action reconnue par la loi ?
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      { v: "st", label: `Sous-traitance EA / ESAT / TIH ≥ ${formatMontant(seuilSousTraitance)} (600 × SMIC)` },
                      { v: "accord", label: "Accord agréé" },
                      { v: "aucune", label: "Aucune de ces actions" },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        aria-pressed={situation.action === o.v}
                        onClick={() => setSituation((st) => ({ ...st, action: o.v }))}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                          situation.action === o.v
                            ? "bg-marine-500 border-marine-400 text-white"
                            : "border-slate-900/15 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Question 3 : nombre de BOETH de l'exercice (si "Oui" pour l'exercice) */}
          {assujettie && regimeConnu && reponseExercice === true && (
            <div className="mt-3 rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
              <label className="block">
                <span className="text-sm font-semibold flex items-center">
                  3. Combien de travailleurs handicapés (BOETH) l'entreprise emploie-t-elle en {ANNEE_REFERENCE} ?{i("boeth")}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Effectif moyen annuel (EMA) de bénéficiaires communiqué par l'URSSAF ou la MSA ; à défaut, une estimation
                  (ex. 1 ou 2,5). Ce nombre est repris automatiquement dans la partie 2.
                </span>
                <div className="relative mt-2 sm:w-64">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={saisie.boeth}
                    onChange={(e) => changerBoeth(e.target.value)}
                    placeholder="Ex. 1"
                    className={`${CLASSE_INPUT} pr-16`}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">BOETH</span>
                </div>
              </label>
            </div>
          )}
          {boethVerrouille && regimeConnu && (
            <p className="mt-3 rounded-lg border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
              Aucun BOETH en {ANNEE_REFERENCE} : l'EMA BOETH et le taux d'emploi sont fixés à 0 dans la partie 2.
            </p>
          )}

          {/* Dernière question : déclarations des années précédentes */}
          {assujettie && regimeConnu && (reponseExercice !== true || boethExerciceRenseigne) && (
            <div className="mt-3 rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
              <p className="text-sm font-semibold">
                {reponseExercice === true ? "4" : "3"}. Avez-vous effectué vos déclarations OETH (DOETH) des années
                précédentes ?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Pour les entreprises assujetties, la déclaration se fait chaque année dans la DSN (exercices {anneesRegle[0]} à{" "}
                {ANNEE_REFERENCE - 1}).
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  { v: true, label: "Oui, elles sont à jour" },
                  { v: false, label: "Non" },
                  { v: "inconnu", label: "Je ne sais pas" },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={situation.declarations === o.v}
                    onClick={() => setSituation((st) => ({ ...st, declarations: o.v }))}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                      situation.declarations === o.v
                        ? "bg-marine-500 border-marine-400 text-white"
                        : "border-slate-900/15 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {(situation.declarations === false || situation.declarations === "inconnu") && (
                <div className="mt-3 rounded-xl border border-marine-400/40 border-l-4 border-l-marine-500 bg-marine-500/[0.07] px-4 py-3">
                  <p className="text-sm font-semibold text-marine-800 dark:text-marine-200">Un expert vous accompagne</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                    Une déclaration manquante ou incertaine se vérifie et se régularise. Un expert du Pôle fait le point avec
                    vous sur les exercices concernés, les montants à déclarer et les actions qui peuvent réduire votre
                    contribution. Vous pouvez poursuivre la simulation en attendant.
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRdvOuvert(true)}
                      className="rounded-full bg-marine-500 hover:bg-marine-400 text-white text-xs font-semibold px-4 py-2 transition"
                    >
                      Prendre rendez-vous avec un expert
                    </button>
                    <a
                      href="tel:+33744127917"
                      className="rounded-full border border-marine-400/40 text-marine-700 dark:text-marine-200 text-xs font-semibold px-4 py-2 hover:bg-marine-500/10 transition"
                    >
                      +33 7 44 12 79 17
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Verdict */}
          {situationComplete && (
            <div
              className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
                regime.ton === "rouge"
                  ? "border-red-400/50 bg-red-500/10 text-red-800 dark:text-red-200"
                  : regime.ton === "orange"
                    ? "border-orange-400/50 bg-orange-500/10 text-orange-900 dark:text-orange-100"
                    : "border-emerald-400/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              }`}
            >
              <p className="font-bold">{regime.titre}</p>
              <p className="mt-0.5 text-xs leading-relaxed">{regime.texte}</p>
            </div>
          )}
        </div>

        {/* ─────────── Partie 2 : vos effectifs ─────────── */}
        {situationComplete ? (
          <div id="etape-essentiel" className="scroll-mt-24 rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950/80 px-5 sm:px-8 pt-5 pb-4">
            <EntetePartie
              numero="2"
              titre="Remplissez vos effectifs"
              sousTitre="Effectif d'assujettissement et bénéficiaires. Le taux d'emploi et l'EMA BOETH sont liés : saisissez l'un, l'autre se calcule."
              complete={partie2Complete}
            />

            <div className="mt-4 grid md:grid-cols-3 gap-3">
              <CaseSaisie
                titre={<>Effectif d'assujettissement{i("effectif")}</>}
                unite="salariés"
                value={saisie.effectif}
                onChange={changerEffectif}
                placeholder="Minimum 20"
                min="20"
                complement={<CalculSixPourcent effectif={saisie.effectif} />}
                aide="Effectif moyen annuel retenu pour l'OETH (minimum 20 salariés)."
                erreur={
                  erreurEffectif
                    ? "Renseignez votre effectif (minimum 20) pour calculer."
                    : effectifRenseigne && Number(saisie.effectif) < 20
                      ? "Minimum 20 salariés : en dessous, l'entreprise n'est pas redevable de la contribution OETH."
                      : null
                }
              />
              <CaseSaisie
                titre={<>Taux d'emploi BOETH{i("objectif")}</>}
                badge={boethVerrouille ? "Partie 1" : "Lié"}
                unite="%"
                value={tauxSaisi}
                onChange={changerTaux}
                placeholder="Ex. 1"
                aide={boethVerrouille ? lienModifierPartie1 : "Taux légal, valorisation seniors incluse."}
                verrouille={boethVerrouille && messageBoethVerrouille}
                accent
              />
              <CaseSaisie
                titre={<>EMA BOETH pris en compte{i("boeth")}</>}
                badge={boethVerrouille ? "Partie 1" : "Lié"}
                unite="BOETH"
                value={saisie.boeth}
                onChange={changerBoeth}
                placeholder="Ex. 0,34"
                aide={
                  boethVerrouille
                    ? lienModifierPartie1
                    : "Bénéficiaires de l'obligation d'emploi pris en compte dans la déclaration."
                }
                verrouille={boethVerrouille && messageBoethVerrouille}
                accent
              />
            </div>

            <div className="mt-2 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.02] dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setAideEssentielOuverte((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Besoin d'aide pour identifier ces informations ?
                <span className="text-marine-600 dark:text-marine-300 text-base leading-none">{aideEssentielOuverte ? "−" : "+"}</span>
              </button>
              {aideEssentielOuverte && (
                <p className="px-4 pb-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  L'effectif correspond à l'EMA OETH d'assujettissement communiqué par l'URSSAF (ou la MSA). Vous pouvez
                  ensuite renseigner soit votre taux d'emploi légal, soit votre EMA BOETH : le simulateur calcule
                  automatiquement l'autre valeur. Lorsque ces données proviennent de l'URSSAF ou de la MSA, elles intègrent
                  déjà la valorisation applicable aux BOETH de 50 ans et plus. Cliquez sur les icônes ⓘ pour une explication
                  détaillée de chaque terme, à lire ou à écouter.
                </p>
              )}
            </div>
          </div>
        ) : (
          <PartieVerrouillee numero="2" titre="Remplissez vos effectifs" message="S'ouvre dès que la partie 1 est complète." />
        )}

        {/* ─────────── Partie 3 : déductions & cas particuliers ───────────
            Ouverte une fois l'effectif renseigné ; masquée quand la partie 1
            indique aucune action sur les 4 ans (le visiteur peut l'afficher
            quand même pour l'ECAP ou les dépenses déductibles). */}
        {partie2Complete && partie3Visible && (
        <div ref={deductionsRef} className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950/80 scroll-mt-24">
          <button
            type="button"
            onClick={() => setDeductionsOuvertes((v) => !v)}
            className="w-full flex items-center gap-3 px-5 sm:px-8 py-4 text-left"
            aria-expanded={deductionsOuvertes}
          >
            <span className="shrink-0 w-10 h-10 rounded-xl bg-marine-500/15 border border-marine-400/30 text-marine-600 dark:text-marine-300 text-sm font-bold flex items-center justify-center">
              03
            </span>
            <span className="flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-marine-600 dark:text-marine-400">Partie 3</span>
              <span className="block font-semibold text-lg">J'ai des déductions ou un cas particulier à renseigner</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sous-traitance EA / ESAT / TIH, ECAP, dépenses déductibles.
              </span>
            </span>
            {nbDeductionsRenseignees > 0 && (
              <span className="hidden sm:inline rounded-full bg-teal-400/15 text-teal-700 dark:text-teal-300 text-[10px] font-semibold px-2.5 py-1">
                {nbDeductionsRenseignees} renseigné{nbDeductionsRenseignees > 1 ? "s" : ""}
              </span>
            )}
            <span className="hidden sm:inline rounded-full border border-slate-900/15 dark:border-white/15 text-slate-500 dark:text-slate-400 text-[10px] font-semibold px-2.5 py-1">
              Facultatif
            </span>
            <span className={`text-marine-600 dark:text-marine-300 text-xl leading-none transition-transform ${deductionsOuvertes ? "rotate-45" : ""}`}>+</span>
          </button>

          {deductionsOuvertes && (
            <div className="px-6 sm:px-8 pb-6 border-t border-slate-900/10 dark:border-white/10 pt-5 space-y-4">
              <p className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.02] dark:bg-white/[0.02] px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                Vous pouvez laisser tous ces montants vides si vous n'êtes pas concerné. Leur saisie permet simplement
                d'affiner le calcul et de préparer votre récapitulatif DSN (codes indiqués sur chaque champ).
              </p>

              <div className="grid md:grid-cols-2 gap-3">
                <CarteDeduction
                  titre={<>Effectif moyen annuel ECAP{i("ecap")}</>}
                  dsn="060"
                  question="Comment le renseigner ?"
                  reponse="Reportez l'effectif moyen annuel ECAP communiqué par l'URSSAF ou la MSA (chauffeurs routiers, BTP, sécurité…). Laissez vide si vous n'êtes pas concerné."
                >
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={saisie.nbEcap}
                    onChange={(e) => modifier("nbEcap", e.target.value)}
                    placeholder="Facultatif"
                    className={CLASSE_INPUT}
                  />
                </CarteDeduction>

                {/* Oui / Non d'abord : beaucoup d'entreprises n'ont aucun achat
                    auprès du secteur protégé, elles passent sans rien saisir. */}
                <CarteDeduction
                  titre={<>Sous-traitance EA, ESAT, TIH ou EPS{i("sousTraitance")}</>}
                  dsn="061"
                  question="Quel montant saisir ?"
                  reponse="Le coût de la main-d'œuvre indiqué sur les attestations annuelles de vos fournisseurs (hors taxes, hors matières premières), et non le total des factures. Le simulateur en retient 30 %."
                >
                  {sousTraitance !== true ? (
                    <>
                      <OuiNon valeur={sousTraitance} onChange={choisirSousTraitance} />
                      <span className="block text-[11px] text-slate-500 mt-1">
                        Travaillez-vous avec une EA, un ESAT, un TIH ou une entreprise de portage (EPS) ?
                      </span>
                    </>
                  ) : (
                    <div className="flex gap-2">
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
                        className="shrink-0 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 px-3 text-slate-500 dark:text-slate-400 hover:bg-slate-900/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </CarteDeduction>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-2 pt-3 border-t border-slate-900/10 dark:border-white/10">
                <p className="font-semibold flex items-center">Dépenses déductibles{i("depenses")}</p>
                <p className="text-xs text-slate-500">Montants HT engagés pendant l'exercice</p>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {DEPENSES.map((d) => (
                  <CarteDeduction key={d.champ} titre={d.titre} dsn={d.dsn} question="Voir des exemples" reponse={d.exemples}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={saisie[d.champ]}
                      onChange={(e) => modifier(d.champ, e.target.value)}
                      placeholder="0"
                      className={CLASSE_INPUT}
                    />
                  </CarteDeduction>
                ))}
              </div>
              <p className="rounded-xl border border-amber-400/30 border-l-4 border-l-amber-400 bg-amber-500/[0.07] px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
                Les dépenses 062, 063, 064 et 072 sont ventilées séparément dans votre récapitulatif DSN. Le simulateur
                applique automatiquement leur plafond global de 10 % de la contribution brute.
              </p>

              {/* Régime (contribution classique ou surcontribution) : déterminé
                  en partie 1, en haut du simulateur. */}
              <p className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                Contribution classique ou surcontribution : votre régime est déterminé en partie 1 (règle des 4 ans).
              </p>
            </div>
          )}
        </div>
        )}
        {partie2Complete && !partie3Visible && (
          <div className="rounded-2xl border border-dashed border-slate-900/15 dark:border-white/15 px-5 sm:px-8 py-4 text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Partie 3 — Déductions : non concernée.</span> Vous avez indiqué n'avoir eu, de{" "}
            {anneesRegle[0]} à {anneesRegle[3]}, ni BOETH, ni sous-traitance EA / ESAT / TIH, ni accord agréé.{" "}
            <button
              type="button"
              onClick={() => {
                setPartie3Forcee(true);
                ouvrirDeductions();
              }}
              className="text-marine-600 dark:text-marine-300 font-semibold hover:underline"
            >
              Renseigner malgré tout un effectif ECAP ou des dépenses déductibles
            </button>
          </div>
        )}
        {!partie2Complete && !aucuneAction && (
          <PartieVerrouillee
            numero="3"
            titre="J'ai des déductions ou un cas particulier à renseigner"
            message={situationComplete ? "S'ouvre dès que votre effectif est renseigné (partie 2)." : "S'ouvre après les parties 1 et 2."}
          />
        )}

        {/* Liens utilitaires — l'appel "Calculer ma contribution" est un
            bouton flottant (voir bas du composant) : il ne prend pas de place
            et les résultats remontent juste sous la saisie. */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span>● Résultat immédiat</span>
            <span>● Sans coordonnées</span>
            <span>● Sans engagement</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <button type="button" onClick={reinitialiser} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline-offset-4 hover:underline">
              Nouvelle simulation
            </button>
            <a href={GUIDE_OFFICIEL_URL} target="_blank" rel="noopener noreferrer" className="text-marine-600 dark:text-marine-300 hover:text-marine-800 dark:hover:text-marine-200 hover:underline">
              Guide officiel OETH (URSSAF · PDF) ↗
            </a>
          </div>
        </div>

        {/* ─────────── Résultats ─────────── */}
        {/* Affichés dès que la partie 1 est complète (masqués, pas démontés,
            pour que l'IntersectionObserver de la barre mobile reste branché) ;
            chaque saisie met les chiffres à jour en direct. */}
        {(
          <div ref={resultatsRef} className={`scroll-mt-20 pt-4 ${situationComplete ? "" : "hidden"}`}>
            <div className="flex items-center gap-4 mb-5">
              <span className="shrink-0 w-10 h-10 rounded-xl bg-teal-400/15 border border-teal-400/30 text-teal-700 dark:text-teal-300 text-sm font-bold flex items-center justify-center">
                ✓
              </span>
              <div>
                <p className="font-semibold text-lg">Vos résultats</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Mis à jour en direct : modifiez une donnée ci-dessus, les chiffres suivent.</p>
              </div>
            </div>

            {erreurCalcul && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{erreurCalcul}</p>}
            {s && !s.assujetti && (
              <p className="mb-5 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-4 text-sm text-emerald-700 dark:text-emerald-200">
                {s.motifNonAssujetti === "neutralisation"
                  ? `Seuil de 20 salariés franchi depuis moins de 5 ans : l'entreprise n'est pas encore assujettie pour ${ANNEE_REFERENCE} (assujettissement à partir de ${s.anneeAssujettissement}). La déclaration mensuelle des bénéficiaires en DSN reste due.`
                  : `Moins de ${s.seuilAssujettissement} salariés : l'entreprise n'est pas assujettie à la contribution OETH (la déclaration mensuelle des bénéficiaires en DSN reste due).`}
              </p>
            )}

            <div className="grid lg:grid-cols-3 gap-5 items-start">
              <div className="lg:col-span-2 space-y-5">
                {/* Montant principal + répartition graphique de la contribution brute */}
                <Carte className="relative overflow-hidden">
                  <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-teal-400/10 blur-3xl" />
                  <div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-center">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 flex items-center">
                        Contribution indicative après déductions{i("contribution")}
                      </p>
                      <p
                        className={`text-5xl sm:text-6xl font-bold tracking-tight mt-2 tabular-nums ${
                          !actif ? "text-slate-600" : s.surcontribution ? "text-red-700 dark:text-red-300" : s.contributionNette === 0 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {actif ? formatMontant(s.contributionNette) : "— €"}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md leading-relaxed">
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
                      className={`rounded-xl border px-3.5 py-3 ${alerte ? "border-red-400/30 bg-red-500/10" : "border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03]"}`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center">
                        {l}
                        {info && i(info)}
                      </p>
                      <p className={`text-base font-semibold mt-1 tabular-nums ${alerte ? "text-red-700 dark:text-red-300" : "text-slate-900 dark:text-white"}`}>{v}</p>
                    </div>
                  ))}
                </div>

                {/* Messages de situation */}
                {actif && s.surcontribution && (
                  <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-200 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-red-700 dark:text-red-300 flex items-center">Base majorée retenue par défaut{i("regle4ans")}</p>
                      <p className="mt-1 text-xs leading-relaxed">
                        Sans BOETH employé sur les 4 dernières années, ni sous-traitance EA/ESAT/TIH d'au moins{" "}
                        {formatMontant(s.seuilSousTraitanceMin)} (600 × SMIC), ni accord agréé, la contribution est calculée
                        à 1 500 × SMIC par bénéficiaire manquant.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={ouvrirDeductions}
                      className="shrink-0 rounded-lg border border-red-300/40 text-red-900 dark:text-red-100 text-xs font-semibold px-3.5 py-2 hover:bg-red-400/15 transition"
                    >
                      Préciser ma situation
                    </button>
                  </div>
                )}
                {actif && !s.surcontribution && s.economie > 0 && (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] p-4 text-sm">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">Effet positif des actions renseignées</p>
                    <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-100/80 leading-relaxed">
                      Les éléments renseignés réduisent l'estimation de {formatMontant(s.economie)} par rapport à une
                      situation maximale avec coefficient 1 500 × SMIC.
                    </p>
                  </div>
                )}
                {actif && !s.surcontribution && !s.conforme && (
                  <div className="rounded-xl border border-amber-400/30 border-l-4 border-l-amber-400 bg-amber-500/[0.08] p-4 text-sm">
                    <p className="font-semibold text-amber-800 dark:text-amber-200">Quota légal non atteint, contribution réduite</p>
                    <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80 leading-relaxed">
                      L'entreprise présente un manque estimé de {formatNombre(s.manque)} bénéficiaire(s). Les actions
                      renseignées écartent la majoration et les déductions applicables sont intégrées à l'estimation.
                    </p>
                  </div>
                )}
                {actif && s.conforme && (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] p-4 text-sm">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">Quota légal atteint</p>
                    <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-100/80">Aucune contribution n'est due au titre de l'année {ANNEE_REFERENCE}.</p>
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
                  <dl className="mt-3 text-sm divide-y divide-slate-900/[0.07] dark:divide-white/[0.07]">
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
                        <dt className="text-slate-500 dark:text-slate-400">{l}</dt>
                        <dd className="font-medium tabular-nums text-right">{v}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between gap-4 pt-3">
                      <dt className="font-semibold text-emerald-700 dark:text-emerald-300">Économie estimée</dt>
                      <dd className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{dash(formatMontant(s?.economie))}</dd>
                    </div>
                  </dl>
                  <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
                    La contribution {ANNEE_REFERENCE} se déclare dans la DSN d'avril {ANNEE_REFERENCE + 1} (échéance du 5 ou 15
                    mai). Estimation indicative selon les règles de droit commun : seule l'URSSAF calcule et recouvre la
                    contribution.{" "}
                    <a href={PAGE_URSSAF_URL} target="_blank" rel="noopener noreferrer" className="text-marine-600 dark:text-marine-300 hover:underline">
                      En savoir plus ↗
                    </a>
                  </p>
                </Carte>

                {/* Entreprise concernée */}
                <Carte className="flex flex-col md:flex-row md:items-center gap-5">
                  <div className="flex-1">
                    <span className="inline-block rounded-full border border-teal-400/30 bg-teal-400/10 text-teal-700 dark:text-teal-300 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1">
                      Facultatif
                    </span>
                    <h3 className="font-semibold mt-2.5">Cette simulation concerne quelle entreprise ?</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
                        className="shrink-0 rounded-xl bg-marine-800 dark:bg-white text-white dark:text-marine-900 hover:bg-marine-900 dark:hover:bg-marine-100 text-sm font-semibold px-4 transition"
                      >
                        {entrepriseMemorisee ? "✓" : "Mémoriser"}
                      </button>
                    </div>
                  </div>
                </Carte>
              </div>

              {/* Colonne synthèse & passage à l'action */}
              <aside ref={asideRef} className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 p-5 sm:p-6">
                <span
                  className={`inline-block rounded-full text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 ${
                    actif ? "bg-teal-400/15 text-teal-700 dark:text-teal-300" : "bg-slate-900/10 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {actif ? "Votre simulation est prête" : "En attente de vos données"}
                </span>

                <div className="mt-4 rounded-xl border border-teal-400/25 bg-teal-400/[0.07] px-4 py-4">
                  <p className="text-xs text-slate-600 dark:text-slate-300">Contribution nette estimée</p>
                  <p className="text-3xl font-bold tracking-tight mt-1 tabular-nums">{actif ? formatMontant(s.contributionNette) : "— €"}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <MiniCarte label="taux d'emploi" valeur={dash(`${formatNombre(s?.tauxEmploi)} %`)} compact />
                  <MiniCarte label="BOETH manquants" valeur={dash(formatNombre(s?.manque))} compact />
                </div>

                {actif && plafondDepenses > 0 && (
                  <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/[0.08] px-4 py-3">
                    <div className="flex justify-between gap-3">
                      <p className="text-xs font-medium text-amber-900 dark:text-amber-100">Encore mobilisable via les dépenses déductibles</p>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-200 tabular-nums">{formatMontant(encoreMobilisable)}</p>
                    </div>
                    <div className="h-1.5 rounded-full bg-amber-200/15 mt-2.5 overflow-hidden">
                      <div className="h-full bg-amber-300 rounded-full transition-all" style={{ width: `${partMobilisee}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-amber-900/70 dark:text-amber-100/70 mt-1.5">
                      <span>Déjà mobilisé : {formatMontant(depensesMobilisees)}</span>
                      <span>Plafond 10 % : {formatMontant(plafondDepenses)}</span>
                    </div>
                    <p className="text-[11px] text-amber-900/60 dark:text-amber-100/60 mt-1.5">ECAP et sous-traitance suivent d'autres règles.</p>
                  </div>
                )}

                <div className="border-t border-slate-900/10 dark:border-white/10 mt-5 pt-5">
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
                  {erreurPdf && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{erreurPdf}</p>}

                  <div className="flex items-center gap-3 my-5 text-[10px] uppercase tracking-wider text-slate-500">
                    <span className="flex-1 h-px bg-slate-900/10 dark:bg-white/10" />
                    ou
                    <span className="flex-1 h-px bg-slate-900/10 dark:bg-white/10" />
                  </div>

                  <Etape numero="2" titre="Analysez-la gratuitement avec un conseiller">
                    Un conseiller du pôle vous aide à comprendre les écarts et à identifier vos leviers prioritaires.
                  </Etape>

                  {!contactOuvert ? (
                    <button
                      type="button"
                      onClick={ouvrirContact}
                      className="mt-4 w-full rounded-xl border border-slate-900/25 dark:border-white/25 text-sm font-semibold py-3 hover:bg-slate-900/10 dark:hover:bg-white/10 transition"
                    >
                      Demander mon analyse gratuite
                    </button>
                  ) : envoye ? (
                    <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
                      <p className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm">Demande envoyée</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Un conseiller du Pôle OETH / AGEFIPH vous recontacte prochainement.</p>
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
                        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg p-3">{erreurEnvoi}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={envoiEnCours || !contact.nom.trim() || !contact.email.trim()}
                          className="flex-1 rounded-xl bg-marine-800 dark:bg-white text-white dark:text-marine-900 hover:bg-marine-900 dark:hover:bg-marine-100 text-sm font-semibold py-2.5 transition disabled:opacity-40"
                        >
                          {envoiEnCours ? "Envoi…" : "Envoyer ma demande"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setContactOuvert(false)}
                          className="rounded-xl text-sm text-slate-500 dark:text-slate-400 px-3 hover:text-slate-900 dark:hover:text-white transition"
                        >
                          Annuler
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="flex gap-4 mt-4 text-[11px] text-slate-500 dark:text-slate-400">
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

            {/* ─────────── Recommandations prioritaires (4 sur une ligne) ─────────── */}
            <div className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
                <div>
                  <p className="text-lg font-semibold">Vos recommandations prioritaires</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Des leviers concrets, du plus rapide au plus structurant.</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {RECOMMANDATIONS.map((r, index) => (
                  <div
                    key={r.titre}
                    className="relative rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 p-5 flex flex-col overflow-hidden"
                  >
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: r.couleur }} />
                    <span
                      className="self-start rounded-full text-[10px] font-bold uppercase tracking-wider px-2.5 py-1"
                      style={{ background: `${r.couleur}22`, color: r.couleur }}
                    >
                      Priorité {index + 1}
                    </span>
                    <p className="font-semibold mt-3 leading-snug">{r.titre}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{r.texte}</p>
                    <div className="mt-4 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] p-3 flex-1">
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Comment nous pouvons vous accompagner</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{r.accompagnement}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {r.tags.map((t) => (
                        <span key={t} className="rounded-md border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] text-[10px] text-slate-600 dark:text-slate-300 px-2 py-1">
                          {t}
                        </span>
                      ))}
                    </div>
                    <Link
                      to={r.lien}
                      className="mt-4 self-start rounded-lg text-xs font-semibold px-3.5 py-2 transition hover:brightness-110"
                      style={{ background: r.couleur, color: "#050b18" }}
                    >
                      {r.bouton} →
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* ─────────── Synthèse DSN ─────────── */}
            <div className="mt-8 rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 p-5 sm:p-7">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <span className="inline-block rounded-full bg-teal-400/15 text-teal-700 dark:text-teal-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
                    Aide à la déclaration
                  </span>
                  <p className="text-lg font-semibold mt-2">Votre synthèse DSN pour préparer la DOETH</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Les principaux codes DSN associés à votre simulation, à transmettre à votre gestionnaire de paie pour
                    préparer la déclaration annuelle et rapprocher vos dépenses de la contribution estimée.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={copierSyntheseDsn}
                    disabled={!actif}
                    className="rounded-lg border border-slate-900/20 dark:border-white/20 text-xs font-semibold px-3.5 py-2 hover:bg-slate-900/10 dark:hover:bg-white/10 transition disabled:opacity-40"
                  >
                    {syntheseCopiee ? "✓ Copiée" : "Copier la synthèse"}
                  </button>
                  <button
                    type="button"
                    onClick={telechargerCsvDsn}
                    disabled={!actif}
                    className="rounded-lg bg-teal-400 hover:bg-teal-300 text-marine-950 text-xs font-semibold px-3.5 py-2 transition disabled:opacity-40"
                  >
                    Télécharger le CSV
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-2 mt-5">
                {[
                  ["Exercice", String(ANNEE_REFERENCE)],
                  ["Bloc principal", "S21.G00.82"],
                  ["Contribution réelle due estimée", dash(formatMontant(s?.contributionNette))],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{l}</p>
                    <p className="text-sm font-bold mt-0.5 tabular-nums">{v}</p>
                  </div>
                ))}
              </div>

              <p className="mt-3 rounded-xl border border-amber-400/30 border-l-4 border-l-amber-400 bg-amber-500/[0.07] px-4 py-3 text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
                Ces codes sont une aide au rapprochement. Avant dépôt, vérifiez les données mises à disposition par l'URSSAF
                ou la MSA, l'existence d'un accord agréé, les plafonds de déduction et la qualification exacte de chaque
                dépense. Les codes 065 à 068 se déclarent obligatoirement ensemble, arrondis à l'euro.
              </p>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-900/10 dark:border-white/10">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-slate-900/[0.04] dark:bg-white/[0.04] text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="text-left font-semibold px-4 py-2.5">Élément</th>
                      <th className="text-left font-semibold px-3 py-2.5">Rubrique DSN</th>
                      <th className="text-left font-semibold px-3 py-2.5">Code</th>
                      <th className="text-right font-semibold px-3 py-2.5">Valeur issue de la simulation</th>
                      <th className="text-left font-semibold px-4 py-2.5">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06]">
                    {lignesDsn.map((l) => (
                      <tr key={l.code} className={l.total ? "bg-teal-400/[0.04]" : ""}>
                        <td className="px-4 py-2.5">
                          <span className={l.total ? "font-semibold" : ""}>{l.element}</span>
                          <span className="block text-[11px] text-slate-500">{l.note}</span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">S21.G00.82.002</td>
                        <td className="px-3 py-2.5">
                          <span className="rounded-md bg-teal-400/15 text-teal-700 dark:text-teal-300 text-[11px] font-bold px-2 py-0.5">{l.code}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {actif ? `${Math.round(l.valeur).toLocaleString("fr-FR")} €` : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-full text-[10px] font-semibold px-2.5 py-1 ${
                              l.statut === "Prérempli"
                                ? "bg-emerald-400/15 text-emerald-700 dark:text-emerald-300"
                                : l.statut === "À valider"
                                  ? "bg-amber-400/15 text-amber-700 dark:text-amber-300"
                                  : "bg-slate-900/10 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {actif ? l.statut : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">
                Montants arrondis à l'euro. Mesures transitoires d'écrêtement terminées : le code 067 reprend le 066.
                Estimation hors accord agréé ; seule l'URSSAF (ou la MSA) calcule et recouvre la contribution.
              </p>
            </div>

            {/* Téléchargement de la synthèse en fin de parcours. Sans les
                champs nécessaires (effectif ≥ 20), on guide le visiteur vers
                la saisie au lieu de télécharger. */}
            <div className="mt-8 flex flex-col items-center text-center gap-2">
              <button
                type="button"
                onClick={telechargerSyntheseFinale}
                disabled={pdfEnCours}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-marine-950 text-sm font-bold px-7 py-3.5 transition shadow-[0_10px_40px_rgba(45,212,191,0.3)] disabled:opacity-50"
              >
                <span aria-hidden>⬇</span> {pdfEnCours ? "Génération…" : "Télécharger ma synthèse PDF"}
              </button>
              {messageSynthese ? (
                <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
                  {messageSynthese}
                </p>
              ) : (
                <p className="text-xs text-slate-500">Résultats, détail du calcul et récapitulatif DSN, au format PDF.</p>
              )}
              {erreurPdf && <p className="text-sm text-red-600 dark:text-red-400">{erreurPdf}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Bouton flottant : visible tant que le simulateur est à l'écran mais
          que le bloc résultats ne l'est pas. Affiche la contribution en
          direct pendant la saisie ; un clic descend aux résultats. */}
      {/* Tant que le parcours est incomplet, aucun montant n'est affiché : un
          clic explique ce qu'il reste à remplir et y conduit. */}
      {sectionVisible && !resultatsVisibles && !parcoursComplet && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-max max-w-[calc(100vw-2rem)] flex flex-col items-center gap-2">
          {messageFlottant && elementManquant && (
            <div role="status" className="relative rounded-xl border border-amber-400/60 bg-white dark:bg-marine-950 text-slate-800 dark:text-slate-100 text-xs sm:text-sm px-4 py-3 pr-9 shadow-2xl max-w-md">
              <p className="font-semibold text-amber-700 dark:text-amber-300">Encore une étape pour obtenir une estimation cohérente</p>
              <p className="mt-0.5">{elementManquant.texte}</p>
              <button
                type="button"
                onClick={() => setMessageFlottant(false)}
                aria-label="Fermer"
                className="absolute top-2 right-2 w-6 h-6 rounded-full text-slate-500 hover:bg-slate-900/10 dark:hover:bg-white/10"
              >
                ✕
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setMessageFlottant(true);
              document.getElementById(elementManquant.cible)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex items-center gap-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-marine-950 pl-5 pr-4 py-3 shadow-[0_12px_40px_rgba(251,191,36,0.35)] transition"
          >
            <span className="text-left">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-marine-900/70">Contribution estimée</span>
              <span className="block text-sm font-bold leading-tight">Complétez le parcours</span>
            </span>
            <span className="rounded-xl bg-white dark:bg-marine-950 text-amber-700 dark:text-amber-300 text-xs font-semibold px-3 py-2 whitespace-nowrap">
              Que manque-t-il ?
            </span>
          </button>
        </div>
      )}
      {sectionVisible && !resultatsVisibles && parcoursComplet && (
        <button
          type="button"
          onClick={calculer}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl bg-teal-400 hover:bg-teal-300 text-marine-950 pl-5 pr-4 py-3 shadow-[0_12px_40px_rgba(45,212,191,0.4)] ring-1 ring-teal-200/40 transition max-w-[calc(100vw-2rem)]"
        >
          {actif ? (
            <>
              <span className="text-left">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-marine-900/70">
                  Contribution estimée
                </span>
                <span className="block text-lg font-bold tabular-nums leading-tight">{formatMontant(s.contributionNette)}</span>
              </span>
              <span className="rounded-xl bg-white dark:bg-marine-950 text-teal-700 dark:text-teal-300 text-xs font-semibold px-3 py-2 whitespace-nowrap">
                Voir le détail ↓
              </span>
            </>
          ) : (
            <span className="text-sm font-bold whitespace-nowrap pr-1">Calculer ma contribution ↓</span>
          )}
        </button>
      )}

      {aideOuverte && <AideModale cle={aideOuverte} onFermer={fermerAide} />}
      {rdvOuvert && <PriseRendezVous onFermer={fermerRdv} />}
    </section>
  );
}

const CLASSE_INPUT =
  "w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-marine-500";

const TEINTES = {
  emerald: "border-emerald-400/25 bg-emerald-400/[0.07]",
  rose: "border-rose-400/25 bg-rose-400/[0.07]",
  sky: "border-sky-400/25 bg-sky-400/[0.07]",
};

function Pastille({ couleur, court, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-full border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.04] dark:bg-white/[0.04] text-[11px] text-slate-600 dark:text-slate-300 px-2.5 sm:px-3 py-1.5">
      <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${couleur}`} />
      {court ? (
        <>
          <span className="sm:hidden">{court}</span>
          <span className="hidden sm:inline">{children}</span>
        </>
      ) : (
        children
      )}
    </span>
  );
}

// En-tête d'une partie du parcours : numéro (coché une fois complète),
// surtitre "Partie N", titre et sous-titre.
function EntetePartie({ numero, titre, sousTitre, complete = false, obligatoire = false }) {
  return (
    <div className="flex items-start gap-4">
      <span
        className={`shrink-0 w-10 h-10 rounded-xl border text-sm font-bold flex items-center justify-center ${
          complete
            ? "bg-emerald-500 border-emerald-400 text-white"
            : "bg-marine-500/15 border-marine-400/30 text-marine-600 dark:text-marine-300"
        }`}
        aria-label={complete ? `Partie ${numero} complète` : `Partie ${numero}`}
      >
        {complete ? "✓" : `0${numero}`}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-marine-600 dark:text-marine-400">Partie {numero}</p>
        <h2 className="text-lg sm:text-xl font-semibold flex items-center flex-wrap gap-2">
          {titre}
          {obligatoire && (
            <span className="rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
              Obligatoire
            </span>
          )}
        </h2>
        {sousTitre && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{sousTitre}</p>}
      </div>
    </div>
  );
}

// Partie pas encore ouverte : titre visible (le visiteur voit la suite du
// parcours), contenu révélé quand la partie précédente est complète.
function PartieVerrouillee({ numero, titre, message }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-900/15 dark:border-white/15 bg-slate-900/[0.02] dark:bg-white/[0.02] px-5 sm:px-8 py-4 flex items-center gap-4 opacity-70">
      <span className="shrink-0 w-10 h-10 rounded-xl border border-slate-900/15 dark:border-white/15 text-slate-500 text-sm font-bold flex items-center justify-center">
        0{numero}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Partie {numero}</p>
        <p className="font-semibold text-slate-700 dark:text-slate-200">{titre}</p>
      </div>
      <span className="hidden sm:inline text-xs text-slate-500">🔒 {message}</span>
    </div>
  );
}

// Case de saisie de la partie 2 (titre, badge "Lié", unité dans le champ).
// Obligation d'emploi calculée instantanément : 6 % de l'effectif, arrondi à
// l'entier inférieur (même règle que le calcul complet, voir server/src/oeth.js),
// seulement à partir de 20 salariés.
function CalculSixPourcent({ effectif }) {
  const eff = Number(String(effectif).replace(",", "."));
  const assujetti = Number.isFinite(eff) && eff >= 20;
  const exact = assujetti ? eff * 0.06 : null;
  // Une seule ligne, à la hauteur du champ de saisie : n'ajoute aucune
  // hauteur à la case. Le détail du calcul est dans l'infobulle.
  return (
    <div
      title={
        assujetti
          ? `${eff.toLocaleString("fr-FR")} × 6 % = ${exact.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}, arrondi à ${Math.floor(exact)}`
          : "Obligation calculée à partir de 20 salariés"
      }
      className="shrink-0 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-400/40 bg-amber-400/[0.08] px-2.5"
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">6 %</span>
      <span className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{assujetti ? Math.floor(exact) : "—"}</span>
      <span className="text-[10px] font-medium text-slate-500">BOETH</span>
    </div>
  );
}

function CaseSaisie({ titre, badge, unite, value, onChange, placeholder, aide, accent = false, erreur = null, min = "0", complement = null, verrouille = false }) {
  return (
    <div
      className={`rounded-xl border p-4 transition ${
        erreur ? "border-red-400/50 bg-red-500/[0.05]" : accent ? "border-teal-400/20 bg-teal-400/[0.03]" : "border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center">{titre}</p>
        {badge && (
          <span className="rounded-full bg-teal-400/15 text-teal-700 dark:text-teal-300 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">{badge}</span>
        )}
      </div>
      <div className="mt-2.5 flex items-stretch gap-2">
      {/* Verrouillée : la valeur vient d'une réponse de la partie 1, on le
          dit dans la case elle-même plutôt que d'afficher un 0 muet. */}
      {verrouille ? (
        <div className="flex-1 min-w-0 flex items-center gap-3 rounded-lg border border-red-400/40 bg-red-500/[0.07] px-3 py-2">
          <span className="shrink-0 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            0 <span className="text-[10px] font-normal text-slate-500">{unite}</span>
          </span>
          <span className="text-[12px] font-semibold leading-snug text-red-700 dark:text-red-300">{verrouille}</span>
        </div>
      ) : (
      <div className="relative flex-1 min-w-0">
        <input
          type="number"
          min={min}
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-900/10 dark:border-white/10 bg-white dark:bg-black/30 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 pl-3 pr-16 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-marine-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">{unite}</span>
      </div>
      )}
      {complement}
      </div>
      <p className={`text-[11px] mt-2 leading-snug ${erreur ? "text-red-700 dark:text-red-300" : "text-slate-500"}`}>{erreur || aide}</p>
    </div>
  );
}

// Anneau de pourcentage coloré (tableau de bord des résultats).
function Anneau({ pourcentage, couleur, titre, detail, actif }) {
  return (
    <div className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 px-3 py-4 flex flex-col items-center text-center">
      <CercleProgression
        pourcentage={actif ? pourcentage : 0}
        couleur={couleur}
        taille={108}
        epaisseur={10}
        texteCentral={actif ? `${Math.round(Math.min(999, pourcentage))} %` : "—"}
      />
      <p className="text-sm font-semibold mt-3">{titre}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{detail}</p>
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
          <circle cx={taille / 2} cy={taille / 2} r={rayon} fill="none" className="stroke-slate-900/10 dark:stroke-white/[0.08]" strokeWidth={epaisseur} />
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
          <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Brute</span>
          <span className="text-sm font-bold tabular-nums">{formatMontant(total)}</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.couleur }} />
            <span className="text-slate-500 dark:text-slate-400 w-24">{seg.label}</span>
            <span className="font-semibold tabular-nums">{Math.round((seg.valeur / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Carte de saisie de l'étape 02 : titre + badge du code DSN concerné, champ,
// puis aide dépliable ("Comment le renseigner ?", "Voir des exemples").
function CarteDeduction({ titre, dsn, question, reponse, children }) {
  return (
    <div className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-2 mb-2.5">
        <p className="text-sm font-semibold flex items-center">{titre}</p>
        <span className="rounded-md bg-teal-400/15 border border-teal-400/25 text-teal-700 dark:text-teal-300 text-[10px] font-bold tracking-wider px-2 py-0.5">
          DSN {dsn}
        </span>
      </div>
      {children}
      <details className="group mt-2.5">
        <summary className="cursor-pointer list-none text-xs font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200 inline-flex items-center gap-1.5">
          <span className="text-[9px] transition-transform group-open:rotate-90">▶</span>
          {question}
        </summary>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{reponse}</p>
      </details>
    </div>
  );
}

function Carte({ className = "", children }) {
  return <div className={`rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-marine-950 p-6 ${className}`}>{children}</div>;
}

function MiniCarte({ label, valeur, compact = false }) {
  return (
    <div className={`rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] ${compact ? "px-3 py-2.5" : "px-4 py-3.5"}`}>
      {compact ? (
        <>
          <p className="text-sm font-bold tabular-nums">{valeur}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-xl font-semibold mt-1 tabular-nums">{valeur}</p>
        </>
      )}
    </div>
  );
}

function Indicateur({ label, valeur, teinte }) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${TEINTES[teinte]}`}>
      <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center">{label}</p>
      <p className="text-xl font-bold mt-1.5 tabular-nums">{valeur}</p>
    </div>
  );
}

function Etape({ numero, titre, children }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-lg bg-teal-400/15 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center">
        {numero}
      </span>
      <div>
        <p className="font-semibold">{titre}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

// Carte de question Oui / Non à boutons radio ronds ; liseré gauche bleu
// tant que la question attend une réponse.
function Question({ intitule, nom, valeur, onChange, actif, children }) {
  return (
    <fieldset
      className={`rounded-xl border bg-slate-900/[0.03] dark:bg-white/[0.03] px-5 py-4 transition ${
        actif ? "border-slate-900/10 dark:border-white/10 border-l-4 border-l-marine-400" : "border-slate-900/10 dark:border-white/10"
      }`}
    >
      <legend className="sr-only">{typeof intitule === "string" ? intitule : nom}</legend>
      <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{intitule}</p>
      <div className="flex gap-6 mt-3">
        {[
          { v: true, label: "Oui" },
          { v: false, label: "Non" },
        ].map((o) => (
          <label key={o.label} className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-200">
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
            valeur === o.v ? "bg-marine-500 border-marine-400 text-white" : "border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-white/10"
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
    <label className="block text-xs text-slate-500 dark:text-slate-400">
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
