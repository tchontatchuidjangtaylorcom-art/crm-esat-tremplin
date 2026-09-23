import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import EntrepriseDetail from "./pages/EntrepriseDetail.jsx";
import Connexion from "./pages/Connexion.jsx";
import AdminUtilisateurs from "./pages/AdminUtilisateurs.jsx";
import { CallProvider } from "./telephony/CallContext.jsx";
import { DialerProvider } from "./telephony/DialerContext.jsx";
import CallPanel from "./telephony/CallPanel.jsx";
import OutilsVenteLayout from "./components/OutilsVenteLayout.jsx";
import NotificationsMail from "./components/NotificationsMail.jsx";

export default function App() {
  return (
    <CallProvider>
      <DialerProvider>
        <Routes>
          {/* Hors du habillage CRM (pas de barre d'outils vente) */}
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/admin/utilisateurs" element={<AdminUtilisateurs />} />

          <Route
            path="/*"
            element={
              <OutilsVenteLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/entreprise/:id" element={<EntrepriseDetail />} />
                </Routes>
              </OutilsVenteLayout>
            }
          />
        </Routes>
        <CallPanel />
        <NotificationsMail />
      </DialerProvider>
    </CallProvider>
  );
}
