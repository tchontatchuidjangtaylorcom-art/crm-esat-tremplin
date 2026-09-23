// Interface commune de téléphonie VoIP, indépendante du fournisseur.
//
// Un provider doit exposer une seule méthode :
//   call(numero, { onStateChange, onError }) -> { hangup() }
// où onStateChange reçoit successivement "connecting", puis soit "active"
// (décroché), soit directement "ended" avec `{ sansReponse: true }` si
// personne ne décroche (sonnerie dans le vide, répondeur, occupé…) — c'est
// ce deuxième cas que le Power Dialer utilise pour journaliser un NRP
// automatique et enchaîner sur le prospect suivant sans intervention agent.
//
// Ce fichier fournit un provider SIMULÉ (pas d'appel réel) qui sert de point
// de branchement pour une vraie intégration WebRTC :
//   - Twilio Voice SDK   : new Twilio.Device(token), device.connect({ params: { To: numero } })
//   - Aircall Everywhere : window.AircallEverywhere + workflow "outgoing_call"
//   - SIP générique      : JsSIP.UA + ua.call(numero, { mediaConstraints }) (softphone Afrique/monde)
//
// Remplacer `creerProviderTelephonie` ci-dessous pour brancher l'un de ces
// SDKs sans changer le reste de l'application (CallContext / CallPanel /
// DialerContext ne connaissent que `call()` et `hangup()`).

// Proportion d'appels simulés sans réponse, pour pouvoir tester le
// comportement "NRP automatique" du Power Dialer sans téléphonie réelle.
const TAUX_SANS_REPONSE_SIMULE = 0.35;

function creerAppelSimule(numero, { onStateChange }) {
  let actif = true;
  const decroche = Math.random() >= TAUX_SANS_REPONSE_SIMULE;

  onStateChange("connecting");
  const delaiSonnerie = 1200 + Math.round(Math.random() * 1200);

  const minuteur = setTimeout(() => {
    if (!actif) return;
    if (decroche) {
      onStateChange("active");
    } else {
      actif = false;
      onStateChange("ended", { sansReponse: true });
    }
  }, delaiSonnerie);

  return {
    hangup() {
      if (!actif) return;
      actif = false;
      clearTimeout(minuteur);
      onStateChange("ended", { sansReponse: false });
    },
  };
}

export function creerProviderTelephonie() {
  // TODO intégration réelle : lire une config (ex. import.meta.env.VITE_TELEPHONY_PROVIDER)
  // et retourner ici un provider Twilio / Aircall / SIP à la place du simulateur.
  return { call: creerAppelSimule };
}
