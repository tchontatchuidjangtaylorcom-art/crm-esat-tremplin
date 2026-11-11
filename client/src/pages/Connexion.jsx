import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { definirEspaceDesire } from "../espace.js";
import { COULEURS_ESPACE } from "../couleursEspace.js";

// Porte d'entrée générique, un même CRM derrière (voir espaces.js côté
// serveur) : /connexion (par défaut, habillage OETH) et /<id-espace> pour
// n'importe quel espace créé depuis l'administration (AdminEspaces.jsx,
// route /:espaceCible dans CrmApp.jsx) — habillées différemment selon la
// couleur de l'espace, mais qui mènent exactement au même compte et au même
// formulaire. `espaceCible` mémorise juste l'espace désiré (voir
// définirEspaceDesire, espace.js) avant la connexion ; une fois connecté, le
// tableau de bord part sur cet espace-là si le compte y a accès, sinon le
// serveur retombe sur son propre espace — jamais d'erreur affichée ici, et
// une page /connexion reste disponible pour la porte générique, ou pour un
// compte qui a accès à plusieurs espaces.
const BRANDING_OETH_PAR_DEFAUT = {
  bandeau: (
    <div className="bandeau-tricolore">
      <span className="bg-marine-800" />
      <span className="bg-white" />
      <span className="bg-red-700" />
    </div>
  ),
  pastille: null,
  surtitreClasse: "text-marine-700 dark:text-marine-300",
  surtitre: "Portail Opérationnel OETH",
  titre: "CRM OETH / AGEFIPH",
};

// Habillage neutre de l'adresse générique /connexion : ne présume d'aucun
// espace particulier (voir le sélecteur juste au-dessus, dans le rendu plus
// bas) — seules les portes dédiées (/oeth, /cee...) gardent un habillage
// propre à leur espace.
const BRANDING_NEUTRE = {
  bandeau: <div className="h-1.5 bg-slate-400 dark:bg-slate-600" />,
  pastille: null,
  surtitreClasse: "text-slate-500 dark:text-slate-400",
  surtitre: "Portail Opérationnel",
  titre: "CRM",
};

// Habillage propre à CEE (couleur historique, avant la généralisation des
// espaces) : conservé tel quel plutôt que généré depuis sa couleur, pour ne
// rien changer visuellement sur cette porte existante.
const BRANDING_CEE = {
  bandeau: <div className="h-1.5 bg-emerald-600" />,
  pastille: <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-600 mr-1.5 align-middle" />,
  surtitreClasse: "text-emerald-700 dark:text-emerald-400",
  surtitre: "Portail Opérationnel CEE",
  titre: "CRM CEE — Économies d'énergie",
};

// Pastille/bandeau fins générés depuis la couleur de l'espace (voir
// COULEURS_ESPACE, partagé avec SelecteurEspace.jsx et AdminEspaces.jsx) —
// pour un espace quelconque créé depuis l'administration, sans rien connaître
// de lui à l'avance.
function brandingDepuisEspace(espace) {
  if (espace.id === "oeth") return BRANDING_OETH_PAR_DEFAUT;
  if (espace.id === "cee") return BRANDING_CEE;
  const classeCouleur = COULEURS_ESPACE[espace.couleur] || COULEURS_ESPACE.marine;
  return {
    bandeau: <div className={`h-1.5 ${classeCouleur}`} />,
    pastille: <span aria-hidden className={`inline-block w-2.5 h-2.5 rounded-full ${classeCouleur} mr-1.5 align-middle`} />,
    surtitreClasse: "text-slate-600 dark:text-slate-300",
    surtitre: `Portail Opérationnel ${espace.court || espace.nom}`,
    titre: espace.nom,
  };
}

// Connexion principalement sans mot de passe : lien magique par mail, ou
// Google si configuré côté serveur (bouton masqué sinon). Un mot de passe
// reste possible par compte, à la discrétion de l'admin (voir
// server/src/auth.js) : si le champ mot de passe est rempli ici, on tente
// une connexion directe ; laissé vide, le comportement habituel (lien
// magique) s'applique — inchangé pour tous les comptes qui n'ont pas de mot
// de passe défini. Le premier compte jamais créé devient automatiquement
// administrateur.
export default function Connexion({ espaceCible }) {
  const { utilisateur, chargement } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Sélecteur d'espace : uniquement sur l'adresse générique /connexion (pas
  // sur une porte dédiée /<id-espace>), pour retrouver facilement une autre
  // porte sans avoir à en connaître l'adresse par cœur. Le formulaire de
  // connexion ci-dessous reste inchangé et utilisable directement en dessous
  // — un agent dont la session a expiré retombe ici sans gêne.
  const [portes, setPortes] = useState([]);
  useEffect(() => {
    if (espaceCible) return;
    let actif = true;
    api
      .listerPortesEspaces()
      .then((liste) => {
        if (actif) setPortes(liste);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [espaceCible]);

  // Habillage de la porte : /connexion (pas d'espaceCible) reste neutre, sans
  // aucun appel réseau — voir BRANDING_NEUTRE plus haut. Une porte dédiée
  // (/<id-espace>) va chercher le nom/la couleur de cet espace — en cas
  // d'erreur (identifiant inconnu, espace désactivé, ou juste le temps du
  // chargement) on retombe sur l'habillage OETH par défaut, jamais de page
  // cassée pour une URL mal tapée.
  const [branding, setBranding] = useState(espaceCible ? BRANDING_OETH_PAR_DEFAUT : BRANDING_NEUTRE);

  useEffect(() => {
    if (espaceCible) definirEspaceDesire(espaceCible);
    if (!espaceCible) {
      setBranding(BRANDING_NEUTRE);
      return;
    }
    if (espaceCible === "oeth") {
      setBranding(BRANDING_OETH_PAR_DEFAUT);
      return;
    }
    let actif = true;
    api
      .getPorteEspace(espaceCible)
      .then((espace) => {
        if (actif) setBranding(brandingDepuisEspace(espace));
      })
      .catch(() => {
        if (actif) setBranding(BRANDING_OETH_PAR_DEFAUT);
      });
    return () => {
      actif = false;
    };
  }, [espaceCible]);
  const [mode, setMode] = useState("connexion"); // "connexion" | "creation"
  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(
    searchParams.get("erreur") === "lien_invalide"
      ? "Ce lien de connexion est invalide ou a expiré. Redemandez-en un ci-dessous."
      : null
  );
  const [config, setConfig] = useState(null);

  useEffect(() => {
    api
      .getAuthConfig()
      .then(setConfig)
      .catch(() => setConfig({ googleConfigure: false }));
  }, []);

  // Charge le SDK Google Identity Services uniquement si une connexion
  // Google est réellement configurée côté serveur.
  useEffect(() => {
    if (!config?.googleConfigure || !config.googleClientId) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async (reponse) => {
          try {
            const resultat = await api.connexionGoogle(reponse.credential);
            if (resultat.statut === "en_attente") {
              setMessage(resultat.message);
            } else {
              window.location.href = "/";
            }
          } catch (e) {
            setErreur(e.message);
          }
        },
      });
      const cible = document.getElementById("bouton-google");
      if (cible) window.google.accounts.id.renderButton(cible, { theme: "outline", size: "large", width: 280 });
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [config]);

  async function soumettre(ev) {
    ev.preventDefault();
    if (!email.trim()) return;
    if (mode === "creation" && (!prenom.trim() || !nom.trim())) return;
    setEnvoiEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      if (mode === "connexion" && motDePasse) {
        // Mot de passe renseigné → connexion directe (compte avec mot de
        // passe défini par l'admin) ; sinon on retombe sur le lien magique.
        await api.connexionMotDePasse(email.trim(), motDePasse);
        window.location.href = "/";
        return;
      }
      const resultat = await api.demanderLien(email.trim(), { prenom: prenom.trim(), nom: nom.trim(), espaceSouhaite: espaceCible });
      setMessage(resultat.message);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function basculerMode(nouveauMode) {
    setMode(nouveauMode);
    setErreur(null);
    setMessage(null);
  }

  if (!chargement && utilisateur) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-6">
      <div className="w-full max-w-sm">
        {!espaceCible && portes.length > 1 && (
          <div className="mb-4 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Choisir un espace
            </p>
            <div className="flex flex-wrap gap-2">
              {portes.map((espace) => (
                <button
                  key={espace.id}
                  type="button"
                  onClick={() => navigate(`/${espace.id}`)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 transition"
                >
                  <span aria-hidden className={`inline-block w-2.5 h-2.5 rounded-full ${COULEURS_ESPACE[espace.couleur] || COULEURS_ESPACE.marine}`} />
                  {espace.court || espace.nom}
                </button>
              ))}
            </div>
          </div>
        )}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {branding.bandeau}
        <div className="p-8 space-y-6">
          <div className="text-center">
            <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${branding.surtitreClasse}`}>
              {branding.surtitre}
            </p>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {branding.pastille}
              {branding.titre}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {mode === "creation" ? "Demande d'accès à l'équipe" : "Lien de connexion ou mot de passe"}
            </p>
          </div>

        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => basculerMode("connexion")}
            className={`flex-1 rounded-md py-1.5 transition ${
              mode === "connexion"
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => basculerMode("creation")}
            className={`flex-1 rounded-md py-1.5 transition ${
              mode === "creation"
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Créer un compte
          </button>
        </div>

        {erreur && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3">
            {erreur}
          </p>
        )}
        {message && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3">
            {message}
          </p>
        )}

        <form onSubmit={soumettre} className="space-y-3">
          {mode === "creation" && (
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
          )}

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

          {mode === "connexion" && (
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Mot de passe (si votre compte en a un — sinon laissez vide)
              <div className="mt-1 relative">
                <input
                  type={motDePasseVisible ? "text" : "password"}
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="Laisser vide pour recevoir un lien"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setMotDePasseVisible((v) => !v)}
                  tabIndex={-1}
                  title={motDePasseVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {motDePasseVisible ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.5a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </label>
          )}

          <button
            type="submit"
            disabled={envoiEnCours || !email.trim() || (mode === "creation" && (!prenom.trim() || !nom.trim()))}
            className="w-full rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 dark:text-marine-900 text-white text-sm font-medium py-2.5 disabled:opacity-40 transition"
          >
            {envoiEnCours
              ? mode === "creation"
                ? "Envoi de la demande…"
                : "Connexion…"
              : mode === "creation"
                ? "Demander un accès"
                : motDePasse
                  ? "Se connecter"
                  : "Recevoir un lien de connexion"}
          </button>
          {mode === "connexion" && (
            <button
              type="button"
              disabled={envoiEnCours}
              onClick={async () => {
                setErreur(null);
                setMessage(null);
                if (!email.trim()) {
                  setErreur("Indiquez d'abord votre adresse mail ci-dessus.");
                  return;
                }
                setEnvoiEnCours(true);
                try {
                  await api.demanderLien(email.trim(), {});
                  setMotDePasse("");
                  setMessage(
                    "Un lien de connexion vient de vous être envoyé par mail. Une fois connecté, cliquez sur votre nom en haut à droite, puis « Changer mon mot de passe »."
                  );
                } catch (e) {
                  setErreur(e.message);
                } finally {
                  setEnvoiEnCours(false);
                }
              }}
              className="block w-full text-center text-xs text-marine-700 dark:text-marine-300 hover:underline disabled:opacity-40"
            >
              Mot de passe oublié ? Recevoir un lien de connexion par mail
            </button>
          )}
        </form>

        {config?.googleConfigure && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs text-slate-400 dark:text-slate-500">ou</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>
            <div id="bouton-google" className="flex justify-center" />
          </>
        )}

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            {mode === "creation"
              ? "Votre demande sera transmise à l'administrateur, qui doit la valider avant que vous puissiez vous connecter."
              : "Premier accès ? Utilisez l'onglet « Créer un compte » ci-dessus."}
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
