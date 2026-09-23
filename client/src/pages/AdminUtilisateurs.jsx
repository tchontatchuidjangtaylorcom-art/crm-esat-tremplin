import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { formatDate } from "../constants.js";

const LIBELLES_STATUT = {
  en_attente: { label: "En attente", classe: "bg-amber-100 text-amber-700 border-amber-300" },
  valide: { label: "Validé", classe: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  refuse: { label: "Refusé", classe: "bg-red-100 text-red-700 border-red-300" },
};

// Validation des comptes agents par un administrateur — l'API sous-jacente
// (exigerAdmin) refuse déjà l'accès à qui n'est pas admin ; cette page se
// contente d'afficher l'erreur renvoyée le cas échéant.
export default function AdminUtilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState(null);
  const [erreur, setErreur] = useState(null);

  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [role, setRole] = useState("agent");
  const [motDePasse, setMotDePasse] = useState("");
  const [creation, setCreation] = useState(false);
  const [erreurCreation, setErreurCreation] = useState(null);
  const [confirmationCreation, setConfirmationCreation] = useState(null);

  // Édition inline du mot de passe d'un compte existant : { id, valeur }.
  const [editionMotDePasse, setEditionMotDePasse] = useState(null);
  const [erreurMotDePasse, setErreurMotDePasse] = useState(null);
  const [enregistrementMotDePasse, setEnregistrementMotDePasse] = useState(false);

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
    if (!email.trim()) return;
    setCreation(true);
    setErreurCreation(null);
    setConfirmationCreation(null);
    try {
      const { utilisateur, mailEnvoye } = await api.creerUtilisateur({
        email: email.trim(),
        prenom: prenom.trim(),
        role,
        motDePasse: motDePasse.trim(),
      });
      setConfirmationCreation(
        mailEnvoye
          ? `Accès créé pour ${utilisateur.email} — un mail avec les instructions de connexion lui a été envoyé.`
          : `Accès créé pour ${utilisateur.email}. Envoi automatique du mail indisponible : communiquez-lui l'adresse du CRM pour qu'il se connecte.`
      );
      setEmail("");
      setPrenom("");
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
    setEnregistrementMotDePasse(true);
    setErreurMotDePasse(null);
    try {
      await api.definirMotDePasse(id, editionMotDePasse.valeur.trim());
      setEditionMotDePasse(null);
      charger();
    } catch (e) {
      setErreurMotDePasse(e.message);
    } finally {
      setEnregistrementMotDePasse(false);
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

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        &larr; Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-3 mb-6">Gestion des accès</h1>

      {erreur && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          {erreur}
        </div>
      )}

      <form
        onSubmit={creerAcces}
        className="mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-4 space-y-3"
      >
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">+ Créer un accès agent</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Le compte est créé directement validé — l'agent pourra se connecter avec cette adresse, par lien de
          connexion par mail, ou directement par mot de passe si vous en définissez un ci-dessous. Limité aux
          dossiers qui lui seront assignés.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            E-mail de l'agent
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
            Prénom (optionnel)
            <input
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              className="mt-1 w-40 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
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
            disabled={creation || !email.trim() || (motDePasse.trim().length > 0 && motDePasse.trim().length < 8)}
            className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium px-4 py-2 disabled:opacity-40"
          >
            {creation ? "Création…" : "Créer l'accès"}
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
                          setEditionMotDePasse({ id: u.id, valeur: "" });
                        }}
                        className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {u.aUnMotDePasse ? "Changer" : "Définir"}
                      </button>
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
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline mr-3"
                        >
                          Passer admin
                        </button>
                      )}
                      {u.statut !== "refuse" && (
                        <button onClick={() => refuser(u.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                          Refuser
                        </button>
                      )}
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
                            type="password"
                            autoComplete="new-password"
                            autoFocus
                            placeholder="Au moins 8 caractères"
                            value={editionMotDePasse.valeur}
                            onChange={(e) => setEditionMotDePasse({ id: u.id, valeur: e.target.value })}
                            className="w-56 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm"
                          />
                          <button
                            onClick={() => enregistrerMotDePasse(u.id)}
                            disabled={enregistrementMotDePasse || editionMotDePasse.valeur.trim().length < 8}
                            className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium px-3 py-1.5 disabled:opacity-40"
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
  );
}
