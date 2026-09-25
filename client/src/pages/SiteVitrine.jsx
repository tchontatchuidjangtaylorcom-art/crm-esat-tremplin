import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import TickerImpact from "../components/vitrine/TickerImpact.jsx";
import ToastActivite from "../components/vitrine/ToastActivite.jsx";
import CompteurAnime from "../components/vitrine/CompteurAnime.jsx";
import RevelerAuScroll from "../components/vitrine/RevelerAuScroll.jsx";
import FondEtoile from "../components/vitrine/FondEtoile.jsx";
import SimulateurOeth from "../components/vitrine/SimulateurOeth.jsx";

const LIENS_NAV = [
  { label: "Notre démarche", href: "#manifeste" },
  { label: "Impact", href: "#impact" },
  { label: "Ressources", href: "#ressources" },
  { label: "Contact", href: "#contact" },
];

const RESSOURCES = [
  {
    nom: "Agefiph",
    description: "Aides financières, conseil et accompagnement des entreprises pour l'emploi des personnes handicapées.",
    url: "https://www.agefiph.fr/",
  },
  {
    nom: "Cap Emploi",
    description: "Réseau national de placement spécialisé : accompagne recruteurs et candidats en situation de handicap.",
    url: "https://www.capemploi.info/",
  },
];

const PILIERS = [
  {
    titre: "La compétence avant tout",
    texte: "Un poste confié pour ce que la personne sait faire, pas pour combler un quota : la meilleure base d'une intégration qui dure.",
  },
  {
    titre: "L'épanouissement et la fierté",
    texte: "Un salaire, une équipe, une progression : le travail direct ouvre un accès concret à l'autonomie et à la reconnaissance sociale du métier exercé.",
  },
  {
    titre: "Une richesse pour l'entreprise",
    texte: "Diversifier ses équipes, c'est gagner en agilité, en créativité et en cohésion — l'inclusion profite à tout le collectif de travail.",
  },
];

function formatMontant(n) {
  return `${Math.round(n || 0).toLocaleString("fr-FR")} €`;
}

export default function SiteVitrine() {
  const [vitrine, setVitrine] = useState(null);
  const [contactPole, setContactPole] = useState(null);
  const [defile, setDefile] = useState(false);
  const [simulateurOuvert, setSimulateurOuvert] = useState(false);

  useEffect(() => {
    api.getVitrine().then(setVitrine).catch(() => setVitrine({ statistiques: {}, entreprises: [] }));
    api.getStatutMail().then(setContactPole).catch(() => {});
  }, []);

  // Nav transparente sur le hero sombre, qui se solidifie une fois le hero
  // dépassé (fond clair en dessous) — évite un texte blanc illisible sur
  // fond blanc plus bas dans la page.
  useEffect(() => {
    function onScroll() {
      setDefile(window.scrollY > window.innerHeight * 0.75);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const stats = vitrine?.statistiques || {};
  const entreprises = vitrine?.entreprises || [];

  return (
    <div className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {vitrine && <ToastActivite entreprises={entreprises} />}

      {/* Navigation — flotte au-dessus du hero, se solidifie au défilement. */}
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-colors duration-300 ${
          defile ? "bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800" : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <p className={`text-sm font-semibold tracking-tight transition-colors shrink-0 ${defile ? "text-slate-900 dark:text-white" : "text-white"}`}>
            Pôle OETH <span className={defile ? "text-marine-500" : "text-white/50"}>/</span> AGEFIPH
          </p>

          <nav className="hidden lg:flex items-center gap-7">
            {LIENS_NAV.map((lien) => (
              <a
                key={lien.href}
                href={lien.href}
                className={`text-xs font-medium tracking-wide transition ${
                  defile ? "text-slate-600 dark:text-slate-300 hover:text-marine-700 dark:hover:text-marine-300" : "text-white/80 hover:text-white"
                }`}
              >
                {lien.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/connexion"
              title="Portail sécurisé (agents)"
              className={`hidden sm:flex items-center gap-1.5 text-xs font-medium transition ${
                defile ? "text-slate-500 dark:text-slate-400 hover:text-marine-700 dark:hover:text-marine-300" : "text-white/60 hover:text-white"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Portail sécurisé
            </Link>
            <button
              onClick={() => setSimulateurOuvert(true)}
              className={`rounded-full text-xs font-semibold px-5 py-2.5 transition ${
                defile
                  ? "bg-marine-800 text-white hover:bg-marine-900"
                  : "bg-white text-marine-900 hover:bg-marine-100"
              }`}
            >
              Estimer vos obligations
            </button>
          </div>
        </div>
      </header>

      {simulateurOuvert && <SimulateurOeth onClose={() => setSimulateurOuvert(false)} />}

      {/* Hero — univers étoilé, plein écran. */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-marine-950 via-marine-900 to-marine-950">
        <div className="bandeau-tricolore absolute top-0 inset-x-0 z-20">
          <span className="bg-marine-400" />
          <span className="bg-white" />
          <span className="bg-red-600" />
        </div>

        {/* Nébuleuses douces, dérive lente — purement décoratif. */}
        <div
          aria-hidden="true"
          className="absolute -top-1/4 -left-1/4 w-[70vw] h-[70vw] rounded-full bg-marine-600/25 blur-[120px] animate-flotter"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-1/4 -right-1/4 w-[65vw] h-[65vw] rounded-full bg-indigo-500/15 blur-[120px] animate-flotter-inverse"
        />
        <FondEtoile />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <RevelerAuScroll>
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-marine-300 mb-6">
              Portail Opérationnel OETH
            </p>
          </RevelerAuScroll>
          <RevelerAuScroll delai={100}>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight">
              L'inclusion n'est pas
              <br />
              une case à cocher.
            </h1>
          </RevelerAuScroll>
          <RevelerAuScroll delai={250}>
            <p className="text-marine-200/80 text-lg sm:text-xl max-w-xl mx-auto mt-7 leading-relaxed">
              Le Pôle OETH / AGEFIPH accompagne les entreprises vers la conformité légale — et vers un recrutement
              direct qui change durablement une trajectoire professionnelle.
            </p>
          </RevelerAuScroll>
          <RevelerAuScroll delai={400}>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
              <button
                onClick={() => setSimulateurOuvert(true)}
                className="rounded-full bg-white text-marine-900 text-sm font-semibold px-7 py-3.5 hover:bg-marine-100 transition"
              >
                Estimer vos obligations
              </button>
              <a
                href="#manifeste"
                className="rounded-full border border-white/25 text-white text-sm font-semibold px-7 py-3.5 hover:bg-white/10 transition"
              >
                Découvrir la démarche
              </a>
            </div>
          </RevelerAuScroll>

          {vitrine && (
            <RevelerAuScroll delai={550}>
              <div className="mt-14 max-w-xl mx-auto">
                <TickerImpact statistiques={stats} entreprises={entreprises} verre />
              </div>
            </RevelerAuScroll>
          )}
        </div>

        <a
          href="#manifeste"
          aria-label="Défiler vers le contenu"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 hover:text-white transition animate-fleche-rebond"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </a>
      </section>

      {/* Manifeste — au cœur de la page, juste après le hero. */}
      <section id="manifeste" className="bg-marine-950 text-white py-28 sm:py-36">
        <div className="max-w-4xl mx-auto px-6">
          <RevelerAuScroll>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-marine-400 mb-6 text-center">
              Notre conviction
            </p>
            <h2 className="text-3xl sm:text-5xl font-bold text-center leading-tight max-w-3xl mx-auto">
              Le recrutement direct change une vie professionnelle —{" "}
              <span className="text-marine-300">pas seulement un chiffre de conformité.</span>
            </h2>
          </RevelerAuScroll>

          <div className="grid sm:grid-cols-3 gap-10 mt-20">
            {PILIERS.map((bloc, i) => (
              <RevelerAuScroll key={bloc.titre} delai={i * 130}>
                <span className="block text-marine-500 text-3xl font-bold mb-3">0{i + 1}</span>
                <h3 className="font-semibold text-lg mb-2.5">{bloc.titre}</h3>
                <p className="text-sm text-marine-200/80 leading-relaxed">{bloc.texte}</p>
              </RevelerAuScroll>
            ))}
          </div>

          <RevelerAuScroll delai={450}>
            <p className="text-xs text-marine-400/70 text-center mt-20 max-w-2xl mx-auto leading-relaxed">
              Le recrutement direct reste la voie la plus durable vers l'inclusion ; l'accompagnement Cap Emploi et les
              solutions ESAT/EA demeurent des leviers complémentaires précieux, en particulier pour les parcours qui
              ont besoin d'un cadre plus soutenant.
            </p>
          </RevelerAuScroll>
        </div>
      </section>

      {/* Compteurs animés — données réelles. */}
      <section id="impact" className="py-24 sm:py-28 border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <RevelerAuScroll>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-center mb-16">
              L'impact, en chiffres réels
            </h2>
          </RevelerAuScroll>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 text-center">
            {[
              { valeur: stats.nbEntreprisesConformes || 0, label: "Entreprises en conformité OETH" },
              { valeur: stats.nbBeneficiairesInseres || 0, label: "Travailleurs handicapés recrutés" },
              { valeur: stats.tauxConformite || 0, suffixe: " %", label: "Taux de conformité moyen" },
            ].map((c, i) => (
              <RevelerAuScroll key={c.label} delai={i * 100}>
                <p className="text-4xl sm:text-5xl font-bold text-marine-800 dark:text-marine-200 tracking-tight">
                  <CompteurAnime valeur={c.valeur} suffixe={c.suffixe || ""} />
                </p>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-3">{c.label}</p>
              </RevelerAuScroll>
            ))}
            <RevelerAuScroll delai={300}>
              <p className="text-4xl sm:text-5xl font-bold text-marine-800 dark:text-marine-200 tracking-tight">
                {formatMontant(stats.economiesRealisees)}
              </p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-3">
                Contribution évitée grâce au recrutement direct (estimation)
              </p>
            </RevelerAuScroll>
          </div>
        </div>
      </section>

      {/* Entreprises citées (avec consentement) */}
      {entreprises.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-24 sm:py-28">
          <RevelerAuScroll>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-center mb-3">Ils sont en règle</h2>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-14">
              Entreprises accompagnées par le pôle, ayant accepté d'être citées publiquement.
            </p>
          </RevelerAuScroll>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {entreprises.map((e, i) => (
              <RevelerAuScroll key={e.id} delai={(i % 3) * 100}>
                <a
                  href={e.siteWeb || `https://www.google.com/search?q=${encodeURIComponent(`${e.nom} ${e.ville || ""} site officiel`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-full rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition px-6 py-5"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{e.nom}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {e.ville}
                    {e.secteur ? ` · ${e.secteur}` : ""}
                  </p>
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-2.5">
                    ✓ {e.beneficiairesRecrutes}/{e.unitesRequises} unités bénéficiaires
                  </p>
                </a>
              </RevelerAuScroll>
            ))}
          </div>
        </section>
      )}

      {/* Ressources */}
      <section id="ressources" className="max-w-6xl mx-auto px-6 py-24 sm:py-28 border-t border-slate-100 dark:border-slate-800">
        <RevelerAuScroll>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-center mb-3">Ressources & partenaires</h2>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-14">
            Des passerelles directes vers les acteurs de référence de l'emploi des personnes handicapées.
          </p>
        </RevelerAuScroll>
        <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {RESSOURCES.map((r, i) => (
            <RevelerAuScroll key={r.nom} delai={i * 120}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition px-6 py-6"
              >
                <p className="font-semibold text-marine-800 dark:text-marine-200">{r.nom} ↗</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">{r.description}</p>
              </a>
            </RevelerAuScroll>
          ))}
        </div>
      </section>

      {/* Pied de page / contact */}
      <footer id="contact" className="border-t border-slate-200 dark:border-slate-800 py-10">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-slate-500 dark:text-slate-400 space-y-1">
          <p className="font-semibold text-slate-700 dark:text-slate-200">Pôle OETH / AGEFIPH</p>
          {contactPole?.adressePostale && <p>{contactPole.adressePostale}</p>}
          <p>
            {contactPole?.adresse && <span>{contactPole.adresse}</span>}
            {contactPole?.adresse && contactPole?.telephone && <span> · </span>}
            {contactPole?.telephone && <span>{contactPole.telephone}</span>}
          </p>
          <button
            onClick={() => setSimulateurOuvert(true)}
            className="inline-block mt-3 rounded-full bg-marine-800 hover:bg-marine-900 text-white text-xs font-semibold px-5 py-2.5 transition"
          >
            Estimer vos obligations / contacter un conseiller
          </button>
          <p className="text-xs text-slate-400 dark:text-slate-600 pt-4">
            Les statistiques affichées sont calculées à partir du portefeuille d'entreprises accompagnées par le pôle et
            mises à jour en continu ; les montants sont des estimations.
          </p>
        </div>
      </footer>
    </div>
  );
}
