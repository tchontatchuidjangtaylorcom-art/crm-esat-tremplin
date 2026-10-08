// Étiquette à côté du nom de l'entreprise : l'agent sait avant de composer
// s'il appelle un employeur privé (AGEFIPH) ou public (FIPHFP) — le
// discours, les modèles de mails et le collecteur ne sont pas les mêmes.
export default function BadgeCollecteur({ entreprise, className = "" }) {
  if (!entreprise?.collecteur) return null;
  const publique = entreprise.collecteur === "FIPHFP";
  return (
    <span
      title={publique ? "Employeur public : contribution versée au FIPHFP" : "Employeur privé : contribution OETH (URSSAF / AGEFIPH)"}
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide align-middle whitespace-nowrap border ${
        publique
          ? "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800"
          : "bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800"
      } ${className}`}
    >
      {publique ? "FIPHFP · public" : "AGEFIPH · privé"}
    </span>
  );
}
