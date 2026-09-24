import { useState } from "react";
import { api } from "../api.js";

function idUnique() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Gestion à chaud de plusieurs adresses e-mail pour une même entreprise —
// même convention que GestionTelephones.jsx (e-mail "principal" + liste
// d'alternatifs promouvables, chacun avec une note libre du type "RH",
// "Secondaire"...). Le choix du destinataire pour un envoi donné se fait
// dans le fil de messagerie (voir MessagerieMail.jsx) ; cette section gère
// la liste elle-même.
export default function GestionEmails({ entreprise, onMaj }) {
  const [emailPrincipal, setEmailPrincipal] = useState(entreprise.contact?.email || "");
  const [nouvelEmail, setNouvelEmail] = useState("");
  const [nouvelleNote, setNouvelleNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  const contact = entreprise.contact || {};
  const alternatifs = contact.emailsAlternatifs || [];

  async function sauvegarderContact(partiel) {
    setEnCours(true);
    setErreur(null);
    try {
      const updated = await api.patchEntreprise(entreprise.id, { contact: { ...contact, ...partiel } });
      onMaj?.(updated);
      return updated;
    } catch (e) {
      setErreur(e.message);
      return null;
    } finally {
      setEnCours(false);
    }
  }

  async function soumettrePrincipal(ev) {
    ev.preventDefault();
    await sauvegarderContact({ email: emailPrincipal.trim() || null });
  }

  async function ajouter(ev) {
    ev.preventDefault();
    if (!nouvelEmail.trim()) return;
    const nouvelleEntree = {
      id: idUnique(),
      email: nouvelEmail.trim(),
      note: nouvelleNote.trim(),
      dateAjout: new Date().toISOString(),
    };
    const updated = await sauvegarderContact({ emailsAlternatifs: [...alternatifs, nouvelleEntree] });
    if (updated) {
      setNouvelEmail("");
      setNouvelleNote("");
    }
  }

  function definirCommePrincipal(alt) {
    const ancienPrincipal = contact.email;
    const autres = alternatifs.filter((a) => a.id !== alt.id);
    if (ancienPrincipal && ancienPrincipal !== alt.email) {
      autres.push({ id: idUnique(), email: ancienPrincipal, note: "Ancien e-mail principal", dateAjout: new Date().toISOString() });
    }
    sauvegarderContact({ email: alt.email, emailsAlternatifs: autres });
    setEmailPrincipal(alt.email);
  }

  function retirer(alt) {
    sauvegarderContact({ emailsAlternatifs: alternatifs.filter((a) => a.id !== alt.id) });
  }

  return (
    <div className="space-y-2">
      <form onSubmit={soumettrePrincipal} className="flex items-end gap-2">
        <label className="text-xs text-slate-500 dark:text-slate-400 flex-1">
          E-mail (principal — utilisé par défaut pour l'envoi)
          <input
            type="email"
            value={emailPrincipal}
            onChange={(e) => setEmailPrincipal(e.target.value)}
            placeholder="contact@entreprise.fr"
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={enCours}
          className="rounded-lg bg-marine-800 hover:bg-marine-900 text-white text-xs font-medium px-3 py-[7px] disabled:opacity-40"
        >
          Enregistrer
        </button>
      </form>

      {erreur && <p className="text-xs text-red-600 dark:text-red-400">{erreur}</p>}

      {alternatifs.length > 0 && (
        <ul className="space-y-1">
          {alternatifs.map((alt) => (
            <li
              key={alt.id}
              className="flex items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5"
            >
              <span className="text-slate-600 dark:text-slate-300 truncate">
                {alt.email}
                {alt.note ? ` — ${alt.note}` : ""}
              </span>
              <span className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => definirCommePrincipal(alt)}
                  className="rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 hover:bg-amber-200 dark:hover:bg-amber-900"
                >
                  Principal
                </button>
                <button
                  type="button"
                  onClick={() => retirer(alt)}
                  className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 px-1"
                  title="Retirer cet e-mail"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          placeholder="Nouvel e-mail (ex : rh@entreprise.fr)"
          value={nouvelEmail}
          onChange={(e) => setNouvelEmail(e.target.value)}
          className="flex-1 min-w-[160px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
        />
        <input
          type="text"
          placeholder="Note (ex : RH)"
          value={nouvelleNote}
          onChange={(e) => setNouvelleNote(e.target.value)}
          className="w-28 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={ajouter}
          disabled={!nouvelEmail.trim() || enCours}
          className="rounded-lg bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium px-3 py-1.5 disabled:opacity-40"
        >
          + Ajouter un e-mail
        </button>
      </div>
    </div>
  );
}
