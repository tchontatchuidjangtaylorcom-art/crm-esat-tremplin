import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { ThemeVitrineLayout } from "./components/vitrine/ThemeVitrine.jsx";

// Espace AcademTrade (formation trading) : application chargée séparément du
// CRM et du site vitrine OETH (voir App.jsx) — page publique de présentation,
// connexion, et espace client personnel (positions simulées, solde, retraits).
const LandingAcademtrade = lazy(() => import("./pages/academtrade/LandingAcademtrade.jsx"));
const ConnexionAcademtrade = lazy(() => import("./pages/academtrade/ConnexionAcademtrade.jsx"));
const DefinirMotDePasseAcademtrade = lazy(() => import("./pages/academtrade/DefinirMotDePasseAcademtrade.jsx"));
const EspaceAcademtrade = lazy(() => import("./pages/academtrade/EspaceAcademtrade.jsx"));

function Chargement() {
  return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" aria-busy="true" />;
}

export default function AcademtradeApp() {
  return (
    <Suspense fallback={<Chargement />}>
      <Routes>
        <Route element={<ThemeVitrineLayout />}>
          <Route path="/academtrade" element={<LandingAcademtrade />} />
          <Route path="/academtrade/connexion" element={<ConnexionAcademtrade />} />
          <Route path="/academtrade/definir-mot-de-passe/:jeton" element={<DefinirMotDePasseAcademtrade />} />
          <Route path="/academtrade/espace" element={<EspaceAcademtrade />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
