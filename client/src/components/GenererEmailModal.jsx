import { useEffect, useState } from "react";
import { api } from "../api.js";
import { diffuserEntrepriseMaj } from "../telephony/CallContext.jsx";
import { jouerSonConfirmation } from "../sonConfirmation.js";
import { construireSignature } from "../mailSignature.js";

// Interface d'envoi d'e-mail ciblée depuis le tableau principal — deux
// entrées distinctes selon que la fiche a déjà une adresse connue ou non
// (voir EntrepriseTable.jsx) :
//  - `autoGenerer=true` (aucune adresse connue, bouton "Générer un e-mail"
//    sous le numéro) : un brouillon IA se génère automatiquement à
//    l'ouverture, l'agent complète juste le destinataire qu'il vient de
//    trouver, relit, et envoie.
//  - `autoGenerer=false` (adresse déjà connue, clic sur l'e-mail affiché) :
//    ouvre directement le compositeur, destinataire déjà pré-rempli — pas de
//    génération imposée, un bouton dédié permet d'en demander une si l'agent
//    le souhaite.
// Contrairement à MessagerieMail.jsx (fil complet, sur la fiche détaillée),
// cette modale n'a qu'un but : envoyer un e-mail en un minimum de gestes
// sans quitter le tableau.
export default function GenererEmailModal({ entreprise, onFermer, autoGenerer = true }) {
  const [destinataire, setDestinataire] = useState(
    entreprise.contact?.email || entreprise.contact?.emailsAlternatifs?.[0]?.email || ""
  );
  const [objet, setObjet] = useState("");
  const [corps, setCorps] = useState("");
  const [statutMail, setStatutMail] = useState(null);
  const [generationEnCours, setGenerationEnCours] = useState(autoGenerer);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annule = false;
    api
      .getStatutMail()
      .then((s) => !annule && setStatutMail(s))
      .catch(() => {});
    if (!autoGenerer) return () => {};
    api
      .genererEmailIA(entreprise.id)
      .then((resultat) => {
        if (annule) return;
        setObjet(resultat.objet);
        setCorps(resultat.corps);
      })
      .catch((e) => !annule && setErreur(e.message))
      .finally(() => !annule && setGenerationEnCours(false));
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprise.id]);

  // Génération IA à la demande (mode `autoGenerer=false`) — même appel que
  // ci-dessus, déclenché par un clic plutôt qu'à l'ouverture.
  async function genererAvecIA() {
    setGenerationEnCours(true);
    setErreur(null);
    try {
      const resultat = await api.genererEmailIA(entreprise.id);
      setObjet(resultat.objet);
      setCorps(resultat.corps);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setGenerationEnCours(false);
    }
  }

  // La signature n'est injectée qu'une fois le statut mail connu (elle en
  // dépend) — remplace le jeton une seule fois, dès qu'il arrive.
  useEffect(() => {
    if (statutMail && corps.includes("{{SIGNATURE}}")) {
      setCorps((c) => c.replaceAll("{{SIGNATURE}}", construireSignature({ statutMail })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statutMail]);

  async function envoyer(ev) {
    ev.preventDefault();
    const adresse = destinataire.trim();
    if (!adresse || !objet.trim() || !corps.trim() || envoiEnCours) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      let updated = await api.envoyerEmail(entreprise.id, { objet, corps, joindrePdf: true, destinataire: adresse });
      // Cette modale n'apparaît que quand la fiche n'a encore aucune adresse
      // connue — l'adresse qu'on vient d'utiliser devient donc l'adresse
      // principale, pour ne pas la faire ressaisir à la prochaine relance.
      if (!entreprise.contact?.email) {
        updated = await api.patchEntreprise(entreprise.id, { contact: { ...updated.contact, email: adresse } });
      }
      diffuserEntrepriseMaj(updated);
      jouerSonConfirmation();
      onFermer();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onFermer}>
      <div
        className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 shadow-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            {autoGenerer ? "✨ Générer un e-mail" : "✉️ Envoyer un e-mail"} — {entreprise.nom}
          </h3>
          <button
            onClick={onFermer}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {statutMail && !statutMail.configuree && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
            Boîte mail non connectée côté serveur — {autoGenerer ? "la génération fonctionne, mais l'envoi sera indisponible." : "l'envoi sera indisponible."}
          </p>
        )}

        {generationEnCours && (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            ✨ Rédaction du brouillon par l'IA…
          </p>
        )}

        {erreur && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{erreur}</p>}

        {!generationEnCours && (
          <form onSubmit={envoyer} className="space-y-3">
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              {autoGenerer ? "Destinataire (aucune adresse connue pour cette fiche)" : "Destinataire"}
              <input
                type="email"
                required
                autoFocus={autoGenerer}
                placeholder="contact@entreprise.fr"
                value={destinataire}
                onChange={(e) => setDestinataire(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </label>

            {!autoGenerer && !objet.trim() && !corps.trim() && (
              <button
                type="button"
                onClick={genererAvecIA}
                className="text-xs font-medium text-marine-700 dark:text-marine-300 hover:underline"
              >
                ✨ Générer un brouillon avec l'IA
              </button>
            )}

            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Objet
              <input
                type="text"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Message
              <textarea
                value={corps}
                onChange={(e) => setCorps(e.target.value)}
                rows={10}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onFermer}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!destinataire.trim() || !objet.trim() || !corps.trim() || envoiEnCours}
                className="rounded-lg bg-marine-800 hover:bg-marine-900 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-40"
              >
                {envoiEnCours ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
