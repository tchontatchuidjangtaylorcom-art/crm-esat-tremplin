import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import EntrepriseDetail from "./pages/EntrepriseDetail.jsx";
import Connexion from "./pages/Connexion.jsx";
import AdminUtilisateurs from "./pages/AdminUtilisateurs.jsx";
import Chat from "./pages/Chat.jsx";
import { CallProvider } from "./telephony/CallContext.jsx";
import { DialerProvider } from "./telephony/DialerContext.jsx";
import CallPanel from "./telephony/CallPanel.jsx";
import OutilsVenteLayout from "./components/OutilsVenteLayout.jsx";
import NotificationsMail from "./components/NotificationsMail.jsx";
import AlerteCreditsIA from "./components/AlerteCreditsIA.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import { ChatProvider } from "./chat/ChatContext.jsx";
import ChatWidget from "./chat/ChatWidget.jsx";
import AssistantDomaineCrm from "./components/AssistantDomaineCrm.jsx";
import RappelsEcheances from "./components/RappelsEcheances.jsx";
import { SupervisionProvider } from "./SupervisionContext.jsx";
import { PresenceProvider } from "./PresenceContext.jsx";
import MesKpis from "./pages/MesKpis.jsx";
import KpisEquipe from "./pages/KpisEquipe.jsx";

// CRM interne (connexion, tableau de bord, fiches, chat, KPIs), chargé
// séparément du site public (voir App.jsx et VitrineApp.jsx).
export default function CrmApp() {
  return (
    <AuthProvider>
      <CallProvider>
        <DialerProvider>
          {/* Suivi du temps de travail : actif sur toutes les pages du CRM
              dès qu'une session existe (y compris les pages admin), jamais
              sur la vitrine publique ni la page de connexion. */}
          <PresenceProvider>
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
                  <ChatProvider>
                    <SupervisionProvider>
                      <OutilsVenteLayout>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/entreprise/:id" element={<EntrepriseDetail />} />
                          <Route path="/chat" element={<Chat />} />
                          <Route path="/mes-kpis" element={<MesKpis />} />
                          <Route
                            path="/kpis-equipe"
                            element={
                              <RequireAuth adminSeulement>
                                <KpisEquipe />
                              </RequireAuth>
                            }
                          />
                        </Routes>
                      </OutilsVenteLayout>
                      <ChatWidget />
                      <AssistantDomaineCrm />
                      <RappelsEcheances />
                    </SupervisionProvider>
                  </ChatProvider>
                </RequireAuth>
              }
            />
          </Routes>
          </PresenceProvider>
          <CallPanel />
          <NotificationsMail />
          <AlerteCreditsIA />
        </DialerProvider>
      </CallProvider>
    </AuthProvider>
  );
}
