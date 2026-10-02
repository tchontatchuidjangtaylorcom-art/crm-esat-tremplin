import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ThemeVitrineLayout } from "./components/vitrine/ThemeVitrine.jsx";
import WidgetsVitrine from "./components/vitrine/WidgetsVitrine.jsx";
import { seoPourChemin } from "./seo/pagesSeo.js";

// Site public (/vitrine…), chargé séparément du CRM : un visiteur ne
// télécharge jamais le code du CRM interne, et chaque page n'est chargée
// qu'à sa première visite.
const SiteVitrine = lazy(() => import("./pages/SiteVitrine.jsx"));
const PilotageHandicap = lazy(() => import("./pages/PilotageHandicap.jsx"));
const NotreDemarche = lazy(() => import("./pages/NotreDemarche.jsx"));
const Vigilance = lazy(() => import("./pages/Vigilance.jsx"));
const Actualites = lazy(() => import("./pages/Actualites.jsx"));
const Faq = lazy(() => import("./pages/Faq.jsx"));
const RendezVousClient = lazy(() => import("./pages/RendezVousClient.jsx"));

// Titre et description mis à jour lors de la navigation interne (le serveur
// les injecte déjà dans le HTML initial, voir server/src/seo.js).
function SeoNavigation() {
  const { pathname } = useLocation();
  useEffect(() => {
    const seo = seoPourChemin(pathname);
    if (!seo) return;
    document.title = seo.titre;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", seo.description);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", `${window.location.origin}${pathname}`);
  }, [pathname]);
  return null;
}

function Chargement() {
  return <div className="min-h-screen" aria-busy="true" />;
}

export default function VitrineApp() {
  const { pathname } = useLocation();
  // Page de prise de rendez-vous ouverte depuis un e-mail : sans les boutons
  // flottants, pour que le client se concentre sur le choix du créneau.
  const pageRendezVous = pathname.startsWith("/vitrine/rendez-vous/");
  return (
    <>
      <SeoNavigation />
      <Suspense fallback={<Chargement />}>
        <Routes>
          {/* Thème clair/sombre propre au site vitrine (voir ThemeVitrine.jsx). */}
          <Route element={<ThemeVitrineLayout />}>
            <Route path="/vitrine" element={<SiteVitrine />} />
            <Route path="/vitrine/pilotage" element={<PilotageHandicap />} />
            <Route path="/vitrine/notre-demarche" element={<NotreDemarche />} />
            <Route path="/vitrine/vigilance" element={<Vigilance />} />
            <Route path="/vitrine/actualites" element={<Actualites />} />
            <Route path="/vitrine/faq" element={<Faq />} />
            {/* Prise de rendez-vous depuis un e-mail (lien propre à une fiche). */}
            <Route path="/vitrine/rendez-vous/:jeton" element={<RendezVousClient />} />
            <Route path="/vitrine/*" element={<SiteVitrine />} />
          </Route>
        </Routes>
      </Suspense>
      {/* Boutons flottants (FAQ, Actualité, Vigilance, Assistance). */}
      {!pageRendezVous && <WidgetsVitrine />}
    </>
  );
}
