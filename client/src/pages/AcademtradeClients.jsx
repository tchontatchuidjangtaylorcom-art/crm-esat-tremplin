import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { estAdmin } from "../roles.js";
import { api } from "../api.js";

// Vue gestionnaire de compte (espace AcademTrade) : liste des clients, et
// détail d'un client (positions simulées, demandes de retrait à traiter).
// La création directe de compte (en attendant Stripe) reste réservée admin
// côté serveur — masquée ici pour les autres gestionnaires.
export default function AcademtradeClients() {
  const { utilisateur } = useAuth();
  const [clients, setClients] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [clientOuvert, setClientOuvert] = useState(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nouveauCompte, setNouveauCompte] = useState({ email: "", prenom: "", nom: "" });
  const [creation, setCreation] = useState(false);
  const [creationInfo, setCreationInfo] = useState(null);

  function charger() {
    api
      .academtradeClients()
      .then(setClients)
      .catch((e) => setErreur(e.message));
  }

  useEffect(charger, []);

  function ouvrirClient(id) {
    api
      .academtradeClient(id)
      .then(setClientOuvert)
      .catch((e) => setErreur(e.message));
  }

  async function traiterRetrait(retraitId, decision) {
    try {
      await api.academtradeTraiterRetrait(clientOuvert.compte.id, retraitId, decision, "");
      ouvrirClient(clientOuvert.compte.id);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function traiterDocument(type, decision) {
    try {
      await api.academtradeTraiterDocument(clientOuvert.compte.id, type, decision, "");
      ouvrirClient(clientOuvert.compte.id);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function creerCompteTest(ev) {
    ev.preventDefault();
    setCreation(true);
    setCreationInfo(null);
    try {
      const resultat = await api.academtradeCreerClientTest(nouveauCompte);
      setCreationInfo(
        resultat.mailEnvoye
          ? `Compte créé pour ${resultat.compte.email}, lien d'accès envoyé par e-mail.`
          : `Compte créé pour ${resultat.compte.email}. L'envoi du mail n'est pas configuré : transmettez-lui le lien manuellement depuis Mon compte/support.`
      );
      setNouveauCompte({ email: "", prenom: "", nom: "" });
      charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setCreation(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold">Clients AcademTrade</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Positions simulées, solde pédagogique et demandes de retrait des clients ayant acheté la formation.
      </p>

      {erreur && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{erreur}</p>}

      {estAdmin(utilisateur) && (
        <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
          <button type="button" onClick={() => setFormulaireOuvert((v) => !v)} className="text-sm font-semibold text-violet-700 dark:text-violet-400">
            {formulaireOuvert ? "Fermer" : "+ Créer un compte directement (en attendant le paiement en ligne)"}
          </button>
          {formulaireOuvert && (
            <form onSubmit={creerCompteTest} className="mt-4 flex flex-wrap items-end gap-3">
              <input
                type="email"
                required
                placeholder="E-mail du client"
                value={nouveauCompte.email}
                onChange={(e) => setNouveauCompte({ ...nouveauCompte, email: e.target.value })}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
              />
              <input
                placeholder="Prénom"
                value={nouveauCompte.prenom}
                onChange={(e) => setNouveauCompte({ ...nouveauCompte, prenom: e.target.value })}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm w-32"
              />
              <input
                placeholder="Nom"
                value={nouveauCompte.nom}
                onChange={(e) => setNouveauCompte({ ...nouveauCompte, nom: e.target.value })}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm w-32"
              />
              <button
                type="submit"
                disabled={creation}
                className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold px-4 py-2 disabled:opacity-40"
              >
                Créer
              </button>
            </form>
          )}
          {creationInfo && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{creationInfo}</p>}
        </div>
      )}

      <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2.5">Client</th>
              <th className="px-4 py-2.5">Solde simulé</th>
              <th className="px-4 py-2.5">Positions ouvertes</th>
              <th className="px-4 py-2.5">Retraits en attente</th>
              <th className="px-4 py-2.5">Documents</th>
            </tr>
          </thead>
          <tbody>
            {(clients || []).map((c) => (
              <tr
                key={c.id}
                onClick={() => ouvrirClient(c.id)}
                className="border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <td className="px-4 py-2.5">
                  {c.prenom} {c.nom} <span className="text-slate-400">· {c.email}</span>
                </td>
                <td className="px-4 py-2.5">{c.soldeSimule.toFixed(2)}</td>
                <td className="px-4 py-2.5">{c.positionsOuvertes}</td>
                <td className="px-4 py-2.5">
                  {c.retraitsEnAttente > 0 ? (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">
                      {c.retraitsEnAttente}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {[c.documents?.identite, c.documents?.adresse].some((d) => d?.statut === "en_attente") ? (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">
                      à vérifier
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {clients && clients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Aucun client pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {clientOuvert && (
        <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">
              {clientOuvert.compte.prenom} {clientOuvert.compte.nom} · {clientOuvert.compte.email}
            </h2>
            <button type="button" onClick={() => setClientOuvert(null)} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white">
              Fermer
            </button>
          </div>

          <h3 className="font-semibold text-sm mt-5 mb-2">Positions</h3>
          {clientOuvert.positions.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Aucune position.</p>}
          <div className="space-y-1.5">
            {clientOuvert.positions.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-800 py-1.5">
                <span>
                  {p.instrumentNom} · {p.sens === "achat" ? "Achat" : "Vente"} · {p.lots} lot(s)
                </span>
                <span>
                  {p.statut === "ouverte" ? (
                    <span className="text-slate-400">ouverte</span>
                  ) : (
                    <span className={p.pnlNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                      {p.pnlNet >= 0 ? "+" : ""}
                      {p.pnlNet.toFixed(2)}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-sm mt-5 mb-2">Documents</h3>
          <div className="space-y-2">
            {["identite", "adresse"].map((type) => {
              const doc = clientOuvert.compte.documents?.[type];
              return (
                <div key={type} className="flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-800 py-1.5">
                  <span>
                    {type === "identite" ? "Pièce d'identité" : "Justificatif de domicile"}
                    {doc && (
                      <span className="text-slate-400">
                        {" "}
                        · {doc.nomOriginal} ·{" "}
                        {doc.statut === "en_attente" ? "en attente" : doc.statut === "validee" ? "validé" : "refusé"}
                      </span>
                    )}
                  </span>
                  {doc && (
                    <div className="flex gap-2">
                      <a
                        href={api.academtradeUrlDocument(clientOuvert.compte.id, type)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1"
                      >
                        Voir
                      </a>
                      {doc.statut === "en_attente" && (
                        <>
                          <button
                            type="button"
                            onClick={() => traiterDocument(type, "validee")}
                            className="text-xs font-semibold rounded-lg bg-emerald-600 text-white px-3 py-1"
                          >
                            Valider
                          </button>
                          <button
                            type="button"
                            onClick={() => traiterDocument(type, "refusee")}
                            className="text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1"
                          >
                            Refuser
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <h3 className="font-semibold text-sm mt-5 mb-2">Demandes de retrait</h3>
          {clientOuvert.retraits.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Aucune demande.</p>}
          <div className="space-y-2">
            {clientOuvert.retraits.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-800 py-1.5">
                <span>
                  {d.montant} · <span className="text-slate-400">{new Date(d.dateDemande).toLocaleDateString("fr-FR")}</span>
                </span>
                {d.statut === "en_attente" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => traiterRetrait(d.id, "validee")}
                      className="text-xs font-semibold rounded-lg bg-emerald-600 text-white px-3 py-1"
                    >
                      Valider
                    </button>
                    <button
                      type="button"
                      onClick={() => traiterRetrait(d.id, "refusee")}
                      className="text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1"
                    >
                      Refuser
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-semibold uppercase text-slate-400">{d.statut === "validee" ? "Validée" : "Refusée"}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
