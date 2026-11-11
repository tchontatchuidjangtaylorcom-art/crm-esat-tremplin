import { Routes, Route, useParams, Outlet, Navigate } from "react-router-dom";
import { installerEnteteEspace, espaceChoisi, appliquerFavicon } from "./espace.js";
import Dashboard from "./pages/Dashboard.jsx";
import EntrepriseDetail from "./pages/EntrepriseDetail.jsx";
import Connexion from "./pages/Connexion.jsx";
import AdminUtilisateurs from "./pages/AdminUtilisateurs.jsx";
import AdminEquipes from "./pages/AdminEquipes.jsx";
import AdminEspaces from "./pages/AdminEspaces.jsx";
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
import Supervision from "./pages/Supervision.jsx";
import Campagnes from "./pages/Campagnes.jsx";
import BoiteMail from "./pages/BoiteMail.jsx";
import MonEquipe from "./pages/MonEquipe.jsx";

// Espace de travail affiché (OETH, CEE…) envoyé au serveur avec chaque requête /api.
installerEnteteEspace();
// Icône d'onglet du CRM authentifié — changerEspace() recharge toujours la
// page (voir espace.js), donc un simple appel au chargement suffit à rester
// juste après un changement d'espace.
appliquerFavicon(espaceChoisi());

// Porte d'entrée dédiée à un espace quelconque (/oeth, /cee, et tout espace
// créé depuis l'administration — voir AdminEspaces.jsx) : un simple wrapper,
// les hooks (useParams) ne pouvant pas s'écrire directement dans `element`.
function PorteEspace() {
  const { espaceCible } = useParams();
  return <Connexion espaceCible={espaceCible} />;
}

// Mise en page du CRM authentifié (tableau de bord, fiches, chat, KPIs…) —
// un vrai parent de route React Router (<Outlet/>), PAS un second <Routes>
// imbriqué : avec un second <Routes>, ses routes enfants ("/chat",
// "/mes-kpis"…) n'existeraient, pour le classement des routes, qu'à
// l'intérieur du chemin du parent ("/*" plus bas) — donc toujours moins
// prioritaires qu'un segment dynamique comme ":espaceCible" déclaré au même
// niveau que ce parent. En vraies routes enfants (voir plus bas), elles sont
// résolues en chemins absolus ("/chat") et rivalisent DIRECTEMENT avec
// ":espaceCible" dans le classement — un segment statique l'emporte alors
// toujours sur un segment dynamique, exactement ce qu'il faut ici.
function EspaceAuthentifieLayout() {
  return (
    <RequireAuth>
      <ChatProvider>
        <SupervisionProvider>
          <OutilsVenteLayout>
            <Outlet />
          </OutilsVenteLayout>
          <ChatWidget />
          <AssistantDomaineCrm />
          <RappelsEcheances />
        </SupervisionProvider>
      </ChatProvider>
    </RequireAuth>
  );
}

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
            {/* Hors du habillage CRM (pas de barre d'outils vente). /:espaceCible :
                porte d'entrée dédiée à N'IMPORTE QUEL espace (/oeth, /cee, et tout
                espace créé depuis l'administration — voir AdminEspaces.jsx), même
                formulaire, habillage différent selon l'espace (voir Connexion.jsx) ;
                /connexion reste l'adresse générique, sans espace présélectionné.
                Un seul segment dynamique à cette profondeur : React Router v6
                préfère toujours un segment statique ("/connexion", "/admin…", et
                toutes les routes du CRM authentifié ci-dessous, qui sont de VRAIES
                routes enfants donc résolues en chemins absolus) à ":espaceCible" au
                même niveau — donc cette route ne peut jamais en masquer une autre,
                ni être masquée par elle. Un espace créé avec l'identifiant d'une de
                ces pages (ex: "chat") serait sans porte d'entrée possible : c'est
                pourquoi le serveur les refuse aussi à la création (voir
                IDENTIFIANTS_RESERVES, espaces.js). */}
            <Route path="/connexion" element={<Connexion />} />
            <Route path="/:espaceCible" element={<PorteEspace />} />
            <Route
              path="/admin/utilisateurs"
              element={
                <RequireAuth adminSeulement>
                  <AdminUtilisateurs />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/equipes"
              element={
                <RequireAuth adminSeulement>
                  <AdminEquipes />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/espaces"
              element={
                <RequireAuth adminSeulement>
                  <AdminEspaces />
                </RequireAuth>
              }
            />

            {/* CRM authentifié : routes enfants d'une mise en page commune
                (EspaceAuthentifieLayout, <Outlet/>) — voir le commentaire au-dessus
                de ce composant pour pourquoi ce sont de vraies routes enfants et pas
                un second <Routes> imbriqué. */}
            <Route element={<EspaceAuthentifieLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/entreprise/:id" element={<EntrepriseDetail />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/mes-kpis" element={<MesKpis />} />
              <Route
                path="/kpis-equipe"
                element={
                  <RequireAuth managerOuAdminSeulement>
                    <KpisEquipe />
                  </RequireAuth>
                }
              />
              <Route
                path="/mon-equipe"
                element={
                  <RequireAuth managerOuAdminSeulement>
                    <MonEquipe />
                  </RequireAuth>
                }
              />
              <Route
                path="/supervision"
                element={
                  <RequireAuth adminSeulement>
                    <Supervision />
                  </RequireAuth>
                }
              />
              <Route
                path="/campagnes"
                element={
                  <RequireAuth adminSeulement>
                    <Campagnes />
                  </RequireAuth>
                }
              />
              <Route
                path="/boite-mail"
                element={
                  <RequireAuth>
                    <BoiteMail />
                  </RequireAuth>
                }
              />
              {/* Adresse à plusieurs segments inconnue (ex: faute de frappe) : ne
                  peut jamais matcher ":espaceCible" (un seul segment) — retour au
                  tableau de bord plutôt qu'une page blanche. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
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
