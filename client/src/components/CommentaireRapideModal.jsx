import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useIdentiteActuelle } from "../identite.js";
import { diffuserEntrepriseMaj } from "../telephony/CallContext.jsx";
import { jouerSonConfirmation } from "../sonConfirmation.js";

// Dictée vocale (Web Speech API) — même logique que AssistantContactIA.jsx :
// confort seulement, dégrade silencieusement sur les navigateurs sans support.
function creerReconnaissanceVocale() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const reco = new Ctor();
  reco.lang = "fr-FR";
  reco.continuous = false;
  reco.interimResults = false;
  reco.maxAlternatives = 1;
  return reco;
}

// Ajout d'un commentaire en un geste depuis le tableau principal, sans ouvrir
// la fiche complète — même route que le fil de commentaires de la fiche
// détaillée (ajouterCommentaire), juste déclenchée depuis une modale légère
// pour ne pas casser le flux de l'agent en pleine relance téléphonique.
export default function CommentaireRapideModal({ entreprise, onFermer }) {
  const { prenom: prenomAgent } = useIdentiteActuelle();
  const [texte, setTexte] = useState("");
  const [ecoute, setEcoute] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const recoRef = useRef(null);
  const zoneRef = useRef(null);

  useEffect(() => {
    zoneRef.current?.focus();
    return () => recoRef.current?.stop();
  }, []);

  function basculerEcoute() {
    if (ecoute) {
      recoRef.current?.stop();
      return;
    }
    const reco = creerReconnaissanceVocale();
    if (!reco) {
      setErreur("Reconnaissance vocale non disponible sur ce navigateur (essayez Chrome ou Edge).");
      return;
    }
    setErreur(null);
    recoRef.current = reco;
    reco.onresult = (ev) => {
      const transcription = ev.results[0]?.[0]?.transcript || "";
      setTexte((t) => (t ? `${t} ${transcription}` : transcription));
    };
    reco.onerror = () => setEcoute(false);
    reco.onend = () => setEcoute(false);
    setEcoute(true);
    reco.start();
  }

  async function soumettre(ev) {
    ev.preventDefault();
    const propre = texte.trim();
    if (!propre || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const updated = await api.ajouterCommentaire(entreprise.id, { texte: propre, auteur: prenomAgent });
      diffuserEntrepriseMaj(updated);
      jouerSonConfirmation();
      onFermer();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onFermer}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 shadow-2xl p-5"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            + Commentaire rapide — {entreprise.nom}
          </h3>
          <button
            onClick={onFermer}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {erreur && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{erreur}</p>}

        <form onSubmit={soumettre} className="space-y-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={zoneRef}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  soumettre(e);
                }
              }}
              placeholder="Ex : Injoignable, rappeler après 14h…"
              rows={3}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-none"
            />
            <button
              type="button"
              onClick={basculerEcoute}
              title={ecoute ? "Arrêter l'écoute" : "Dicter le commentaire (micro)"}
              className={`w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center text-lg transition ${
                ecoute
                  ? "bg-red-100 border-red-300 text-red-700 animate-pulse"
                  : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              🎙️
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onFermer}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!texte.trim() || enCours}
              className="rounded-lg bg-marine-800 hover:bg-marine-900 text-white text-sm font-medium px-4 py-1.5 disabled:opacity-40"
            >
              {enCours ? "Enregistrement…" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
