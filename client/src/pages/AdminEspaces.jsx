import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { COULEURS_ESPACE } from "../couleursEspace.js";

// Espaces de travail (OETH, CEE, et tout autre projet confié au pôle) : voir
// server/src/espaces.js. Créer un espace ici ouvre immédiatement sa propre
// porte d'entrée sur /<identifiant> (voir Connexion.jsx et CrmApp.jsx) —
// aucun développeur ni nouveau déploiement nécessaire pour démarrer une
// nouvelle ligne d'activité.
export default function AdminEspaces() {
  const [espaces, setEspaces] = useState(null);
  const [erreur, setErreur] = useState(null);

  function charger() {
    api
      .listerEspacesAdmin()
      .then(setEspaces)
      .catch((e) => setErreur(e.message));
  }

  useEffect(() => {
    charger();
  }, []);

  const [id, setId] = useState("");
  const [nom, setNom] = useState("");
  const [court, setCourt] = useState("");
  const [description, setDescription] = useState("");
  const [couleur, setCouleur] = useState("marine");
  const [creation, setCreation] = useState(false);
  const [erreurCreation, setErreurCreation] = useState(null);
  const [porteCreee, setPorteCreee] = useState(null);

  async function creer(ev) {
    ev.preventDefault();
    if (!id.trim() || !nom.trim()) return;
    setCreation(true);
    setErreurCreation(null);
    setPorteCreee(null);
    try {
      const espace = await api.creerEspace({
        id: id.trim(),
        nom: nom.trim(),
        court: court.trim(),
        description: description.trim(),
        couleur,
      });
      setPorteCreee(`${window.location.origin}/${espace.id}`);
      setId("");
      setNom("");
      setCourt("");
      setDescription("");
      setCouleur("marine");
      charger();
    } catch (e) {
      setErreurCreation(e.message);
    } finally {
      setCreation(false);
    }
  }

  // Édition en ligne d'un espace existant (nom/court/description/couleur/actif
  // — jamais l'identifiant, qui est déjà la porte d'entrée et la clé des
  // fiches de cet espace : le renommer les orphelinerait).
  const [editionOuverte, setEditionOuverte] = useState(null); // { id, champs }
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurEdition, setErreurEdition] = useState(null);

  function ouvrirEdition(esp) {
    setErreurEdition(null);
    setEditionOuverte({
      id: esp.id,
      champs: { nom: esp.nom, court: esp.court || "", description: esp.description || "", couleur: esp.couleur || "marine" },
    });
  }

  async function enregistrerEdition() {
    setEnregistrement(true);
    setErreurEdition(null);
    try {
      await api.modifierEspace(editionOuverte.id, editionOuverte.champs);
      setEditionOuverte(null);
      charger();
    } catch (e) {
      setErreurEdition(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  async function basculerActif(esp) {
    try {
      await api.modifierEspace(esp.id, { actif: !esp.actif });
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
      <div className="p-6 max-w-[1100px] mx-auto">
        <Link to="/" className="text-sm text-marine-700 dark:text-marine-300 hover:underline">
          &larr; Retour au tableau de bord
        </Link>
        <nav className="flex items-center gap-3 mt-2 text-xs">
          <Link to="/admin/utilisateurs" className="text-slate-400 dark:text-slate-500 hover:text-marine-700 dark:hover:text-marine-300 hover:underline">
            Gestion des accès
          </Link>
          <Link to="/admin/equipes" className="text-slate-400 dark:text-slate-500 hover:text-marine-700 dark:hover:text-marine-300 hover:underline">
            Équipes
          </Link>
          <span className="font-semibold text-slate-600 dark:text-slate-300">Espaces</span>
        </nav>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-3 mb-1">Gestion des espaces</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
          Un espace = une ligne d'activité (OETH, CEE, et les suivantes) avec sa propre porte d'entrée, ses propres
          fiches et son propre sélecteur dans le CRM. Créer un espace ici n'a besoin d'aucun développeur ni nouveau
          déploiement — tout reste la même application, la même base de données.
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
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">+ Créer un espace</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Identifiant (minuscules, chiffres, tirets)
              <input
                type="text"
                required
                placeholder="ex: solaire-residentiel"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="mt-1 w-56 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Nom complet
              <input
                type="text"
                required
                placeholder="ex: Panneaux solaires résidentiels"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="mt-1 w-56 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Nom court (affiché sur téléphone)
              <input
                type="text"
                placeholder="= nom complet si vide"
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                className="mt-1 w-40 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Description (affichée dans le sélecteur d'espace)
            <input
              type="text"
              placeholder="Une phrase pour présenter cette ligne d'activité."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </label>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Couleur</p>
            <div className="flex items-center gap-2">
              {Object.keys(COULEURS_ESPACE).map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setCouleur(c)}
                  className={`w-7 h-7 rounded-full ${COULEURS_ESPACE[c]} ${
                    couleur === c ? "ring-2 ring-offset-2 ring-slate-800 dark:ring-slate-200" : ""
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            L'identifiant devient l'adresse de la porte d'entrée dédiée à cet espace : sera accessible sur{" "}
            <code>/{id.trim() || "<identifiant>"}</code>.
          </p>
          <button
            type="submit"
            disabled={creation || !id.trim() || !nom.trim()}
            className="rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 text-white dark:text-marine-900 text-sm font-medium px-4 py-2 disabled:opacity-40"
          >
            {creation ? "Création…" : "Créer l'espace"}
          </button>
          {erreurCreation && <p className="text-sm text-red-600 dark:text-red-400">{erreurCreation}</p>}
          {porteCreee && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3">
              Porte d'accès créée : <a href={porteCreee} className="underline">{porteCreee}</a>
            </p>
          )}
        </form>

        {!espaces ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Chargement…</p>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Espace</th>
                  <th className="px-4 py-3 text-left">Identifiant / porte</th>
                  <th className="px-4 py-3 text-left">Couleur</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {espaces.map((esp) => (
                  <Fragment key={esp.id}>
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                        {esp.nom}
                        {esp.description && (
                          <span className="block text-xs font-normal text-slate-400 dark:text-slate-500">{esp.description}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <code>/{esp.id}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block w-4 h-4 rounded-full ${COULEURS_ESPACE[esp.couleur] || COULEURS_ESPACE.marine}`} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => basculerActif(esp)}
                          className={`text-xs font-medium hover:underline ${
                            esp.actif !== false ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          {esp.actif !== false ? "Actif" : "Désactivé"}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => (editionOuverte?.id === esp.id ? setEditionOuverte(null) : ouvrirEdition(esp))}
                          className="text-xs text-marine-700 dark:text-marine-300 hover:underline"
                        >
                          {editionOuverte?.id === esp.id ? "Fermer" : "Modifier…"}
                        </button>
                      </td>
                    </tr>
                    {editionOuverte?.id === esp.id && (
                      <tr className="bg-slate-50 dark:bg-slate-900">
                        <td colSpan={5} className="px-4 py-4">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            L'identifiant <code>/{esp.id}</code> ne peut pas être changé : les fiches de cet espace et sa
                            porte d'entrée le référencent déjà.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="block text-xs text-slate-500 dark:text-slate-400">
                              Nom complet
                              <input
                                type="text"
                                value={editionOuverte.champs.nom}
                                onChange={(e) => setEditionOuverte((ed) => ({ ...ed, champs: { ...ed.champs, nom: e.target.value } }))}
                                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
                              />
                            </label>
                            <label className="block text-xs text-slate-500 dark:text-slate-400">
                              Nom court
                              <input
                                type="text"
                                value={editionOuverte.champs.court}
                                onChange={(e) => setEditionOuverte((ed) => ({ ...ed, champs: { ...ed.champs, court: e.target.value } }))}
                                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
                              />
                            </label>
                            <label className="block text-xs text-slate-500 dark:text-slate-400">
                              Description
                              <input
                                type="text"
                                value={editionOuverte.champs.description}
                                onChange={(e) => setEditionOuverte((ed) => ({ ...ed, champs: { ...ed.champs, description: e.target.value } }))}
                                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
                              />
                            </label>
                          </div>
                          <div className="mt-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Couleur</p>
                            <div className="flex items-center gap-2">
                              {Object.keys(COULEURS_ESPACE).map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  title={c}
                                  onClick={() => setEditionOuverte((ed) => ({ ...ed, champs: { ...ed.champs, couleur: c } }))}
                                  className={`w-6 h-6 rounded-full ${COULEURS_ESPACE[c]} ${
                                    editionOuverte.champs.couleur === c ? "ring-2 ring-offset-2 ring-slate-800 dark:ring-slate-200" : ""
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          {erreurEdition && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{erreurEdition}</p>}
                          <div className="flex items-center gap-3 mt-3">
                            <button
                              onClick={enregistrerEdition}
                              disabled={enregistrement}
                              className="rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 text-white dark:text-marine-900 text-xs font-medium px-3 py-1.5 disabled:opacity-40"
                            >
                              Enregistrer
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {espaces.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                      Aucun espace pour l'instant.
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
