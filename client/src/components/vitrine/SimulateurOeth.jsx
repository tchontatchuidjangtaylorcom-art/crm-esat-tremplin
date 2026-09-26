import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import CercleProgression from "./CercleProgression.jsx";

function formatMontant(n) {
  return `${Math.round(n || 0).toLocaleString("fr-FR")} €`;
}

const ANNEE_REFERENCE = 2026;

// Module interactif "Simulateur Gratuit OETH / DOETH" de la landing page
// publique — saisie manuelle directe (effectif + bénéficiaires), sur le
// modèle des simulateurs de référence du secteur (service-oeth.fr,
// pro.coline.care) plutôt qu'une recherche d'entreprise imposée : l'agent au
// téléphone ou le dirigeant qui visite le site connaît ses propres chiffres
// mieux qu'une tranche d'effectif INSEE. La recherche d'entreprise (Sirene,
// publique et gratuite) reste disponible mais reléguée à un simple
// pré-remplissage optionnel (secteur, effectif, date de création — pour la
// neutralisation légale des 5 ans), jamais obligatoire.
// Calcul via /api/vitrine/calculer (même moteur calculerObligationOeth que
// le CRM, lecture seule, rien n'écrit nulle part) : une seule source de
// vérité pour la formule légale, jamais dupliquée côté client.
export default function SimulateurOeth({ onClose }) {
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState([]);
  const [recherche, setRecherche] = useState(false);
  const [erreurRecherche, setErreurRecherche] = useState(null);
  const debounceRechercheRef = useRef(null);

  const [nomEntreprise, setNomEntreprise] = useState("");
  const [effectifSaisi, setEffectifSaisi] = useState("");
  const [beneficiairesSaisi, setBeneficiairesSaisi] = useState("0");
  const [dateCreation, setDateCreation] = useState(null);

  const [oeth, setOeth] = useState(null);
  const [erreurCalcul, setErreurCalcul] = useState(null);
  const debounceCalculRef = useRef(null);

  const [etape, setEtape] = useState("donnees"); // donnees | contact | envoye
  const [contact, setContact] = useState({ nom: "", email: "", telephone: "", message: "" });
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState(null);

  const inputEffectifRef = useRef(null);

  useEffect(() => {
    inputEffectifRef.current?.focus();
    function onEchap(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEchap);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEchap);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Recherche Sirene optionnelle (pré-remplissage uniquement).
  useEffect(() => {
    clearTimeout(debounceRechercheRef.current);
    if (requete.trim().length < 2) {
      setResultats([]);
      setErreurRecherche(null);
      return;
    }
    debounceRechercheRef.current = setTimeout(async () => {
      setRecherche(true);
      setErreurRecherche(null);
      try {
        const { resultats: r } = await api.simulerObligationsOeth(requete.trim());
        setResultats(r);
      } catch (e) {
        setErreurRecherche(e.message);
        setResultats([]);
      } finally {
        setRecherche(false);
      }
    }, 350);
    return () => clearTimeout(debounceRechercheRef.current);
  }, [requete]);

  function preremplirDepuisRecherche(candidat) {
    setNomEntreprise(candidat.nom);
    setEffectifSaisi(String(candidat.effectifEstime ?? ""));
    setDateCreation(candidat.dateCreation || null);
    setRechercheOuverte(false);
    setRequete("");
    setResultats([]);
    inputEffectifRef.current?.focus();
  }

  // Calcul immédiat (débounce court, juste le temps d'éviter une requête par
  // frappe) dès que l'effectif saisi est un nombre valide.
  useEffect(() => {
    clearTimeout(debounceCalculRef.current);
    const effectifNombre = Number(effectifSaisi);
    if (!effectifSaisi.trim() || !Number.isFinite(effectifNombre) || effectifNombre < 0) {
      setOeth(null);
      setErreurCalcul(null);
      return;
    }
    debounceCalculRef.current = setTimeout(async () => {
      setErreurCalcul(null);
      try {
        const { oeth: resultat } = await api.calculerObligationVitrine({
          effectif: effectifNombre,
          effectifBeneficiaire: Number(beneficiairesSaisi) || 0,
          dateCreation,
        });
        setOeth(resultat);
      } catch (e) {
        setErreurCalcul(e.message);
        setOeth(null);
      }
    }, 200);
    return () => clearTimeout(debounceCalculRef.current);
  }, [effectifSaisi, beneficiairesSaisi, dateCreation]);

  function ouvrirContact() {
    setContact((c) => ({
      ...c,
      message: `Bonjour, suite à la simulation OETH ${nomEntreprise ? `sur ${nomEntreprise}` : "sur mon entreprise"}, je souhaite être recontacté(e) par un conseiller.`,
    }));
    setEtape("contact");
  }

  async function envoyerContact(ev) {
    ev.preventDefault();
    if (!contact.nom.trim() || !contact.email.trim()) return;
    setEnvoiEnCours(true);
    setErreurEnvoi(null);
    try {
      await api.contacterConseillerVitrine({ ...contact, entreprise: nomEntreprise || "" });
      setEtape("envoye");
    } catch (e) {
      setErreurEnvoi(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  const pourcentageAtteint = oeth?.assujetti && oeth.unitesRequises > 0 ? (oeth.beneficiairesRecrutes / oeth.unitesRequises) * 100 : 0;
  const ton = !oeth?.assujetti ? "neutre" : oeth.conforme ? "conforme" : oeth.surcontribution ? "critique" : "partiel";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl bg-marine-950 border border-white/10 rounded-2xl shadow-2xl my-8 sm:my-0 overflow-hidden text-white">
        {/* Liseré tricolore discret — identité, pas un emblème d'État. */}
        <div className="flex h-1">
          <span className="flex-1 bg-marine-500" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-red-500" />
        </div>

        <div className="flex items-start justify-between px-6 sm:px-8 pt-6 pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marine-400">Simulateur OETH / DOETH</p>
            <h2 className="font-bold text-white text-2xl mt-1">Simulateur Gratuit OETH / DOETH {ANNEE_REFERENCE}</h2>
            <p className="text-sm text-slate-400 mt-1.5 max-w-md">
              Obtenez une estimation immédiate de votre contribution OETH {ANNEE_REFERENCE} à partir des données de
              votre entreprise.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 sm:px-8 pb-8">
          {etape === "donnees" && (
            <>
              {/* Recherche Sirene — repliée, purement facultative. */}
              <button
                type="button"
                onClick={() => setRechercheOuverte((v) => !v)}
                className="text-xs text-marine-300 hover:text-marine-200 hover:underline mb-3 inline-flex items-center gap-1"
              >
                {rechercheOuverte ? "▾" : "▸"} Pré-remplir via ma raison sociale ou mon SIREN (facultatif)
              </button>
              {rechercheOuverte && (
                <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-3">
                  <input
                    type="text"
                    value={requete}
                    onChange={(e) => setRequete(e.target.value)}
                    placeholder="Ex : ESAT Tremplin, ou 123 456 789"
                    className="w-full rounded-lg border border-white/10 bg-marine-900 text-white placeholder:text-slate-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marine-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Répertoire public Sirene (INSEE) — aucune donnée n'est enregistrée.
                  </p>
                  <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                    {recherche && <p className="text-xs text-slate-500">Recherche…</p>}
                    {erreurRecherche && <p className="text-xs text-red-400">{erreurRecherche}</p>}
                    {resultats.map((r) => (
                      <button
                        key={r.siren}
                        type="button"
                        onClick={() => preremplirDepuisRecherche(r)}
                        className="w-full text-left rounded-lg hover:bg-white/10 transition px-3 py-2"
                      >
                        <p className="text-sm font-medium text-white">{r.nom}</p>
                        <p className="text-[11px] text-slate-400">
                          {[r.ville, r.trancheEffectifLabel].filter(Boolean).join(" · ")}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Saisie manuelle — cœur du simulateur. */}
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-slate-400">
                  Effectif total
                  <input
                    ref={inputEffectifRef}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={effectifSaisi}
                    onChange={(e) => setEffectifSaisi(e.target.value)}
                    placeholder="Ex : 45"
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 text-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-marine-500"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Salariés handicapés déjà employés
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={beneficiairesSaisi}
                    onChange={(e) => setBeneficiairesSaisi(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 text-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-marine-500"
                  />
                </label>
              </div>

              {erreurCalcul && <p className="text-sm text-red-400 mt-3">{erreurCalcul}</p>}

              {/* Résultat — mis à jour en direct. */}
              {!effectifSaisi.trim() ? (
                <p className="text-sm text-slate-500 mt-6 text-center py-6">
                  Renseignez votre effectif pour voir votre estimation s'afficher ici.
                </p>
              ) : oeth?.neutralisation?.neutralise ? (
                <div className="mt-6 rounded-xl bg-sky-500/10 border border-sky-400/30 p-4 text-sm text-sky-200">
                  Entreprise créée il y a {oeth.neutralisation.ancienneteAnnees} an(s) : l'obligation OETH est
                  neutralisée pendant 5 ans à compter de la création. Aucune contribution due pour l'instant.
                </div>
              ) : oeth && !oeth.assujetti ? (
                <div className="mt-6 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-4 text-sm text-emerald-200">
                  Effectif inférieur au seuil de {oeth.seuilAssujettissement} salariés : votre entreprise n'est a
                  priori pas assujettie à l'obligation OETH.
                </div>
              ) : oeth ? (
                <div className="mt-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                    <CercleProgression
                      pourcentage={pourcentageAtteint}
                      ton={ton}
                      libelle="quota légal 6 % atteint"
                    />
                    <div className="flex-1 w-full space-y-2.5">
                      <div className="flex items-center justify-between text-sm border-b border-white/10 pb-2">
                        <span className="text-slate-400">Unités bénéficiaires requises</span>
                        <span className="font-semibold text-white">{oeth.unitesRequises}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm border-b border-white/10 pb-2">
                        <span className="text-slate-400">Déficit</span>
                        <span className={`font-semibold ${oeth.conforme ? "text-emerald-400" : ton === "critique" ? "text-red-400" : "text-orange-400"}`}>
                          {oeth.conforme ? "0 — conforme" : `${oeth.deficit} UB`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-1">
                        <span className="text-slate-300 font-medium">
                          {oeth.surcontribution ? "Surcontribution estimée" : "Contribution estimée"}
                        </span>
                        <span className="font-bold text-lg text-white">{formatMontant(oeth.montantEstime)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-slate-300 flex gap-2">
                      <span aria-hidden>📅</span>
                      <span>
                        La contribution due au titre de {ANNEE_REFERENCE} se régularise via la DSN de février{" "}
                        {ANNEE_REFERENCE + 1}.
                      </span>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-slate-300 flex gap-2">
                      <span aria-hidden>⚠️</span>
                      <span>
                        Estimation indicative — ne remplace pas votre déclaration DOETH officielle. Une contribution
                        non régularisée expose à des majorations et, en cas de contrôle, à un redressement URSSAF.
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={ouvrirContact}
                    className="mt-6 w-full rounded-xl bg-white text-marine-900 hover:bg-marine-100 text-sm font-semibold py-3 transition"
                  >
                    Contacter un conseiller OETH / AGEFIPH ou FIPHFP
                  </button>
                </div>
              ) : null}
            </>
          )}

          {etape === "contact" && (
            <form onSubmit={envoyerContact} className="space-y-3">
              <button
                type="button"
                onClick={() => setEtape("donnees")}
                className="text-xs text-marine-300 hover:text-marine-200 hover:underline mb-1 inline-flex items-center gap-1"
              >
                ← Retour à l'estimation
              </button>
              <p className="text-sm text-slate-400 mb-3">
                Laissez vos coordonnées, un conseiller du pôle vous recontacte rapidement
                {nomEntreprise ? (
                  <>
                    {" "}
                    au sujet de <strong className="text-white">{nomEntreprise}</strong>
                  </>
                ) : (
                  ""
                )}
                .
              </p>
              <input
                type="text"
                required
                placeholder="Votre nom"
                value={contact.nom}
                onChange={(e) => setContact((c) => ({ ...c, nom: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-slate-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-marine-500"
              />
              <input
                type="email"
                required
                placeholder="Votre e-mail"
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-slate-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-marine-500"
              />
              <input
                type="tel"
                placeholder="Téléphone (facultatif)"
                value={contact.telephone}
                onChange={(e) => setContact((c) => ({ ...c, telephone: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-slate-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-marine-500"
              />
              <textarea
                rows={3}
                value={contact.message}
                onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 text-white px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-marine-500"
              />
              {erreurEnvoi && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg p-3">{erreurEnvoi}</p>
              )}
              <button
                type="submit"
                disabled={envoiEnCours || !contact.nom.trim() || !contact.email.trim()}
                className="w-full rounded-xl bg-white text-marine-900 hover:bg-marine-100 text-sm font-semibold py-3 transition disabled:opacity-40"
              >
                {envoiEnCours ? "Envoi…" : "Envoyer ma demande"}
              </button>
            </form>
          )}

          {etape === "envoye" && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="font-semibold text-white">Demande envoyée</p>
              <p className="text-sm text-slate-400 mt-1.5">
                Un conseiller du Pôle OETH / AGEFIPH vous recontacte prochainement.
              </p>
              <button
                onClick={onClose}
                className="mt-6 rounded-full border border-white/20 text-sm font-medium px-6 py-2.5 hover:bg-white/10 transition"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
