// Bandeau défilant en tête de la vitrine — uniquement des messages construits
// à partir de vraies données (statistiques agrégées du portefeuille + noms
// d'entreprises ayant explicitement consenti à être citées, voir
// /api/vitrine côté serveur). Aucun événement ni nom n'est inventé ici.
function construireMessages(statistiques, entreprises) {
  const messages = [];
  for (const e of entreprises) {
    messages.push(`✓ ${e.nom}${e.ville ? ` (${e.ville})` : ""} respecte son quota légal OETH`);
  }
  if (statistiques.nbEntreprisesConformes > 0) {
    messages.push(`${statistiques.nbEntreprisesConformes} entreprise${statistiques.nbEntreprisesConformes > 1 ? "s" : ""} accompagnée${statistiques.nbEntreprisesConformes > 1 ? "s" : ""} déjà en conformité`);
  }
  if (statistiques.nbBeneficiairesInseres > 0) {
    messages.push(`${statistiques.nbBeneficiairesInseres} travailleurs handicapés recrutés dans des entreprises suivies par le pôle`);
  }
  if (statistiques.tauxConformite > 0) {
    messages.push(`${statistiques.tauxConformite}% de taux de conformité moyen dans le portefeuille accompagné`);
  }
  if (messages.length === 0) {
    messages.push("Le pôle OETH / AGEFIPH accompagne les entreprises vers la conformité — chiffres mis à jour en continu");
  }
  return messages;
}

export default function TickerImpact({ statistiques, entreprises }) {
  const messages = construireMessages(statistiques, entreprises);
  // Dupliqué une fois pour boucler sans coupure visible (translateX -50%).
  const boucle = [...messages, ...messages];

  return (
    <div className="bg-marine-900 text-white overflow-hidden border-b border-marine-800">
      <div className="group flex whitespace-nowrap py-2">
        <div className="flex animate-defiler group-hover:[animation-play-state:paused]">
          {boucle.map((m, i) => (
            <span key={i} className="flex items-center text-xs sm:text-sm font-medium px-6">
              {m}
              <span className="ml-6 text-marine-500" aria-hidden>
                •
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
