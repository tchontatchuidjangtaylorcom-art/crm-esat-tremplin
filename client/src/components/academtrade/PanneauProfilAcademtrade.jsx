import { useState } from "react";
import { api } from "../../api.js";

const LIBELLES_STATUT = { en_attente: "En attente de vérification", validee: "Validé", refusee: "Refusé" };

function LigneDocument({ type, titre, document, surEnvoye }) {
  const [fichier, setFichier] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function envoyer() {
    if (!fichier) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await api.academtradeEnvoyerDocument(type, fichier);
      setFichier(null);
      surEnvoye();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="border border-slate-900/10 dark:border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">{titre}</p>
        {document && (
          <span
            className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
              document.statut === "validee"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : document.statut === "refusee"
                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
          >
            {LIBELLES_STATUT[document.statut]}
          </span>
        )}
      </div>
      {document && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{document.nomOriginal}</p>}
      {document?.statut === "refusee" && document.commentaireAgent && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">Motif : {document.commentaireAgent}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => setFichier(e.target.files?.[0] || null)}
          className="text-xs"
        />
        <button
          type="button"
          onClick={envoyer}
          disabled={!fichier || envoi}
          className="text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 disabled:opacity-40"
        >
          {envoi ? "Envoi…" : document ? "Remplacer" : "Envoyer"}
        </button>
      </div>
      {erreur && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{erreur}</p>}
    </div>
  );
}

export default function PanneauProfilAcademtrade({ compte, onFermer, onMisAJour }) {
  const [onglet, setOnglet] = useState("infos");
  const [infos, setInfos] = useState({
    prenom: compte.prenom || "",
    nom: compte.nom || "",
    telephone: compte.telephone || "",
    adresse: compte.adresse || { rue: "", ville: "", codePostal: "", pays: "" },
  });
  const [motDePasse, setMotDePasse] = useState({ ancien: "", nouveau: "", confirmation: "" });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);

  async function rafraichirCompte() {
    const c = await api.academtradeMoi();
    onMisAJour(c);
  }

  async function enregistrerInfos(ev) {
    ev.preventDefault();
    setEnvoi(true);
    setErreur(null);
    setSucces(null);
    try {
      const c = await api.academtradeMettreAJourProfil(infos);
      onMisAJour(c);
      setSucces("Informations enregistrées.");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function changerMotDePasse(ev) {
    ev.preventDefault();
    if (motDePasse.nouveau !== motDePasse.confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    setSucces(null);
    try {
      await api.academtradeChangerMotDePasse(motDePasse.ancien, motDePasse.nouveau);
      setMotDePasse({ ancien: "", nouveau: "", confirmation: "" });
      setSucces("Mot de passe modifié.");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  const champClasse =
    "w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onFermer}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-900/10 dark:border-white/10 rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="h-1.5 bg-violet-600" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Mon profil</h2>
            <button type="button" onClick={onFermer} className="text-slate-500 hover:text-slate-800 dark:hover:text-white text-sm">
              Fermer
            </button>
          </div>

          <div className="flex gap-2 mb-5">
            {[
              ["infos", "Mes informations"],
              ["mot_de_passe", "Mot de passe"],
              ["documents", "Mes documents"],
            ].map(([id, libelle]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setOnglet(id);
                  setErreur(null);
                  setSucces(null);
                }}
                className={`text-xs font-semibold rounded-full px-3 py-1.5 ${
                  onglet === id ? "bg-violet-600 text-white" : "bg-slate-900/5 dark:bg-white/5 text-slate-600 dark:text-slate-300"
                }`}
              >
                {libelle}
              </button>
            ))}
          </div>

          {erreur && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{erreur}</p>}
          {succes && <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">{succes}</p>}

          {onglet === "infos" && (
            <form onSubmit={enregistrerInfos} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Prénom" value={infos.prenom} onChange={(e) => setInfos({ ...infos, prenom: e.target.value })} className={champClasse} />
                <input placeholder="Nom" value={infos.nom} onChange={(e) => setInfos({ ...infos, nom: e.target.value })} className={champClasse} />
              </div>
              <input
                placeholder="Téléphone"
                value={infos.telephone}
                onChange={(e) => setInfos({ ...infos, telephone: e.target.value })}
                className={champClasse}
              />
              <input
                placeholder="Adresse"
                value={infos.adresse.rue}
                onChange={(e) => setInfos({ ...infos, adresse: { ...infos.adresse, rue: e.target.value } })}
                className={champClasse}
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  placeholder="Code postal"
                  value={infos.adresse.codePostal}
                  onChange={(e) => setInfos({ ...infos, adresse: { ...infos.adresse, codePostal: e.target.value } })}
                  className={champClasse}
                />
                <input
                  placeholder="Ville"
                  value={infos.adresse.ville}
                  onChange={(e) => setInfos({ ...infos, adresse: { ...infos.adresse, ville: e.target.value } })}
                  className={`${champClasse} col-span-2`}
                />
              </div>
              <input
                placeholder="Pays"
                value={infos.adresse.pays}
                onChange={(e) => setInfos({ ...infos, adresse: { ...infos.adresse, pays: e.target.value } })}
                className={champClasse}
              />
              <button type="submit" disabled={envoi} className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold py-2.5 disabled:opacity-40">
                {envoi ? "Enregistrement…" : "Enregistrer"}
              </button>
            </form>
          )}

          {onglet === "mot_de_passe" && (
            <form onSubmit={changerMotDePasse} className="space-y-3">
              <input
                type="password"
                placeholder="Mot de passe actuel"
                value={motDePasse.ancien}
                onChange={(e) => setMotDePasse({ ...motDePasse, ancien: e.target.value })}
                className={champClasse}
              />
              <input
                type="password"
                placeholder="Nouveau mot de passe"
                value={motDePasse.nouveau}
                onChange={(e) => setMotDePasse({ ...motDePasse, nouveau: e.target.value })}
                className={champClasse}
              />
              <input
                type="password"
                placeholder="Confirmer le nouveau mot de passe"
                value={motDePasse.confirmation}
                onChange={(e) => setMotDePasse({ ...motDePasse, confirmation: e.target.value })}
                className={champClasse}
              />
              <button type="submit" disabled={envoi} className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold py-2.5 disabled:opacity-40">
                {envoi ? "Modification…" : "Changer le mot de passe"}
              </button>
            </form>
          )}

          {onglet === "documents" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">PDF, PNG ou JPG, 10 Mo maximum.</p>
              <LigneDocument type="identite_recto" titre="Pièce d'identité (recto)" document={compte.documents?.identite_recto} surEnvoye={rafraichirCompte} />
              <LigneDocument type="identite_verso" titre="Pièce d'identité (verso)" document={compte.documents?.identite_verso} surEnvoye={rafraichirCompte} />
              <LigneDocument type="adresse" titre="Justificatif de domicile" document={compte.documents?.adresse} surEnvoye={rafraichirCompte} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
