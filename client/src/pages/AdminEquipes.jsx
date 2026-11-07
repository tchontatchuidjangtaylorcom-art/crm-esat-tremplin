import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

const CHAMPS_MAIL_VIDES = { smtpHost: "", smtpPort: "", imapHost: "", imapPort: "", user: "", password: "", from: "", replyTo: "" };

// Équipes (bureaux) — Cameroun, Paris, et les suivants : chaque équipe a son
// propre manager et son propre stock de fiches (voir server/src/equipes.js).
// La boîte mail d'une équipe est optionnelle et à deux niveaux :
//  - Alias seulement (From / Répondre à) : les mails partent toujours via la
//    boîte partagée du pôle, mais affichent une adresse personnalisée au
//    client (ex: paris@oeth-fiph.fr créé comme ALIAS côté OVH sur la boîte
//    partagée). Les réponses du client arrivent dans la boîte partagée.
//  - Vraie boîte séparée : en plus, un hôte/identifiant/mot de passe IMAP et
//    SMTP propres (la vraie boîte OVH de cette équipe) — les réponses du
//    client arrivent alors directement dans CETTE boîte, relevée séparément.
export default function AdminEquipes() {
  const [equipes, setEquipes] = useState(null);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [espaces, setEspaces] = useState([]);
  const [erreur, setErreur] = useState(null);

  function charger() {
    api
      .listEquipes()
      .then(setEquipes)
      .catch((e) => setErreur(e.message));
  }

  useEffect(() => {
    charger();
    api.listUtilisateurs().then(setUtilisateurs).catch(() => {});
    fetch("/api/espaces/tous")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEspaces)
      .catch(() => {});
  }, []);

  const [nom, setNom] = useState("");
  const [espace, setEspace] = useState("oeth");
  const [managerId, setManagerId] = useState("");
  const [creation, setCreation] = useState(false);
  const [erreurCreation, setErreurCreation] = useState(null);

  async function creer(ev) {
    ev.preventDefault();
    if (!nom.trim()) return;
    setCreation(true);
    setErreurCreation(null);
    try {
      await api.creerEquipe({ nom: nom.trim(), espace, managerId: managerId || null });
      setNom("");
      setManagerId("");
      charger();
    } catch (e) {
      setErreurCreation(e.message);
    } finally {
      setCreation(false);
    }
  }

  async function modifier(id, patch) {
    try {
      await api.modifierEquipe(id, patch);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  // Formulaire boîte mail ouvert pour une équipe : { id, champs }.
  const [mailOuvert, setMailOuvert] = useState(null);
  const [enregistrementMail, setEnregistrementMail] = useState(false);
  const [erreurMail, setErreurMail] = useState(null);

  function ouvrirMail(equipe) {
    setErreurMail(null);
    setMailOuvert({
      id: equipe.id,
      champs: {
        ...CHAMPS_MAIL_VIDES,
        user: equipe.mail?.user || "",
        from: equipe.mail?.from || "",
        replyTo: equipe.mail?.replyTo || "",
        smtpHost: equipe.mail?.smtpHost || "",
        smtpPort: equipe.mail?.smtpPort ? String(equipe.mail.smtpPort) : "",
        imapHost: equipe.mail?.imapHost || "",
        imapPort: equipe.mail?.imapPort ? String(equipe.mail.imapPort) : "",
        // Le mot de passe n'est jamais renvoyé par l'API (voir equipes.js) —
        // laissé vide ici, un champ vide à l'enregistrement garde celui déjà
        // enregistré côté serveur plutôt que de l'effacer.
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
      await api.definirMailEquipe(id, {
        smtpHost: c.smtpHost.trim(),
        smtpPort: c.smtpPort.trim() ? Number(c.smtpPort) : null,
        imapHost: c.imapHost.trim(),
        imapPort: c.imapPort.trim() ? Number(c.imapPort) : null,
        user: c.user.trim(),
        password: c.password, // laissé vide = inchangé côté serveur si l'équipe en a déjà un (voir note sous le formulaire)
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
    if (!window.confirm("Retirer la boîte propre de cette équipe ? Elle retombera sur la boîte partagée du pôle.")) return;
    setEnregistrementMail(true);
    try {
      await api.definirMailEquipe(id, null);
      setMailOuvert(null);
      charger();
    } catch (e) {
      setErreurMail(e.message);
    } finally {
      setEnregistrementMail(false);
    }
  }

  const nomEspace = (id) => espaces.find((e) => e.id === id)?.nom || id;
  const nomUtilisateur = (id) => {
    const u = utilisateurs.find((x) => x.id === id);
    return u ? u.prenom || u.email : null;
  };
  const managersDisponibles = utilisateurs.filter((u) => u.statut === "valide");

  return (
    <div className="min-h-screen">
      <div className="bandeau-tricolore">
        <span className="bg-marine-800" />
        <span className="bg-white" />
        <span className="bg-red-700" />
      </div>
      <div className="p-6 max-w-[1300px] mx-auto">
        <Link to="/" className="text-sm text-marine-700 dark:text-marine-300 hover:underline">
          &larr; Retour au tableau de bord
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-3 mb-1">Gestion des équipes</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
          Un bureau (Cameroun, Paris…) = une équipe. Son manager voit toutes ses fiches, ses agents n'y voient que les
          leurs. Attribuez l'équipe de chaque compte depuis la page « Gestion des accès ».
        </p>

        {erreur && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
            {erreur}
          </div>
        )}

        <form
          onSubmit={creer}
          className="mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-4 space-y-3"
        >
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">+ Nouvelle équipe</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Nom
              <input
                type="text"
                required
                placeholder="Bureau de Paris"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="mt-1 w-56 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Espace (ligne d'activité)
              <select
                value={espace}
                onChange={(e) => setEspace(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              >
                {espaces.length ? (
                  espaces.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom}
                    </option>
                  ))
                ) : (
                  <option value="oeth">OETH</option>
                )}
              </select>
            </label>
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Manager (optionnel)
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              >
                <option value="">À définir plus tard</option>
                {managersDisponibles.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.prenom || u.email}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={creation || !nom.trim()}
              className="rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 text-white dark:text-marine-900 text-sm font-medium px-4 py-2 disabled:opacity-40"
            >
              {creation ? "Création…" : "Créer l'équipe"}
            </button>
          </div>
          {erreurCreation && <p className="text-sm text-red-600 dark:text-red-400">{erreurCreation}</p>}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Le manager doit aussi avoir le rôle « Manager » — à faire depuis « Gestion des accès ». Le rôle seul ne
            lui donne accès qu'à sa propre équipe : il doit y être lui-même rattaché.
          </p>
        </form>

        {!equipes ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Chargement…</p>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Équipe</th>
                  <th className="px-4 py-3 text-left">Espace</th>
                  <th className="px-4 py-3 text-left">Manager</th>
                  <th className="px-4 py-3 text-left">Boîte mail</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {equipes.map((eq) => (
                  <Fragment key={eq.id}>
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{eq.nom}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{nomEspace(eq.espace)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <select
                          value={eq.managerId || ""}
                          onChange={(e) => modifier(eq.id, { managerId: e.target.value || null })}
                          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-2 py-1 text-xs"
                        >
                          <option value="">Aucun</option>
                          {managersDisponibles.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.prenom || u.email}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            eq.mail?.configuree
                              ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                              : "bg-slate-100 text-slate-500 border-slate-300"
                          }`}
                        >
                          {eq.mail?.configuree ? `Propre (${eq.mail.from || eq.mail.user})` : "Boîte partagée"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => modifier(eq.id, { actif: !eq.actif })}
                          className={`text-xs font-medium hover:underline ${
                            eq.actif ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          {eq.actif ? "Active" : "Désactivée"}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => (mailOuvert?.id === eq.id ? setMailOuvert(null) : ouvrirMail(eq))}
                          className="text-xs text-marine-700 dark:text-marine-300 hover:underline"
                        >
                          {mailOuvert?.id === eq.id ? "Fermer" : "Boîte mail…"}
                        </button>
                      </td>
                    </tr>
                    {mailOuvert?.id === eq.id && (
                      <tr className="bg-slate-50 dark:bg-slate-900">
                        <td colSpan={6} className="px-4 py-4">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            Deux usages possibles, aux mêmes champs : renseignez seulement <b>From</b> (et éventuellement
                            Répondre à) pour un simple ALIAS OVH sur la boîte partagée (ex : {nomUtilisateur(eq.managerId) || "le manager"}
                            &nbsp;garde une adresse personnalisée, mais les réponses du client arrivent dans la boîte du pôle) ;
                            renseignez en plus l'hôte/l'identifiant/le mot de passe IMAP+SMTP pour une VRAIE boîte séparée
                            (les réponses du client arrivent alors directement dans cette boîte-là, relevée séparément).
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <label className="block text-xs text-slate-500 dark:text-slate-400">
                              From (adresse affichée)
                              <input
                                type="email"
                                placeholder="paris@oeth-fiph.fr"
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
                                placeholder="paris@oeth-fiph.fr"
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
                                placeholder={eq.mail?.configuree ? "Laisser vide = inchangé" : ""}
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
                              onClick={() => enregistrerMail(eq.id)}
                              disabled={enregistrementMail}
                              className="rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 text-white dark:text-marine-900 text-xs font-medium px-3 py-1.5 disabled:opacity-40"
                            >
                              Enregistrer
                            </button>
                            {eq.mail?.configuree && (
                              <button
                                onClick={() => retirerMail(eq.id)}
                                disabled={enregistrementMail}
                                className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-40"
                              >
                                Retirer la boîte propre (revenir au partagé)
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {equipes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                      Aucune équipe pour l'instant.
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
