import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import TickerImpact from "../components/vitrine/TickerImpact.jsx";
import ToastActivite from "../components/vitrine/ToastActivite.jsx";
import CompteurAnime from "../components/vitrine/CompteurAnime.jsx";
import RevelerAuScroll from "../components/vitrine/RevelerAuScroll.jsx";

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

function formatMontant(n) {
  return `${Math.round(n || 0).toLocaleString("fr-FR")} €`;
}

export default function SiteVitrine() {
  const [vitrine, setVitrine] = useState(null);
  const [contactPole, setContactPole] = useState(null);

  useEffect(() => {
    api.getVitrine().then(setVitrine).catch(() => setVitrine({ statistiques: {}, entreprises: [] }));
    api.getStatutMail().then(setContactPole).catch(() => {});
  }, []);

  const stats = vitrine?.statistiques || {};
  const entreprises = vitrine?.entreprises || [];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {vitrine && <TickerImpact statistiques={stats} entreprises={entreprises} />}
      {vitrine && <ToastActivite entreprises={entreprises} />}

      <div className="bandeau-tricolore">
        <span className="bg-marine-800" />
        <span className="bg-white" />
        <span className="bg-red-700" />
      </div>

      {/* En-tête */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-marine-700 dark:text-marine-300">
              Portail Opérationnel OETH
            </p>
            <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Pôle OETH / AGEFIPH</p>
          </div>
          <Link
            to="/connexion"
            className="flex items-center gap-2 rounded-full border border-marine-800 dark:border-marine-300 text-marine-800 dark:text-marine-200 text-sm font-medium px-4 py-2 hover:bg-marine-800 hover:text-white dark:hover:bg-marine-300 dark:hover:text-marine-900 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Portail sécurisé
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <RevelerAuScroll>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white leading-tight max-w-3xl mx-auto">
            L'obligation d'emploi des travailleurs handicapés,{" "}
            <span className="text-marine-700 dark:text-marine-300">transformée en opportunité durable</span>
          </h1>
        </RevelerAuScroll>
        <RevelerAuScroll delai={150}>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto mt-5">
            Le Pôle OETH / AGEFIPH accompagne les entreprises vers la conformité légale — et vers un recrutement direct
            qui change durablement une trajectoire professionnelle.
          </p>
        </RevelerAuScroll>
        <RevelerAuScroll delai={300}>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <Link
              to="/connexion"
              className="rounded-lg bg-marine-800 hover:bg-marine-900 text-white text-sm font-semibold px-6 py-3 transition"
            >
              Accéder au portail sécurisé
            </Link>
            <a
              href="#ressources"
              className="rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
            >
              Voir les ressources
            </a>
          </div>
        </RevelerAuScroll>
      </section>

      {/* Compteurs animés */}
      <section className="bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 py-14">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            { valeur: stats.nbEntreprisesConformes || 0, label: "Entreprises en conformité OETH" },
            { valeur: stats.nbBeneficiairesInseres || 0, label: "Travailleurs handicapés recrutés" },
            { valeur: stats.tauxConformite || 0, suffixe: " %", label: "Taux de conformité moyen" },
          ].map((c, i) => (
            <RevelerAuScroll key={c.label} delai={i * 100}>
              <p className="text-3xl sm:text-4xl font-bold text-marine-800 dark:text-marine-200">
                <CompteurAnime valeur={c.valeur} suffixe={c.suffixe || ""} />
              </p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2">{c.label}</p>
            </RevelerAuScroll>
          ))}
          <RevelerAuScroll delai={300}>
            <p className="text-3xl sm:text-4xl font-bold text-marine-800 dark:text-marine-200">
              {formatMontant(stats.economiesRealisees)}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2">
              Contribution évitée grâce au recrutement direct (estimation)
            </p>
          </RevelerAuScroll>
        </div>
      </section>

      {/* Entreprises citées (avec consentement) */}
      {entreprises.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-16">
          <RevelerAuScroll>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">Ils sont en règle</h2>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-10">
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
                  className="block h-full rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition px-5 py-4"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{e.nom}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {e.ville}
                    {e.secteur ? ` · ${e.secteur}` : ""}
                  </p>
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-2">
                    ✓ {e.beneficiairesRecrutes}/{e.unitesRequises} unités bénéficiaires
                  </p>
                </a>
              </RevelerAuScroll>
            ))}
          </div>
        </section>
      )}

      {/* Manifeste */}
      <section className="bg-marine-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-6">
          <RevelerAuScroll>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-marine-300 mb-3 text-center">
              Notre conviction
            </p>
            <h2 className="text-3xl font-bold text-center mb-10">
              Le recrutement direct change une vie professionnelle — pas seulement un chiffre de conformité
            </h2>
          </RevelerAuScroll>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                titre: "La compétence avant tout",
                texte:
                  "Un poste confié pour ce que la personne sait faire, pas pour combler un quota : c'est la meilleure base d'une intégration qui dure.",
              },
              {
                titre: "L'épanouissement et la fierté",
                texte:
                  "Un salaire, une équipe, une progression : le travail direct en entreprise ouvre un accès à l'autonomie et à la reconnaissance sociale du métier exercé.",
              },
              {
                titre: "Une richesse pour l'entreprise",
                texte:
                  "Diversifier ses équipes, c'est aussi gagner en agilité, en créativité et en cohésion — l'inclusion profite à tout le collectif de travail.",
              },
            ].map((bloc, i) => (
              <RevelerAuScroll key={bloc.titre} delai={i * 120}>
                <h3 className="font-semibold mb-2">{bloc.titre}</h3>
                <p className="text-sm text-marine-200 leading-relaxed">{bloc.texte}</p>
              </RevelerAuScroll>
            ))}
          </div>
          <RevelerAuScroll delai={400}>
            <p className="text-xs text-marine-400 text-center mt-10 max-w-2xl mx-auto">
              Le recrutement direct reste la voie la plus durable vers l'inclusion ; l'accompagnement Cap Emploi et les
              solutions ESAT/EA restent des leviers complémentaires précieux, en particulier pour les parcours qui ont
              besoin d'un cadre plus soutenant.
            </p>
          </RevelerAuScroll>
        </div>
      </section>

      {/* Ressources */}
      <section id="ressources" className="max-w-6xl mx-auto px-6 py-16">
        <RevelerAuScroll>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">Ressources & partenaires</h2>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-10">
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
                className="block h-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition px-6 py-5"
              >
                <p className="font-semibold text-marine-800 dark:text-marine-200">{r.nom} ↗</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">{r.description}</p>
              </a>
            </RevelerAuScroll>
          ))}
        </div>
      </section>

      {/* Pied de page */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-10">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-slate-500 dark:text-slate-400 space-y-1">
          <p className="font-semibold text-slate-700 dark:text-slate-200">Pôle OETH / AGEFIPH</p>
          {contactPole?.adressePostale && <p>{contactPole.adressePostale}</p>}
          <p>
            {contactPole?.adresse && <span>{contactPole.adresse}</span>}
            {contactPole?.adresse && contactPole?.telephone && <span> · </span>}
            {contactPole?.telephone && <span>{contactPole.telephone}</span>}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-600 pt-2">
            Les statistiques affichées sont calculées à partir du portefeuille d'entreprises accompagnées par le pôle et
            mises à jour en continu ; les montants sont des estimations.
          </p>
        </div>
      </footer>
    </div>
  );
}
