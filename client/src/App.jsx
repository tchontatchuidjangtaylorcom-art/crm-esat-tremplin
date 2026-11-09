import { Component, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";

// Point d'entrée : le site public (/vitrine…) et le CRM interne sont deux
// applications chargées séparément. Un visiteur de la vitrine ne télécharge
// jamais le code du CRM (tableau de bord, téléphonie, chat…), et inversement
// — voir VitrineApp.jsx et CrmApp.jsx.
//
// Si ce chargement échoue (connexion coupée en cours de route, ou onglet
// ouvert avant une mise à jour qui réclame un fichier qui n'existe plus),
// la page restait blanche sans explication. On recharge alors la page
// automatiquement quelques fois, puis on affiche un message avec un bouton.
const CLE_RELANCE = "crm-rechargement-apres-echec";
const MAX_RECHARGEMENTS = 4;

function chargerAvecRelance(importer) {
  return lazy(() =>
    importer().then(
      (module) => {
        try {
          sessionStorage.removeItem(CLE_RELANCE);
        } catch {
          /* stockage indisponible : sans conséquence */
        }
        return module;
      },
      (erreur) => {
        // Pendant un déploiement, le serveur Render (avec disque) est arrêté
        // environ une minute : on recharge plusieurs fois, de plus en plus
        // espacé (4, 8, 12, 16 s ≈ 40 s), avant d'afficher le message.
        // Un nouvel import du même fichier ne suffit pas : le navigateur
        // garde l'échec en mémoire jusqu'au rechargement de la page.
        let essais = MAX_RECHARGEMENTS;
        try {
          essais = Number(sessionStorage.getItem(CLE_RELANCE)) || 0;
          if (essais < MAX_RECHARGEMENTS) sessionStorage.setItem(CLE_RELANCE, String(essais + 1));
        } catch {
          /* sans stockage, pas de rechargement automatique (évite une boucle) */
        }
        if (essais < MAX_RECHARGEMENTS) {
          setTimeout(() => window.location.reload(), 4000 * (essais + 1));
          return new Promise(() => {}); // « Chargement… » jusqu'au rechargement
        }
        throw erreur;
      }
    )
  );
}

const VitrineApp = chargerAvecRelance(() => import("./VitrineApp.jsx"));
const CrmApp = chargerAvecRelance(() => import("./CrmApp.jsx"));

function Chargement() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500 dark:text-slate-400" aria-busy="true">
      Chargement…
    </div>
  );
}

class EchecChargement extends Component {
  state = { erreur: null };

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, info) {
    console.error("[app] Erreur de l'application :", erreur);
    // Inscrit l'erreur dans les journaux du serveur (comptes connectés).
    try {
      fetch("/api/erreur-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          page: window.location.pathname,
          message: String(erreur?.message || erreur),
          pile: String(erreur?.stack || ""),
          composants: String(info?.componentStack || ""),
        }),
      }).catch(() => {});
    } catch {
      /* sans conséquence */
    }
  }

  render() {
    const { erreur } = this.state;
    if (!erreur) return this.props.children;
    // Fichier de l'application qui n'arrive pas (connexion coupée, ancienne
    // version) ou bien vrai plantage de l'interface : messages différents.
    const chargement = /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|preload/i.test(
      String(erreur?.message || "")
    );
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {chargement ? "La page n'a pas pu se charger." : "Une erreur s'est produite dans le CRM."}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {chargement
              ? "Le serveur est peut-être en cours de mise à jour (environ une minute), ou la connexion Internet a été coupée. Patientez un instant, puis rechargez la page."
              : "L'erreur a été signalée automatiquement. Rechargez la page ; si elle revient, envoyez une capture de ce message à l'administrateur."}
          </p>
          <p className="mt-3 break-words rounded bg-slate-100 px-2 py-1 text-left font-mono text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {String(erreur?.message || erreur).slice(0, 300)}
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem(CLE_RELANCE);
              } catch {
                /* sans conséquence */
              }
              window.location.reload();
            }}
            className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}

export default function App() {
  const { pathname } = useLocation();
  const estVitrine = pathname === "/vitrine" || pathname.startsWith("/vitrine/");
  return (
    <EchecChargement>
      <Suspense fallback={<Chargement />}>{estVitrine ? <VitrineApp /> : <CrmApp />}</Suspense>
    </EchecChargement>
  );
}
