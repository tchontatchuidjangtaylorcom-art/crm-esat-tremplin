// Interface commune de téléphonie VoIP, indépendante du fournisseur.
//
// Un provider doit exposer une seule méthode :
//   call(numero, { onStateChange, onError }) -> { hangup() }
// où onStateChange reçoit successivement "connecting", "active", puis "ended".
//
// Ce fichier fournit un provider SIMULÉ (pas d'appel réel) qui sert de point
// de branchement pour une vraie intégration WebRTC :
//   - Twilio Voice SDK   : new Twilio.Device(token), device.connect({ params: { To: numero } })
//   - Aircall Everywhere : window.AircallEverywhere + workflow "outgoing_call"
//   - SIP générique      : JsSIP.UA + ua.call(numero, { mediaConstraints }) (softphone Afrique/monde)
//
// Remplacer `creerProviderTelephonie` ci-dessous pour brancher l'un de ces
// SDKs sans changer le reste de l'application (CallContext / CallPanel ne
// connaissent que `call()` et `hangup()`).

function creerAppelSimule(numero, { onStateChange }) {
  let actif = true;

  onStateChange("connecting");
  const delaiConnexion = setTimeout(() => {
    if (actif) onStateChange("active");
  }, 1200 + Math.round(Math.random() * 600));

  return {
    hangup() {
      if (!actif) return;
      actif = false;
      clearTimeout(delaiConnexion);
      onStateChange("ended");
    },
  };
}

export function creerProviderTelephonie() {
  // TODO intégration réelle : lire une config (ex. import.meta.env.VITE_TELEPHONY_PROVIDER)
  // et retourner ici un provider Twilio / Aircall / SIP à la place du simulateur.
  return { call: creerAppelSimule };
}
