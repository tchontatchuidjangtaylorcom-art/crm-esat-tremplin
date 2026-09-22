import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import EntrepriseDetail from "./pages/EntrepriseDetail.jsx";
import { CallProvider } from "./telephony/CallContext.jsx";
import CallPanel from "./telephony/CallPanel.jsx";

export default function App() {
  return (
    <CallProvider>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/entreprise/:id" element={<EntrepriseDetail />} />
      </Routes>
      <CallPanel />
    </CallProvider>
  );
}
