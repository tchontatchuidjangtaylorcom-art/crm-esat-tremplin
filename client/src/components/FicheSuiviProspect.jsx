import { useState } from "react";
import { api } from "../api.js";

function aujourdHui() {
  return new Date().toISOString().slice(0, 10);
}

// Numérisation de la "Fiche de Suivi Prospect" papier — modale ouverte
// depuis la fiche entreprise. Les informations déjà connues du CRM (identité
// de l'entreprise) sont affichées en lecture seule ; seuls les champs propres
// à la fiche papier sont saisissables, pré-remplis quand une valeur
// équivalente existe déjà (contact, effectif bénéficiaire, montant estimé).
export default function FicheSuiviProspect({ entreprise, prenomAgent, onValide, onFermer }) {
  const [prenom, setPrenom] = useState(prenomAgent || "");
  const [date, setDate] = useState(aujourdHui());
  const [numeroDossier, setNumeroDossier] = useState("");
  const [personneEnChargeNom, setPersonneEnChargeNom] = useState(
    entreprise.contact?.nom && entreprise.contact.nom !== "-" ? entreprise.contact.nom : ""
  );
  const [personneEnChargeFonction, setPersonneEnChargeFonction] = useState(
    entreprise.contact?.fonction && entreprise.contact.fonction !== "-" ? entreprise.contact.fonction : ""
  );
  const [nombreTravailleursHandicapes, setNombreTravailleursHandicapes] = useState(
    entreprise.effectifBeneficiaire || 0
  );
  const [montantTaxesAnnonce, setMontantTaxesAnnonce] = useState(
    Math.round(entreprise.oeth?.montantEstime || 0)
  );
  const [montantAFaire, setMontantAFaire] = useState("");
  const [remarques, setRemarques] = useState("");

  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function soumettre(ev) {
    ev.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      const updated = await api.soumettreFicheProspection(entreprise.id, {
        prenom,
        date,
        numeroDossier,
        personneEnChargeNom,
        personneEnChargeFonction,
        nombreTravailleursHandicapes,
        montantTaxesAnnonce,
        montantAFaire,
        remarques,
      });
      onValide(updated);
    } catch (e) {
      setErreur(e.message);
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFermer}>
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">Fiche de Suivi Prospect</h2>
          <button
            onClick={onFermer}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <form onSubmit={soumettre} className="p-6 space-y-5">
          {/* Informations déjà connues du CRM — lecture seule, jamais modifiées depuis cette fiche */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-sm space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{entreprise.nom}</p>
            <p className="text-slate-500 dark:text-slate-400">SIRET : {entreprise.siret || "-"}</p>
            <p className="text-slate-500 dark:text-slate-400">
              {entreprise.adresse}, {entreprise.codePostal} {entreprise.ville}
            </p>
            <p className="text-slate-500 dark:text-slate-400">Effectif : {entreprise.effectif ?? "-"} salarié(s)</p>
            <p className="text-slate-500 dark:text-slate-400">Email : {entreprise.contact?.email || "Non renseigné"}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Prénom
              <input
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Numéro de dossier
            <input
              type="text"
              value={numeroDossier}
              onChange={(e) => setNumeroDossier(e.target.value)}
              placeholder="Ex : 2026-0142"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Nom de la personne en charge
              <input
                type="text"
                value={personneEnChargeNom}
                onChange={(e) => setPersonneEnChargeNom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Fonction
              <input
                type="text"
                value={personneEnChargeFonction}
                onChange={(e) => setPersonneEnChargeFonction(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Nombre de travailleurs handicapés
            <input
              type="number"
              min={0}
              value={nombreTravailleursHandicapes}
              onChange={(e) => setNombreTravailleursHandicapes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Montant de taxes annoncé (€)
              <input
                type="number"
                min={0}
                value={montantTaxesAnnonce}
                onChange={(e) => setMontantTaxesAnnonce(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Montant à faire (€)
              <input
                type="number"
                min={0}
                value={montantAFaire}
                onChange={(e) => setMontantAFaire(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Remarques sur le client
            <textarea
              value={remarques}
              onChange={(e) => setRemarques(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </label>

          {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              La validation bascule automatiquement le dossier sur « Fiche Potentielle ».
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onFermer}
                className="rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium px-4 py-2"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={enCours}
                className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
              >
                {enCours ? "Validation…" : "Valider la fiche"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
