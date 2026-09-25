import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";

function formatMontant(n) {
  return `${Math.round(n || 0).toLocaleString("fr-FR")} €`;
}

// Module interactif "Estimer vos obligations" de la landing page publique :
// 1) recherche libre (nom OU SIREN) dans le répertoire Sirene public (INSEE,
//    gratuit, sans clé) ; 2) l'entreprise choisie, calcul instantané avec le
//    MÊME moteur OETH que le CRM (calculerObligationOeth côté serveur) ;
//    3) prise de contact optionnelle, qui envoie simplement un mail au pôle
//    (voir POST /api/vitrine/contact) — rien n'est jamais créé dans le CRM
//    depuis ce module public, volontairement indépendant.
// Effectif réel des travailleurs handicapés déjà en poste inconnu du public :
// le calcul suppose 0 (scénario le plus défavorable), annoncé clairement à
// l'écran plutôt que présenté comme un chiffre définitif.
export default function SimulateurOeth({ onClose }) {
  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState([]);
  const [recherche, setRecherche] = useState(false);
  const [erreurRecherche, setErreurRecherche] = useState(null);
  const [selection, setSelection] = useState(null);
  const [etape, setEtape] = useState("recherche"); // recherche | resultat | contact | envoye
  const [contact, setContact] = useState({ nom: "", email: "", telephone: "", message: "" });
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
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

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (requete.trim().length < 2) {
      setResultats([]);
      setErreurRecherche(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
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
    return () => clearTimeout(debounceRef.current);
  }, [requete]);

  function choisir(candidat) {
    setSelection(candidat);
    setEtape("resultat");
  }

  function recommencer() {
    setSelection(null);
    setEtape("recherche");
    setErreurEnvoi(null);
  }

  function ouvrirContact() {
    setContact((c) => ({
      ...c,
      message: `Bonjour, suite à la simulation OETH sur ${selection?.nom || "mon entreprise"}, je souhaite être recontacté(e) par un conseiller.`,
    }));
    setEtape("contact");
  }

  async function envoyerContact(ev) {
    ev.preventDefault();
    if (!contact.nom.trim() || !contact.email.trim()) return;
    setEnvoiEnCours(true);
    setErreurEnvoi(null);
    try {
      await api.contacterConseillerVitrine({
        ...contact,
        entreprise: selection?.nom || "",
      });
      setEtape("envoye");
    } catch (e) {
      setErreurEnvoi(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  const oeth = selection?.oeth;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-marine-950/70 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl my-8 sm:my-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marine-500">Simulateur OETH</p>
            <h2 className="font-bold text-slate-900 dark:text-white text-lg">Estimer vos obligations</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">
          {etape === "recherche" && (
            <>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Nom de l'entreprise ou numéro SIREN
              </label>
              <input
                ref={inputRef}
                type="text"
                value={requete}
                onChange={(e) => setRequete(e.target.value)}
                placeholder="Ex : ESAT Tremplin, ou 123 456 789"
                className="mt-2 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-marine-500"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Recherche dans le répertoire public Sirene (INSEE) — aucune donnée n'est enregistrée.
              </p>

              <div className="mt-4 space-y-2 min-h-[3rem]">
                {recherche && <p className="text-sm text-slate-400">Recherche en cours…</p>}
                {erreurRecherche && (
                  <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3">
                    {erreurRecherche}
                  </p>
                )}
                {!recherche &&
                  !erreurRecherche &&
                  requete.trim().length >= 2 &&
                  resultats.length === 0 && <p className="text-sm text-slate-400">Aucune entreprise trouvée.</p>}
                {resultats.map((r) => (
                  <button
                    key={r.siren}
                    onClick={() => choisir(r)}
                    className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 hover:border-marine-400 dark:hover:border-marine-500 hover:bg-marine-50 dark:hover:bg-marine-950/30 transition px-4 py-3"
                  >
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                      {r.nom} {!r.actif && <span className="text-xs font-normal text-red-500">(radiée)</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {[r.ville, r.secteurActivite].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-marine-600 dark:text-marine-300 mt-1">{r.trancheEffectifLabel}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {etape === "resultat" && selection && oeth && (
            <>
              <button
                onClick={recommencer}
                className="text-xs text-marine-600 dark:text-marine-300 hover:underline mb-4 inline-flex items-center gap-1"
              >
                ← Changer d'entreprise
              </button>
              <p className="font-bold text-slate-900 dark:text-white text-lg">{selection.nom}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                {[selection.ville, selection.trancheEffectifLabel].filter(Boolean).join(" · ")}
              </p>

              {oeth.neutralisation?.neutralise ? (
                <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 p-4 text-sm text-sky-800 dark:text-sky-200">
                  Entreprise créée il y a {oeth.neutralisation.ancienneteAnnees} an(s) : l'obligation OETH est
                  neutralisée pendant 5 ans à compter de la création. Aucune contribution due pour l'instant.
                </div>
              ) : !oeth.assujetti ? (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4 text-sm text-emerald-800 dark:text-emerald-200">
                  Effectif estimé sous le seuil de {oeth.seuilAssujettissement} salariés : cette entreprise n'est a
                  priori pas assujettie à l'obligation OETH.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-2xl font-bold text-marine-800 dark:text-marine-200">{oeth.unitesRequises}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Collaborateurs en situation de handicap attendus (quota 6 %)
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{oeth.deficit}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Emplois manquants estimés</p>
                  </div>
                  <div className="col-span-2 rounded-xl border border-marine-200 dark:border-marine-800 bg-marine-50 dark:bg-marine-950/30 p-4">
                    <p className="text-2xl font-bold text-marine-900 dark:text-white">
                      {formatMontant(oeth.montantEstime)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      Contribution financière estimée — évitable en recrutant directement les {oeth.deficit} personne
                      {oeth.deficit > 1 ? "s" : ""} manquante{oeth.deficit > 1 ? "s" : ""}.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 leading-relaxed">
                Estimation indicative à partir de la tranche d'effectif publique (INSEE) et en supposant qu'aucun
                collaborateur en situation de handicap n'est encore déclaré — un conseiller affine ce chiffre avec vos
                données réelles. Ne remplace pas votre déclaration officielle (DOETH).
              </p>

              <button
                onClick={ouvrirContact}
                className="mt-6 w-full rounded-xl bg-marine-800 hover:bg-marine-900 text-white text-sm font-semibold py-3 transition"
              >
                Contacter un conseiller OETH / AGEFIPH ou FIPHFP
              </button>
            </>
          )}

          {etape === "contact" && (
            <form onSubmit={envoyerContact} className="space-y-3">
              <button
                type="button"
                onClick={() => setEtape("resultat")}
                className="text-xs text-marine-600 dark:text-marine-300 hover:underline mb-1 inline-flex items-center gap-1"
              >
                ← Retour à l'estimation
              </button>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Laissez vos coordonnées, un conseiller du pôle vous recontacte rapidement au sujet de{" "}
                <strong>{selection?.nom}</strong>.
              </p>
              <input
                type="text"
                required
                placeholder="Votre nom"
                value={contact.nom}
                onChange={(e) => setContact((c) => ({ ...c, nom: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              />
              <input
                type="email"
                required
                placeholder="Votre e-mail"
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              />
              <input
                type="tel"
                placeholder="Téléphone (facultatif)"
                value={contact.telephone}
                onChange={(e) => setContact((c) => ({ ...c, telephone: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              />
              <textarea
                rows={3}
                value={contact.message}
                onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm resize-none"
              />
              {erreurEnvoi && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3">
                  {erreurEnvoi}
                </p>
              )}
              <button
                type="submit"
                disabled={envoiEnCours || !contact.nom.trim() || !contact.email.trim()}
                className="w-full rounded-xl bg-marine-800 hover:bg-marine-900 text-white text-sm font-semibold py-3 transition disabled:opacity-40"
              >
                {envoiEnCours ? "Envoi…" : "Envoyer ma demande"}
              </button>
            </form>
          )}

          {etape === "envoye" && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">Demande envoyée</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                Un conseiller du Pôle OETH / AGEFIPH vous recontacte prochainement.
              </p>
              <button
                onClick={onClose}
                className="mt-6 rounded-full border border-slate-300 dark:border-slate-600 text-sm font-medium px-6 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
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
