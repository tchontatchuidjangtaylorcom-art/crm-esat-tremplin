import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { formatDate } from "../constants.js";

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
  const [utilisateurs, setUtilisateurs] = useState(null);
  const [erreur, setErreur] = useState(null);

  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
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

  useEffect(() => {
    charger();
  }, []);

  async function creerAcces(ev) {
    ev.preventDefault();
    if (!email.trim() || !prenom.trim() || !nom.trim()) return;
    setCreation(true);
    setErreurCreation(null);
    setConfirmationCreation(null);
    try {
      const { utilisateur, mailEnvoye, entrepriseLieeNom, siretSansCorrespondance } = await api.creerUtilisateur({
        email: email.trim(),
        prenom: prenom.trim(),
        nom: nom.trim(),
        telephone: telephone.trim(),
        siret: siret.trim(),
        role,
        motDePasse: motDePasse.trim(),
      });
      const morceaux = [
        mailEnvoye
          ? `Accès créé pour ${utilisateur.email} — un mail avec les instructions de connexion lui a été envoyé.`
          : `Accès créé pour ${utilisateur.email}. Envoi automatique du mail indisponible : communiquez-lui l'adresse du CRM pour qu'il se connecte.`,
      ];
      if (entrepriseLieeNom) morceaux.push(`Lié à l'entreprise « ${entrepriseLieeNom} » (SIRET reconnu).`);
      else if (siretSansCorrespondance) morceaux.push("SIRET enregistré, mais aucune entreprise correspondante trouvée dans le CRM.");
      setConfirmationCreation(morceaux.join(" "));
      setEmail("");
      setPrenom("");
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
          Le compte est créé directement validé — la personne pourra se connecter avec cette adresse, par lien de
          connexion par mail (indispensable, voir l'e-mail obligatoire ci-dessous), ou directement par mot de passe si
          vous en définissez un. Limité aux dossiers qui lui seront assignés.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Prénom
            <input
              type="text"
              required
              placeholder="Jean"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              className="mt-1 w-36 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Nom
            <input
              type="text"
              required
              placeholder="Dupont"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="mt-1 w-36 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
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
              <option value="admin">Administrateur</option>
            </select>
          </label>
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Mot de passe (optionnel)
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Laisser vide → lien magique seul"
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
              !prenom.trim() ||
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
              {utilisateurs.map((u) => (
                <Fragment key={u.id}>
                  <tr>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{u.email}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {[u.prenom, u.nom].filter(Boolean).join(" ") || "-"}
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
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.role}</td>
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
                      {u.statut === "valide" && u.role !== "admin" && (
                        <button
                          onClick={() => valider(u.id, "admin")}
                          className="text-xs text-marine-700 dark:text-marine-300 hover:underline mr-3"
                        >
                          Passer admin
                        </button>
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
                </Fragment>
              ))}
              {utilisateurs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                    Aucun compte pour l'instant.
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
