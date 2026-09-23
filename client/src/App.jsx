import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import EntrepriseDetail from "./pages/EntrepriseDetail.jsx";
import { CallProvider } from "./telephony/CallContext.jsx";
import { DialerProvider } from "./telephony/DialerContext.jsx";
import CallPanel from "./telephony/CallPanel.jsx";
import OutilsVenteLayout from "./components/OutilsVenteLayout.jsx";
import NotificationsMail from "./components/NotificationsMail.jsx";

export default function App() {
  return (
    <CallProvider>
      <DialerProvider>
        <OutilsVenteLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/entreprise/:id" element={<EntrepriseDetail />} />
          </Routes>
        </OutilsVenteLayout>
        <CallPanel />
        <NotificationsMail />
      </DialerProvider>
    </CallProvider>
  );
}
