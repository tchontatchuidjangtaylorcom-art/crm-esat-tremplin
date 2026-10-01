// Signale au serveur qu'un agent appelle un numéro d'une fiche (clic sur le
// numéro ou copie pour Aircall). Le serveur ne compte un même numéro qu'une
// fois par agent et par jour (voir server/src/appelsAgents.js). "keepalive" :
// la requête part même si le clic ouvre aussitôt l'application téléphone.
export function compterAppel(entrepriseId, numero, moyen = "lien") {
  if (!entrepriseId || !numero) return;
  try {
    fetch(`/api/entreprises/${entrepriseId}/appel-compte`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero, moyen }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Comptage au mieux : ne bloque jamais l'appel.
  }
}
