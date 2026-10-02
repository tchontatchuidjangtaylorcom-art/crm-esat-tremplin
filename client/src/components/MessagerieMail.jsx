import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useContenuAide } from "../useContenuAide.js";
import { formatDateHeure } from "../constants.js";
import { construireSignature } from "../mailSignature.js";
import BoutonCorrection from "./BoutonCorrection.jsx";
import { useAuth } from "../AuthContext.jsx";
import { estAdmin } from "../roles.js";

// Fil de messagerie mail réel avec le contact de l'entreprise (boîte IMAP/SMTP
// du pôle — voir server/src/mail.js). Reste utilisable même sans boîte
// connectée : affiche juste un message explicatif et masque l'envoi.
// Toutes les adresses connues pour cette entreprise (principale + alternatifs
// gérés dans "Informations structure" — voir GestionEmails.jsx), pour le
// sélecteur de destinataire ci-dessous.
function destinatairesDisponibles(entreprise) {
  const contact = entreprise.contact || {};
  const liste = [];
  if (contact.email) liste.push({ email: contact.email, label: "Principal" });
  for (const alt of contact.emailsAlternatifs || []) {
    if (alt.email) liste.push({ email: alt.email, label: alt.note || "Autre" });
  }
  return liste;
}

export default function MessagerieMail({ entreprise, onMaj }) {
  // Rédaction par l'IA (payante) réservée aux administrateurs.
  const { utilisateur } = useAuth();
  const iaAutorisee = estAdmin(utilisateur);
  // Repliée par défaut (une seule ligne) : remontée en haut de la fiche (voir
  // EntrepriseDetail.jsx), elle ne doit pas occuper une pleine section tant
  // qu'aucun mail n'est en cours de rédaction — un clic déplie le fil complet
  // + le formulaire, et l'envoi replie automatiquement pour regagner l'espace.
  const [ouvert, setOuvert] = useState(false);
  const [statutMail, setStatutMail] = useState(null);
  const [objet, setObjet] = useState("");
  const [corps, setCorps] = useState("");
  const [joindrePdf, setJoindrePdf] = useState(true);
  // Mise en page officielle (voir server/src/emailOfficiel.js) et envoi de
  // test à l'adresse du compte connecté, sans rien inscrire sur la fiche.
  const [formatOfficiel, setFormatOfficiel] = useState(true);
  const [testEnCours, setTestEnCours] = useState(false);
  const [testEnvoye, setTestEnvoye] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [toastEnvoi, setToastEnvoi] = useState(null);
  const [iaConfiguree, setIaConfiguree] = useState(null);
  const [generationEnCours, setGenerationEnCours] = useState(false);
  const [erreurGeneration, setErreurGeneration] = useState(null);
  const destinataires = destinatairesDisponibles(entreprise);
  const [destinataire, setDestinataire] = useState(entreprise.contact?.email || destinataires[0]?.email || "");
  // Copie (CC) : autres adresses de la fiche cochées + adresses saisies
  // (données par l'interlocuteur), séparées par des virgules.
  const [copiesCochees, setCopiesCochees] = useState([]);
  const [copiesSaisies, setCopiesSaisies] = useState("");
  const copies = [
    ...copiesCochees.filter((a) => a !== destinataire && destinataires.some((d) => d.email === a)),
    ...copiesSaisies.split(/[s,;]+/).map((a) => a.trim()).filter(Boolean),
  ];

  // Reste sur l'adresse choisie tant qu'elle existe toujours dans la liste ;
  // ne revient sur la principale que si elle a disparu (fiche changée,
  // adresse retirée dans "Informations structure" pendant que ce fil est ouvert).
  useEffect(() => {
    if (!destinataires.some((d) => d.email === destinataire)) {
      setDestinataire(entreprise.contact?.email || destinataires[0]?.email || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprise.id, entreprise.contact?.email, entreprise.contact?.emailsAlternatifs]);

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
    api
      .getStatutIA()
      .then((r) => setIaConfiguree(r.configuree))
      .catch(() => setIaConfiguree(false));
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

  // Génération sur demande (jamais automatique) : l'agent déclenche
  // explicitement la rédaction, l'IA s'appuie sur les données déjà connues
  // du CRM (secteur, chiffres OETH, interlocuteur, historique d'échange —
  // voir server/src/rechercheContact.js) pour proposer un brouillon
  // personnalisé, qui ne fait que pré-remplir le formulaire comme un modèle
  // classique : l'agent relit et clique lui-même sur "Envoyer".
  async function genererEmail() {
    setGenerationEnCours(true);
    setErreurGeneration(null);
    try {
      const resultat = await api.genererEmailIA(entreprise.id);
      setObjet(resultat.objet);
      setCorps(resultat.corps.replaceAll("{{SIGNATURE}}", construireSignature({ statutMail })));
    } catch (e) {
      setErreurGeneration(e.message);
    } finally {
      setGenerationEnCours(false);
    }
  }

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
    if (!objet.trim() || !corps.trim() || !destinataire) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      const updated = await appelEnvoi({ objet, corps, joindrePdf, destinataire, formatOfficiel, cc: copies });
      onMaj(updated);
      setToastEnvoi(`E-mail envoyé à ${destinataire}${copies.length ? ` (+ ${copies.length} en copie)` : ""}.`);
      setObjet("");
      setCorps("");
      setCopiesCochees([]);
      setCopiesSaisies("");
      setOuvert(false);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoiEnCours(false);
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
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">
          ✉️ Boîte mail — Pôle OETH/AGEFIPH
          {emails.length > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
              {emails.length} échange{emails.length > 1 ? "s" : ""}
            </span>
          )}
        </h2>
        <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{ouvert ? "▲ Réduire" : "▼ Écrire un mail"}</span>
      </button>

      {ouvert && (
      <div className="mt-3">
      {destinataires.length > 0 ? (
        <label className="flex items-center gap-2 mb-4 text-xs text-slate-500 dark:text-slate-400">
          Destinataire
          <select
            value={destinataire}
            onChange={(e) => setDestinataire(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200"
          >
            {destinataires.map((d) => (
              <option key={d.email} value={d.email}>
                {d.email} — {d.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {destinataires.length > 0 && (
        <div className="mb-4 -mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span>Copie (CC)</span>
          {destinataires
            .filter((d) => d.email !== destinataire)
            .map((d) => (
              <label key={d.email} className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={copiesCochees.includes(d.email)}
                  onChange={(e) =>
                    setCopiesCochees((l) => (e.target.checked ? [...l, d.email] : l.filter((a) => a !== d.email)))
                  }
                />
                {d.email}
              </label>
            ))}
          <input
            type="text"
            value={copiesSaisies}
            onChange={(e) => setCopiesSaisies(e.target.value)}
            placeholder="Autres adresses, séparées par une virgule"
            className="min-w-[14rem] flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200"
          />
        </div>
      )}
      {destinataires.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
          Aucune adresse mail connue — ajoutez-en une dans "Informations structure".
        </p>
      )}

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
                {m.direction === "recu" ? `De : ${m.de}` : `Envoyé à ${m.a || entreprise.contact?.email || "?"}${m.cc?.length ? ` (cc : ${m.cc.join(", ")})` : ""}`}
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

      {/* Le formulaire de composition reste visible même sans destinataire connu :
          la génération IA doit justement s'activer dans ce cas précis (contact
          sans e-mail renseigné, ou qui ne répond pas) — seul "Envoyer" reste
          désactivé tant qu'aucune adresse n'est disponible (voir le disabled
          plus bas). */}
      <form onSubmit={envoyer} className="space-y-2 pt-3 border-t border-marine-100 dark:border-marine-900/30">
          {destinataires.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-2">
              Aucun e-mail connu pour ce contact — générez un brouillon dès maintenant, puis ajoutez une adresse dans
              "Informations structure" pour pouvoir l'envoyer.
            </p>
          )}
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

          {iaAutorisee && iaConfiguree !== false && (
            <div className="mb-1">
              <button
                type="button"
                onClick={genererEmail}
                disabled={generationEnCours}
                title="Particulièrement utile si ce contact n'a pas répondu à un e-mail précédent, ou si aucun e-mail n'était disponible jusqu'ici"
                className="text-[11px] px-2.5 py-1.5 rounded-full bg-marine-100 dark:bg-marine-950/50 text-marine-800 dark:text-marine-300 hover:bg-marine-200 dark:hover:bg-marine-900 disabled:opacity-40 font-medium"
              >
                {generationEnCours ? "✨ Génération…" : "✨ Générer un e-mail de relance/proposition (IA)"}
              </button>
              {erreurGeneration && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erreurGeneration}</p>
              )}
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
            spellCheck
            lang="fr"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <BoutonCorrection texte={corps} onCorrige={setCorps} />
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <input type="checkbox" checked={joindrePdf} onChange={(e) => setJoindrePdf(e.target.checked)} />
            Joindre la synthèse OETH en PDF (effectif, déficit, contribution estimée)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <input type="checkbox" checked={formatOfficiel} onChange={(e) => setFormatOfficiel(e.target.checked)} />
            Mise en page officielle (bandeau du pôle, récapitulatif contribution / surcontribution, boutons simulation et conseiller)
          </label>
          {testEnvoye && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              ✓ Test envoyé à {testEnvoye} (objet précédé de [TEST]) — rien n'a été enregistré sur la fiche.
            </p>
          )}
          {erreur && <p className="text-xs text-red-600 dark:text-red-400">{erreur}</p>}
          <button
            type="button"
            onClick={envoyerTest}
            disabled={!objet.trim() || !corps.trim() || testEnCours || envoiEnCours || statutMail?.configuree === false}
            className="mr-2 rounded-lg border border-marine-300 dark:border-marine-700 text-marine-800 dark:text-marine-200 text-sm px-3 py-2 hover:bg-marine-50 dark:hover:bg-marine-950/40 disabled:opacity-40"
            title="Envoie cet e-mail à votre propre adresse, pour vérifier le rendu"
          >
            {testEnCours ? "Envoi du test…" : "M'envoyer un test"}
          </button>
          <button
            type="submit"
            disabled={!objet.trim() || !corps.trim() || !destinataire || envoiEnCours || statutMail?.configuree === false}
            className="rounded-lg bg-marine-600 hover:bg-marine-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
          >
            {envoiEnCours ? "Envoi…" : "Envoyer (signé Pôle OETH / AGEFIPH)"}
          </button>
      </form>
      </div>
      )}
      </div>
    </>
  );
}
