export default function Header({ prenom = "Philippe" }) {
  const heure = new Date().getHours();
  const salutation = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold text-slate-800">
        {salutation} {prenom}
      </h1>
      <p className="text-slate-500 text-sm mt-1">
        Voici l'état de vos dossiers OETH / AGEFIPH aujourd'hui.
      </p>
    </header>
  );
}
