import { useState } from "react";
import { api } from "../api.js";

function aujourdHui() {
  return new Date().toISOString().slice(0, 10);
}

function idUnique() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Numérisation de la "Fiche de Suivi Prospect" papier — modale ouverte
// depuis la fiche entreprise, pensée pour être renseignée PENDANT l'appel.
// Deux catégories de champs :
//  - Ancrage CRM fixe (nom de l'entreprise, SIRET) : jamais modifiable ici,
//    c'est l'identité légale qui rattache la fiche au bon dossier.
//  - Tout le reste (adresse, effectif, contact, numéros de téléphone) est
//    modifiable "à chaud" : chaque champ s'enregistre immédiatement sur la
//    fiche entreprise (PATCH) dès qu'on le quitte, et remonte au CRM via
//    `onMaj` — pas besoin d'attendre la validation finale pour que ça compte.
// Les champs propres au papier (prénom de l'agent, date, n° de dossier,
// montants) ne sont eux enregistrés qu'à la validation finale, avec le
// statut "Fiche Potentielle".
export default function FicheSuiviProspect({ entreprise, prenomAgent, onMaj, onValide, onFermer }) {
  const [entrepriseCourante, setEntrepriseCourante] = useState(entreprise);

  const [adresseSaisie, setAdresseSaisie] = useState(entreprise.adresse || "");
  const [codePostalSaisi, setCodePostalSaisi] = useState(entreprise.codePostal || "");
  const [villeSaisie, setVilleSaisie] = useState(entreprise.ville || "");
  const [effectifSaisi, setEffectifSaisi] = useState(String(entreprise.effectif ?? ""));
  const [effectifBeneficiaireSaisi, setEffectifBeneficiaireSaisi] = useState(
    String(entreprise.effectifBeneficiaire ?? "0")
  );
  const [emailSaisi, setEmailSaisi] = useState(
    entreprise.contact?.email && entreprise.contact.email !== "-" ? entreprise.contact.email : ""
  );
  const [contactNomSaisi, setContactNomSaisi] = useState(
    entreprise.contact?.nom && entreprise.contact.nom !== "-" ? entreprise.contact.nom : ""
  );
  const [contactFonctionSaisie, setContactFonctionSaisie] = useState(
    entreprise.contact?.fonction && entreprise.contact.fonction !== "-" ? entreprise.contact.fonction : ""
  );

  const [nouveauTelNumero, setNouveauTelNumero] = useState("");
  const [nouveauTelNote, setNouveauTelNote] = useState("");

  const [enregistrementChamp, setEnregistrementChamp] = useState(false);
  const [erreurChamp, setErreurChamp] = useState(null);

  // Champs propres à la fiche papier — indépendants de l'entreprise,
  // enregistrés uniquement à la validation finale.
  const [prenom, setPrenom] = useState(prenomAgent || "");
  const [date, setDate] = useState(aujourdHui());
  const [numeroDossier, setNumeroDossier] = useState("");
  const [montantTaxesAnnonce, setMontantTaxesAnnonce] = useState(
    Math.round(entreprise.oeth?.montantEstime || 0)
  );
  const [montantAFaire, setMontantAFaire] = useState("");
  const [remarques, setRemarques] = useState("");

  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  // Enregistre immédiatement un champ de la fiche entreprise (PATCH) et
  // fait remonter la mise à jour au CRM — c'est ce qui rend la fiche
  // "modifiable à chaud" plutôt que de tout garder en brouillon local.
  async function sauvegarderChamp(patch) {
    setEnregistrementChamp(true);
    setErreurChamp(null);
    try {
      const updated = await api.patchEntreprise(entreprise.id, patch);
      setEntrepriseCourante(updated);
      onMaj?.(updated);
    } catch (e) {
      setErreurChamp(e.message);
    } finally {
      setEnregistrementChamp(false);
    }
  }

  function sauvegarderContact(partiel) {
    return sauvegarderChamp({ contact: { ...entrepriseCourante.contact, ...partiel } });
  }

  function ajouterTelephone(ev) {
    ev.preventDefault();
    if (!nouveauTelNumero.trim()) return;
    const alternatesActuels = entrepriseCourante.contact?.telephonesAlternatifs || [];
    const nouvelleEntree = {
      id: idUnique(),
      numero: nouveauTelNumero.trim(),
      note: nouveauTelNote.trim(),
      dateAjout: new Date().toISOString(),
    };
    sauvegarderContact({ telephonesAlternatifs: [...alternatesActuels, nouvelleEntree] });
    setNouveauTelNumero("");
    setNouveauTelNote("");
  }

  // Le numéro promu devient LE numéro utilisé partout dans le CRM (appel,
  // relances) ; l'ancien numéro principal est conservé dans les alternatifs
  // plutôt que perdu, au cas où celui obtenu au standard soit lui-même
  // remis en cause plus tard.
  function definirCommePrioritaire(alt) {
    const contact = entrepriseCourante.contact || {};
    const ancienPrincipal = contact.telephone;
    const autresAlternates = (contact.telephonesAlternatifs || []).filter((a) => a.id !== alt.id);
    if (ancienPrincipal && ancienPrincipal !== alt.numero) {
      autresAlternates.push({
        id: idUnique(),
        numero: ancienPrincipal,
        note: "Ancien numéro principal",
        dateAjout: new Date().toISOString(),
      });
    }
    sauvegarderContact({ telephone: alt.numero, telephoneInvalide: false, telephonesAlternatifs: autresAlternates });
  }

  function retirerTelephoneAlternatif(alt) {
    const autresAlternates = (entrepriseCourante.contact?.telephonesAlternatifs || []).filter((a) => a.id !== alt.id);
    sauvegarderContact({ telephonesAlternatifs: autresAlternates });
  }

  async function soumettre(ev) {
    ev.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      const updated = await api.soumettreFicheProspection(entreprise.id, {
        prenom,
        date,
        numeroDossier,
        personneEnChargeNom: entrepriseCourante.contact?.nom || "",
        personneEnChargeFonction: entrepriseCourante.contact?.fonction || "",
        nombreTravailleursHandicapes: entrepriseCourante.effectifBeneficiaire || 0,
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

  const oeth = entrepriseCourante.oeth;
  const alternates = entrepriseCourante.contact?.telephonesAlternatifs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFermer}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700"
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
          {/* Ancrage CRM fixe — identité légale, jamais modifiée depuis cette fiche */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-sm">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{entreprise.nom}</p>
            <p className="text-slate-500 dark:text-slate-400">SIRET : {entreprise.siret || "-"} (identité légale, non modifiable)</p>
          </div>

          {erreurChamp && <p className="text-xs text-red-600 dark:text-red-400">{erreurChamp}</p>}

          {/* Informations modifiables à chaud */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Informations entreprise
              </h3>
              {enregistrementChamp && <span className="text-[10px] text-slate-400">Enregistrement…</span>}
            </div>

            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Adresse
              <input
                type="text"
                value={adresseSaisie}
                onChange={(e) => setAdresseSaisie(e.target.value)}
                onBlur={() => adresseSaisie !== entreprise.adresse && sauvegarderChamp({ adresse: adresseSaisie })}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Code postal
                <input
                  type="text"
                  value={codePostalSaisi}
                  onChange={(e) => setCodePostalSaisi(e.target.value)}
                  onBlur={() => sauvegarderChamp({ codePostal: codePostalSaisi })}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <label className="col-span-2 block text-xs text-slate-500 dark:text-slate-400">
                Ville
                <input
                  type="text"
                  value={villeSaisie}
                  onChange={(e) => setVilleSaisie(e.target.value)}
                  onBlur={() => sauvegarderChamp({ ville: villeSaisie })}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Effectif total
                <input
                  type="number"
                  min={0}
                  value={effectifSaisi}
                  onChange={(e) => setEffectifSaisi(e.target.value)}
                  onBlur={() => sauvegarderChamp({ effectif: Number(effectifSaisi) || 0 })}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Travailleurs handicapés déjà employés
                <input
                  type="number"
                  min={0}
                  value={effectifBeneficiaireSaisi}
                  onChange={(e) => setEffectifBeneficiaireSaisi(e.target.value)}
                  onBlur={() => sauvegarderChamp({ effectifBeneficiaire: Number(effectifBeneficiaireSaisi) || 0 })}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
            </div>

            {/* Affichage du manque : le cœur de l'argumentaire pendant l'appel */}
            {oeth?.assujetti && (
              <div
                className={`rounded-lg border p-3 text-sm font-medium ${
                  oeth.deficit > 0
                    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300"
                    : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300"
                }`}
              >
                {oeth.deficit > 0
                  ? `Il manque ${oeth.deficit} travailleur${oeth.deficit > 1 ? "s" : ""} handicapé${oeth.deficit > 1 ? "s" : ""} (unité${oeth.deficit > 1 ? "s" : ""} bénéficiaire${oeth.deficit > 1 ? "s" : ""}) pour atteindre la conformité — sur ${oeth.unitesRequises} requise${oeth.unitesRequises > 1 ? "s" : ""}.`
                  : "Conformité atteinte : plus aucune unité bénéficiaire manquante."}
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Contact
            </h3>
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Email
              <input
                type="email"
                value={emailSaisi}
                onChange={(e) => setEmailSaisi(e.target.value)}
                onBlur={() => sauvegarderContact({ email: emailSaisi })}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Nom de la personne en charge
                <input
                  type="text"
                  value={contactNomSaisi}
                  onChange={(e) => setContactNomSaisi(e.target.value)}
                  onBlur={() => sauvegarderContact({ nom: contactNomSaisi })}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Fonction
                <input
                  type="text"
                  value={contactFonctionSaisie}
                  onChange={(e) => setContactFonctionSaisie(e.target.value)}
                  onBlur={() => sauvegarderContact({ fonction: contactFonctionSaisie })}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
            </div>

            {/* Gestion dynamique des numéros de téléphone */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Numéro principal (utilisé pour les appels) :{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {entrepriseCourante.contact?.telephone || "aucun"}
                </strong>
              </p>

              {alternates.length > 0 && (
                <ul className="space-y-1">
                  {alternates.map((alt) => (
                    <li
                      key={alt.id}
                      className="flex items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5"
                    >
                      <span className="text-slate-600 dark:text-slate-300">
                        {alt.numero}
                        {alt.note ? ` — ${alt.note}` : ""}
                      </span>
                      <span className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => definirCommePrioritaire(alt)}
                          className="rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 hover:bg-amber-200 dark:hover:bg-amber-900"
                        >
                          Définir comme prioritaire
                        </button>
                        <button
                          type="button"
                          onClick={() => retirerTelephoneAlternatif(alt)}
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 px-1"
                          title="Retirer ce numéro"
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Nouveau numéro (ex : obtenu via le standard)"
                  value={nouveauTelNumero}
                  onChange={(e) => setNouveauTelNumero(e.target.value)}
                  className="flex-1 min-w-[160px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Note (optionnel)"
                  value={nouveauTelNote}
                  onChange={(e) => setNouveauTelNote(e.target.value)}
                  className="w-40 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={ajouterTelephone}
                  disabled={!nouveauTelNumero.trim()}
                  className="rounded-lg bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium px-3 py-1.5 disabled:opacity-40"
                >
                  + Ajouter
                </button>
              </div>
            </div>
          </div>

          {/* Champs propres à la fiche papier — enregistrés à la validation */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Fiche du jour
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Prénom (agent)
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
          </div>

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
                Fermer
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
