import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useContenuAide } from "../useContenuAide.js";
import { useAuth } from "../AuthContext.jsx";
import ArgumentaireContenu from "./ArgumentaireContenu.jsx";
import ScriptVenteContenu from "./ScriptVenteContenu.jsx";
import ModelesMailsContenu from "./ModelesMailsContenu.jsx";
import EditeurArgumentaire from "./EditeurArgumentaire.jsx";
import EditeurScriptVente from "./EditeurScriptVente.jsx";
import EditeurModelesMails from "./EditeurModelesMails.jsx";
import PanelEsatTremplin from "./PanelEsatTremplin.jsx";
import { ArgumentairePublic, ScriptPublic } from "./PitchPublic.jsx";
import { useFicheCourante } from "../ficheCourante.js";
import { useEspaces } from "../espace.js";

const TITRES = {
  argumentaire: "Argumentaire AGEFIPH",
  script: "Script de vente",
  mails: "Modèles de mails",
  esat: "ESAT Tremplin / TIH",
};

function PanelArgumentaire({ modeEdition, onEnregistre, onAnnuler }) {
  const { data, erreur } = useContenuAide("argumentaire-agefiph", api.getArgumentaireAgefiph);
  if (erreur) return <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>;
  if (!data) return <p className="text-sm text-slate-400 dark:text-slate-500">Chargement de l'argumentaire…</p>;
  if (modeEdition) return <EditeurArgumentaire data={data} onEnregistre={onEnregistre} onAnnuler={onAnnuler} />;
  return <ArgumentaireContenu data={data} />;
}

function PanelScriptVente({ modeEdition, onEnregistre, onAnnuler }) {
  const { data, erreur } = useContenuAide("script-vente", api.getScriptVente);
  if (modeEdition) {
    if (erreur) return <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>;
    if (!data) return <p className="text-sm text-slate-400 dark:text-slate-500">Chargement du script…</p>;
    return <EditeurScriptVente data={data} onEnregistre={onEnregistre} onAnnuler={onAnnuler} />;
  }
  return <ScriptVenteContenu />;
}

function PanelModelesMails({ modeEdition, onEnregistre, onAnnuler }) {
  const { data, erreur } = useContenuAide("modeles-mails", api.getModelesMails);
  if (modeEdition) {
    if (erreur) return <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>;
    if (!data) return <p className="text-sm text-slate-400 dark:text-slate-500">Chargement des modèles…</p>;
    return <EditeurModelesMails data={data} onEnregistre={onEnregistre} onAnnuler={onAnnuler} />;
  }
  return <ModelesMailsContenu />;
}

// Panneau latéral docké (jamais de fond assombri par-dessus l'écran) : la
// page appelante (voir OutilsVenteLayout) rétrécit pour lui laisser la
// place, la fiche client et les boutons d'appel restent visibles à côté.
// En-tête collant (titre + bouton ✕ bien visible en haut à droite) : même
// en plein écran sur mobile et après défilement, on peut toujours fermer le
// panneau pour revenir au CRM. La touche Échap ferme aussi le panneau.
//
// Édition du contenu (argumentaire/script/mails) réservée aux
// super-administrateurs : ce contenu est vu par TOUS les agents, donc son
// édition mérite un palier de rôle au-dessus du simple "admin" (voir
// estAdmin/exigerSuperAdmin côté serveur) — le bouton "Modifier" ci-dessous
// n'apparaît que pour ce rôle, et le serveur revalide de toute façon à
// chaque appel.
export default function PanelOutilsVente({ outil, onFermer }) {
  const { utilisateur } = useAuth();
  const { estOeth } = useEspaces();
  const [modeEdition, setModeEdition] = useState(false);
  // Contenu CEE pas encore éditable (SECTIONS_CEE fixe côté serveur, voir
  // scriptVente.js) : cacher "Modifier" hors de l'espace OETH évite d'y
  // écraser silencieusement le contenu OETH personnalisé (même stockage).
  const estSuperAdmin = utilisateur?.role === "super_admin" && estOeth;
  // Fiche publique ouverte (FIPHFP) : argumentaire et script du secteur
  // public par défaut, avec un bouton pour revenir à ceux du privé.
  const fiche = useFicheCourante();
  const fichePublique = fiche?.collecteur === "FIPHFP";
  const [vuePublic, setVuePublic] = useState(fichePublique);
  useEffect(() => setVuePublic(fichePublique), [fichePublique, fiche?.id]);
  const pitchPublic = fichePublique && vuePublic && (outil === "argumentaire" || outil === "script") && !modeEdition;

  useEffect(() => {
    setModeEdition(false);
  }, [outil]);

  useEffect(() => {
    const onTouche = (e) => e.key === "Escape" && onFermer();
    document.addEventListener("keydown", onTouche);
    return () => document.removeEventListener("keydown", onTouche);
  }, [onFermer]);

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {pitchPublic ? (outil === "argumentaire" ? "Argumentaire FIPHFP (public)" : "Script — secteur public") : TITRES[outil]}
        </h2>
        <div className="flex items-center gap-3 shrink-0">
          {estSuperAdmin && !modeEdition && !pitchPublic && outil !== "esat" && (
            <button
              type="button"
              onClick={() => setModeEdition(true)}
              className="text-xs font-medium text-marine-700 dark:text-marine-300 hover:underline"
            >
              ✏️ Modifier
            </button>
          )}
          <button
            type="button"
            onClick={onFermer}
            title="Fermer et revenir au CRM"
            aria-label="Fermer le panneau et revenir au CRM"
            className="shrink-0 w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-5">
        {fichePublique && (outil === "argumentaire" || outil === "script") && !modeEdition && (
          <div className="mb-4 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-2 text-xs text-indigo-800 dark:text-indigo-200 flex flex-wrap items-center justify-between gap-2">
            <span>
              🏛️ <strong>{fiche.nom}</strong> est un employeur <strong>public</strong> (FIPHFP).
            </span>
            <span className="inline-flex rounded-full border border-indigo-300 dark:border-indigo-700 overflow-hidden">
              <button type="button" onClick={() => setVuePublic(true)} className={`px-2.5 py-0.5 ${vuePublic ? "bg-indigo-600 text-white" : ""}`}>
                Public
              </button>
              <button type="button" onClick={() => setVuePublic(false)} className={`px-2.5 py-0.5 ${!vuePublic ? "bg-indigo-600 text-white" : ""}`}>
                Privé
              </button>
            </span>
          </div>
        )}
        {pitchPublic && outil === "argumentaire" && <ArgumentairePublic />}
        {pitchPublic && outil === "script" && <ScriptPublic />}
        {!pitchPublic && outil === "argumentaire" && (
          <PanelArgumentaire modeEdition={modeEdition} onEnregistre={() => setModeEdition(false)} onAnnuler={() => setModeEdition(false)} />
        )}
        {!pitchPublic && outil === "script" && (
          <PanelScriptVente modeEdition={modeEdition} onEnregistre={() => setModeEdition(false)} onAnnuler={() => setModeEdition(false)} />
        )}
        {outil === "mails" && (
          <PanelModelesMails modeEdition={modeEdition} onEnregistre={() => setModeEdition(false)} onAnnuler={() => setModeEdition(false)} />
        )}
        {outil === "esat" && <PanelEsatTremplin />}
      </div>
    </div>
  );
}
