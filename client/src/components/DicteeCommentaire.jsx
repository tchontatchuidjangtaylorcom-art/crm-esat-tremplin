import { useRef, useState } from "react";
import { api } from "../api.js";
import { jouerSonConfirmation } from "../sonConfirmation.js";

function idUnique() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Dictée longue (compte-rendu d'appel) : continuous + interimResults pour un
// retour visuel pendant que l'agent parle — contrairement au mic ponctuel de
// AssistantContactIA.jsx (une question courte), ici l'agent dicte plusieurs
// phrases d'affilée. Dégrade silencieusement (message d'erreur au clic) sur
// les navigateurs sans support (Firefox, Safari desktop notamment).
function creerReconnaissanceVocale() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const reco = new Ctor();
  reco.lang = "fr-FR";
  reco.continuous = true;
  reco.interimResults = true;
  reco.maxAlternatives = 1;
  return reco;
}

// Dictaphone IA — compte-rendu d'appel : l'agent dicte (ou tape) un résumé
// brut de l'échange qu'il vient d'avoir, l'IA le reformule en compte-rendu
// professionnel et en extrait d'éventuels contacts nominatifs cités
// ("j'ai eu Madame Dupont des RH…"). Un seul clic "Enregistrer sur la fiche"
// journalise le compte-rendu en commentaire ET associe les contacts trouvés
// — l'agent reste concentré sur l'appel suivant plutôt que de ressaisir ce
// qu'il vient de dire. Même principe "IA propose, agent valide" que le reste
// de l'Espace IA : rien n'est écrit avant ce clic.
export default function DicteeCommentaire({ entreprise, onMaj, prenomAgent }) {
  const [transcription, setTranscription] = useState("");
  const [interim, setInterim] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [resultat, setResultat] = useState(null); // { resume, contacts }
  const [erreur, setErreur] = useState(null);
  const [enregistrementFiche, setEnregistrementFiche] = useState(false);
  const recoRef = useRef(null);

  function basculerEnregistrement() {
    if (enregistrement) {
      recoRef.current?.stop();
      return;
    }
    const reco = creerReconnaissanceVocale();
    if (!reco) {
      setErreur("Dictée vocale non disponible sur ce navigateur (essayez Chrome ou Edge).");
      return;
    }
    setErreur(null);
    setResultat(null);
    recoRef.current = reco;
    reco.onresult = (ev) => {
      let finalTexte = "";
      let interimTexte = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const morceau = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalTexte += morceau;
        else interimTexte += morceau;
      }
      if (finalTexte.trim()) {
        setTranscription((t) => (t ? `${t.trim()} ${finalTexte.trim()}` : finalTexte.trim()));
      }
      setInterim(interimTexte);
    };
    reco.onerror = () => setEnregistrement(false);
    reco.onend = () => {
      setEnregistrement(false);
      setInterim("");
    };
    setEnregistrement(true);
    reco.start();
  }

  async function analyser() {
    const texte = transcription.trim();
    if (!texte || analyseEnCours) return;
    setAnalyseEnCours(true);
    setErreur(null);
    setResultat(null);
    try {
      const r = await api.analyserDicteeIA(entreprise.id, texte);
      setResultat(r);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setAnalyseEnCours(false);
    }
  }

  async function enregistrerSurFiche() {
    if (!resultat || enregistrementFiche) return;
    setEnregistrementFiche(true);
    setErreur(null);
    try {
      let derniereEntreprise = entreprise;

      if (resultat.contacts?.length) {
        const contactActuel = derniereEntreprise.contact || {};
        const patch = { ...contactActuel };
        const alternatifs = [...(contactActuel.contactsAlternatifs || [])];
        const telAlternatifs = [...(contactActuel.telephonesAlternatifs || [])];
        let principalDejaPose = Boolean(contactActuel.nom);

        for (const c of resultat.contacts) {
          if (c.nom && !principalDejaPose) {
            patch.nom = c.nom;
            patch.fonction = c.role || "";
            principalDejaPose = true;
          } else if (c.nom) {
            alternatifs.push({ id: idUnique(), nom: c.nom, fonction: c.role || "", dateAjout: new Date().toISOString() });
          }
          if (c.telephone) {
            telAlternatifs.push({
              id: idUnique(),
              numero: c.telephone,
              note: "Mentionné en dictée d'appel",
              dateAjout: new Date().toISOString(),
            });
          }
        }
        patch.contactsAlternatifs = alternatifs;
        patch.telephonesAlternatifs = telAlternatifs;
        derniereEntreprise = await api.patchEntreprise(entreprise.id, { contact: patch });
        onMaj?.(derniereEntreprise);
      }

      derniereEntreprise = await api.ajouterCommentaire(entreprise.id, { texte: resultat.resume, auteur: prenomAgent });
      onMaj?.(derniereEntreprise);

      jouerSonConfirmation();
      setTranscription("");
      setResultat(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrementFiche(false);
    }
  }

  return (
    <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
          Dictaphone — compte-rendu d'appel
        </p>
        <button
          type="button"
          onClick={basculerEnregistrement}
          title={enregistrement ? "Arrêter la dictée" : "Dicter le compte-rendu de l'appel"}
          className={`w-9 h-9 shrink-0 rounded-full border flex items-center justify-center text-lg transition ${
            enregistrement
              ? "bg-red-100 border-red-300 text-red-700 animate-pulse"
              : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
        >
          🎙️
        </button>
      </div>

      <textarea
        value={transcription + (interim ? ` ${interim}` : "")}
        onChange={(e) => setTranscription(e.target.value)}
        placeholder="Dictez le résumé de l'appel (ex : « J'ai eu madame Dupont des RH, elle me dit qu'ils ont déjà deux travailleurs handicapés recrutés, elle rappelle la semaine prochaine »)…"
        rows={3}
        disabled={enregistrement}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-none disabled:opacity-70"
      />

      <div className="flex items-center justify-between mt-2 gap-2">
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {enregistrement ? "Écoute en cours…" : "Micro pour dicter, ou tapez/corrigez directement."}
        </span>
        <button
          type="button"
          onClick={analyser}
          disabled={!transcription.trim() || analyseEnCours || enregistrement}
          className="shrink-0 rounded-lg bg-marine-600 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-40"
        >
          {analyseEnCours ? "Analyse…" : "🤖 Générer le compte-rendu"}
        </button>
      </div>

      {erreur && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{erreur}</p>}

      {resultat && (
        <div className="mt-3 rounded-lg border border-marine-200 dark:border-marine-800 bg-white dark:bg-slate-800 p-3">
          <p className="text-[11px] font-semibold uppercase text-marine-700 dark:text-marine-300 mb-1">
            Compte-rendu proposé
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{resultat.resume}</p>
          {resultat.contacts?.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {resultat.contacts.map((c, i) => (
                <li key={i} className="text-xs text-marine-700 dark:text-marine-300">
                  → {c.nom || "(nom non précisé)"}
                  {c.role ? `, ${c.role}` : ""}
                  {c.telephone ? ` — ${c.telephone}` : ""}
                  {c.email ? ` — ${c.email}` : ""}
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={enregistrerSurFiche}
              disabled={enregistrementFiche}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-40"
            >
              {enregistrementFiche ? "Enregistrement…" : "✓ Enregistrer sur la fiche"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
