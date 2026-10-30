import { useState } from "react";
import { api } from "../api.js";

async function copierPressePapier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

// Génère un lien d'invitation à un ou plusieurs espaces (voir
// server/src/invitations.js) : alternative à "+ Ajouter un client / Créer un
// profil" ci-dessus pour les cas où l'admin préfère laisser la personne
// créer elle-même son compte (ou ajouter l'accès à son compte existant) en
// ouvrant un lien, plutôt que de saisir ses informations à sa place.
export default function LienInvitation({ espaces }) {
  const [choix, setChoix] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [lien, setLien] = useState(null);
  const [copie, setCopie] = useState(false);

  if (!espaces?.length) return null;

  function basculer(id) {
    setChoix((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
    setLien(null);
    setCopie(false);
  }

  async function generer() {
    if (choix.length === 0) return;
    setEnCours(true);
    setErreur(null);
    setCopie(false);
    try {
      const resultat = await api.creerInvitation(choix);
      setLien(resultat);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  async function copier() {
    if (!lien) return;
    setCopie(await copierPressePapier(lien.url));
  }

  return (
    <div className="mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">+ Inviter par lien</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Choisissez un ou plusieurs espaces puis générez un lien à transmettre vous-même (mail, SMS, Slack…) : la
        personne qui l'ouvre crée son compte — ou ajoute l'accès à son compte existant si elle en a déjà un — avec
        exactement ces espaces, sans repasser par "Gestion des accès" ci-dessous. Lien valable 30 jours, réutilisable
        pour inviter plusieurs personnes.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {espaces.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => basculer(e.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                choix.includes(e.id)
                  ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400"
              }`}
            >
              {choix.includes(e.id) ? "✓ " : ""}
              {e.nom}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={generer}
          disabled={enCours || choix.length === 0}
          className="rounded-lg bg-marine-800 hover:bg-marine-900 dark:bg-marine-200 dark:hover:bg-marine-300 text-white dark:text-marine-900 text-sm font-medium px-4 py-2 disabled:opacity-40"
        >
          {enCours ? "Génération…" : "Générer le lien"}
        </button>
      </div>
      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
      {lien && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-3 py-2">
          <code className="text-xs font-mono text-slate-800 dark:text-slate-100 select-all break-all">{lien.url}</code>
          <button type="button" onClick={copier} className="text-xs text-marine-700 dark:text-marine-300 hover:underline shrink-0">
            {copie ? "Copié !" : "Copier"}
          </button>
        </div>
      )}
    </div>
  );
}
