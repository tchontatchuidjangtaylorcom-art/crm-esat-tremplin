import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { formatDate } from "../constants.js";
import { libelleRole } from "../roles.js";

const LIBELLES_STATUT_COMPTE = {
  en_attente: { label: "En attente", classe: "bg-amber-100 text-amber-700 border-amber-300" },
  valide: { label: "Validé", classe: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  refuse: { label: "Refusé", classe: "bg-red-100 text-red-700 border-red-300" },
};

const LIBELLE_STATUT_CAMPAGNE = {
  en_cours: { label: "En cours", classe: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  en_pause: { label: "En pause", classe: "bg-amber-100 text-amber-800 border-amber-300" },
  terminee: { label: "Terminée", classe: "bg-slate-100 text-slate-700 border-slate-300" },
  annulee: { label: "Annulée", classe: "bg-rose-100 text-rose-700 border-rose-300" },
};

const champInput =
  "mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm";

// Version restreinte, pour un manager, de "Gestion des accès" + "KPIs
// équipe" + "Campagnes" : seulement sa propre équipe (voir estManager,
// server/src/equipes.js) — jamais les autres équipes, jamais la promotion ou
// la suppression de comptes (demande du fondateur 2026-11-10). Le serveur
// revalide de toute façon le rôle manager et l'equipeId à chaque appel.
export default function MonEquipe() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(null);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [creation, setCreation] = useState(false);
  const [erreurCreation, setErreurCreation] = useState(null);
  const [confirmationCreation, setConfirmationCreation] = useState(null);

  const [campagnes, setCampagnes] = useState(null);
  const [erreurCampagnes, setErreurCampagnes] = useState(null);

  function charger() {
    api
      .getMonEquipe()
      .then(setDonnees)
      .catch((e) => setErreur(e.message));
  }

  useEffect(() => {
    charger();
    api
      .getCampagnesMonEquipe()
      .then((d) => setCampagnes(d.campagnes))
      .catch((e) => setErreurCampagnes(e.message));
  }, []);

  async function ajouterMembre(ev) {
    ev.preventDefault();
    if (!prenom.trim() || !nom.trim() || !email.trim()) return;
    setCreation(true);
    setErreurCreation(null);
    setConfirmationCreation(null);
    try {
      const { utilisateur, mailEnvoye, motDePasseProvisoire } = await api.creerMembreMonEquipe({
        prenom: prenom.trim(),
        nom: nom.trim(),
        email: email.trim(),
        telephone: telephone.trim(),
      });
      setConfirmationCreation(
        mailEnvoye
          ? `Compte créé pour ${utilisateur.email} — un mail avec le lien de connexion et le mot de passe provisoire (${motDePasseProvisoire}) lui a été envoyé.`
          : `Compte créé pour ${utilisateur.email}. Envoi automatique du mail indisponible : communiquez-lui l'adresse du CRM et le mot de passe provisoire : ${motDePasseProvisoire}`
      );
      setPrenom("");
      setNom("");
      setEmail("");
      setTelephone("");
      charger();
    } catch (e) {
      setErreurCreation(e.message);
    } finally {
      setCreation(false);
    }
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        &larr; Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-3">
        👥 Mon équipe{donnees?.equipe ? ` — ${donnees.equipe.nom}` : ""}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        Les membres et les campagnes de votre équipe uniquement. Pour les autres réglages (boîte mail de l'équipe, autres
        équipes…), voyez un administrateur.
      </p>

      {erreur && (
        <p className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2">{erreur}</p>
      )}

      {!donnees ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Chargement…</p>
      ) : (
        <>
          <form
            onSubmit={ajouterMembre}
            className="mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-4 space-y-3"
          >
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">+ Ajouter un agent à mon équipe</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Le compte est créé avec le rôle agent, dans votre équipe — la personne reçoit un mail avec un lien de connexion
              et un mot de passe provisoire qu'elle devra remplacer à sa première connexion.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Prénom
                <input type="text" required value={prenom} onChange={(e) => setPrenom(e.target.value)} className={`${champInput} w-36`} />
              </label>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Nom
                <input type="text" required value={nom} onChange={(e) => setNom(e.target.value)} className={`${champInput} w-36`} />
              </label>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                E-mail
                <input
                  type="email"
                  required
                  placeholder="prenom.nom@exemple.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${champInput} w-64`}
                />
              </label>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Téléphone (optionnel)
                <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} className={`${champInput} w-40`} />
              </label>
              <button
                type="submit"
                disabled={creation || !prenom.trim() || !nom.trim() || !email.trim()}
                className="rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 text-white dark:text-marine-900 text-sm font-medium px-4 py-2 disabled:opacity-40"
              >
                {creation ? "Création…" : "Ajouter"}
              </button>
            </div>
            {erreurCreation && <p className="text-sm text-red-600 dark:text-red-400">{erreurCreation}</p>}
            {confirmationCreation && <p className="text-sm text-emerald-600 dark:text-emerald-400">{confirmationCreation}</p>}
          </form>

          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Membres de l'équipe</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto mb-8">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Prénom</th>
                  <th className="px-4 py-3 text-left">Nom</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Rôle</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Depuis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {donnees.membres.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{m.prenom || "-"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{m.nom || "-"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{m.email}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{libelleRole(m.role)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          LIBELLES_STATUT_COMPTE[m.statut]?.classe || ""
                        }`}
                      >
                        {LIBELLES_STATUT_COMPTE[m.statut]?.label || m.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">{formatDate(m.dateCreation)}</td>
                  </tr>
                ))}
                {donnees.membres.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                      Aucun membre pour l'instant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Campagnes de votre équipe</h2>
          {erreurCampagnes && (
            <p className="mb-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2">
              {erreurCampagnes}
            </p>
          )}
          {campagnes === null && !erreurCampagnes && <p className="text-sm text-slate-400 dark:text-slate-500">Chargement…</p>}
          {campagnes && campagnes.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500">Aucune campagne pour votre équipe pour l'instant.</p>
          )}
          {campagnes && campagnes.length > 0 && (
            <div className="space-y-3">
              {campagnes.map((c) => {
                const s = LIBELLE_STATUT_CAMPAGNE[c.statut] || { label: c.statut, classe: "" };
                return (
                  <div key={c.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold mr-2 ${s.classe}`}>
                      {s.label}
                    </span>
                    <strong className="text-slate-800 dark:text-slate-100">{c.nom}</strong>
                    <p className="text-xs text-slate-500 mt-1.5">
                      <strong className="text-emerald-700">{c.envoyes} envoyés</strong> · {c.restants} restants · {c.erreurs} erreurs · {c.ignores} écartés · {c.total} au total
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
