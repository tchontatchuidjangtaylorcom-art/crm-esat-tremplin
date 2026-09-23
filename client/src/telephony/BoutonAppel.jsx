import { useTelephonie } from "./CallContext.jsx";

const STYLE_ICONE = "inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition";
const STYLE_LIEN = "text-blue-600 hover:underline font-medium";

// Numéro nettoyé pour un lien tel: valide (garde un éventuel "+", retire le reste).
function versLienTel(numero) {
  return "tel:" + numero.replace(/[^\d+]/g, "");
}

// Bouton d'appel unique utilisé partout où un numéro de téléphone est affiché
// (tableau de bord, fiche entreprise…) — le comportement dépend du mode de
// téléphonie choisi par l'agent (voir CallContext) :
//  - "manuel" : lien tel: natif (téléphone perso/pro, Phone Link, FaceTime…),
//               aucun enchaînement automatique.
//  - "auto"   : lance l'appel via le provider VoIP (Power Dialer / SIP).
export default function BoutonAppel({ entreprise, variant = "icone" }) {
  const { mode, startCall } = useTelephonie();
  const numero = entreprise?.contact?.telephone;
  const style = variant === "icone" ? STYLE_ICONE : STYLE_LIEN;
  const contenu = variant === "icone" ? "☎" : numero;

  if (!numero) return variant === "lien" ? "-" : null;

  if (mode === "manuel") {
    return (
      <a
        href={versLienTel(numero)}
        onClick={(ev) => ev.stopPropagation()}
        title={`Appeler ${numero} depuis votre téléphone`}
        className={style}
      >
        {contenu}
      </a>
    );
  }

  return (
    <button
      onClick={(ev) => {
        ev.stopPropagation();
        startCall(entreprise);
      }}
      title={`Appeler ${numero} (auto-dialer)`}
      className={style}
    >
      {contenu}
    </button>
  );
}
