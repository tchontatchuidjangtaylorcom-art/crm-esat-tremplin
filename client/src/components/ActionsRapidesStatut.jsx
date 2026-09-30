import { useState } from "react";
import { api } from "../api.js";
import { jouerSonConfirmation } from "../sonConfirmation.js";
import { diffuserEntrepriseArchivee, diffuserEntrepriseMaj } from "../telephony/CallContext.jsx";
import ChampDateHeure from "./ChampDateHeure.jsx";

function idUnique() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Boutons d'issue d'appel en un clic, juste au-dessus du champ commentaire de
// la fiche : chacun change le statut ET écrit le commentaire correspondant,
// pour ne plus avoir à faire les deux à la main après chaque appel.
//  - "direct"  : aucun complément à saisir (NRP) ;
//  - "sortie"  : sortie de dossier qui archive la fiche (confirmation) ;
//  - "mail"    : fenêtre pour noter ce que l'interlocuteur a demandé ;
//  - "date"    : fenêtre pour la date du rappel / du rendez-vous.
const ACTIONS = [
  {
    cle: "a_jour",
    label: "✅ À jour",
    titre: "L'entreprise respecte déjà son obligation : dossier passé en Mort et retiré du pipeline",
    type: "sortie",
    sortie: "mort",
    commentaire: "À jour : l'entreprise respecte déjà son obligation d'emploi (OETH). Dossier clos.",
    confirmation: "L'entreprise est déjà à jour de son obligation ?\nLe dossier passe en « Mort » et sort du pipeline actif.",
    classe: "border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
  {
    cle: "nrp",
    label: "📵 NRP",
    titre: "Ne répond pas : statut NRP + commentaire",
    type: "direct",
    issue: "nrp",
    commentaire: "NRP — ne répond pas.",
    classe: "border-red-300 text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  },
  {
    cle: "mail",
    label: "✉️ Mail",
    titre: "Demande un mail : statut Mail + ce que l'interlocuteur a demandé",
    type: "mail",
    issue: "mail",
    classe: "border-cyan-300 text-cyan-800 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800",
  },
  {
    cle: "a_rappeler",
    label: "📞 À rappeler",
    titre: "À rappeler : choisir la date",
    type: "date",
    issue: "a_rappeler",
    classe: "border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
  {
    cle: "me_rappelle",
    label: "🔔 Me rappelle",
    // Sans date : l'entreprise rappelle quand elle veut ; la fiche est à
    // retrouver dans la catégorie "Me rappelle" du tableau de bord.
    titre: "L'entreprise doit vous rappeler : statut Me rappelle + commentaire",
    type: "direct",
    issue: "me_rappelle",
    commentaire: "Me rappelle — l'entreprise doit nous rappeler.",
    classe: "border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  },
  {
    cle: "rdv",
    label: "📅 RDV",
    titre: "Rendez-vous : choisir la date",
    type: "date",
    issue: "rdv",
    classe: "border-green-300 text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
  },
  {
    cle: "refus",
    label: "✋ Refus",
    titre: "Refus : dossier clos et retiré du pipeline",
    type: "sortie",
    sortie: "refus",
    commentaire: "Refus de l'entreprise. Dossier clos.",
    confirmation: "Enregistrer le refus ?\nLe dossier passe en « Refus » et sort du pipeline actif.",
    classe: "border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  },
];

const LIBELLE_DATE = { a_rappeler: "Date du rappel", rdv: "Date du rendez-vous" };

export default function ActionsRapidesStatut({ entreprise, onMaj, prenomAgent }) {
  const [enCours, setEnCours] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  // Fenêtre ouverte : { action, texte, email, date }
  const [fenetre, setFenetre] = useState(null);

  async function commenter(texte) {
    return api.ajouterCommentaire(entreprise.id, { texte, auteur: prenomAgent });
  }

  async function executer(action, { texte = "", email = "", date = "", aussiRappel = false } = {}) {
    setEnCours(action.cle);
    setErreur(null);
    setConfirmation(null);
    try {
      if (action.type === "sortie") {
        const { entreprise: archivee } = await api.enregistrerSortie(entreprise.id, {
          sortie: action.sortie,
          details: null,
        });
        await commenter(action.commentaire).catch(() => {});
        jouerSonConfirmation();
        // La fiche quitte le pipeline : la page revient au tableau de bord.
        diffuserEntrepriseArchivee(archivee);
        return;
      }

      let commentaire = action.commentaire || "";
      if (action.type === "mail") {
        commentaire = `Mail demandé : ${texte.trim()}${email.trim() ? ` (adresse communiquée : ${email.trim()})` : ""}`;
        if (aussiRappel) commentaire += " — le contact doit aussi nous rappeler (fiche aussi dans « Me rappelle »)";
      } else if (action.type === "date") {
        const quand = new Date(date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
        commentaire = `${action.label.replace(/^\S+\s/, "")} le ${quand}${texte.trim() ? ` — ${texte.trim()}` : ""}`;
      }

      await api.enregistrerAppel(entreprise.id, {
        issue: action.issue,
        date: action.type === "date" ? date : null,
        details: null,
      });
      let maj = await commenter(commentaire);

      // Adresse donnée au téléphone (ex : celle des RH) : ajoutée aux e-mails
      // de la fiche — principale s'il n'y en a pas encore.
      const adresse = email.trim();
      if (action.type === "mail" && EMAIL_VALIDE.test(adresse)) {
        const contact = maj.contact || {};
        const connues = [contact.email, ...(contact.emailsAlternatifs || []).map((e) => e.email)]
          .filter(Boolean)
          .map((e) => e.toLowerCase());
        if (!connues.includes(adresse.toLowerCase())) {
          const nouveauContact = contact.email
            ? {
                ...contact,
                emailsAlternatifs: [
                  ...(contact.emailsAlternatifs || []),
                  { id: idUnique(), email: adresse, note: "Communiquée au téléphone", dateAjout: new Date().toISOString() },
                ],
              }
            : { ...contact, email: adresse };
          maj = await api.patchEntreprise(entreprise.id, { contact: nouveauContact });
        }
      }

      // Mail + "doit aussi me rappeler" : la fiche reste en statut Mail mais
      // compte aussi dans "Me rappelle" (filtre, compteur). Sans date, comme
      // "Me rappelle" : l'entreprise rappelle quand elle veut.
      if (action.type === "mail") {
        maj = await api.patchEntreprise(entreprise.id, { aussiMeRappelle: aussiRappel });
      }

      jouerSonConfirmation();
      onMaj?.(maj);
      diffuserEntrepriseMaj(maj);
      setFenetre(null);
      setConfirmation(`${action.label} enregistré.`);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  }

  function cliquer(action) {
    if (action.type === "direct") return executer(action);
    if (action.type === "sortie") {
      if (window.confirm(action.confirmation)) executer(action);
      return;
    }
    setErreur(null);
    setFenetre({ action, texte: "", email: "", date: "", aussiRappel: false });
  }

  function valider(ev) {
    ev.preventDefault();
    const { action, texte, email, date, aussiRappel } = fenetre;
    if (action.type === "mail" && !texte.trim()) return setErreur("Notez ce que l'interlocuteur a demandé.");
    if (action.type === "mail" && email.trim() && !EMAIL_VALIDE.test(email.trim())) {
      return setErreur("Adresse e-mail invalide.");
    }
    if (action.type === "date" && !date) return setErreur("Choisissez une date et une heure (ex : 14:30).");
    executer(action, { texte, email, date, aussiRappel });
  }

  const champ =
    "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm";

  return (
    <div className="mb-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
        Issue de l'appel — statut et commentaire en un clic
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ACTIONS.map((a) => (
          <button
            key={a.cle}
            type="button"
            title={a.titre}
            disabled={Boolean(enCours)}
            onClick={() => cliquer(a)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-40 ${a.classe}`}
          >
            {enCours === a.cle ? "…" : a.label}
          </button>
        ))}
      </div>
      {confirmation && <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1.5">✓ {confirmation}</p>}
      {erreur && !fenetre && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{erreur}</p>}

      {fenetre && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !enCours && setFenetre(null)}
        >
          <form
            onSubmit={valider}
            onClick={(ev) => ev.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                {fenetre.action.label} — {entreprise.nom}
              </h3>
              {/* Boutons en haut : jamais recouverts par le calendrier ouvert. */}
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setFenetre(null)}
                  disabled={Boolean(enCours)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={Boolean(enCours)}
                  className="rounded-lg bg-marine-800 hover:bg-marine-900 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-40"
                >
                  {enCours ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>

            {fenetre.action.type === "mail" ? (
              <>
                <label className="block text-xs text-slate-600 dark:text-slate-300">
                  Qu'a demandé l'interlocuteur ? (ex : envoyer la présentation aux RH)
                  <textarea
                    autoFocus
                    rows={3}
                    value={fenetre.texte}
                    onChange={(e) => setFenetre({ ...fenetre, texte: e.target.value })}
                    className={`mt-1 ${champ}`}
                  />
                </label>
                <label className="block text-xs text-slate-600 dark:text-slate-300">
                  Adresse e-mail communiquée (facultatif — ajoutée à la fiche)
                  <input
                    type="email"
                    value={fenetre.email}
                    onChange={(e) => setFenetre({ ...fenetre, email: e.target.value })}
                    placeholder="ex : rh@entreprise.fr"
                    className={`mt-1 ${champ}`}
                  />
                </label>
                {/* Ex. : l'interlocuteur transmet vos coordonnées aux RH, qui
                    doivent vous rappeler — la fiche apparaît aussi dans
                    "Me rappelle" (sans date : ils rappellent quand ils veulent). */}
                <label className="flex items-start gap-2 rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fenetre.aussiRappel}
                    onChange={(e) => setFenetre({ ...fenetre, aussiRappel: e.target.checked })}
                    className="mt-0.5"
                  />
                  <span>
                    <strong>📞 Le contact doit aussi me rappeler</strong>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      La fiche reste en « Mail » et apparaît aussi dans « Me rappelle ».
                    </span>
                  </span>
                </label>
              </>
            ) : (
              <>
                <ChampDateHeure
                  autoFocus
                  value={fenetre.date}
                  onChange={(valeur) => setFenetre((f) => ({ ...f, date: valeur }))}
                  libelleDate={LIBELLE_DATE[fenetre.action.issue]}
                />
                <label className="block text-xs text-slate-600 dark:text-slate-300">
                  Précision (facultatif)
                  <input
                    type="text"
                    value={fenetre.texte}
                    onChange={(e) => setFenetre({ ...fenetre, texte: e.target.value })}
                    placeholder="ex : demander Mme Martin, DRH"
                    className={`mt-1 ${champ}`}
                  />
                </label>
              </>
            )}

            {erreur && <p className="text-xs text-red-600 dark:text-red-400">{erreur}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
