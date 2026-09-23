import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import EntrepriseDetail from "./pages/EntrepriseDetail.jsx";
import { CallProvider } from "./telephony/CallContext.jsx";
import { DialerProvider } from "./telephony/DialerContext.jsx";
import CallPanel from "./telephony/CallPanel.jsx";
import ArgumentaireDrawer from "./components/ArgumentaireDrawer.jsx";

export default function App() {
  return (
    <CallProvider>
      <DialerProvider>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/entreprise/:id" element={<EntrepriseDetail />} />
        </Routes>
        <CallPanel />
        <ArgumentaireDrawer />
      </DialerProvider>
    </CallProvider>
  );
}
