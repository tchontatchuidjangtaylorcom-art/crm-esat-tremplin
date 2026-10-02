import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useContenuAide } from "../useContenuAide.js";
import { diffuserEntrepriseMaj } from "../telephony/CallContext.jsx";
import { jouerSonConfirmation } from "../sonConfirmation.js";
import { construireSignature } from "../mailSignature.js";
import BoutonCorrection from "./BoutonCorrection.jsx";
import { useAuth } from "../AuthContext.jsx";
import { estAdmin } from "../roles.js";

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
// objetInitial / corpsInitial : e-mail déjà rédigé (ex. récapitulatif OETH
// préparé depuis l'en-tête de la fiche), à relire avant envoi.
export default function GenererEmailModal({ entreprise, onFermer, autoGenerer: autoGenererDemande = true, objetInitial = "", corpsInitial = "" }) {
  // Rédaction par l'IA (payante) réservée aux administrateurs : pour un agent,
  // la fenêtre sert à écrire et envoyer le mail lui-même (ex. "Résumé").
  const { utilisateur } = useAuth();
  const iaAutorisee = estAdmin(utilisateur);
  const autoGenerer = autoGenererDemande && iaAutorisee;
  const [destinataire, setDestinataire] = useState(
    entreprise.contact?.email || entreprise.contact?.emailsAlternatifs?.[0]?.email || ""
  );
  const [objet, setObjet] = useState(objetInitial);
  const [corps, setCorps] = useState(corpsInitial);
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

  // Modèles de mails : la fenêtre ouverte sans texte (agent, ou fiche sans
  // brouillon IA) est pré-remplie avec le premier modèle (« Régularisation
  // DOETH 2026 ») ; les autres sont à un clic.
  const { data: modeles } = useContenuAide("modeles-mails", api.getModelesMails);
  function inserer(modele) {
    setObjet(modele.objet);
    setCorps(statutMail ? modele.corps.replaceAll("{{SIGNATURE}}", construireSignature({ statutMail })) : modele.corps);
  }
  const [preRempli, setPreRempli] = useState(false);
  useEffect(() => {
    const premier = modeles?.modeles?.[0];
    if (preRempli || !premier || autoGenerer || objetInitial || corpsInitial) return;
    setPreRempli(true);
    if (!objet.trim() && !corps.trim()) inserer(premier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeles]);

  // Mise en page officielle (bandeau du pôle, bouton « Parler à un
  // conseiller » qui mène à la prise de rendez-vous — voir
  // server/src/emailOfficiel.js), et envoi de test à sa propre adresse.
  const [formatOfficiel, setFormatOfficiel] = useState(true);
  // Synthèse PDF optionnelle, décochée par défaut.
  const [joindrePdf, setJoindrePdf] = useState(false);
  const [testEnCours, setTestEnCours] = useState(false);
  const [testEnvoye, setTestEnvoye] = useState(null);

  async function appelEnvoi(corpsRequete) {
    const res = await fetch(`/api/entreprises/${entreprise.id}/emails/envoyer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpsRequete),
    });
    const donnees = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(donnees.error || `Erreur HTTP ${res.status}`);
    return donnees;
  }

  async function envoyerTest() {
    if (!objet.trim() || !corps.trim() || testEnCours) return;
    setTestEnCours(true);
    setErreur(null);
    setTestEnvoye(null);
    try {
      const r = await appelEnvoi({ objet, corps, joindrePdf, formatOfficiel, testVersMoi: true });
      setTestEnvoye(r.destinataire);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setTestEnCours(false);
    }
  }

  async function envoyer(ev) {
    ev.preventDefault();
    const adresse = destinataire.trim();
    if (!adresse || !objet.trim() || !corps.trim() || envoiEnCours) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      let updated = await appelEnvoi({ objet, corps, joindrePdf, destinataire: adresse, formatOfficiel });
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

            {iaAutorisee && !autoGenerer && !objet.trim() && !corps.trim() && (
              <button
                type="button"
                onClick={genererAvecIA}
                className="text-xs font-medium text-marine-700 dark:text-marine-300 hover:underline"
              >
                ✨ Générer un brouillon avec l'IA
              </button>
            )}

            {!autoGenerer && modeles?.modeles?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {modeles.modeles.map((m) => (
                  <button
                    key={m.cle || m.titre}
                    type="button"
                    onClick={() => inserer(m)}
                    className="text-[11px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    {m.titre}
                  </button>
                ))}
              </div>
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
                spellCheck
                lang="fr"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono"
              />
            </label>
            <BoutonCorrection texte={corps} onCorrige={setCorps} />

            <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formatOfficiel}
                onChange={(e) => setFormatOfficiel(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong>Mise en page officielle</strong> — bandeau du Pôle OETH / AGEFIPH et bouton « Parler à un conseiller » :
                le client choisit un créneau (lundi–vendredi, 9h–17h30) et vous êtes prévenu.
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={joindrePdf} onChange={(e) => setJoindrePdf(e.target.checked)} className="mt-0.5" />
              <span>
                Joindre la synthèse OETH en PDF (effectif, déficit, contribution estimée) — <em>facultatif</em>
              </span>
            </label>

            {testEnvoye && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                ✓ Test envoyé à {testEnvoye} (objet précédé de [TEST]) — rien n'a été enregistré sur la fiche.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={envoyerTest}
                disabled={!objet.trim() || !corps.trim() || testEnCours || envoiEnCours}
                className="mr-auto rounded-lg border border-marine-300 dark:border-marine-700 text-marine-800 dark:text-marine-200 text-sm px-3 py-1.5 hover:bg-marine-50 dark:hover:bg-marine-950/40 disabled:opacity-40"
                title="Envoie cet e-mail à votre propre adresse, pour vérifier le rendu"
              >
                {testEnCours ? "Envoi du test…" : "M'envoyer un test"}
              </button>
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
