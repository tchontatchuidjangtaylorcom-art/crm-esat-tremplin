// Lien vers la page de facturation de la console Anthropic (fourni par le
// serveur quand l'API Claude répond "crédit épuisé", voir
// server/src/rechercheContact.js). Les crédits de l'API sont distincts de
// tout abonnement claude.ai ; le rechargement automatique s'active sur la
// même page.
export default function BoutonRechargeCredits({ lien, className = "" }) {
  return (
    <a
      href={lien}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3 py-1.5 whitespace-nowrap ${className}`}
    >
      💳 Recharger les crédits Claude ↗
    </a>
  );
}
