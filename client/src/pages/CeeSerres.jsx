import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BoutonThemeVitrine } from "../components/vitrine/ThemeVitrine.jsx";
import FormulaireSerresCee from "../components/vitrine/FormulaireSerresCee.jsx";
import AssistantCee from "../components/vitrine/AssistantCee.jsx";
import { FAQ_CEE } from "../components/vitrine/contenuFaqCee.js";

// Page publique de l'offre CEE — serres agricoles (/vitrine/cee-serres) :
// chauffage par pompe à chaleur (Démétherme 400), pour le compte d'Eco Smart
// France, financé via le dispositif CEE. Pitch repris fidèlement du script
// d'appel déjà en usage (server/src/scriptVente.js, SECTIONS_CEE) : jamais de
// chiffre d'économie, de montant ou de délai de clôture inventé, zéro euro
// toujours présenté comme conditionné à l'éligibilité du dossier (section 8
// du script — garde-fous de conformité).
//
// Page volontairement simple (pitch + formulaire de qualification +
// assistant automatique), distincte du reste de la vitrine OETH : pas de
// récit immersif, de simulateur ni de widgets FAQ/Actualité/Vigilance OETH
// (hors sujet ici) — voir VitrineApp.jsx, qui masque WidgetsVitrine sur cette
// page et affiche AssistantCee à la place.

const ATOUTS = [
  { titre: "Pompe à chaleur Démétherme 400", texte: "chauffe une serre agricole, ou remplace un chauffage existant" },
  { titre: "Financement CEE", texte: "porté par les entreprises soumises aux obligations CEE, pour les dossiers éligibles" },
  { titre: "Dossier vérifié avant engagement", texte: "éligibilité confirmée par un conseiller, puis visite technique" },
];

const CARACTERISTIQUES = [
  { label: "Puissance annoncée", valeur: "411,1 kW" },
  { label: "Eau chaude", valeur: "jusqu'à 60 °C" },
  { label: "COP annoncé", valeur: "3,56 (selon les conditions de mesure)" },
];

const ETAPES = [
  {
    titre: "Vous laissez vos coordonnées",
    texte: "Nom de l'exploitation, nombre de serres, surface, cultures et chauffage actuel.",
  },
  {
    titre: "Un conseiller vérifie l'éligibilité",
    texte: "Le dossier est étudié avant toute proposition : rien n'est confirmé sans cette vérification.",
  },
  {
    titre: "Devis et visite technique",
    texte: "Si le dossier est éligible, un devis détaillé est présenté, puis une visite technique est organisée.",
  },
];

// Les objections les plus fréquentes du script d'appel, posées à l'écrit —
// mêmes réponses que l'assistant (contenuFaqCee.js), pour un visiteur qui ne
// l'ouvre pas.
const FAQ_AFFICHEES = ["zero-euro", "quest-ce-que-cee", "demetherme-400", "apres-contact"];

function Accordeon({ item }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="w-full text-left text-sm font-semibold flex items-start justify-between gap-3 text-slate-800 dark:text-white"
      >
        {item.question}
        <span className="text-emerald-600 dark:text-emerald-400 shrink-0">{ouvert ? "−" : "+"}</span>
      </button>
      {ouvert && <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2">{item.reponse}</p>}
    </div>
  );
}

export default function CeeSerres() {
  const [assistantOuvert, setAssistantOuvert] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const questionsAffichees = FAQ_CEE.filter((q) => FAQ_AFFICHEES.includes(q.id));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white">
      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-black/85 backdrop-blur border-b border-slate-900/10 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <Link to="/vitrine/cee-serres" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-600" />
            Eco Smart France <span className="text-slate-400 dark:text-white/40">·</span> CEE Serres agricoles
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <BoutonThemeVitrine />
            <Link
              to="/cee"
              title="Portail sécurisé (agents)"
              className="hidden sm:inline text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white"
            >
              Portail sécurisé
            </Link>
          </div>
        </div>
      </header>

      {/* Hero / accroche — formulaire visible dès l'arrivée (à côté du pitch
          sur grand écran, juste en dessous sur mobile), plutôt que relégué
          en bas de page : c'est ce qu'un visiteur presse vient faire ici. */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-10">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Dispositif CEE · Certificats d'Économies d'Énergie
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-3">
              Une pompe à chaleur pour chauffer vos serres agricoles
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
              Eco Smart France propose le Démétherme 400 pour chauffer une serre agricole, ou remplacer un chauffage
              existant, avec une offre à zéro euro <strong>pour les dossiers qui remplissent les conditions</strong> du
              dispositif CEE. Le financement prévu est porté par les entreprises soumises aux obligations CEE (notamment
              des fournisseurs d'énergie) — pas par une aide de l'État. Un conseiller vérifie l'éligibilité de votre
              exploitation avant toute confirmation.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mt-8">
              {ATOUTS.map((a) => (
                <div key={a.titre} className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
                  <p className="font-semibold text-sm">{a.titre}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{a.texte}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:sticky lg:top-24">
            <div
              id="demande-cee"
              className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] shadow-sm p-5 sm:p-6 scroll-mt-24"
            >
              <FormulaireSerresCee />
            </div>
          </div>
        </div>
      </section>

      {/* Le produit */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 border-t border-slate-900/10 dark:border-white/10">
        <h2 className="text-xl font-bold">Le Démétherme 400</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-2xl leading-relaxed">
          Sert à chauffer une serre agricole, ou à remplacer un chauffage existant (fioul, gaz, électrique…). Les
          économies réelles dépendent de votre bâtiment et de votre utilisation : nous ne communiquons jamais un chiffre
          d'économie précis avant la visite technique.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          {CARACTERISTIQUES.map((c) => (
            <div key={c.label} className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
              <p className="text-lg font-bold mt-1 text-emerald-700 dark:text-emerald-400">{c.valeur}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 border-t border-slate-900/10 dark:border-white/10">
        <h2 className="text-xl font-bold">Comment ça marche</h2>
        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          {ETAPES.map((e, i) => (
            <div key={e.titre} className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold">
                {i + 1}
              </span>
              <p className="font-semibold text-sm mt-3">{e.titre}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{e.texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ condensée — le formulaire reste accessible plus haut (ancre
          #demande-cee) pour qui veut y revenir après avoir lu. */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 border-t border-slate-900/10 dark:border-white/10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-bold">Questions fréquentes</h2>
          <a href="#demande-cee" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
            Être recontacté par un conseiller →
          </a>
        </div>
        <div className="space-y-2.5 mt-6 max-w-2xl">
          {questionsAffichees.map((q) => (
            <Accordeon key={q.id} item={q} />
          ))}
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-8 border-t border-slate-900/10 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Offre proposée par Eco Smart France dans le cadre du dispositif des Certificats d'Économies d'Énergie (CEE) :
        entreprises soumises à une obligation légale de financer des économies d'énergie, et non un programme de l'État.
        L'éligibilité de chaque dossier, les montants et les conditions sont vérifiés par un conseiller avant toute
        signature.
      </footer>

      <AssistantCee ouvert={assistantOuvert} onBasculer={() => setAssistantOuvert((o) => !o)} onFermer={() => setAssistantOuvert(false)} />
    </div>
  );
}
