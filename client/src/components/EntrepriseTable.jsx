import { useEffect, useRef, useState } from "react";
import StatusSelect from "./StatusSelect.jsx";
import BadgeCollecteur from "./BadgeCollecteur.jsx";
import CommentaireRapideModal from "./CommentaireRapideModal.jsx";
import GenererEmailModal from "./GenererEmailModal.jsx";
import { formatMontant, formatDateHeure } from "../constants.js";
import BoutonAppel from "../telephony/BoutonAppel.jsx";
import { diffuserEntrepriseArchivee } from "../telephony/CallContext.jsx";
import { api } from "../api.js";
import SelecteurPersonne from "./SelecteurPersonne.jsx";

// Aucune adresse mail connue pour cette fiche (ni principale, ni alternative)
// — la seule situation où le bouton "Générer un e-mail" a un sens dans le
// tableau : sans destinataire, il n'y a rien à faire depuis la fiche
// complète (MessagerieMail) que l'agent n'ait pas déjà sous les yeux ici.
function sansEmailConnu(entreprise) {
  return !entreprise.contact?.email && !(entreprise.contact?.emailsAlternatifs?.length > 0);
}

// Adresse à afficher/utiliser comme destinataire : la principale si elle
// existe, sinon la première alternative connue (ex : trouvée par l'IA mais
// pas encore promue principale).
function adresseEmailConnue(entreprise) {
  return entreprise.contact?.email || entreprise.contact?.emailsAlternatifs?.[0]?.email || null;
}

function OethCell({ oeth }) {
  if (!oeth?.assujetti) {
    return <span className="text-xs text-slate-400 italic">Non assujetti (&lt; 20 sal.)</span>;
  }
  if (oeth.conforme) {
    return <span className="text-xs font-medium text-green-700">Conforme (0 UB manquante)</span>;
  }
  // Version courte pour gagner de la hauteur : le détail (UB requises,
  // surcontribution) reste dans l'infobulle et sur la fiche.
  return (
    <span
      title={`${oeth.deficit} UB manquante${oeth.deficit > 1 ? "s" : ""} sur ${oeth.unitesRequises}${oeth.surcontribution ? " — surcontribution (0 recruté)" : ""}`}
      className={`text-xs font-semibold whitespace-nowrap ${oeth.surcontribution ? "text-red-700" : "text-orange-700"}`}
    >
      −{oeth.deficit} UB
    </span>
  );
}

function EcheanceCell({ entreprise }) {
  const echeance = entreprise.dateRdv || entreprise.dateRappel;
  if (!echeance) return <span className="text-slate-300 dark:text-slate-600">-</span>;
  return (
    <span className="text-xs whitespace-nowrap">
      {entreprise.dateRdv ? "RDV : " : "Rappel : "}
      <strong>{formatDateHeure(echeance)}</strong>
    </span>
  );
}

// Bouton de sortie rapide "Mort" directement depuis la liste — sans avoir à
// passer par un appel ou ouvrir la fiche. Réutilise le même événement DOM que
// le module AGIR (voir CallContext) pour que le tableau de bord retire
// immédiatement la ligne, exactement comme après une sortie via le CallPanel.
function BoutonMarquerMort({ entreprise }) {
  const [enCours, setEnCours] = useState(false);

  async function marquerMort(ev) {
    ev.stopPropagation();
    if (!window.confirm(`Marquer « ${entreprise.nom} » comme mort et retirer du flux actif ?`)) return;
    setEnCours(true);
    try {
      const { entreprise: updated } = await api.enregistrerSortie(entreprise.id, {
        sortie: "mort",
        details: "Sortie rapide depuis le tableau de bord.",
      });
      diffuserEntrepriseArchivee(updated);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <button
      onClick={marquerMort}
      disabled={enCours}
      title="Marquer mort (archive le dossier, hors pipeline actif)"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-700 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-red-950 dark:hover:text-red-400 transition disabled:opacity-40"
    >
      ✕
    </button>
  );
}

// Bouton "+" d'action rapide (commentaire) — ouvre la modale légère plutôt
// qu'un popover positionné en absolu dans la cellule : dans un tableau qui
// défile horizontalement (overflow-x-auto), un popover ancré à une ligne du
// bas se ferait couper ; une modale centrée reste toujours entièrement visible.
function BoutonCommentaireRapide({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="Ajouter un commentaire rapide (sans ouvrir la fiche)"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-marine-100 hover:text-marine-700 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-marine-950 dark:hover:text-marine-300 transition"
    >
      +
    </button>
  );
}

// En-tête de colonne triable : flèche qui indique le sens actif, neutre
// (double flèche discrète) quand ce n'est pas la colonne triée. Réutilisé
// pour "Contact" (présence de numéro) et "Commentaire récent" (chronologie).
function EnTeteTriable({ colonne, label, tri, onTrier }) {
  const actif = tri?.colonne === colonne;
  return (
    <button
      type="button"
      onClick={() => onTrier(colonne)}
      className={`flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 ${
        actif ? "text-slate-700 dark:text-slate-200" : ""
      }`}
      title={`Trier par ${label.toLowerCase()}`}
    >
      {label}
      <span aria-hidden className="text-[10px] leading-none">
        {actif ? (tri.direction === "desc" ? "▼" : "▲") : "⇅"}
      </span>
    </button>
  );
}

// Case à cocher de l'en-tête : coche/décoche toutes les lignes affichées
// (la page courante) et passe à l'état "indéterminé" (trait, ni coché ni
// vide) quand certaines lignes seulement sont sélectionnées — signal visuel
// standard pour "sélection partielle" qu'un simple `checked` ne rend pas.
function CaseTout({ etat, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = etat === "partiel";
  }, [etat]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={etat === "tout"}
      onChange={onChange}
      className="rounded border-slate-300"
      aria-label="Tout sélectionner"
    />
  );
}

export default function EntrepriseTable({
  entreprises,
  estAdmin,
  agents,
  moiId,
  onAssigner,
  selection,
  onToggleSelection,
  onToggleSelectionTout,
  tri,
  onTrier,
}) {
  const nbColonnes = (estAdmin ? 11 : 10) + 1;
  const nbCochees = entreprises.filter((e) => selection.has(e.id)).length;
  const etatToutCoche = entreprises.length > 0 && nbCochees === entreprises.length ? "tout" : nbCochees > 0 ? "partiel" : "aucun";
  const [commentaireOuvertPour, setCommentaireOuvertPour] = useState(null);
  const [emailOuvertPour, setEmailOuvertPour] = useState(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
            <th className="px-3 py-2 text-left w-8">
              <CaseTout etat={etatToutCoche} onChange={() => onToggleSelectionTout(entreprises.map((e) => e.id))} />
            </th>
            <th className="px-3 py-2 text-left">Société</th>
            <th className="px-3 py-2 text-left">Statut</th>
            <th className="px-3 py-2 text-left">Échéance</th>
            <th className="px-3 py-2 text-left">Secteur</th>
            <th className="px-3 py-2 text-left">Obligation OETH</th>
            <th className="px-3 py-2 text-left">Montant estimé</th>
            <th className="px-3 py-2 text-left">
              <EnTeteTriable colonne="contact" label="Contact" tri={tri} onTrier={onTrier} />
            </th>
            <th className="px-3 py-2 text-left">CP</th>
            <th className="px-3 py-2 text-left">
              <EnTeteTriable colonne="commentaire" label="Commentaire récent" tri={tri} onTrier={onTrier} />
            </th>
            {estAdmin && <th className="px-3 py-2 text-left">Assigné à</th>}
            <th className="px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {entreprises.map((e) => {
            const dernierCommentaire = e.commentaires?.[0]?.texte;
            const coche = selection.has(e.id);
            return (
              <tr
                key={e.id}
                className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${coche ? "bg-marine-50 dark:bg-marine-950/30" : ""}`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={coche}
                    onChange={() => onToggleSelection(e.id)}
                    className="rounded border-slate-300"
                    aria-label={`Sélectionner ${e.nom}`}
                  />
                </td>
                {/* Nom sur une seule ligne (coupé, complet au survol) : plus de
                    fiches visibles à l'écran sans faire défiler. */}
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100 max-w-[15rem]">
                  <a
                    href={`/entreprise/${e.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate hover:underline hover:text-marine-700 dark:hover:text-marine-300"
                    title={`${e.nom} — ouvrir la fiche dans un nouvel onglet`}
                  >
                    {e.nom}
                  </a>
                  {e.binomeId && (
                    <span
                      title={`Fiche en binôme : ${e.assigneANom || "non assignée"} + ${e.binomeNom}`}
                      className="ml-1 inline-block rounded-full bg-teal-100 text-teal-800 border border-teal-300 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800 px-2 py-0.5 text-[10px] font-semibold align-middle whitespace-nowrap"
                    >
                      👥 {e.assigneANom ? `${e.assigneANom} + ${e.binomeNom}` : e.binomeNom}
                    </span>
                  )}
                  {e.origine === "site_web" && (
                    <span
                      title={e.demandesSite?.[0]?.libelle ? `Dernière demande : ${e.demandesSite[0].libelle}` : "Demande reçue du site web"}
                      className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold align-middle ${
                        e.demandeSiteNonVue
                          ? "bg-teal-500 text-white"
                          : "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
                      }`}
                    >
                      🌐 Site web{e.demandeSiteNonVue ? " · nouveau" : ""}
                    </span>
                  )}
                  {e.confirmationClient && (
                    <span
                      title={`Effectif et bénéficiaires confirmés par ${e.confirmationClient.nom} le ${new Date(e.confirmationClient.date).toLocaleDateString("fr-FR")}`}
                      className="ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold align-middle bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      ✅ Confirmée client
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 min-w-0">
                    <BadgeCollecteur entreprise={e} className="shrink-0" />
                    <span className="truncate">
                      {e.effectif ?? "?"} sal. · {e.categorie?.label}
                      {e.lot ? ` · ${e.lot}` : ""}
                    </span>
                  </span>
                  {e.superviseurNom ? (
                    <span className="block text-[11px] font-medium text-violet-700 dark:text-violet-300">
                      🤝 {e.assigneANom || "—"} → sup. {e.superviseurNom}
                    </span>
                  ) : (
                    e.statut === "fiche" && (
                      <span className="block text-[11px] text-violet-500 dark:text-violet-400">🤝 Sans superviseur{e.assigneANom ? ` · agent ${e.assigneANom}` : ""}</span>
                    )
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusSelect entreprise={e} />
                  {e.statut === "mail" && e.aussiMeRappelle && (
                    <span
                      className="block mt-1 text-[10px] font-semibold text-violet-700 dark:text-violet-300"
                      title="En attente d'un mail ET d'un rappel du contact (aussi dans « Me rappelle »)"
                    >
                      + me rappelle
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <EcheanceCell entreprise={e} />
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-[11rem]">
                  <span className="line-clamp-2 text-xs" title={e.secteurActivite}>
                    {e.secteurActivite}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <OethCell oeth={e.oeth} />
                </td>
                <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                  {e.oeth?.assujetti ? formatMontant(e.oeth.montantEstime) : "-"}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {e.contact?.nom && e.contact.nom !== "-" && <span className="block">{e.contact.nom}</span>}
                  {/* Numéro et e-mail sont deux actions dissociées : l'un ne
                      déclenche jamais l'autre — cliquer le numéro appelle
                      (BoutonAppel), cliquer l'e-mail ouvre uniquement
                      l'interface d'envoi (GenererEmailModal), jamais le
                      téléphone. */}
                  <BoutonAppel entreprise={e} variant="lien" />
                  {sansEmailConnu(e) ? (
                    <button
                      onClick={() => setEmailOuvertPour(e)}
                      title={estAdmin ? "Aucune adresse mail connue — générer un e-mail avec l'IA" : "Aucune adresse mail connue — écrire un e-mail"}
                      className="block mt-1 text-[11px] font-medium text-marine-700 dark:text-marine-300 hover:underline whitespace-nowrap"
                    >
                      {estAdmin ? "✨ Générer un e-mail" : "✉️ Écrire un e-mail"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setEmailOuvertPour(e)}
                      title={`Envoyer un e-mail à ${adresseEmailConnue(e)}`}
                      className="block mt-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[160px]"
                    >
                      {adresseEmailConnue(e)}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{e.codePostal}</td>
                <td
                  className="px-3 py-2 text-slate-500 dark:text-slate-400 max-w-[220px] truncate"
                  title={dernierCommentaire}
                >
                  {dernierCommentaire || "-"}
                </td>
                {estAdmin && (
                  <td className="px-3 py-2">
                    <SelecteurPersonne
                      personnes={agents}
                      moiId={moiId}
                      valeur={e.assigneA || ""}
                      onChange={(id) => onAssigner?.(e.id, id || null)}
                      optionsSpeciales={[{ valeur: "", label: "Non assigné" }]}
                      placeholder="Non assigné"
                      className="text-xs px-2 py-1 w-36"
                    />
                  </td>
                )}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <BoutonAppel entreprise={e} variant="icone" />
                    <BoutonCommentaireRapide onClick={() => setCommentaireOuvertPour(e)} />
                    <BoutonMarquerMort entreprise={e} />
                  </div>
                </td>
              </tr>
            );
          })}
          {entreprises.length === 0 && (
            <tr>
              <td colSpan={nbColonnes} className="px-3 py-8 text-center text-slate-400 dark:text-slate-500">
                Aucune entreprise pour ce filtre.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {commentaireOuvertPour && (
        <CommentaireRapideModal
          entreprise={commentaireOuvertPour}
          onFermer={() => setCommentaireOuvertPour(null)}
        />
      )}
      {emailOuvertPour && (
        <GenererEmailModal
          entreprise={emailOuvertPour}
          onFermer={() => setEmailOuvertPour(null)}
          autoGenerer={sansEmailConnu(emailOuvertPour)}
        />
      )}
    </div>
  );
}
