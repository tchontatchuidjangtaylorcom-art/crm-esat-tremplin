import { useState } from "react";
import { STATUTS, STATUTS_ARCHIVES, ISSUES_APPEL } from "../constants.js";
import { api } from "../api.js";
import { diffuserEntrepriseMaj, diffuserEntrepriseArchivee } from "../telephony/CallContext.jsx";
import ChampDateHeure from "./ChampDateHeure.jsx";
import { useAuth } from "../AuthContext.jsx";

// Badge de statut cliquable, utilisé à la fois dans le tableau principal et
// en en-tête de la fiche détaillée : un <select> natif habillé aux couleurs
// du badge (mêmes classes STATUTS partout — un seul statut pointe vers un
// seul jeu de couleurs) plutôt qu'un menu maison en position absolue, pour
// ne jamais se faire couper par le défilement horizontal du tableau
// (overflow-x-auto) : un <select> natif s'affiche toujours par-dessus, quel
// que soit son parent. Réutilise la même route que le changement de statut
// groupé (une sélection d'un seul dossier) — donc la même règle d'archivage
// automatique sur conforme/refus/mort, avec la même confirmation qu'à la
// sélection multiple.
// Statuts qui demandent une date (rappel, rendez-vous) : "Me rappelle",
// "À rappeler", "RDV". Choisis depuis le badge, ils ouvrent une petite
// fenêtre pour saisir la date, puis passent par la route des issues d'appel
// (/api/entreprises/:id/appels), qui enregistre dateRappel / dateRdv —
// comme le faisait le module AGIR, retiré de la fiche.
const STATUTS_AVEC_DATE = new Set(ISSUES_APPEL.filter((i) => i.needsDate).map((i) => i.value));

export default function StatusSelect({ entreprise }) {
  const [enCours, setEnCours] = useState(false);
  const [aDater, setADater] = useState(null);
  const [date, setDate] = useState("");
  const [details, setDetails] = useState("");
  const [erreurDate, setErreurDate] = useState(null);
  // Passage en Client Potentiel : fiche de passation au superviseur (date de
  // rappel, interlocuteur, poste, commentaire).
  const [cp, setCp] = useState(null);
  const { utilisateur } = useAuth();
  const info = STATUTS[entreprise.statut] || {
    label: entreprise.statut,
    badge: "bg-gray-100 text-gray-700 border border-gray-300",
  };

  async function changer(ev) {
    ev.stopPropagation();
    const nouveauStatut = ev.target.value;
    if (!nouveauStatut || nouveauStatut === entreprise.statut) return;

    if (nouveauStatut === "fiche") {
      ev.target.value = entreprise.statut;
      const c = entreprise.contact || {};
      setCp({
        date: "",
        nom: c.nom && c.nom !== "-" ? c.nom : "",
        poste: c.fonction && c.fonction !== "-" ? c.fonction : "",
        commentaire: "",
        erreur: null,
      });
      return;
    }

    if (STATUTS_AVEC_DATE.has(nouveauStatut)) {
      ev.target.value = entreprise.statut;
      setADater(nouveauStatut);
      setDate("");
      setDetails("");
      setErreurDate(null);
      return;
    }

    if (
      STATUTS_ARCHIVES.includes(nouveauStatut) &&
      !window.confirm(
        `Passer « ${entreprise.nom} » au statut "${STATUTS[nouveauStatut].label}" ? Ce statut archive automatiquement le dossier (hors pipeline actif).`
      )
    ) {
      ev.target.value = entreprise.statut;
      return;
    }

    setEnCours(true);
    try {
      const { archive, entreprises } = await api.changerStatutGroupe([entreprise.id], nouveauStatut);
      const maj = entreprises[0];
      if (archive) diffuserEntrepriseArchivee(maj);
      else diffuserEntrepriseMaj(maj);
    } catch (e) {
      ev.target.value = entreprise.statut;
      window.alert(`Impossible de changer le statut : ${e.message}`);
    } finally {
      setEnCours(false);
    }
  }

  async function validerCp(ev) {
    ev.preventDefault();
    if (!cp.date) return setCp({ ...cp, erreur: "Indiquez quand le client doit être rappelé (ex : demain 14h)." });
    if (!cp.nom.trim()) return setCp({ ...cp, erreur: "Indiquez le nom de votre interlocuteur." });
    setEnCours(true);
    try {
      const { entreprises } = await api.changerStatutGroupe([entreprise.id], "fiche");
      const actuelle = entreprises[0] || entreprise;
      const contact = { ...(actuelle.contact || {}) };
      const nom = cp.nom.trim();
      const poste = cp.poste.trim();
      // Nouvel interlocuteur principal : l'ancien n'est pas perdu.
      const ancien = contact.nom && contact.nom !== "-" ? contact.nom : null;
      if (ancien && ancien.toLowerCase() !== nom.toLowerCase()) {
        contact.contactsAlternatifs = [
          ...(contact.contactsAlternatifs || []),
          { id: `${Date.now()}`, nom: ancien, fonction: contact.fonction && contact.fonction !== "-" ? contact.fonction : "", dateAjout: new Date().toISOString() },
        ];
      }
      // S'il figurait déjà parmi les contacts secondaires, il en sort.
      contact.contactsAlternatifs = (contact.contactsAlternatifs || []).filter(
        (c) => (c.nom || "").toLowerCase() !== nom.toLowerCase()
      );
      contact.nom = nom;
      contact.fonction = poste || "-";
      await api.patchEntreprise(entreprise.id, { contact, dateRappel: cp.date });
      const quand = new Date(cp.date).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
      const maj = await api.ajouterCommentaire(entreprise.id, {
        texte:
          `🟡 Client Potentiel (CP) — à rappeler le ${quand}. Interlocuteur : ${nom}${poste ? ` (${poste})` : ""}.` +
          (cp.commentaire.trim() ? ` Commentaire : ${cp.commentaire.trim()}` : ""),
        auteur: utilisateur?.prenom || utilisateur?.email || "Agent",
      });
      diffuserEntrepriseMaj(maj);
      setCp(null);
    } catch (e) {
      setCp({ ...cp, erreur: e.message });
    } finally {
      setEnCours(false);
    }
  }

  async function validerDate(ev) {
    ev.preventDefault();
    if (!date) {
      setErreurDate("Choisissez une date et une heure (ex : 14:30).");
      return;
    }
    setEnCours(true);
    try {
      const maj = await api.enregistrerAppel(entreprise.id, { issue: aDater, date, details: details.trim() || null });
      diffuserEntrepriseMaj(maj);
      setADater(null);
    } catch (e) {
      setErreurDate(e.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="relative inline-block" onClick={(ev) => ev.stopPropagation()}>
      {cp && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setCp(null)}>
          <form
            onSubmit={validerCp}
            onClick={(ev) => ev.stopPropagation()}
            className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 shadow-2xl p-5 space-y-3 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">🟡 Client Potentiel (CP)</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{entreprise.nom} — fiche transmise au superviseur</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setCp(null)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={enCours}
                  className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  {enCours ? "…" : "Valider"}
                </button>
              </div>
            </div>
            <ChampDateHeure
              value={cp.date}
              onChange={(v) => setCp((c) => ({ ...c, date: v }))}
              autoFocus
              libelleDate="À rappeler le (souhait du client)"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Interlocuteur
                <input
                  type="text"
                  value={cp.nom}
                  onChange={(e) => setCp({ ...cp, nom: e.target.value })}
                  placeholder="ex : Mme Martin"
                  className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Poste
                <input
                  type="text"
                  value={cp.poste}
                  onChange={(e) => setCp({ ...cp, poste: e.target.value })}
                  placeholder="ex : DRH"
                  className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Commentaire pour le superviseur
              <textarea
                value={cp.commentaire}
                onChange={(e) => setCp({ ...cp, commentaire: e.target.value })}
                rows={3}
                placeholder="ex : intéressée par l'ESAT Tremplin, attend le chiffrage, préfère être appelée le matin"
                className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              />
            </label>
            {cp.erreur && <p className="text-sm text-red-600 dark:text-red-400">{cp.erreur}</p>}
          </form>
        </div>
      )}
      {aDater && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setADater(null)}>
          <form
            onSubmit={validerDate}
            onClick={(ev) => ev.stopPropagation()}
            className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-3 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {STATUTS[aDater]?.label} — {entreprise.nom}
              </p>
              {/* Boutons en haut : jamais recouverts par le calendrier ouvert. */}
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setADater(null)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={enCours}
                  className="rounded-lg bg-marine-700 hover:bg-marine-800 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  Enregistrer
                </button>
              </div>
            </div>
            <ChampDateHeure
              value={date}
              onChange={setDate}
              autoFocus
              libelleDate={aDater === "rdv" ? "Date du rendez-vous" : "Date du rappel"}
            />
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Détails (facultatif)
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              />
            </label>
            {erreurDate && <p className="text-sm text-red-600 dark:text-red-400">{erreurDate}</p>}
          </form>
        </div>
      )}
      <select
        value={entreprise.statut}
        onChange={changer}
        onClick={(ev) => ev.stopPropagation()}
        disabled={enCours}
        title="Changer le statut"
        className={`appearance-none cursor-pointer pl-2.5 pr-5 py-1 rounded-full text-xs font-semibold whitespace-nowrap disabled:opacity-50 ${info.badge}`}
      >
        {Object.entries(STATUTS).map(([cle, i]) => (
          <option key={cle} value={cle} className="bg-white text-slate-800">
            {i.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] opacity-60">▾</span>
    </div>
  );
}
