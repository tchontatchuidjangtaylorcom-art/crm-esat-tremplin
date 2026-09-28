import { useEffect, useState } from "react";
import { formatMontant } from "../constants.js";

// Mêmes règles que server/src/oeth.js (sans déductions, comme l'estimation
// de la fiche) : quota = 6 % de l'effectif arrondi à l'entier inférieur dès
// 20 salariés ; unités manquantes = quota − BOETH ; contribution = unités
// manquantes × coefficient × SMIC horaire, le coefficient dépendant de la
// taille (400 / 500 / 600), ou 1 500 (surcontribution) si aucun BOETH.
export function calculerObligationRapide({ effectif, boeth, smicHoraire }) {
  const eff = Number(effectif) || 0;
  const beneficiaires = Math.max(0, Number(boeth) || 0);
  const assujetti = eff >= 20;
  const quota = assujetti ? Math.floor(eff * 0.06) : 0;
  const manque = assujetti ? Math.max(0, quota - beneficiaires) : 0;
  const surcontribution = manque > 0 && beneficiaires === 0;
  const coefficient = manque > 0 ? (surcontribution ? 1500 : eff <= 249 ? 400 : eff <= 749 ? 500 : 600) : 0;
  const montant = smicHoraire ? Math.round(manque * coefficient * smicHoraire) : null;
  return { eff, beneficiaires, assujetti, quota, manque, surcontribution, montant };
}

// Texte du récapitulatif envoyé au client après l'appel (modifiable dans la
// fenêtre d'envoi avant l'envoi).
export function resumeObligationEmail(entreprise, c) {
  const lignes = [
    "Bonjour,",
    "",
    `Suite à notre échange téléphonique, voici le récapitulatif de la situation de ${entreprise.nom} au regard de l'obligation d'emploi des travailleurs handicapés (OETH) :`,
    "",
    `• Effectif d'assujettissement : ${c.eff.toLocaleString("fr-FR")} salariés`,
    `• Obligation d'emploi (6 %) : ${c.quota} bénéficiaire${c.quota > 1 ? "s" : ""}`,
    `• Bénéficiaires déjà employés (BOETH) : ${c.beneficiaires.toLocaleString("fr-FR")}`,
    `• Unités manquantes : ${c.manque.toLocaleString("fr-FR")}`,
  ];
  if (c.montant != null && c.manque > 0) {
    lignes.push(
      `• Contribution annuelle estimée : ${formatMontant(c.montant)}${
        c.surcontribution ? " (contribution majorée, faute de bénéficiaire employé)" : ""
      }`
    );
  }
  lignes.push(
    "",
    c.manque > 0
      ? "Ce montant est une estimation, avant déductions éventuelles (sous-traitance auprès d'un ESAT / EA / TIH, dépenses déductibles). Nous pouvons étudier ensemble les solutions pour le réduire : recrutement direct, sous-traitance, accompagnement."
      : "D'après ces chiffres, votre quota est atteint : aucune contribution n'est due. Nous restons disponibles pour vous accompagner dans la durée.",
    "",
    "N'hésitez pas à nous répondre pour corriger un chiffre ou convenir d'un rendez-vous.",
    "",
    "Bien cordialement,"
  );
  return {
    objet: `Votre obligation d'emploi (OETH) — récapitulatif de notre échange`,
    corps: lignes.join("\n"),
  };
}

// Ligne compacte de l'en-tête de fiche : l'effectif (estimé depuis Sirene,
// à confirmer au téléphone) et les BOETH se corrigent sur place ; 6 %,
// unités manquantes et contribution se recalculent à chaque frappe.
// « Enregistrer » met la fiche à jour, « Résumé » prépare l'e-mail au client.
export default function CalculObligationFiche({ entreprise, enregistrement, onEnregistrer, onResume }) {
  const [effectif, setEffectif] = useState(String(entreprise.effectif ?? ""));
  const [boeth, setBoeth] = useState(String(entreprise.effectifBeneficiaire ?? 0));

  // Resynchronise quand la fiche change (enregistrement, autre fiche, panneau ESAT).
  useEffect(() => {
    setEffectif(String(entreprise.effectif ?? ""));
    setBoeth(String(entreprise.effectifBeneficiaire ?? 0));
  }, [entreprise.id, entreprise.effectif, entreprise.effectifBeneficiaire]);

  const c = calculerObligationRapide({ effectif, boeth, smicHoraire: entreprise.oeth?.tauxHoraireSmic });
  const neutralisee = Boolean(entreprise.oeth?.neutralisation?.neutralise);
  const modifie =
    Number(effectif) !== Number(entreprise.effectif || 0) || Number(boeth) !== Number(entreprise.effectifBeneficiaire || 0);
  const champ =
    "rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-marine-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  function enregistrer(ev) {
    ev.preventDefault();
    onEnregistrer({ effectif: c.eff, effectifBeneficiaire: c.beneficiaires });
  }

  return (
    <form onSubmit={enregistrer} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
      <label className="flex items-center gap-1 text-slate-500 dark:text-slate-400" title="Effectif (estimé d'après Sirene — à confirmer avec le client)">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={effectif}
          onChange={(e) => setEffectif(e.target.value)}
          aria-label="Effectif (salariés)"
          className={`w-[4.75rem] ${champ}`}
        />
        sal.
      </label>
      <span className="text-slate-500 dark:text-slate-400" title="Obligation : 6 % de l'effectif, arrondi à l'entier inférieur">
        6 % = <strong className="text-slate-800 dark:text-slate-100 tabular-nums">{c.assujetti ? c.quota : "—"}</strong>
      </span>
      <label className="flex items-center gap-1 text-slate-500 dark:text-slate-400" title="Bénéficiaires de l'obligation d'emploi déjà employés">
        BOETH
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={boeth}
          onChange={(e) => setBoeth(e.target.value)}
          aria-label="BOETH déjà employés"
          className={`w-14 ${champ}`}
        />
      </label>
      {!c.assujetti ? (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Moins de 20 sal. : non assujettie
        </span>
      ) : c.manque > 0 ? (
        <span className="px-2.5 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {c.manque} manquant{c.manque > 1 ? "s" : ""}
        </span>
      ) : (
        <span className="px-2.5 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          Conforme
        </span>
      )}
      {c.manque > 0 && c.montant != null && (
        <strong
          className={`tabular-nums ${c.surcontribution ? "text-amber-700 dark:text-amber-400" : "text-slate-800 dark:text-slate-100"}`}
          title={c.surcontribution ? "Contribution majorée : aucun bénéficiaire employé" : "Contribution annuelle estimée, avant déductions"}
        >
          {neutralisee ? "0 € (création < 5 ans)" : `${formatMontant(c.montant)}/an`}
        </strong>
      )}
      <button
        type="submit"
        disabled={!modifie || enregistrement}
        className="rounded-md bg-marine-700 hover:bg-marine-800 text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-40"
        title={modifie ? "Enregistrer ces chiffres sur la fiche" : "Chiffres déjà enregistrés"}
      >
        {enregistrement ? "…" : modifie ? "Enregistrer" : "✓ Enregistré"}
      </button>
      <button
        type="button"
        onClick={() => onResume(resumeObligationEmail(entreprise, c))}
        disabled={!c.assujetti}
        className="rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold px-2.5 py-1.5 disabled:opacity-40"
        title="Préparer un e-mail récapitulatif pour le client"
      >
        ✉ Résumé
      </button>
    </form>
  );
}
