import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

// Page publique ouverte depuis un lien d'invitation généré par un admin
// (voir LienInvitation.jsx côté admin et server/src/invitations.js côté
// serveur, qui documente les choix v1 : lien réutilisable, 30 jours,
// espaces toujours ajoutés jamais retirés). Deux cas :
//  - le visiteur est déjà connecté → un clic ajoute les espaces du lien à
//    son compte ;
//  - sinon → un petit formulaire crée son compte directement avec ces
//    espaces, et le connecte dans la foulée. Si l'adresse saisie correspond
//    à un compte déjà existant, le serveur refuse (sécurité : impossible
//    d'élargir l'accès d'un compte qui n'est pas le sien juste en
//    connaissant son adresse) et cette page invite à se connecter puis à
//    rouvrir ce même lien, réutilisable.
export default function Invitation() {
  const { jeton } = useParams();
  const navigate = useNavigate();
  const { utilisateur, chargement, rafraichir } = useAuth();

  const [apercu, setApercu] = useState(null); // { espaces: [...] } | { erreur }
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [codeErreur, setCodeErreur] = useState(null);

  useEffect(() => {
    api
      .apercuInvitation(jeton)
      .then(setApercu)
      .catch((e) => setApercu({ erreur: e.message }));
  }, [jeton]);

  async function ajouterAuCompte() {
    setEnCours(true);
    setErreur(null);
    try {
      await api.ajouterEspacesInvitation(jeton);
      await rafraichir();
      navigate("/");
    } catch (e) {
      setErreur(e.message);
      setEnCours(false);
    }
  }

  async function creerCompte(ev) {
    ev.preventDefault();
    if (!prenom.trim() || !nom.trim() || !email.trim()) return;
    setEnCours(true);
    setErreur(null);
    setCodeErreur(null);
    try {
      await api.creerCompteInvitation(jeton, { prenom: prenom.trim(), nom: nom.trim(), email: email.trim() });
      await rafraichir();
      navigate("/");
    } catch (e) {
      setErreur(e.message);
      setCodeErreur(e.code);
      setEnCours(false);
    }
  }

  const nomsEspaces = (apercu?.espaces || []).map((e) => e.nom).join(" et ");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bandeau-tricolore">
          <span className="bg-marine-800" />
          <span className="bg-white" />
          <span className="bg-red-700" />
        </div>
        <div className="p-8 space-y-6">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-marine-700 dark:text-marine-300 mb-1">
              Invitation
            </p>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">CRM OETH / AGEFIPH</h1>
          </div>

          {!apercu && <p className="text-sm text-slate-400 dark:text-slate-500 text-center">Vérification du lien…</p>}

          {apercu?.erreur && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3">
              {apercu.erreur}
            </p>
          )}

          {apercu?.espaces && !chargement && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
                Vous êtes invité(e) à accéder à l'espace <strong>{nomsEspaces}</strong>.
              </p>

              {erreur && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3">
                  {erreur}
                  {codeErreur === "COMPTE_EXISTANT" && (
                    <>
                      {" "}
                      <a href="/connexion" className="underline font-medium">
                        Se connecter
                      </a>
                      , puis rouvrir ce lien.
                    </>
                  )}
                </p>
              )}

              {utilisateur ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    Connecté(e) en tant que {utilisateur.email}.
                  </p>
                  <button
                    type="button"
                    onClick={ajouterAuCompte}
                    disabled={enCours}
                    className="w-full rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 dark:text-marine-900 text-white text-sm font-medium py-2.5 disabled:opacity-40 transition"
                  >
                    {enCours ? "Ajout en cours…" : "Ajouter cet accès à mon compte"}
                  </button>
                </div>
              ) : (
                <form onSubmit={creerCompte} className="space-y-3">
                  <div className="flex gap-2">
                    <label className="block flex-1 text-xs text-slate-500 dark:text-slate-400">
                      Prénom
                      <input
                        type="text"
                        required
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block flex-1 text-xs text-slate-500 dark:text-slate-400">
                      Nom
                      <input
                        type="text"
                        required
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400">
                    Adresse mail professionnelle
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="prenom.nom@exemple.fr"
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={enCours || !prenom.trim() || !nom.trim() || !email.trim()}
                    className="w-full rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 dark:text-marine-900 text-white text-sm font-medium py-2.5 disabled:opacity-40 transition"
                  >
                    {enCours ? "Création…" : "Créer mon compte et accéder au CRM"}
                  </button>
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                    Déjà un compte ?{" "}
                    <a href="/connexion" className="underline">
                      Connectez-vous
                    </a>
                    , puis rouvrez ce lien.
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
