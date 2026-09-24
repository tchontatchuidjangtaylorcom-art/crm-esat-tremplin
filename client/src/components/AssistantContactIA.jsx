import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { jouerSonConfirmation } from "../sonConfirmation.js";

function idUnique() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Dictée vocale de la question (Web Speech API) : purement un confort pour
// ne pas faire perdre de temps à l'agent pendant/juste après un appel —
// dégrade silencieusement (bouton micro qui affiche une erreur au clic) sur
// les navigateurs sans support (Firefox, Safari desktop notamment).
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

// Assistant conversationnel de l'Espace IA : contrairement à la recherche de
// téléphone au-dessus (qui cherche UN numéro), l'agent pose ici une question
// libre ("Qui contacter pour la comptabilité / les RH ?") et reçoit une
// réponse nominative — nom + fonction — si une source fiable en confirme une
// (voir poserQuestionContact côté serveur, même garde-fou anti-hallucination
// que la recherche de téléphone : jamais de nom inventé).
//
// "Enregistrer sur la fiche" journalise l'échange en commentaire ET associe
// le contact trouvé en un seul geste, pour que l'agent reste concentré sur
// l'appel plutôt que de ressaisir ce que l'IA vient de trouver.
export default function AssistantContactIA({ entreprise, onMaj, prenomAgent }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]); // { id, question, reponse, contact, source, confiance, enregistre }
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [ecoute, setEcoute] = useState(false);
  const recoRef = useRef(null);

  useEffect(() => () => recoRef.current?.stop(), []);

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
      setQuestion((q) => (q ? `${q} ${transcription}` : transcription));
    };
    reco.onerror = () => setEcoute(false);
    reco.onend = () => setEcoute(false);
    setEcoute(true);
    reco.start();
  }

  async function poserQuestion(ev) {
    ev.preventDefault();
    const texteQuestion = question.trim();
    if (!texteQuestion || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const resultat = await api.poserQuestionContactIA(entreprise.id, texteQuestion);
      setMessages((prev) => [...prev, { id: idUnique(), question: texteQuestion, ...resultat, enregistre: false }]);
      setQuestion("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  async function enregistrerSurFiche(message) {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, enregistrementEnCours: true } : m)));
    try {
      let derniereEntreprise = entreprise;

      if (message.contact) {
        const contactActuel = derniereEntreprise.contact || {};
        const { nom, role, telephone } = message.contact;
        const patch = { ...contactActuel };
        // Devient le contact principal seulement si la fiche n'en a aucun —
        // sinon ajouté en alternatif, jamais en écrasant une donnée déjà
        // vérifiée par un agent (même règle que GestionContacts/GestionTelephones).
        if (nom && !contactActuel.nom) {
          patch.nom = nom;
          patch.fonction = role || "";
        } else if (nom) {
          patch.contactsAlternatifs = [
            ...(contactActuel.contactsAlternatifs || []),
            { id: idUnique(), nom, fonction: role || "", dateAjout: new Date().toISOString() },
          ];
        }
        if (telephone) {
          patch.telephonesAlternatifs = [
            ...(contactActuel.telephonesAlternatifs || []),
            {
              id: idUnique(),
              numero: telephone,
              note: "Trouvé par l'assistant IA",
              dateAjout: new Date().toISOString(),
            },
          ];
        }
        derniereEntreprise = await api.patchEntreprise(entreprise.id, { contact: patch });
        onMaj?.(derniereEntreprise);
      }

      const texteCommentaire = `Assistant IA — Q : « ${message.question} » → R : ${message.reponse}`;
      derniereEntreprise = await api.ajouterCommentaire(entreprise.id, { texte: texteCommentaire, auteur: prenomAgent });
      onMaj?.(derniereEntreprise);

      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, enregistre: true, enregistrementEnCours: false } : m))
      );
      jouerSonConfirmation();
    } catch (e) {
      setErreur(e.message);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, enregistrementEnCours: false } : m)));
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-marine-100 dark:border-marine-900/30">
      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">
        Assistant conversationnel — contact nominatif
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
        Posez une question précise (ex : « Qui contacter pour la comptabilité / les RH ? ») — l'IA cherche un nom et
        une fonction réels via le web/LinkedIn, jamais inventés.
      </p>

      {messages.length > 0 && (
        <ul className="space-y-2 mb-3 max-h-72 overflow-y-auto">
          {messages.map((m) => (
            <li key={m.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-sm">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">« {m.question} »</p>
              <p className="text-slate-700 dark:text-slate-200">{m.reponse}</p>
              {m.contact && (
                <p className="mt-1 text-xs text-marine-700 dark:text-marine-300">
                  → {m.contact.nom}
                  {m.contact.role ? `, ${m.contact.role}` : ""}
                  {m.contact.telephone ? ` — ${m.contact.telephone}` : ""}
                  {m.contact.email ? ` — ${m.contact.email}` : ""}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-2">
                {m.source && (
                  <a
                    href={m.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    source
                  </a>
                )}
                <span className="text-[11px] text-slate-400 dark:text-slate-500">confiance {m.confiance}</span>
                <div className="flex-1" />
                {m.enregistre ? (
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400">✓ Enregistré sur la fiche</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => enregistrerSurFiche(m)}
                    disabled={m.enregistrementEnCours}
                    className="text-[11px] rounded-full bg-marine-800 hover:bg-marine-900 text-white px-2.5 py-1 disabled:opacity-40"
                  >
                    {m.enregistrementEnCours ? "Enregistrement…" : "Enregistrer sur la fiche"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {erreur && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{erreur}</p>}

      <form onSubmit={poserQuestion} className="flex items-end gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              poserQuestion(e);
            }
          }}
          placeholder="Ex : Qui contacter pour la comptabilité / les RH ?"
          rows={2}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-none"
        />
        <button
          type="button"
          onClick={basculerEcoute}
          title={ecoute ? "Arrêter l'écoute" : "Dicter la question (micro)"}
          className={`w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center text-lg transition ${
            ecoute
              ? "bg-red-100 border-red-300 text-red-700 animate-pulse"
              : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          🎙️
        </button>
        <button
          type="submit"
          disabled={!question.trim() || enCours}
          className="shrink-0 rounded-lg bg-marine-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
        >
          {enCours ? "…" : "Demander"}
        </button>
      </form>
    </div>
  );
}
