import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { formatDate } from "../constants.js";
import { useAuth } from "../AuthContext.jsx";
import EspacesCompte from "../components/EspacesCompte.jsx";
import EquipeCompte from "../components/EquipeCompte.jsx";

const CHAMPS_MAIL_VIDES = { smtpHost: "", smtpPort: "", imapHost: "", imapPort: "", user: "", password: "", from: "", replyTo: "" };

const LIBELLES_STATUT = {
  en_attente: { label: "En attente", classe: "bg-amber-100 text-amber-700 border-amber-300" },
  valide: { label: "Validé", classe: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  refuse: { label: "Refusé", classe: "bg-red-100 text-red-700 border-red-300" },
};

// Alphabet sans caractères ambigus à l'oral/à l'écran (pas de 0/O, 1/l/I) —
// ce mot de passe est destiné à être lu ou dicté au téléphone à un agent.
const ALPHABET_MOT_DE_PASSE = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

function genererMotDePasseAleatoire(longueur = 12) {
  const valeurs = new Uint32Array(longueur);
  crypto.getRandomValues(valeurs);
  return Array.from(valeurs, (v) => ALPHABET_MOT_DE_PASSE[v % ALPHABET_MOT_DE_PASSE.length]).join("");
}

async function copierPressePapier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

// Validation des comptes agents par un administrateur — l'API sous-jacente
// (exigerAdmin) refuse déjà l'accès à qui n'est pas admin ; cette page se
// contente d'afficher l'erreur renvoyée le cas échéant.
export default function AdminUtilisateurs() {
  const { utilisateur: moi } = useAuth();

  // Clic sur l'e-mail ou le nom d'un compte validé : ouvre son CRM en Mode
  // Manager (même mécanisme que « Voir le compte de… », mémorisé pour la
  // session — voir SupervisionContext.jsx). Son propre compte : le CRM normal.
  function ouvrirCompte(u) {
    try {
      if (u.id === moi?.id) window.sessionStorage.removeItem("supervision:agent");
      else window.sessionStorage.setItem("supervision:agent", JSON.stringify({ id: u.id, prenom: u.prenom, email: u.email }));
    } catch {
      // stockage indisponible : on ouvre simplement le tableau de bord
    }
    window.location.assign("/");
  }
  const lienCompte = (u, contenu, classe) =>
    u.statut === "valide" ? (
      <button
        type="button"
        onClick={() => ouvrirCompte(u)}
        title={u.id === moi?.id ? "Ouvrir mon CRM" : `Ouvrir le CRM de ${u.prenom || u.email} (Mode Manager)`}
        className={`text-left hover:underline hover:text-marine-700 dark:hover:text-marine-300 ${classe}`}
      >
        {contenu}
      </button>
    ) : (
      contenu
    );
  const [utilisateurs, setUtilisateurs] = useState(null);
  // Recherche instantanée dans la liste (e-mail, prénom, nom, téléphone).
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState(null);

  const [email, setEmail] = useState("");
  // Un seul champ nom (plus de prénom séparé) — envoyé dans `prenom` côté API,
  // seul champ utilisé comme nom d'affichage partout ailleurs dans le CRM.
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [siret, setSiret] = useState("");
  const [role, setRole] = useState("agent");
  const [motDePasse, setMotDePasse] = useState("");
  const [creation, setCreation] = useState(false);
  const [erreurCreation, setErreurCreation] = useState(null);
  const [confirmationCreation, setConfirmationCreation] = useState(null);

  // Édition inline du mot de passe d'un compte existant : { id, valeur }.
  const [editionMotDePasse, setEditionMotDePasse] = useState(null);
  const [erreurMotDePasse, setErreurMotDePasse] = useState(null);
  const [enregistrementMotDePasse, setEnregistrementMotDePasse] = useState(false);
  // Confirmation affichée juste après l'enregistrement : { id, valeur, copie }
  // — le mot de passe en clair n'existe que côté client (jamais renvoyé par
  // le serveur, qui ne stocke que le hash) et seulement le temps de le
  // communiquer à l'agent ; il n'est plus récupérable une fois cette
  // confirmation fermée.
  const [motDePasseConfirme, setMotDePasseConfirme] = useState(null);

  // Renvoi manuel du lien de connexion : feedback par utilisateur ({ id: message|erreur }).
  const [renvoiEnCours, setRenvoiEnCours] = useState(null);
  const [renvoiResultat, setRenvoiResultat] = useState({});

  function charger() {
    api
      .listUtilisateurs()
      .then(setUtilisateurs)
      .catch((e) => setErreur(e.message));
  }

  // Espaces de travail (OETH, CEE…) ouverts à chaque compte.
  const [espaces, setEspaces] = useState([]);
  useEffect(() => {
    fetch("/api/espaces/tous")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEspaces)
      .catch(() => {});
  }, []);

  // Équipes (bureaux) — voir server/src/equipes.js et la page /admin/equipes
  // pour les créer et leur donner une boîte mail propre.
  const [equipes, setEquipes] = useState([]);
  useEffect(() => {
    api.listEquipes().then(setEquipes).catch(() => {});
  }, []);

  useEffect(() => {
    charger();
  }, []);

  async function creerAcces(ev) {
    ev.preventDefault();
    if (!email.trim() || !nom.trim()) return;
    setCreation(true);
    setErreurCreation(null);
    setConfirmationCreation(null);
    try {
      const { utilisateur, mailEnvoye, motDePasseProvisoire, entrepriseLieeNom, siretSansCorrespondance } = await api.creerUtilisateur({
        email: email.trim(),
        prenom: nom.trim(),
        nom: "",
        telephone: telephone.trim(),
        siret: siret.trim(),
        role,
        motDePasse: motDePasse.trim(),
      });
      const morceaux = [
        mailEnvoye
          ? `Accès créé pour ${utilisateur.email} — un mail avec le lien de connexion et le mot de passe provisoire lui a été envoyé.`
          : `Accès créé pour ${utilisateur.email}. Envoi automatique du mail indisponible : communiquez-lui l'adresse du CRM et le mot de passe provisoire ci-dessous.`,
      ];
      if (entrepriseLieeNom) morceaux.push(`Lié à l'entreprise « ${entrepriseLieeNom} » (SIRET reconnu).`);
      else if (siretSansCorrespondance) morceaux.push("SIRET enregistré, mais aucune entreprise correspondante trouvée dans le CRM.");
      setConfirmationCreation(morceaux.join(" "));
      // Même bloc que pour "Changer" un mot de passe existant : affiché une
      // seule fois, le temps que l'admin le communique si besoin (voir
      // motDePasseConfirme plus bas) — l'utilisateur devra de toute façon le
      // remplacer à sa première connexion (doitChangerMotDePasse).
      setMotDePasseConfirme({ id: utilisateur.id, valeur: motDePasseProvisoire, copie: false });
      setEmail("");
      setNom("");
      setTelephone("");
      setSiret("");
      setRole("agent");
      setMotDePasse("");
      charger();
    } catch (e) {
      setErreurCreation(e.message);
    } finally {
      setCreation(false);
    }
  }

  async function enregistrerMotDePasse(id) {
    const valeur = editionMotDePasse.valeur.trim();
    setEnregistrementMotDePasse(true);
    setErreurMotDePasse(null);
    try {
      await api.definirMotDePasse(id, valeur);
      setEditionMotDePasse(null);
      // Affiche le mot de passe en clair une dernière fois pour que l'admin
      // puisse le communiquer/copier — le serveur ne le renverra plus jamais
      // (seul le hash est stocké), donc c'est la seule occasion de le voir.
      setMotDePasseConfirme({ id, valeur, copie: false });
      charger();
    } catch (e) {
      setErreurMotDePasse(e.message);
    } finally {
      setEnregistrementMotDePasse(false);
    }
  }

  async function copierMotDePasseConfirme() {
    if (!motDePasseConfirme) return;
    const ok = await copierPressePapier(motDePasseConfirme.valeur);
    if (ok) setMotDePasseConfirme((c) => (c ? { ...c, copie: true } : c));
  }

  async function renvoyerLien(id) {
    setRenvoiEnCours(id);
    setRenvoiResultat((r) => ({ ...r, [id]: null }));
    try {
      await api.renvoyerLien(id);
      setRenvoiResultat((r) => ({ ...r, [id]: { ok: true, message: "Lien de connexion envoyé." } }));
    } catch (e) {
      setRenvoiResultat((r) => ({ ...r, [id]: { ok: false, message: e.message } }));
    } finally {
      setRenvoiEnCours(null);
    }
  }

  async function retirerMotDePasse(id) {
    setEnregistrementMotDePasse(true);
    setErreurMotDePasse(null);
    try {
      await api.definirMotDePasse(id, "");
      setEditionMotDePasse(null);
      charger();
    } catch (e) {
      setErreurMotDePasse(e.message);
    } finally {
      setEnregistrementMotDePasse(false);
    }
  }

  // Boîte mail personnelle (voir server/src/auth.js, mailPersonnel) : un
  // agent/manager peut l'utiliser à la place de la boîte générale au moment
  // d'envoyer un mail depuis une fiche (sélecteur dans MessagerieMail.jsx).
  // Même logique de fusion/prefill que la boîte d'équipe (AdminEquipes.jsx) :
  // { id, champs }.
  const [mailOuvert, setMailOuvert] = useState(null);
  const [enregistrementMail, setEnregistrementMail] = useState(false);
  const [erreurMail, setErreurMail] = useState(null);

  function ouvrirMail(u) {
    setErreurMail(null);
    setMailOuvert({
      id: u.id,
      champs: {
        ...CHAMPS_MAIL_VIDES,
        user: u.mail?.user || "",
        from: u.mail?.from || "",
        replyTo: u.mail?.replyTo || "",
        smtpHost: u.mail?.smtpHost || "",
        smtpPort: u.mail?.smtpPort ? String(u.mail.smtpPort) : "",
        imapHost: u.mail?.imapHost || "",
        imapPort: u.mail?.imapPort ? String(u.mail.imapPort) : "",
        // Le mot de passe n'est jamais renvoyé par l'API — laissé vide ici,
        // un champ vide à l'enregistrement garde celui déjà enregistré.
      },
    });
  }

  async function enregistrerMail(id) {
    const c = mailOuvert.champs;
    if (!c.from.trim() && !c.user.trim()) {
      setErreurMail("Indiquez au moins une adresse d'expédition (From) ou un identifiant de boîte.");
      return;
    }
    setEnregistrementMail(true);
    setErreurMail(null);
    try {
      await api.definirMailPersonnel(id, {
        smtpHost: c.smtpHost.trim(),
        smtpPort: c.smtpPort.trim() ? Number(c.smtpPort) : null,
        imapHost: c.imapHost.trim(),
        imapPort: c.imapPort.trim() ? Number(c.imapPort) : null,
        user: c.user.trim(),
        password: c.password,
        from: c.from.trim(),
        replyTo: c.replyTo.trim(),
      });
      setMailOuvert(null);
      charger();
    } catch (e) {
      setErreurMail(e.message);
    } finally {
      setEnregistrementMail(false);
    }
  }

  async function retirerMail(id) {
    if (!window.confirm("Retirer la boîte mail personnelle de ce compte ?")) return;
    setEnregistrementMail(true);
    try {
      await api.definirMailPersonnel(id, null);
      setMailOuvert(null);
      charger();
    } catch (e) {
      setErreurMail(e.message);
    } finally {
      setEnregistrementMail(false);
    }
  }

  // Équipes supplémentaires vues par un manager ("manager principal"), en
  // plus de sa propre équipe (equipeId) — voir estVisibleParEquipe dans
  // server/src/equipes.js. L'id du compte dont la liste est dépliée.
  const [equipesSuperviseesOuvert, setEquipesSuperviseesOuvert] = useState(null);
  const [enregistrementEquipesSupervisees, setEnregistrementEquipesSupervisees] = useState(false);
  const [erreurEquipesSupervisees, setErreurEquipesSupervisees] = useState(null);

  async function basculerEquipeSupervisee(u, equipeId) {
    const actuelles = u.equipesSupervisees || [];
    const prochaines = actuelles.includes(equipeId)
      ? actuelles.filter((id) => id !== equipeId)
      : [...actuelles, equipeId];
    setEnregistrementEquipesSupervisees(true);
    setErreurEquipesSupervisees(null);
    try {
      await api.definirEquipesSuperviseesUtilisateur(u.id, prochaines);
      setUtilisateurs((l) => l.map((x) => (x.id === u.id ? { ...x, equipesSupervisees: prochaines } : x)));
    } catch (e) {
      setErreurEquipesSupervisees(e.message);
    } finally {
      setEnregistrementEquipesSupervisees(false);
    }
  }

  async function valider(id, role) {
    try {
      await api.validerUtilisateur(id, role);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function refuser(id) {
    try {
      await api.refuserUtilisateur(id);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function supprimer(id, email) {
    if (!window.confirm(`Supprimer définitivement le compte ${email} ? Cette action est irréversible.`)) return;
    try {
      await api.supprimerUtilisateur(id);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  // Sans accents ni majuscules : "helene" trouve "Hélène", "DUPONT" trouve "Dupont".
  const normaliser = (texte) =>
    String(texte || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const termes = normaliser(recherche).split(/\s+/).filter(Boolean);
  const utilisateursFiltres = (utilisateurs || []).filter((u) => {
    if (termes.length === 0) return true;
    const texte = normaliser([u.email, u.prenom, u.nom, u.telephone].filter(Boolean).join(" "));
    return termes.every((t) => texte.includes(t));
  });

  return (
    <div className="min-h-screen">
      <div className="bandeau-tricolore">
        <span className="bg-marine-800" />
        <span className="bg-white" />
        <span className="bg-red-700" />
      </div>
      <div className="p-6 max-w-[1600px] mx-auto">
        <Link to="/" className="text-sm text-marine-700 dark:text-marine-300 hover:underline">
          &larr; Retour au tableau de bord
        </Link>
        <div className="flex items-center gap-2 mt-3 mb-1">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gestion des accès</h1>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          Accès réservé aux administrateurs — mots de passe chiffrés, actions journalisées.
        </p>

        {erreur && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          {erreur}
        </div>
      )}

      <form
        onSubmit={creerAcces}
        className="mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-4 space-y-3"
      >
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">+ Ajouter un client / Créer un profil</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Le compte est créé directement validé — la personne reçoit un mail avec un lien de connexion et un mot de
          passe provisoire qu'elle devra remplacer à sa première connexion. Limité aux dossiers qui lui seront
          assignés.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Nom
            <input
              type="text"
              required
              placeholder="Jean Dupont"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="mt-1 w-44 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            E-mail
            <input
              type="email"
              required
              placeholder="prenom.nom@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-64 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Téléphone (optionnel)
            <input
              type="tel"
              placeholder="06 12 34 56 78"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              className="mt-1 w-40 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            SIRET (optionnel)
            <input
              type="text"
              placeholder="Entreprise partenaire OETH"
              title="Si ce SIRET correspond à une entreprise déjà suivie dans le CRM, le compte y sera automatiquement lié."
              value={siret}
              onChange={(e) => setSiret(e.target.value)}
              className="mt-1 w-48 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Rôle
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            >
              <option value="agent">Agent</option>
              <option value="superviseur">Superviseur</option>
              <option value="manager">Manager (chef d'équipe/bureau)</option>
              <option value="admin">Administrateur</option>
              <option value="super_admin">Super-administrateur</option>
            </select>
          </label>
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Mot de passe provisoire (optionnel)
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Laisser vide → généré automatiquement"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="mt-1 w-56 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={
              creation ||
              !email.trim() ||
              !nom.trim() ||
              (motDePasse.trim().length > 0 && motDePasse.trim().length < 8)
            }
            className="rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 text-white dark:text-marine-900 text-sm font-medium px-4 py-2 disabled:opacity-40"
          >
            {creation ? "Création…" : "Créer le profil"}
          </button>
        </div>
        {motDePasse.trim().length > 0 && motDePasse.trim().length < 8 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Le mot de passe doit contenir au moins 8 caractères.</p>
        )}
        {erreurCreation && <p className="text-sm text-red-600 dark:text-red-400">{erreurCreation}</p>}
        {confirmationCreation && <p className="text-sm text-emerald-600 dark:text-emerald-400">{confirmationCreation}</p>}
      </form>

      {utilisateurs && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-96">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un agent (nom, prénom ou e-mail)…"
              aria-label="Rechercher un agent"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marine-400"
            />
          </div>
          {recherche.trim() && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {utilisateursFiltres.length} compte{utilisateursFiltres.length > 1 ? "s" : ""} sur {utilisateurs.length}
            </span>
          )}
        </div>
      )}

      {!utilisateurs ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Chargement…</p>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Nom</th>
                <th className="px-4 py-3 text-left">Rôle</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Connexion</th>
                <th className="px-4 py-3 text-left">Demande</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {utilisateursFiltres.map((u) => (
                <Fragment key={u.id}>
                  <tr>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{lienCompte(u, u.email, "")}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {lienCompte(u, [u.prenom, u.nom].filter(Boolean).join(" ") || "-", "font-medium")}
                      {(u.telephone || u.siret) && (
                        <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                          {[u.telephone, u.siret ? `SIRET ${u.siret}` : null].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {u.entrepriseLieeId && (
                        <a
                          href={`/entreprise/${u.entrepriseLieeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[11px] text-marine-700 dark:text-marine-300 hover:underline"
                        >
                          🔗 Entreprise liée
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {u.role}
                      {u.statut === "valide" && (
                        <EspacesCompte
                          utilisateur={u}
                          espaces={espaces}
                          onMaj={(maj) => setUtilisateurs((l) => l.map((x) => (x.id === maj.id ? { ...x, espaces: maj.espaces } : x)))}
                        />
                      )}
                      {u.statut === "valide" && (
                        <EquipeCompte
                          utilisateur={u}
                          equipes={equipes}
                          onMaj={(maj) => setUtilisateurs((l) => l.map((x) => (x.id === maj.id ? { ...x, equipeId: maj.equipeId } : x)))}
                        />
                      )}
                      {u.statut === "valide" && u.role === "manager" && (
                        <button
                          onClick={() => setEquipesSuperviseesOuvert((id) => (id === u.id ? null : u.id))}
                          title="Équipes supplémentaires que ce manager voit en plus de la sienne (« manager principal »)"
                          className="mt-1 block text-[11px] text-teal-700 dark:text-teal-300 hover:underline"
                        >
                          {equipesSuperviseesOuvert === u.id
                            ? "Fermer"
                            : u.equipesSupervisees?.length
                              ? `+ ${u.equipesSupervisees.length} équipe${u.equipesSupervisees.length > 1 ? "s" : ""} supervisée${u.equipesSupervisees.length > 1 ? "s" : ""}`
                              : "Superviser d'autres équipes…"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          LIBELLES_STATUT[u.statut]?.classe || ""
                        }`}
                      >
                        {LIBELLES_STATUT[u.statut]?.label || u.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          u.aUnMotDePasse
                            ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                            : "bg-slate-100 text-slate-500 border-slate-300"
                        }`}
                      >
                        {u.aUnMotDePasse ? "Mot de passe défini" : "Lien magique seul"}
                      </span>
                      <button
                        onClick={() => {
                          setErreurMotDePasse(null);
                          setMotDePasseConfirme(null);
                          setEditionMotDePasse({ id: u.id, valeur: "" });
                        }}
                        className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {u.aUnMotDePasse ? "Changer" : "Définir"}
                      </button>
                      {u.statut === "valide" && (
                        <button
                          onClick={() => renvoyerLien(u.id)}
                          disabled={renvoiEnCours === u.id}
                          title="Renvoyer le mail avec le lien de connexion"
                          className="ml-2 text-xs text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-40"
                        >
                          {renvoiEnCours === u.id ? "Envoi…" : "Renvoyer le lien"}
                        </button>
                      )}
                      {u.statut === "valide" && (
                        <button
                          onClick={() => (mailOuvert?.id === u.id ? setMailOuvert(null) : ouvrirMail(u))}
                          title="Boîte mail personnelle — utilisable à la place de la boîte générale pour envoyer un mail depuis une fiche"
                          className={`ml-2 text-xs hover:underline ${
                            u.mail?.configuree ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {mailOuvert?.id === u.id ? "Fermer" : u.mail?.configuree ? "Boîte perso ✓" : "Boîte perso…"}
                        </button>
                      )}
                      {renvoiResultat[u.id] && (
                        <p
                          className={`text-[11px] mt-1 ${
                            renvoiResultat[u.id].ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {renvoiResultat[u.id].message}
                          {!renvoiResultat[u.id].ok && " — utilisez plutôt le mot de passe temporaire ci-contre."}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">{formatDate(u.dateCreation)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.statut !== "valide" && (
                        <button
                          onClick={() => valider(u.id, "agent")}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline mr-3"
                        >
                          Valider
                        </button>
                      )}
                      {/* Changements de rôle masqués sur sa propre ligne : le serveur les
                          refuse de toute façon (voir POST .../valider) — un admin qui se
                          rétrograderait lui-même pourrait se retrouver verrouillé hors de
                          cette page s'il était le seul admin. */}
                      {u.statut === "valide" && u.id !== moi?.id && (
                        <>
                          {u.role === "agent" && (
                            <button
                              onClick={() => valider(u.id, "superviseur")}
                              title="Peut prendre en charge les leads des agents (Clients Potentiels)"
                              className="text-xs text-violet-700 dark:text-violet-300 hover:underline mr-3"
                            >
                              Passer superviseur
                            </button>
                          )}
                          {u.role === "agent" && (
                            <button
                              onClick={() => valider(u.id, "manager")}
                              title="Voit toutes les fiches de son équipe (bureau) — à lui attribuer une équipe ci-contre"
                              className="text-xs text-teal-700 dark:text-teal-300 hover:underline mr-3"
                            >
                              Passer manager
                            </button>
                          )}
                          {u.role !== "agent" && (
                            <button
                              onClick={() => valider(u.id, "agent")}
                              title="Retire tous les droits élevés (superviseur/admin/super-admin) — redevient un agent standard"
                              className="text-xs text-slate-600 dark:text-slate-300 hover:underline mr-3"
                            >
                              Repasser agent
                            </button>
                          )}
                          {u.role !== "admin" && u.role !== "super_admin" && (
                            <button
                              onClick={() => valider(u.id, "admin")}
                              className="text-xs text-marine-700 dark:text-marine-300 hover:underline mr-3"
                            >
                              Passer admin
                            </button>
                          )}
                          {u.role !== "super_admin" && (
                            <button
                              onClick={() => valider(u.id, "super_admin")}
                              title="Débloque l'édition de l'argumentaire AGEFIPH, du script de vente et des modèles de mails"
                              className="text-xs text-amber-700 dark:text-amber-400 hover:underline mr-3"
                            >
                              Passer super-admin
                            </button>
                          )}
                        </>
                      )}
                      {u.statut !== "refuse" && (
                        <button
                          onClick={() => refuser(u.id)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline mr-3"
                        >
                          Refuser
                        </button>
                      )}
                      <button
                        onClick={() => supprimer(u.id, u.email)}
                        title={`Supprimer définitivement le compte ${u.email}`}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  {equipesSuperviseesOuvert === u.id && (
                    <tr key={`${u.id}-equipes-supervisees`} className="bg-slate-50 dark:bg-slate-900">
                      <td colSpan={7} className="px-4 py-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                          En plus de sa propre équipe ({equipes.find((e) => e.id === u.equipeId)?.nom || "aucune pour l'instant"}),
                          {" "}{u.prenom || u.email} verra aussi toutes les fiches des équipes cochées ci-dessous — chaque
                          fiche reste identifiée par son équipe d'origine, rien n'est mélangé.
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {equipes
                            .filter((e) => e.id !== u.equipeId)
                            .map((e) => (
                              <label key={e.id} className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                                <input
                                  type="checkbox"
                                  checked={(u.equipesSupervisees || []).includes(e.id)}
                                  disabled={enregistrementEquipesSupervisees}
                                  onChange={() => basculerEquipeSupervisee(u, e.id)}
                                />
                                {e.nom}
                              </label>
                            ))}
                          {equipes.length <= 1 && (
                            <span className="text-sm text-slate-400 dark:text-slate-500">
                              Aucune autre équipe à superviser pour l'instant.
                            </span>
                          )}
                        </div>
                        {erreurEquipesSupervisees && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-2">{erreurEquipesSupervisees}</p>
                        )}
                      </td>
                    </tr>
                  )}
                  {editionMotDePasse?.id === u.id && (
                    <tr key={`${u.id}-mdp`} className="bg-slate-50 dark:bg-slate-900">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Nouveau mot de passe pour {u.email} :
                          </span>
                          <input
                            type="text"
                            autoComplete="new-password"
                            autoFocus
                            placeholder="Au moins 8 caractères"
                            value={editionMotDePasse.valeur}
                            onChange={(e) => setEditionMotDePasse({ id: u.id, valeur: e.target.value })}
                            className="w-56 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setEditionMotDePasse({ id: u.id, valeur: genererMotDePasseAleatoire() })}
                            title="Générer un mot de passe temporaire aléatoire"
                            className="text-xs text-marine-700 dark:text-marine-300 hover:underline"
                          >
                            Générer
                          </button>
                          <button
                            onClick={() => enregistrerMotDePasse(u.id)}
                            disabled={enregistrementMotDePasse || editionMotDePasse.valeur.trim().length < 8}
                            className="rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 text-white dark:text-marine-900 text-xs font-medium px-3 py-1.5 disabled:opacity-40"
                          >
                            Enregistrer
                          </button>
                          {u.aUnMotDePasse && (
                            <button
                              onClick={() => retirerMotDePasse(u.id)}
                              disabled={enregistrementMotDePasse}
                              className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-40"
                            >
                              Retirer le mot de passe (revenir au lien magique)
                            </button>
                          )}
                          <button
                            onClick={() => setEditionMotDePasse(null)}
                            className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                          >
                            Annuler
                          </button>
                        </div>
                        {erreurMotDePasse && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{erreurMotDePasse}</p>}
                      </td>
                    </tr>
                  )}
                  {motDePasseConfirme?.id === u.id && (
                    <tr key={`${u.id}-mdp-confirme`} className="bg-emerald-50 dark:bg-emerald-950/30">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                            Mot de passe enregistré pour {u.email} — communiquez-le maintenant :
                          </span>
                          <code className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-mono text-slate-800 dark:text-slate-100 select-all">
                            {motDePasseConfirme.valeur}
                          </code>
                          <button
                            onClick={copierMotDePasseConfirme}
                            className="text-xs text-marine-700 dark:text-marine-300 hover:underline"
                          >
                            {motDePasseConfirme.copie ? "Copié !" : "Copier"}
                          </button>
                          <button
                            onClick={() => setMotDePasseConfirme(null)}
                            className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                          >
                            Fermer
                          </button>
                        </div>
                        <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1.5">
                          Il ne sera plus jamais affiché ni récupérable ensuite (seul un hash est conservé) — notez-le ou copiez-le avant de fermer.
                        </p>
                      </td>
                    </tr>
                  )}
                  {mailOuvert?.id === u.id && (
                    <tr key={`${u.id}-mail`} className="bg-slate-50 dark:bg-slate-900">
                      <td colSpan={7} className="px-4 py-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          Boîte mail personnelle de {u.prenom || u.email}, utilisable à la place de la boîte générale au
                          moment d'envoyer un mail depuis une fiche (sélecteur « Depuis » dans la boîte mail de la
                          fiche) — par exemple pour qu'un manager reprenne un dossier en direct : à partir de son
                          premier envoi, les réponses du client arrivent dans CETTE boîte, plus dans la boîte générale.
                          Mêmes champs qu'une boîte d'équipe : renseignez seulement <b>From</b> pour un simple alias
                          OVH (réponses toujours dans la boîte générale), ou en plus l'hôte/l'identifiant/le mot de
                          passe IMAP+SMTP pour une vraie boîte séparée (réponses relevées directement ici).
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <label className="block text-xs text-slate-500 dark:text-slate-400">
                            From (adresse affichée)
                            <input
                              type="email"
                              placeholder="pierre.bernard@oeth-fiph.fr"
                              value={mailOuvert.champs.from}
                              onChange={(e) => setMailOuvert((m) => ({ ...m, champs: { ...m.champs, from: e.target.value } }))}
                              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="block text-xs text-slate-500 dark:text-slate-400">
                            Répondre à (optionnel)
                            <input
                              type="email"
                              placeholder="= From si vide"
                              value={mailOuvert.champs.replyTo}
                              onChange={(e) => setMailOuvert((m) => ({ ...m, champs: { ...m.champs, replyTo: e.target.value } }))}
                              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="block text-xs text-slate-500 dark:text-slate-400">
                            Identifiant de boîte (SMTP/IMAP)
                            <input
                              type="text"
                              placeholder="pierre.bernard@oeth-fiph.fr"
                              value={mailOuvert.champs.user}
                              onChange={(e) => setMailOuvert((m) => ({ ...m, champs: { ...m.champs, user: e.target.value } }))}
                              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="block text-xs text-slate-500 dark:text-slate-400">
                            Mot de passe de la boîte
                            <input
                              type="password"
                              autoComplete="new-password"
                              placeholder={u.mail?.configuree ? "Laisser vide = inchangé" : ""}
                              value={mailOuvert.champs.password}
                              onChange={(e) => setMailOuvert((m) => ({ ...m, champs: { ...m.champs, password: e.target.value } }))}
                              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="block text-xs text-slate-500 dark:text-slate-400">
                            Hôte SMTP (envoi)
                            <input
                              type="text"
                              placeholder="pro1.mail.ovh.net"
                              value={mailOuvert.champs.smtpHost}
                              onChange={(e) => setMailOuvert((m) => ({ ...m, champs: { ...m.champs, smtpHost: e.target.value } }))}
                              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="block text-xs text-slate-500 dark:text-slate-400">
                            Port SMTP
                            <input
                              type="number"
                              placeholder="587"
                              value={mailOuvert.champs.smtpPort}
                              onChange={(e) => setMailOuvert((m) => ({ ...m, champs: { ...m.champs, smtpPort: e.target.value } }))}
                              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="block text-xs text-slate-500 dark:text-slate-400">
                            Hôte IMAP (réception)
                            <input
                              type="text"
                              placeholder="pro1.mail.ovh.net"
                              value={mailOuvert.champs.imapHost}
                              onChange={(e) => setMailOuvert((m) => ({ ...m, champs: { ...m.champs, imapHost: e.target.value } }))}
                              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="block text-xs text-slate-500 dark:text-slate-400">
                            Port IMAP
                            <input
                              type="number"
                              placeholder="993"
                              value={mailOuvert.champs.imapPort}
                              onChange={(e) => setMailOuvert((m) => ({ ...m, champs: { ...m.champs, imapPort: e.target.value } }))}
                              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
                            />
                          </label>
                        </div>
                        {erreurMail && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{erreurMail}</p>}
                        <div className="flex items-center gap-3 mt-3">
                          <button
                            onClick={() => enregistrerMail(u.id)}
                            disabled={enregistrementMail}
                            className="rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 text-white dark:text-marine-900 text-xs font-medium px-3 py-1.5 disabled:opacity-40"
                          >
                            Enregistrer
                          </button>
                          {u.mail?.configuree && (
                            <button
                              onClick={() => retirerMail(u.id)}
                              disabled={enregistrementMail}
                              className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-40"
                            >
                              Retirer la boîte personnelle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {utilisateursFiltres.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                    {utilisateurs.length === 0
                      ? "Aucun compte pour l'instant."
                      : `Aucun compte ne correspond à « ${recherche.trim()} ».`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
