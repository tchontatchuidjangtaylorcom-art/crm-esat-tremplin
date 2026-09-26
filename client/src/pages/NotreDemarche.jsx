import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import EnteteVitrine from "../components/vitrine/EnteteVitrine.jsx";
import RecitImmersif from "../components/vitrine/RecitImmersif.jsx";

// Page "Notre démarche" : le récit immersif (accroche + convictions 01/02/03),
// sorti de la page principale pour que /vitrine s'ouvre directement sur le
// simulateur.
export default function NotreDemarche() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  function allerAuSimulateur() {
    navigate("/vitrine#simulateur");
  }

  return (
    <div className="bg-black text-white">
      <EnteteVitrine />

      <RecitImmersif onOuvrirSimulateur={allerAuSimulateur} />

      {/* Sortie du récit : renvoi vers le simulateur. */}
      <section className="relative bg-black py-24 sm:py-28 border-t border-white/10">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-marine-300 mb-6">Passer à l'action</p>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
            Estimez votre contribution et vos leviers en quelques minutes.
          </h2>
          <Link
            to="/vitrine#simulateur"
            className="inline-block mt-10 rounded-full bg-white text-marine-900 text-sm font-semibold px-7 py-3.5 hover:bg-marine-100 transition"
          >
            Simuler ma contribution OETH
          </Link>
        </div>
      </section>
    </div>
  );
}
