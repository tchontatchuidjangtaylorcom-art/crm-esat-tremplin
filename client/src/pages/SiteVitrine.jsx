import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import TickerImpact from "../components/vitrine/TickerImpact.jsx";
import ToastActivite from "../components/vitrine/ToastActivite.jsx";
import CompteurAnime from "../components/vitrine/CompteurAnime.jsx";
import RevelerAuScroll from "../components/vitrine/RevelerAuScroll.jsx";
import SimulateurOeth from "../components/vitrine/SimulateurOeth.jsx";
import RecitImmersif from "../components/vitrine/RecitImmersif.jsx";

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

function formatMontant(n) {
  return `${Math.round(n || 0).toLocaleString("fr-FR")} €`;
}

export default function SiteVitrine() {
  const [vitrine, setVitrine] = useState(null);
  const [contactPole, setContactPole] = useState(null);
  const [defile, setDefile] = useState(false);
  const [simulateurOuvert, setSimulateurOuvert] = useState(false);
  const recitRef = useRef(null);

  useEffect(() => {
    api.getVitrine().then(setVitrine).catch(() => setVitrine({ statistiques: {}, entreprises: [] }));
    api.getStatutMail().then(setContactPole).catch(() => {});
  }, []);

  // Nav transparente sur le récit sombre (400vh, voir RecitImmersif), qui se
  // solidifie seulement une fois ce bloc entièrement dépassé (fond clair en
  // dessous) — mesuré sur sa vraie hauteur plutôt qu'un seuil fixe en vh,
  // pour rester correct quel que soit le nombre d'étapes du récit.
  useEffect(() => {
    function onScroll() {
      const bas = recitRef.current?.getBoundingClientRect().bottom ?? 0;
      setDefile(bas <= 0);
    }
    onScroll();
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

      {/* Récit immersif au scroll (hero + convictions + citation), voir
          RecitImmersif.jsx — remplace l'ancien hero + manifeste statiques. */}
      <div ref={recitRef} id="manifeste">
        <RecitImmersif onOuvrirSimulateur={() => setSimulateurOuvert(true)} />
      </div>

      {/* Bandeau de transition — chiffres en un coup d'œil avant la section
          détaillée, sur un fond encore sombre pour ne pas casser l'ambiance
          du récit qui vient de se terminer. */}
      {vitrine && (
        <div className="bg-marine-950 py-8">
          <div className="max-w-xl mx-auto px-6">
            <TickerImpact statistiques={stats} entreprises={entreprises} verre />
          </div>
        </div>
      )}

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
