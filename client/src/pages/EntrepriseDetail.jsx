import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api.js";
import StatusBadge from "../components/StatusBadge.jsx";
import MessagerieMail from "../components/MessagerieMail.jsx";
import FicheSuiviProspect from "../components/FicheSuiviProspect.jsx";
import BoutonAppel from "../telephony/BoutonAppel.jsx";
import { useIdentiteActuelle } from "../identite.js";
import {
  ISSUES_APPEL,
  SORTIES_DOSSIER,
  formatMontant,
  formatDate,
  formatDateHeure,
  formatDuree,
} from "../constants.js";

// Libellé + style du badge de neutralisation légale (règle des 5 ans), utilisé
// à la fois dans "Informations structure" et dans "Obligation OETH".
function libelleNeutralisation(neutralisation) {
  if (!neutralisation || neutralisation.ancienneteAnnees == null) {
    return { label: "Date de création non renseignée", className: "bg-slate-100 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600" };
  }
  const { ancienneteAnnees, alerteAnticipation, neutralise } = neutralisation;
  const an = `${ancienneteAnnees} an${ancienneteAnnees > 1 ? "s" : ""}`;
  if (alerteAnticipation) {
    return {
      label: `Alerte Anticipation (An ${ancienneteAnnees}) — bientôt assujettie`,
      className: "bg-amber-100 text-amber-800 border-amber-300",
    };
  }
  if (neutralise) {
    return {
      label: `Non assujettie — Période de neutralisation (${an} < 5 ans)`,
      className: "bg-emerald-100 text-emerald-700 border-emerald-300",
    };
  }
  return {
    label: `Assujettissement complet (${an})`,
    className: "bg-slate-100 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600",
  };
}

export default function EntrepriseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { prenom: prenomAgent } = useIdentiteActuelle();
  const [entreprise, setEntreprise] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [enregistrementTelephone, setEnregistrementTelephone] = useState(false);
  const [nouveauTelephone, setNouveauTelephone] = useState("");
  const [rechercheIaEnCours, setRechercheIaEnCours] = useState(false);
  const [propositionIa, setPropositionIa] = useState(null);
  const [erreurRechercheIa, setErreurRechercheIa] = useState(null);
  const [appliquerCategorieSuggeree, setAppliquerCategorieSuggeree] = useState(true);
  const [ficheSuiviOuverte, setFicheSuiviOuverte] = useState(false);
  const [toastFiche, setToastFiche] = useState(false);

  useEffect(() => {
    if (!toastFiche) return;
    const idTimer = setTimeout(() => setToastFiche(false), 4000);
    return () => clearTimeout(idTimer);
  }, [toastFiche]);

  const [issueChoisie, setIssueChoisie] = useState("");
  const [dateIssue, setDateIssue] = useState("");
  const [detailsIssue, setDetailsIssue] = useState("");

  const [sortieChoisie, setSortieChoisie] = useState("");
  const [detailsSortie, setDetailsSortie] = useState("");

  const [nouveauCommentaire, setNouveauCommentaire] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  const [effectifSaisi, setEffectifSaisi] = useState("");
  const [effectifBeneficiaireSaisi, setEffectifBeneficiaireSaisi] = useState("");
  const [enregistrementEffectifs, setEnregistrementEffectifs] = useState(false);

  const [dateCreationSaisie, setDateCreationSaisie] = useState("");
  const [enregistrementDateCreation, setEnregistrementDateCreation] = useState(false);
  const [enregistrementSecteurPublic, setEnregistrementSecteurPublic] = useState(false);

  const [siteWebSaisi, setSiteWebSaisi] = useState("");
  const [enregistrementSiteWeb, setEnregistrementSiteWeb] = useState(false);
  const [enregistrementConsentement, setEnregistrementConsentement] = useState(false);

  const [dateRappelSaisie, setDateRappelSaisie] = useState("");
  const [dateRdvSaisie, setDateRdvSaisie] = useState("");
  const [enregistrementEcheance, setEnregistrementEcheance] = useState(false);

  function charger() {
    api
      .getEntreprise(id)
      .then((e) => {
        setEntreprise(e);
        setEffectifSaisi(String(e.effectif));
        setEffectifBeneficiaireSaisi(String(e.effectifBeneficiaire));
        setDateCreationSaisie(e.dateCreation || "");
        setDateRappelSaisie(e.dateRappel || "");
        setDateRdvSaisie(e.dateRdv || "");
        setSiteWebSaisi(e.siteWeb || "");
        setErreur(null);
      })
      .catch((e) => setErreur(e.message));
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Se met à jour si un appel VoIP (module AGIR) enregistre une issue pendant
  // que cette fiche est ouverte.
  useEffect(() => {
    function onMaj(ev) {
      if (ev.detail.id === id) setEntreprise(ev.detail);
    }
    function onArchive(ev) {
      if (ev.detail.id === id) navigate("/");
    }
    window.addEventListener("entreprise:maj", onMaj);
    window.addEventListener("entreprise:archivee", onArchive);
    return () => {
      window.removeEventListener("entreprise:maj", onMaj);
      window.removeEventListener("entreprise:archivee", onArchive);
    };
  }, [id, navigate]);

  async function soumettreIssueAppel(ev) {
    ev.preventDefault();
    if (!issueChoisie) return;
    const infoIssue = ISSUES_APPEL.find((i) => i.value === issueChoisie);
    if (infoIssue?.needsDate && !dateIssue) {
      setErreur("Merci de choisir une date pour cette issue d'appel.");
      return;
    }
    setEnregistrement(true);
    try {
      const updated = await api.enregistrerAppel(id, {
        issue: issueChoisie,
        date: dateIssue || null,
        details: detailsIssue || null,
      });
      setEntreprise(updated);
      setIssueChoisie("");
      setDateIssue("");
      setDetailsIssue("");
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  async function soumettreSortieDossier(ev) {
    ev.preventDefault();
    if (!sortieChoisie) return;
    setEnregistrement(true);
    try {
      const { archive, entreprise: updated } = await api.enregistrerSortie(id, {
        sortie: sortieChoisie,
        details: detailsSortie || null,
      });
      if (archive) {
        // Dossier "mort" : archivé côté serveur, retiré du pipeline actif —
        // retour au tableau de bord, la fiche n'y est plus consultable en direct.
        navigate("/");
        return;
      }
      setEntreprise(updated);
      setSortieChoisie("");
      setDetailsSortie("");
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  async function soumettreCommentaire(ev) {
    ev.preventDefault();
    if (!nouveauCommentaire.trim()) return;
    setEnregistrement(true);
    try {
      const updated = await api.ajouterCommentaire(id, { texte: nouveauCommentaire, auteur: prenomAgent });
      setEntreprise(updated);
      setNouveauCommentaire("");
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  }

  async function mettreAJourEffectifs(payload) {
    setEnregistrementEffectifs(true);
    try {
      const updated = await api.patchEntreprise(id, payload);
      setEntreprise(updated);
      setEffectifSaisi(String(updated.effectif));
      setEffectifBeneficiaireSaisi(String(updated.effectifBeneficiaire));
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrementEffectifs(false);
    }
  }

  async function soumettreEffectifs(ev) {
    ev.preventDefault();
    await mettreAJourEffectifs({
      effectif: Number(effectifSaisi) || 0,
      effectifBeneficiaire: Number(effectifBeneficiaireSaisi) || 0,
    });
  }

  // Planifie ou corrige directement une échéance (relance/RDV), sans passer
  // par le module AGIR — utile notamment pour "À relancer", qui n'a pas
  // d'issue d'appel dédiée, ou pour corriger une date après coup.
  async function soumettreEcheance(ev) {
    ev.preventDefault();
    setEnregistrementEcheance(true);
    try {
      const updated = await api.patchEntreprise(id, {
        dateRappel: dateRappelSaisie || null,
        dateRdv: dateRdvSaisie || null,
      });
      setEntreprise(updated);
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrementEcheance(false);
    }
  }

  async function soumettreDateCreation(ev) {
    ev.preventDefault();
    setEnregistrementDateCreation(true);
    try {
      const updated = await api.patchEntreprise(id, { dateCreation: dateCreationSaisie || null });
      setEntreprise(updated);
      setDateCreationSaisie(updated.dateCreation || "");
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrementDateCreation(false);
    }
  }

  // Site officiel de l'entreprise : saisie manuelle par l'agent (aucune API
  // publique fiable ne fournit cette donnée — Sirene/recherche-entreprises
  // ne renseigne que des informations légales, pas d'URL commerciale).
  // Alimente notamment le lien cliquable des cartes "Ils sont en règle" de
  // la landing page publique (voir components/vitrine/ToastActivite.jsx).
  async function soumettreSiteWeb(ev) {
    ev.preventDefault();
    setEnregistrementSiteWeb(true);
    try {
      let valeur = siteWebSaisi.trim();
      if (valeur && !/^https?:\/\//i.test(valeur)) valeur = `https://${valeur}`;
      const updated = await api.patchEntreprise(id, { siteWeb: valeur || null });
      setEntreprise(updated);
      setSiteWebSaisi(updated.siteWeb || "");
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrementSiteWeb(false);
    }
  }

  // Autorisation explicite, dossier par dossier, à citer nommément cette
  // entreprise (nom, ville, site web) sur la landing page publique
  // (/vitrine) — jamais activé par défaut : le calcul de conformité OETH
  // reste exact, mais le rendre public sans accord serait une divulgation
  // non consentie du statut réglementaire d'un tiers. Voir /api/vitrine
  // côté serveur pour la liste blanche stricte des champs exposés.
  async function changerConsentementPublic(valeur) {
    setEnregistrementConsentement(true);
    try {
      const updated = await api.patchEntreprise(id, { consentementAffichagePublic: valeur });
      setEntreprise(updated);
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrementConsentement(false);
    }
  }

  // Corrige la classification public/privé (donc le collecteur AGEFIPH/FIPHFP)
  // quand la détection automatique par SIREN ou par mots-clés est erronée.
  async function changerSecteurPublic(valeur) {
    setEnregistrementSecteurPublic(true);
    try {
      const updated = await api.patchEntreprise(id, { secteurPublic: valeur === "oui" });
      setEntreprise(updated);
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrementSecteurPublic(false);
    }
  }

  // Bascule Oui/Non "au moins un bénéficiaire recruté" : force 0 (surcontribution)
  // côté Non, ou restaure/initialise un effectif >= 1 côté Oui, puis déclenche
  // immédiatement le recalcul serveur (seule source de vérité du montant OETH).
  async function changerPresenceBeneficiaire(reponse) {
    const effectifBeneficiaire =
      reponse === "oui" ? Math.max(1, Number(effectifBeneficiaireSaisi) || 1) : 0;
    await mettreAJourEffectifs({
      effectif: Number(effectifSaisi) || 0,
      effectifBeneficiaire,
    });
  }

  // Espace IA : signale un numéro non attribué/invalide (journalisé + flaggé
  // côté serveur) puis, une fois un numéro alternatif trouvé (recherche IA ou
  // pistes manuelles) et vérifié par l'agent, l'enregistre pour lever le signalement.
  async function signalerTelephoneInvalide() {
    setEnregistrementTelephone(true);
    try {
      const updated = await api.signalerTelephoneInvalide(id);
      setEntreprise(updated);
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrementTelephone(false);
    }
  }

  // Recherche IA (Gemini + recherche Google) : propose un numéro/contact et
  // une catégorie de secteur alternatifs SANS rien écrire en base — pré-remplit
  // juste le champ de correction manuel existant, que l'agent doit vérifier
  // et valider lui-même avant "Enregistrer" (un numéro ou une catégorie
  // hallucinés utilisés pour un vrai appel commercial seraient pires que
  // l'absence d'info).
  async function rechercherContactIa() {
    setRechercheIaEnCours(true);
    setErreurRechercheIa(null);
    setPropositionIa(null);
    setAppliquerCategorieSuggeree(true);
    try {
      const resultat = await api.rechercherContactAlternatif(id);
      setPropositionIa(resultat);
      if (resultat.telephone) setNouveauTelephone(resultat.telephone);
      const misAJour = await api.getEntreprise(id);
      setEntreprise(misAJour);
    } catch (e) {
      setErreurRechercheIa(e.message);
    } finally {
      setRechercheIaEnCours(false);
    }
  }

  async function corrigerTelephone(ev) {
    ev.preventDefault();
    const nouveauNumero = nouveauTelephone.trim();
    const appliqueCategorie = appliquerCategorieSuggeree && propositionIa?.secteurCategorie;
    if (!nouveauNumero && !appliqueCategorie) return;
    setEnregistrementTelephone(true);
    try {
      const patch = {};
      if (nouveauNumero) patch.contact = { ...entreprise.contact, telephone: nouveauNumero, telephoneInvalide: false };
      if (appliqueCategorie) patch.categorieForcee = propositionIa.secteurCategorie;
      await api.patchEntreprise(id, patch);
      const morceauxTexte = [];
      if (nouveauNumero) morceauxTexte.push(`Numéro corrigé manuellement : ${nouveauNumero} (ancien numéro signalé invalide).`);
      if (appliqueCategorie) morceauxTexte.push(`Catégorie mise à jour : ${propositionIa.secteurCategorieLabel}.`);
      const updated = await api.ajouterCommentaire(id, {
        texte: morceauxTexte.join(" "),
        auteur: prenomAgent,
      });
      setEntreprise(updated);
      setNouveauTelephone("");
      setPropositionIa(null);
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrementTelephone(false);
    }
  }

  const infoIssueSelectionnee = ISSUES_APPEL.find((i) => i.value === issueChoisie);

  if (erreur && !entreprise) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          &larr; Retour au tableau de bord
        </Link>
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {erreur}
        </div>
      </div>
    );
  }

  if (!entreprise) {
    return <div className="p-6 text-slate-400 dark:text-slate-500 text-sm">Chargement…</div>;
  }

  const { oeth, categorie } = entreprise;

  // Fusionne historique d'appels et commentaires pour la messagerie, triés du plus récent au plus ancien.
  const fil = [
    ...entreprise.historiqueAppels.map((h) => ({ ...h, kind: "appel" })),
    ...entreprise.commentaires.map((c) => ({ ...c, kind: "commentaire" })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="min-h-screen p-6">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        &larr; Retour au tableau de bord
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mt-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{entreprise.nom}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {entreprise.adresse}, {entreprise.codePostal} {entreprise.ville}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFicheSuiviOuverte(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-sm font-medium px-3 py-2 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            title="Numériser la fiche de suivi prospect papier"
          >
            📝 Fiche de suivi prospect
          </button>
          <a
            href={`/api/entreprises/${id}/rapport-pdf`}
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
            title="Générer un PDF avec les indicateurs OETH et l'historique de prospection"
          >
            📄 Télécharger le rapport PDF
          </a>
          <StatusBadge statut={entreprise.statut} />
        </div>
      </div>

      {ficheSuiviOuverte && (
        <FicheSuiviProspect
          entreprise={entreprise}
          prenomAgent={prenomAgent}
          onFermer={() => setFicheSuiviOuverte(false)}
          onValide={(updated) => {
            setEntreprise(updated);
            setFicheSuiviOuverte(false);
            setToastFiche(true);
          }}
        />
      )}

      {toastFiche && (
        <div
          role="status"
          className="fixed top-6 right-6 z-50 flex items-start gap-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium px-4 py-3 shadow-lg"
        >
          <span className="text-lg leading-none">✓</span>
          <span>Fiche validée — dossier passé en « Fiche Potentielle ».</span>
        </div>
      )}

      {erreur && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {erreur}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne informations structure */}
        <section className="lg:col-span-1 space-y-6 h-fit">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-marine-200/70 dark:border-marine-900/40 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Informations structure</h2>
            <dl className="space-y-3 text-sm">
              <Info label="SIRET" value={entreprise.siret} />
              <Info label="Forme juridique" value={entreprise.formeJuridique} />
              <Info label="Secteur d'activité" value={entreprise.secteurActivite} />
              <Info label="Téléphone" value={<BoutonAppel entreprise={entreprise} variant="lien" />} />
              <Info
                label="Contact"
                value={
                  entreprise.contact
                    ? `${entreprise.contact.nom}${entreprise.contact.fonction ? " — " + entreprise.contact.fonction : ""}`
                    : "-"
                }
              />
              <Info label="Email" value={entreprise.contact?.email || "-"} />
              <Info
                label="Site web"
                value={
                  entreprise.siteWeb ? (
                    <a
                      href={entreprise.siteWeb}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-marine-700 dark:text-marine-300 hover:underline"
                    >
                      {entreprise.siteWeb.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
                    </a>
                  ) : (
                    "-"
                  )
                }
              />
              <Info label="Type de contrat" value={entreprise.typeContrat} />
              <Info label="ESAT associé" value={entreprise.esatAssocie} />
              <Info label="Part. manquant" value={entreprise.partManquant ?? "-"} />
              <Info
                label="Début / Fin Op."
                value={`${formatDate(entreprise.partDebutOp)} → ${formatDate(entreprise.partFinOp)}`}
              />
            </dl>

            <div className="mt-4 pt-4 border-t border-marine-100 dark:border-marine-900/30">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">
                Échéance / prochaine relance
              </p>
              <form onSubmit={soumettreEcheance} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Rappel prévu
                  <input
                    type="datetime-local"
                    value={dateRappelSaisie}
                    onChange={(e) => setDateRappelSaisie(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  RDV
                  <input
                    type="datetime-local"
                    value={dateRdvSaisie}
                    onChange={(e) => setDateRdvSaisie(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={enregistrementEcheance}
                  className="col-span-1 sm:col-span-2 rounded-lg bg-slate-900 text-white text-xs font-medium py-1.5 disabled:opacity-40"
                >
                  Enregistrer l'échéance
                </button>
              </form>
            </div>

            <div className="mt-4 pt-4 border-t border-marine-100 dark:border-marine-900/30">
              <form onSubmit={soumettreSiteWeb} className="flex items-end gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400 flex-1">
                  Site web officiel
                  <input
                    type="text"
                    placeholder="www.entreprise.fr"
                    value={siteWebSaisi}
                    onChange={(e) => setSiteWebSaisi(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={enregistrementSiteWeb}
                  className="rounded-lg bg-marine-800 hover:bg-marine-900 text-white text-xs font-medium px-3 py-[7px] disabled:opacity-40"
                >
                  Enregistrer
                </button>
              </form>

              {oeth?.conforme && (
                <label className="flex items-start gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={Boolean(entreprise.consentementAffichagePublic)}
                    onChange={(e) => changerConsentementPublic(e.target.checked)}
                    disabled={enregistrementConsentement}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span>
                    Afficher nommément sur le site vitrine public (nom, ville, site web)
                    <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                      Nécessite l'accord de l'entreprise — n'active que si elle a explicitement consenti à être citée.
                    </span>
                  </span>
                </label>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-marine-100 dark:border-marine-900/30">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">
                Secteur public (relève du FIPHFP) ?
                <select
                  value={entreprise.secteurPublic ? "oui" : "non"}
                  onChange={(e) => changerSecteurPublic(e.target.value)}
                  disabled={enregistrementSecteurPublic}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm disabled:opacity-40"
                >
                  <option value="non">Non — secteur privé (AGEFIPH)</option>
                  <option value="oui">Oui — secteur public (FIPHFP)</option>
                </select>
              </label>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  entreprise.collecteur === "FIPHFP"
                    ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                    : "bg-sky-100 text-sky-700 border-sky-300"
                }`}
              >
                Collecteur : {entreprise.collecteur}
              </span>
            </div>

            <div className="mt-4 pt-4 border-t border-marine-100 dark:border-marine-900/30">
              <form onSubmit={soumettreDateCreation} className="flex items-end gap-2 mb-3">
                <label className="text-xs text-slate-500 dark:text-slate-400 flex-1">
                  Date de création
                  <input
                    type="date"
                    value={dateCreationSaisie}
                    onChange={(e) => setDateCreationSaisie(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={enregistrementDateCreation}
                  className="rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-[7px] disabled:opacity-40"
                >
                  Enregistrer
                </button>
              </form>
              <div className="flex flex-wrap items-center gap-2">
                {oeth?.neutralisation?.ancienneteAnnees != null && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Ancienneté :{" "}
                    <strong>
                      {oeth.neutralisation.ancienneteAnnees} an{oeth.neutralisation.ancienneteAnnees > 1 ? "s" : ""}
                    </strong>
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    libelleNeutralisation(oeth?.neutralisation).className
                  }`}
                >
                  {libelleNeutralisation(oeth?.neutralisation).label}
                </span>
              </div>
            </div>
          </div>

          {/* Classification secteur + argumentaire */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-marine-200/70 dark:border-marine-900/40 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Catégorie & argumentaire</h2>
            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 mb-3">
              {categorie?.label}
            </span>
            <p className="text-sm text-slate-600 dark:text-slate-300">{categorie?.argumentaire}</p>
            {oeth?.neutralisation?.alerteAnticipation && (
              <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <strong>Conseil An 4 :</strong> insistez sur l'anticipation des difficultés de recrutement de
                travailleurs handicapés et proposez dès maintenant une mise en relation avec l'ESAT Tremplin, pour
                sécuriser la structure avant la levée de la neutralisation l'an prochain.
              </p>
            )}
          </div>

          {/* Obligation OETH */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-marine-200/70 dark:border-marine-900/40 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Obligation OETH</h2>

            <form onSubmit={soumettreEffectifs} className="grid grid-cols-2 gap-3 mb-4">
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Effectif total
                <input
                  type="number"
                  min="0"
                  value={effectifSaisi}
                  onChange={(e) => setEffectifSaisi(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Bénéficiaires recrutés
                <input
                  type="number"
                  min="1"
                  value={effectifBeneficiaireSaisi}
                  onChange={(e) => setEffectifBeneficiaireSaisi(e.target.value)}
                  disabled={Number(effectifBeneficiaireSaisi) === 0}
                  title={
                    Number(effectifBeneficiaireSaisi) === 0
                      ? "Sélectionnez « Oui » ci-dessous pour saisir un nombre de bénéficiaires"
                      : undefined
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500"
                />
              </label>
              <button
                type="submit"
                disabled={enregistrementEffectifs}
                className="col-span-2 rounded-lg bg-slate-900 text-white text-xs font-medium py-1.5 disabled:opacity-40"
              >
                Mettre à jour les effectifs
              </button>
            </form>

            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-4">
              L'entreprise a-t-elle au moins un travailleur handicapé (bénéficiaire) ?
              <select
                value={Number(effectifBeneficiaireSaisi) > 0 ? "oui" : "non"}
                onChange={(e) => changerPresenceBeneficiaire(e.target.value)}
                disabled={enregistrementEffectifs}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm disabled:opacity-40"
              >
                <option value="non">Non — 0 recruté (surcontribution forcée)</option>
                <option value="oui">Oui — au moins 1 recruté (contribution classique)</option>
              </select>
            </label>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Mode appliqué :</span>
              {oeth?.neutralisation?.neutralise ? (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    libelleNeutralisation(oeth.neutralisation).className
                  }`}
                >
                  {libelleNeutralisation(oeth.neutralisation).label}
                </span>
              ) : (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    !oeth?.assujetti
                      ? "bg-slate-100 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600"
                      : oeth.surcontribution
                      ? "bg-red-100 text-red-700 border-red-300"
                      : "bg-blue-100 text-blue-700 border-blue-300"
                  }`}
                >
                  {!oeth?.assujetti
                    ? "Non assujetti"
                    : oeth.surcontribution
                    ? "Surcontribution — coefficient 1500"
                    : `Contribution classique — coefficient ${oeth.coefficient ?? "—"}`}
                </span>
              )}
            </div>

            {oeth?.neutralisation?.neutralise ? (
              <div className="space-y-3">
                <p
                  className={`text-sm rounded-lg border p-3 ${
                    oeth.neutralisation.alerteAnticipation
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}
                >
                  {oeth.neutralisation.alerteAnticipation
                    ? `An ${oeth.neutralisation.ancienneteAnnees} : dernière année de la période de neutralisation légale. Taxe estimée à 0 € pour l'instant, mais l'assujettissement complet à l'OETH s'appliquera dans un an.`
                    : `Entreprise créée il y a ${oeth.neutralisation.ancienneteAnnees} an${
                        oeth.neutralisation.ancienneteAnnees > 1 ? "s" : ""
                      } : période de neutralisation légale (< 5 ans). Taxe estimée à 0 € — l'entreprise n'a pas à s'inquiéter pour le moment.`}
                </p>
                {oeth.neutralisation.alerteAnticipation && oeth.projectionSiAssujetti && !oeth.projectionSiAssujetti.conforme && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                    <p className="font-semibold uppercase tracking-wide">Anticipation recommandée — ESAT Tremplin</p>
                    <p>
                      À effectif constant, la taxe représenterait environ{" "}
                      <strong>{formatMontant(oeth.projectionSiAssujetti.montantEstime)}</strong> (
                      {oeth.projectionSiAssujetti.deficit} UB manquante
                      {oeth.projectionSiAssujetti.deficit > 1 ? "s" : ""}) dès la levée de la neutralisation.
                      Recommandez dès maintenant l'ESAT Tremplin pour préparer le recrutement et éviter le mur de la
                      surcontribution.
                    </p>
                  </div>
                )}
              </div>
            ) : !oeth?.assujetti ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                Non assujetti à l'OETH (effectif &lt; {oeth?.seuilAssujettissement}).
              </p>
            ) : (
              <dl className="space-y-2 text-sm">
                <Info label="Unités bénéficiaires requises" value={oeth.unitesRequises} />
                <Info label="Bénéficiaires recrutés" value={oeth.beneficiairesRecrutes} />
                <Info
                  label="Déficit"
                  value={
                    oeth.conforme ? (
                      <span className="text-green-700 font-semibold">0 — conforme</span>
                    ) : (
                      <span className={oeth.surcontribution ? "text-red-700 font-semibold" : "text-orange-700 font-semibold"}>
                        {oeth.deficit} UB
                      </span>
                    )
                  }
                />
                {!oeth.conforme && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Décomposition du calcul
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <span className="px-2 py-1 rounded-md bg-white border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200">
                        {oeth.deficit} UB manquante{oeth.deficit > 1 ? "s" : ""}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">×</span>
                      <span
                        className={`px-2 py-1 rounded-md bg-white border font-semibold ${
                          oeth.surcontribution ? "border-red-300 text-red-700" : "border-orange-300 text-orange-700"
                        }`}
                      >
                        {oeth.coefficient}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">×</span>
                      <span className="px-2 py-1 rounded-md bg-white border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200">
                        {oeth.tauxHoraireSmic} € (SMIC horaire)
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">=</span>
                      <span className="px-2 py-1 rounded-md bg-slate-900 text-white font-bold">
                        {formatMontant(oeth.montantEstime)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {oeth.deficit} unité{oeth.deficit > 1 ? "s" : ""} bénéficiaire{oeth.deficit > 1 ? "s" : ""}{" "}
                      manquante{oeth.deficit > 1 ? "s" : ""} × coefficient <strong>{oeth.coefficient}</strong>{" "}
                      {oeth.surcontribution
                        ? "(surcontribution — aucun bénéficiaire recruté)"
                        : `(tranche ${oeth.tranche} salariés)`}{" "}
                      × <strong>{oeth.tauxHoraireSmic} €</strong> de taux horaire SMIC ={" "}
                      <strong>{formatMontant(oeth.montantEstime)}</strong> dus au titre de l'obligation d'emploi.
                    </p>
                    {oeth.surcontribution && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                        Surcontribution maximale : aucun travailleur handicapé recruté en interne.
                      </p>
                    )}
                  </div>
                )}
                <div className="pt-2 border-t border-marine-100 dark:border-marine-900/30">
                  <Info label="Montant estimé" value={<strong>{formatMontant(oeth.montantEstime)}</strong>} />
                </div>
              </dl>
            )}
          </div>
        </section>

        {/* Colonne module AGIR + messagerie */}
        <section className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-marine-200/70 dark:border-marine-900/40 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Module AGIR</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nouvelle issue d'appel */}
              <form onSubmit={soumettreIssueAppel} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">
                  Nouvelle issue d'appel
                </label>
                <select
                  value={issueChoisie}
                  onChange={(e) => setIssueChoisie(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm mb-2"
                >
                  <option value="">Sélectionner…</option>
                  {ISSUES_APPEL.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>

                {infoIssueSelectionnee?.needsDate && (
                  <input
                    type="datetime-local"
                    value={dateIssue}
                    onChange={(e) => setDateIssue(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm mb-2"
                  />
                )}

                <textarea
                  value={detailsIssue}
                  onChange={(e) => setDetailsIssue(e.target.value)}
                  placeholder="Détails (facultatif)"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm mb-2"
                />

                <button
                  type="submit"
                  disabled={!issueChoisie || enregistrement}
                  className="w-full rounded-lg bg-slate-900 text-white text-sm font-medium py-2 disabled:opacity-40"
                >
                  Enregistrer l'issue
                </button>
              </form>

              {/* Sortie du dossier */}
              <form onSubmit={soumettreSortieDossier} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">
                  Sortie du dossier
                </label>
                <select
                  value={sortieChoisie}
                  onChange={(e) => setSortieChoisie(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm mb-2"
                >
                  <option value="">Sélectionner…</option>
                  {SORTIES_DOSSIER.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>

                <textarea
                  value={detailsSortie}
                  onChange={(e) => setDetailsSortie(e.target.value)}
                  placeholder="Détails (facultatif)"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm mb-2"
                />

                <button
                  type="submit"
                  disabled={!sortieChoisie || enregistrement}
                  className="w-full rounded-lg bg-red-600 text-white text-sm font-medium py-2 disabled:opacity-40"
                >
                  Clore / envoyer en atelier
                </button>
              </form>
            </div>
          </div>

          {/* Espace IA : contact alternatif en cas de numéro invalide */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-marine-200/70 dark:border-marine-900/40 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Espace IA — Contact alternatif</h2>

            {!entreprise.contact?.telephoneInvalide ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Numéro {entreprise.contact?.telephone || "(aucun renseigné)"} non attribué ou injoignable ?
                </p>
                <button
                  onClick={signalerTelephoneInvalide}
                  disabled={enregistrementTelephone}
                  className="rounded-lg bg-amber-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-40 whitespace-nowrap"
                >
                  Signaler numéro invalide
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Numéro signalé invalide. Lancez une recherche IA ci-dessous, ou utilisez les pistes de recherche
                  manuelles — dans tous les cas, vérifiez le résultat avant de l'enregistrer.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={rechercherContactIa}
                    disabled={rechercheIaEnCours}
                    className="rounded-lg bg-marine-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-40 whitespace-nowrap"
                  >
                    {rechercheIaEnCours ? "Recherche en cours…" : "🔎 Rechercher via IA"}
                  </button>
                  {propositionIa && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {propositionIa.telephone ? (
                        <>
                          Proposition : <strong>{propositionIa.telephone}</strong>
                          {propositionIa.contact ? ` — ${propositionIa.contact}` : ""}{" "}
                          <span className="text-xs opacity-70">(confiance {propositionIa.confiance})</span>
                          {propositionIa.source && (
                            <>
                              {" · "}
                              <a
                                href={propositionIa.source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                source
                              </a>
                            </>
                          )}
                          {" — vérifiez puis cliquez sur Enregistrer ci-dessous."}
                        </>
                      ) : (
                        "Aucun numéro fiable trouvé par l'IA."
                      )}
                    </p>
                  )}
                </div>
                {propositionIa?.secteurCategorieLabel && (
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={appliquerCategorieSuggeree}
                      onChange={(e) => setAppliquerCategorieSuggeree(e.target.checked)}
                    />
                    Catégorie suggérée par l'IA : <strong>{propositionIa.secteurCategorieLabel}</strong> — l'appliquer
                    en cliquant sur Enregistrer
                  </label>
                )}
                {erreurRechercheIa && (
                  <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3">
                    {erreurRechercheIa}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(
                      `${entreprise.nom} ${entreprise.ville} téléphone`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-200"
                  >
                    Rechercher sur Google
                  </a>
                  <a
                    href={`https://www.societe.com/cgi-bin/search?champs=${encodeURIComponent(
                      entreprise.siret?.slice(0, 9) || entreprise.nom
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-200"
                  >
                    Fiche Societe.com
                  </a>
                  <a
                    href={`https://www.pagesjaunes.fr/recherche/${encodeURIComponent(entreprise.nom)}/${encodeURIComponent(
                      entreprise.ville || ""
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-200"
                  >
                    PagesJaunes
                  </a>
                  <a
                    href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(entreprise.nom)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-200"
                  >
                    LinkedIn
                  </a>
                </div>

                <form onSubmit={corrigerTelephone} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nouveau numéro trouvé…"
                    value={nouveauTelephone}
                    onChange={(e) => setNouveauTelephone(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={
                      (!nouveauTelephone.trim() && !(appliquerCategorieSuggeree && propositionIa?.secteurCategorie)) ||
                      enregistrementTelephone
                    }
                    className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 disabled:opacity-40"
                  >
                    Enregistrer
                  </button>
                </form>
              </div>
            )}
          </div>

          <MessagerieMail entreprise={entreprise} onMaj={setEntreprise} />

          {/* Messagerie / historique */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-marine-200/70 dark:border-marine-900/40 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Messagerie & historique</h2>

            <form onSubmit={soumettreCommentaire} className="flex gap-2 mb-4">
              <input
                type="text"
                value={nouveauCommentaire}
                onChange={(e) => setNouveauCommentaire(e.target.value)}
                placeholder="Ajouter un commentaire…"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!nouveauCommentaire.trim() || enregistrement}
                className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 disabled:opacity-40"
              >
                Envoyer
              </button>
            </form>

            <ul className="space-y-3 max-h-[420px] overflow-y-auto">
              {fil.map((item) => (
                <li key={item.id} className="border border-slate-100 dark:border-slate-700 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {item.kind === "appel" ? item.issueLabel : item.auteur}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{formatDateHeure(item.date)}</span>
                  </div>
                  {item.kind === "appel" ? (
                    <p className="text-slate-500 dark:text-slate-400">
                      {item.details || "Aucun détail renseigné."}
                      {item.dateProgrammee && (
                        <span className="block text-xs mt-1 text-slate-400 dark:text-slate-500">
                          Date programmée : {formatDate(item.dateProgrammee)}
                        </span>
                      )}
                      {Number.isFinite(item.dureeSecondes) && (
                        <span className="block text-xs mt-1 text-slate-400 dark:text-slate-500">
                          Durée d'appel : {formatDuree(item.dureeSecondes)}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-slate-600 dark:text-slate-300">{item.texte}</p>
                  )}
                </li>
              ))}
              {fil.length === 0 && (
                <li className="text-slate-400 dark:text-slate-500 text-sm">Aucun historique pour ce dossier.</li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="text-slate-700 dark:text-slate-200 font-medium text-right">{value}</dd>
    </div>
  );
}
