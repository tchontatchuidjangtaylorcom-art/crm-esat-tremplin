import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";

// Point d'entrée : le site public (/vitrine…) et le CRM interne sont deux
// applications chargées séparément. Un visiteur de la vitrine ne télécharge
// jamais le code du CRM (tableau de bord, téléphonie, chat…), et inversement
// — voir VitrineApp.jsx et CrmApp.jsx.
const VitrineApp = lazy(() => import("./VitrineApp.jsx"));
const CrmApp = lazy(() => import("./CrmApp.jsx"));

export default function App() {
  const { pathname } = useLocation();
  const estVitrine = pathname === "/vitrine" || pathname.startsWith("/vitrine/");
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>{estVitrine ? <VitrineApp /> : <CrmApp />}</Suspense>
  );
}
