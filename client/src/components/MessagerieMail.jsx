import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useContenuAide } from "../useContenuAide.js";
import { formatDateHeure } from "../constants.js";
import { construireSignature } from "../mailSignature.js";

// Fil de messagerie mail réel avec le contact de l'entreprise (boîte IMAP/SMTP
// du pôle — voir server/src/mail.js). Reste utilisable même sans boîte
// connectée : affiche juste un message explicatif et masque l'envoi.
export default function MessagerieMail({ entreprise, onMaj }) {
  const [statutMail, setStatutMail] = useState(null);
  const [objet, setObjet] = useState("");
  const [corps, setCorps] = useState("");
  const [joindrePdf, setJoindrePdf] = useState(true);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [toastEnvoi, setToastEnvoi] = useState(null);
  const [emailSaisi, setEmailSaisi] = useState(entreprise.contact?.email || "");
  const [enregistrementEmail, setEnregistrementEmail] = useState(false);

  // Garde le champ synchronisé si l'e-mail change ailleurs (fiche rechargée,
  // mise à jour reçue par un autre onglet/agent) sans écraser une saisie en
  // cours de l'agent sur CE fil.
  useEffect(() => {
    setEmailSaisi(entreprise.contact?.email || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprise.id, entreprise.contact?.email]);

  // Le toast se referme tout seul après quelques secondes — pas besoin d'une
  // action de l'agent pour le faire disparaître.
  useEffect(() => {
    if (!toastEnvoi) return;
    const id = setTimeout(() => setToastEnvoi(null), 4000);
    return () => clearTimeout(id);
  }, [toastEnvoi]);
  const { data: modeles } = useContenuAide("modeles-mails", api.getModelesMails);

  useEffect(() => {
    api
      .getStatutMail()
      .then(setStatutMail)
      .catch(() => setStatutMail({ configuree: false }));
  }, []);

  // Marque les mails reçus comme lus dès que ce fil est affiché (= la fiche
  // est ouverte), pour faire disparaître la notification globale.
  useEffect(() => {
    const nonLus = (entreprise.emails || []).some((m) => m.direction === "recu" && !m.lu);
    if (nonLus) {
      api.marquerEmailsLus(entreprise.id).then(onMaj).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprise.id]);

  function inserer(modele) {
    setObjet(modele.objet);
    setCorps(
      modele.corps.replaceAll(
        "{{SIGNATURE}}",
        construireSignature({ statutMail })
      )
    );
  }

  async function envoyer(ev) {
    ev.preventDefault();
    if (!objet.trim() || !corps.trim()) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      const updated = await api.envoyerEmail(entreprise.id, { objet, corps, joindrePdf });
      onMaj(updated);
      setToastEnvoi(`E-mail envoyé à ${entreprise.contact.email}.`);
      setObjet("");
      setCorps("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  // Saisie manuelle de l'e-mail (ajout ou correction) directement depuis le
  // fil de messagerie — typiquement quand l'agent l'obtient au téléphone et
  // veut pouvoir envoyer un document dans la foulée. `contact` est remplacé
  // en bloc côté serveur (pas de fusion), donc on renvoie l'objet complet
  // avec uniquement l'email modifié, pour ne pas écraser nom/fonction/téléphone.
  async function enregistrerEmail(ev) {
    ev.preventDefault();
    const valeur = emailSaisi.trim();
    setEnregistrementEmail(true);
    setErreur(null);
    try {
      const updated = await api.patchEntreprise(entreprise.id, {
        contact: { ...(entreprise.contact || {}), email: valeur || null },
      });
      onMaj(updated);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrementEmail(false);
    }
  }

  const emails = entreprise.emails || [];

  return (
    <>
      {toastEnvoi && (
        <div
          role="status"
          className="fixed top-6 right-6 z-50 flex items-start gap-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium px-4 py-3 shadow-lg animate-toast-in"
        >
          <span className="text-lg leading-none">✓</span>
          <span>{toastEnvoi}</span>
        </div>
      )}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-marine-200/70 dark:border-marine-900/40 shadow-sm p-5">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Boîte mail — Pôle OETH/AGEFIPH</h2>
      <form onSubmit={enregistrerEmail} className="flex items-center gap-2 mb-4">
        <input
          type="email"
          placeholder="Adresse e-mail du contact"
          value={emailSaisi}
          onChange={(e) => setEmailSaisi(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200"
        />
        <button
          type="submit"
          disabled={enregistrementEmail || emailSaisi.trim() === (entreprise.contact?.email || "")}
          className="rounded-lg bg-marine-800 hover:bg-marine-900 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-40 whitespace-nowrap"
        >
          {enregistrementEmail ? "…" : "Enregistrer"}
        </button>
      </form>

      {statutMail && !statutMail.configuree && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-2 mb-4">
          Boîte mail non connectée pour l'instant — utilisez les modèles à copier-coller depuis le panneau "Modèles
          de mails" en haut de l'écran.
        </p>
      )}

      <ul className="space-y-3 max-h-80 overflow-y-auto mb-4">
        {emails.map((m) => (
          <li
            key={m.id}
            className={`rounded-lg p-3 text-sm ${
              m.direction === "recu"
                ? "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                : "bg-marine-50 dark:bg-marine-950/30 border border-marine-100 dark:border-marine-900/40"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {m.direction === "recu" ? `De : ${m.de}` : "Envoyé par le pôle"}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{formatDateHeure(m.date)}</span>
            </div>
            <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{m.objet}</p>
            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">{m.corps}</p>
            {m.piecesJointes?.length > 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                📎 {m.piecesJointes.map((p) => p.nom).join(", ")}
              </p>
            )}
          </li>
        ))}
        {emails.length === 0 && (
          <li className="text-sm text-slate-400 dark:text-slate-500">
            Aucun mail échangé avec ce contact pour l'instant.
          </li>
        )}
      </ul>

      {entreprise.contact?.email && (
        <form onSubmit={envoyer} className="space-y-2 pt-3 border-t border-marine-100 dark:border-marine-900/30">
          {modeles?.modeles?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {modeles.modeles.map((m) => (
                <button
                  key={m.cle}
                  type="button"
                  onClick={() => inserer(m)}
                  className="text-[11px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  {m.titre}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            placeholder="Objet"
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Votre message…"
            value={corps}
            onChange={(e) => setCorps(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <input type="checkbox" checked={joindrePdf} onChange={(e) => setJoindrePdf(e.target.checked)} />
            Joindre la synthèse OETH en PDF (effectif, déficit, contribution estimée)
          </label>
          {erreur && <p className="text-xs text-red-600 dark:text-red-400">{erreur}</p>}
          <button
            type="submit"
            disabled={!objet.trim() || !corps.trim() || envoiEnCours || statutMail?.configuree === false}
            className="rounded-lg bg-marine-600 hover:bg-marine-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
          >
            {envoiEnCours ? "Envoi…" : "Envoyer (signé Pôle OETH / AGEFIPH)"}
          </button>
        </form>
      )}
      </div>
    </>
  );
}
