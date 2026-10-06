// Canal d'actions déclenchées par l'assistant général du CRM (voir
// AssistantDomaineCrm.jsx) : quand l'agent demande "comment je fais pour…",
// l'IA peut en plus indiquer à l'interface de pointer l'endroit concerné
// (scroll + halo visuel), ou carrément l'ouvrir (ex. la boîte mail). Même
// principe que l'événement "outils-vente:ouvrir" déjà utilisé par
// OutilsVenteLayout.jsx, mais pour les éléments hors panneau d'outils —
// chaque composant concerné écoute sa propre clé, pas de registre central à
// maintenir ici.
const EVENEMENT = "assistant:pointer";

export function declencherPointeurAssistant(cle) {
  window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: cle }));
}

// À utiliser dans un useEffect : `useEffect(() => ecouterPointeurAssistant("ma_cle", () => {...}), [])`.
export function ecouterPointeurAssistant(cle, gestionnaire) {
  function ecouteur(ev) {
    if (ev.detail === cle) gestionnaire();
  }
  window.addEventListener(EVENEMENT, ecouteur);
  return () => window.removeEventListener(EVENEMENT, ecouteur);
}

// Scroll + halo temporaire : pointe un élément déjà affiché sans le modifier.
export function pointerElement(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-4", "ring-teal-400", "ring-offset-2");
  setTimeout(() => el.classList.remove("ring-4", "ring-teal-400", "ring-offset-2"), 2500);
  return true;
}
