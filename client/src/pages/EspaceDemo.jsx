import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

// Aperçu public du CRM, affiché à la racine à quiconque arrive SANS lien
// d'invitation (voir RequireAuth.jsx) : aucune session, aucune donnée
// réelle, aucune personnalisation — juste la forme du CRM avec des chiffres
// à zéro, pour donner une idée du produit. Un visiteur avec un lien
// d'invitation précis (voir server/src/invitations.js) ne passe jamais par
// ici : il arrive directement sur /invitation/:jeton.
const CARTES_PLACEHOLDER = [
  { label: "Nouveaux", valeur: "—" },
  { label: "En cours", valeur: "—" },
  { label: "Convertis", valeur: "—" },
  { label: "À relancer", valeur: "—" },
];

const ESPACES_DISPONIBLES = [
  { id: "oeth", nom: "OETH / AGEFIPH" },
  { id: "cee", nom: "CEE — Économies d'énergie" },
];

export default function EspaceDemo() {
  const [ouvert, setOuvert] = useState(false);
  const [espaces, setEspaces] = useState([]);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [message, setMessage] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState(null);

  function basculerEspace(id) {
    setEspaces((liste) => (liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]));
  }

  async function soumettre(ev) {
    ev.preventDefault();
    if (!nom.trim() || !email.trim()) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      await api.demanderPersonnalisationDemo({
        nom: nom.trim(),
        email: email.trim(),
        telephone: telephone.trim(),
        entreprise: entreprise.trim(),
        message: message.trim(),
        espaces,
      });
      setEnvoye(true);
    } catch (e) {
      setErreur(e.message || "L'envoi a échoué. Réessayez plus tard.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Aperçu</p>
          <h1 className="text-base font-bold text-slate-700 dark:text-slate-200">CRM</h1>
        </div>
        <Link
          to="/connexion"
          className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          Espace professionnel · Se connecter
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Vous consultez un aperçu vierge du CRM, sans lien d'invitation : aucune fiche, aucune donnée réelle, aucune
            entreprise associée. Si on vous a envoyé un lien d'invitation précis, utilisez-le plutôt — il vous donnera
            accès à votre propre espace.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CARTES_PLACEHOLDER.map((c) => (
            <div
              key={c.label}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3"
            >
              <p className="text-xs text-slate-400 dark:text-slate-500">{c.label}</p>
              <p className="text-xl font-bold text-slate-300 dark:text-slate-600">{c.valeur}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Fiches</p>
          </div>
          <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            Aucune fiche — ceci est un espace de démonstration.
          </p>
        </div>

        <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-5">
          {!ouvert && !envoye && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Vous voulez une version personnalisée pour votre entreprise, avec vos propres fiches ?
              </p>
              <button
                onClick={() => setOuvert(true)}
                className="rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-slate-300 dark:text-slate-900 text-white text-sm font-medium px-4 py-2 transition whitespace-nowrap"
              >
                Nous contacter
              </button>
            </div>
          )}

          {ouvert && !envoye && (
            <form onSubmit={soumettre} className="space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Dites-nous qui vous êtes, on s'occupe de votre espace personnalisé.
              </p>

              <div className="flex flex-wrap gap-2">
                {ESPACES_DISPONIBLES.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => basculerEspace(e.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                      espaces.includes(e.id)
                        ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {e.nom}
                  </button>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block text-xs text-slate-500 dark:text-slate-400">
                  Nom
                  <input
                    type="text"
                    required
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-slate-500 dark:text-slate-400">
                  Entreprise
                  <input
                    type="text"
                    value={entreprise}
                    onChange={(e) => setEntreprise(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-slate-500 dark:text-slate-400">
                  E-mail
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-slate-500 dark:text-slate-400">
                  Téléphone
                  <input
                    type="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Message (facultatif)
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </label>

              {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}

              <button
                type="submit"
                disabled={envoiEnCours || !nom.trim() || !email.trim()}
                className="rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-slate-300 dark:text-slate-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-40 transition"
              >
                {envoiEnCours ? "Envoi…" : "Envoyer"}
              </button>
            </form>
          )}

          {envoye && (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              C'est noté — on vous recontacte pour mettre en place votre espace.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
