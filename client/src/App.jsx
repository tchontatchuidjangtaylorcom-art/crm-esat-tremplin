import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import EntrepriseDetail from "./pages/EntrepriseDetail.jsx";
import Connexion from "./pages/Connexion.jsx";
import AdminUtilisateurs from "./pages/AdminUtilisateurs.jsx";
import SiteVitrine from "./pages/SiteVitrine.jsx";
import Chat from "./pages/Chat.jsx";
import { CallProvider } from "./telephony/CallContext.jsx";
import { DialerProvider } from "./telephony/DialerContext.jsx";
import CallPanel from "./telephony/CallPanel.jsx";
import OutilsVenteLayout from "./components/OutilsVenteLayout.jsx";
import NotificationsMail from "./components/NotificationsMail.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import { ChatProvider } from "./chat/ChatContext.jsx";
import ChatWidget from "./chat/ChatWidget.jsx";
import { SupervisionProvider } from "./SupervisionContext.jsx";

export default function App() {
  return (
    <AuthProvider>
      <CallProvider>
        <DialerProvider>
          <Routes>
            {/* Site vitrine public — pas d'authentification, pas d'habillage CRM.
                Vit à /vitrine plutôt qu'à la racine "/" pour ne rien changer au
                routage existant du CRM (déjà utilisé en production) ; le bouton
                "Portail sécurisé" de la vitrine renvoie vers /connexion. */}
            <Route path="/vitrine" element={<SiteVitrine />} />

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
                  <ChatProvider>
                    <SupervisionProvider>
                      <OutilsVenteLayout>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/entreprise/:id" element={<EntrepriseDetail />} />
                          <Route path="/chat" element={<Chat />} />
                        </Routes>
                      </OutilsVenteLayout>
                      <ChatWidget />
                    </SupervisionProvider>
                  </ChatProvider>
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
