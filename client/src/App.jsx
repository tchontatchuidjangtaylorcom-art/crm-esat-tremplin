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
import RequireAuth from "./components/RequireAuth.jsx";
import { AuthProvider } from "./AuthContext.jsx";

export default function App() {
  return (
    <AuthProvider>
      <CallProvider>
        <DialerProvider>
          <Routes>
            {/* Hors du habillage CRM (pas de barre d'outils vente) */}
            <Route path="/connexion" element={<Connexion />} />
            <Route
              path="/admin/utilisateurs"
              element={
                <RequireAuth adminSeulement>
                  <AdminUtilisateurs />
                </RequireAuth>
              }
            />

            <Route
              path="/*"
              element={
                <RequireAuth>
                  <OutilsVenteLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/entreprise/:id" element={<EntrepriseDetail />} />
                    </Routes>
                  </OutilsVenteLayout>
                </RequireAuth>
              }
            />
          </Routes>
          <CallPanel />
          <NotificationsMail />
        </DialerProvider>
      </CallProvider>
    </AuthProvider>
  );
}
