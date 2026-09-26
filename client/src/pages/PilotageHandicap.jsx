import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PriseRendezVous from "../components/vitrine/PriseRendezVous.jsx";
import FormulaireDemo from "../components/vitrine/FormulaireDemo.jsx";

// Page publique de présentation du logiciel de pilotage de politique
// handicap (/vitrine/pilotage). Textes originaux, à adapter au périmètre
// réel du produit avant diffusion. "Parler à un expert" ouvre la prise de
// rendez-vous (PriseRendezVous) ; "Demander une démo" mène au formulaire.

const ATOUTS = [
  { titre: "Centralisé", texte: "suivis, échéances et indicateurs réunis" },
  { titre: "Multi-établissements", texte: "une vue locale et consolidée" },
  { titre: "Confidentiel", texte: "des données sensibles protégées" },
];

const MISSIONS = [
  {
    id: "suivi",
    icone: "👥",
    couleur: "#2dd4bf",
    titre: "Suivi des bénéficiaires et des RQTH",
    texte:
      "Recensez vos bénéficiaires de l'obligation d'emploi, anticipez les renouvellements de RQTH et accompagnez les nouvelles démarches en toute confidentialité.",
  },
  {
    id: "feuille-de-route",
    icone: "🗺️",
    couleur: "#a78bfa",
    titre: "Feuille de route handicap",
    texte:
      "Fixez vos priorités, désignez les responsables, planifiez les échéances et mesurez l'avancement de chaque action tout au long de l'année.",
  },
  {
    id: "doeth",
    icone: "📊",
    couleur: "#38bdf8",
    titre: "Préparation de la DOETH et de la DSN",
    texte:
      "Estimez votre contribution en continu, rapprochez déductions et dépenses des codes DSN (060 à 072) et arrivez prêt à la déclaration d'avril.",
  },
  {
    id: "achats",
    icone: "🤝",
    couleur: "#fbbf24",
    titre: "Achats inclusifs",
    texte:
      "Suivez vos achats auprès des EA, ESAT et TIH, le montant de main-d'œuvre valorisable et le seuil de 600 × SMIC qui écarte la contribution majorée.",
  },
  {
    id: "maintien",
    icone: "🛡️",
    couleur: "#f472b6",
    titre: "Maintien dans l'emploi",
    texte:
      "Repérez tôt les situations fragiles, organisez les aménagements de poste et gardez la trace des actions engagées avec la médecine du travail.",
  },
  {
    id: "sensibilisation",
    icone: "🎤",
    couleur: "#fb923c",
    titre: "Sensibilisation et formation",
    texte:
      "Planifiez vos actions de sensibilisation et la formation des managers et des RH, et valorisez les dépenses déductibles correspondantes (DSN 064).",
  },
];

export default function PilotageHandicap() {
  const [rdvOuvert, setRdvOuvert] = useState(false);
  const fermerRdv = useCallback(() => setRdvOuvert(false), []);
  const { hash } = useLocation();

  // Arrivée depuis une carte de recommandation (#sensibilisation, #demo…).
  useEffect(() => {
    if (!hash) return window.scrollTo(0, 0);
    setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [hash]);

  const allerDemo = () => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-black/85 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <Link to="/vitrine" className="text-sm font-semibold tracking-tight">
            Pôle OETH <span className="text-white/50">/</span> AGEFIPH
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-xs text-white/80">
            <Link to="/vitrine#simulateur" className="hover:text-white">
              Simulateur OETH
            </Link>
            <a href="#missions" className="hover:text-white">
              Fonctionnalités
            </a>
            <a href="#demo" className="hover:text-white">
              Démo
            </a>
          </nav>
          <button
            type="button"
            onClick={() => setRdvOuvert(true)}
            className="rounded-full bg-white text-marine-900 hover:bg-marine-100 text-xs font-semibold px-4 py-2 transition"
          >
            Parler à un expert
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-40 -left-20 w-[700px] h-[500px] rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block rounded-full border border-teal-400/30 bg-teal-400/10 text-teal-300 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5">
              Logiciel de pilotage de politique handicap
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mt-5">
              Pilotez votre politique handicap et anticipez votre DOETH, depuis un seul espace.
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed mt-6">
              <strong className="text-white">Un outil pensé pour les référents handicap, les RH et les DRH.</strong> Suivi des
              bénéficiaires et des RQTH, feuille de route, maintien dans l'emploi, achats inclusifs, dépenses déductibles et
              préparation de la déclaration annuelle : tout est réuni pour agir tout au long de l'année, plutôt que de
              découvrir sa contribution au moment de la DSN.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <button
                type="button"
                onClick={() => setRdvOuvert(true)}
                className="rounded-xl bg-teal-400 hover:bg-teal-300 text-marine-950 text-sm font-bold px-6 py-3.5 transition shadow-[0_10px_40px_rgba(45,212,191,0.3)]"
              >
                Parler à un expert →
              </button>
              <button
                type="button"
                onClick={allerDemo}
                className="rounded-xl border border-white/20 text-sm font-semibold px-6 py-3.5 hover:bg-white/10 transition"
              >
                Demander une démo
              </button>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-8">
              {ATOUTS.map((a) => (
                <div key={a.titre} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
                  <p className="font-semibold text-sm">{a.titre}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{a.texte}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Aperçu du tableau de bord — illustration, données fictives */}
          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-marine-950 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
                <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">Aperçu illustratif · données fictives</span>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <div className="border-r border-white/10 p-3 space-y-1.5 text-xs">
                  {["Pilotage", "Collaborateurs", "Feuille de route", "DOETH", "Achats"].map((m, i) => (
                    <p key={m} className={`rounded-lg px-2.5 py-2 ${i === 0 ? "bg-teal-400/15 text-teal-300 font-semibold" : "text-slate-400"}`}>
                      {m}
                    </p>
                  ))}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Tableau de bord handicap</p>
                    <span className="rounded-full bg-amber-400/15 text-amber-300 text-[10px] font-bold px-2 py-0.5">2026</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {[
                      ["Situations suivies", "28", "dont 5 ce trimestre"],
                      ["RQTH à renouveler", "6", "dans les 6 mois"],
                      ["Actions en cours", "11", "sur la feuille de route"],
                      ["Préparation DOETH", "74 %", null],
                    ].map(([l, v, d]) => (
                      <div key={l} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                        <p className="text-[10px] text-slate-400">{l}</p>
                        <p className="text-xl font-bold mt-0.5">{v}</p>
                        {d ? (
                          <p className="text-[10px] text-slate-500">{d}</p>
                        ) : (
                          <div className="h-1.5 rounded-full bg-white/10 mt-1.5 overflow-hidden">
                            <div className="h-full w-[74%] bg-teal-400 rounded-full" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 mt-2 space-y-2">
                    <p className="text-xs font-semibold">Avancement global</p>
                    {[
                      ["Feuille de route", 62, "#2dd4bf"],
                      ["Achats inclusifs", 38, "#38bdf8"],
                      ["Suivi individuel", 81, "#f472b6"],
                    ].map(([l, p, c]) => (
                      <div key={l} className="flex items-center gap-2 text-[11px]">
                        <span className="w-24 text-slate-400">{l}</span>
                        <span className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <span className="block h-full rounded-full" style={{ width: `${p}%`, background: c }} />
                        </span>
                        <span className="w-8 text-right tabular-nums">{p} %</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Missions */}
      <section id="missions" className="scroll-mt-20 border-t border-white/10 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-block rounded-full border border-teal-400/30 bg-teal-400/10 text-teal-300 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5">
              Toutes vos missions
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-4">Suivre, organiser et piloter, au même endroit</h2>
            <p className="text-slate-400 mt-3">
              Chaque volet de votre politique handicap a sa place, et tous alimentent la même vision de votre situation OETH.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {MISSIONS.map((m) => (
              <div
                key={m.id}
                id={m.id}
                className="scroll-mt-24 relative rounded-2xl border border-white/10 bg-marine-950 p-6 overflow-hidden"
              >
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: m.couleur }} />
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{ background: `${m.couleur}22` }}
                >
                  {m.icone}
                </span>
                <p className="font-semibold mt-4">{m.titre}</p>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">{m.texte}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <button
              type="button"
              onClick={() => setRdvOuvert(true)}
              className="rounded-xl bg-teal-400 hover:bg-teal-300 text-marine-950 text-sm font-bold px-6 py-3.5 transition"
            >
              Parler à un expert →
            </button>
          </div>
        </div>
      </section>

      {/* Demande de démo */}
      <section id="demo" className="scroll-mt-20 border-t border-white/10 py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl border border-white/10 bg-marine-950 overflow-hidden">
            <div className="flex h-1">
              <span className="flex-1 bg-marine-500" />
              <span className="flex-1 bg-white" />
              <span className="flex-1 bg-red-500" />
            </div>
            <div className="grid lg:grid-cols-[1fr_1.3fr] gap-10 p-6 sm:p-10">
              <div>
                <span className="inline-block rounded-full border border-teal-400/30 bg-teal-400/10 text-teal-300 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5">
                  Demander une démo
                </span>
                <h2 className="text-3xl font-bold tracking-tight mt-4">Découvrez l'outil sur votre propre situation.</h2>
                <p className="text-slate-400 mt-4 leading-relaxed">
                  Indiquez votre effectif, votre organisation et les sujets à piloter. Nous vous montrerons comment suivre
                  vos bénéficiaires et vos RQTH, bâtir votre feuille de route, valoriser vos achats inclusifs et vos dépenses,
                  et préparer sereinement votre DOETH.
                </p>
                <div className="mt-6 space-y-2 text-sm text-slate-300">
                  <p>✓ Démonstration adaptée à votre taille et à vos enjeux</p>
                  <p>✓ Sans engagement</p>
                  <p>
                    ✓ Vous préférez fixer un créneau ?{" "}
                    <button type="button" onClick={() => setRdvOuvert(true)} className="text-teal-300 hover:underline">
                      Réservez un échange
                    </button>
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7">
                <FormulaireDemo />
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-500">
        <Link to="/vitrine" className="hover:text-white">
          ← Retour à l'accueil et au simulateur OETH
        </Link>
      </footer>

      {rdvOuvert && <PriseRendezVous onFermer={fermerRdv} />}
    </div>
  );
}
