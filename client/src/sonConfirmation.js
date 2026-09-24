// Signal sonore court et discret joué à la confirmation d'une action
// sensible sur le terrain (ex : enregistrement d'un numéro de téléphone) —
// généré à la volée via l'API Web Audio plutôt qu'un fichier à charger, pour
// rester instantané et ne dépendre d'aucune ressource externe.
let contexteAudio = null;

function obtenirContexte() {
  if (contexteAudio) return contexteAudio;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  contexteAudio = new Ctx();
  return contexteAudio;
}

// Deux notes brèves et montantes, volume modéré et enveloppe en fondu pour
// rester discret même dans un open space — jamais bloquant : une erreur
// (contexte audio indisponible, politique navigateur…) ne doit jamais faire
// échouer l'action métier qu'elle accompagne.
export function jouerSonConfirmation() {
  try {
    const ctx = obtenirContexte();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const maintenant = ctx.currentTime;
    [
      [880, 0],
      [1174.66, 0.09],
    ].forEach(([frequence, decalage]) => {
      const oscillateur = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillateur.type = "sine";
      oscillateur.frequency.value = frequence;
      gain.gain.setValueAtTime(0, maintenant + decalage);
      gain.gain.linearRampToValueAtTime(0.12, maintenant + decalage + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, maintenant + decalage + 0.12);
      oscillateur.connect(gain);
      gain.connect(ctx.destination);
      oscillateur.start(maintenant + decalage);
      oscillateur.stop(maintenant + decalage + 0.13);
    });
  } catch {
    // Confort seulement — jamais bloquant.
  }
}
