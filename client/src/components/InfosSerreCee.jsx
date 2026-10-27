import { useEffect, useState } from "react";
import { api } from "../api.js";

// Informations serre propres à l'espace CEE (voir espaces.js) : lues en
// direct par l'agent pendant l'appel (voir server/src/scriptVente.js,
// section "Informations à confirmer dans le CRM" du script Démétherme 400
// fourni par le partenaire le 2026-10-27). Mêmes conventions que
// GestionContacts/GestionTelephones : champ libre, sauvegarde au blur ou au
// clic, pas de validation serveur stricte — un agent au téléphone doit
// pouvoir corriger vite.
export default function InfosSerreCee({ entreprise, onMaj }) {
  const [nombreSerres, setNombreSerres] = useState(entreprise.nombreSerres ?? "");
  const [surfaceSerres, setSurfaceSerres] = useState(entreprise.surfaceSerres ?? "");
  const [cultures, setCultures] = useState(entreprise.cultures || "");
  const [serreChauffee, setSerreChauffee] = useState(entreprise.serreChauffee ?? "");
  const [energieChauffage, setEnergieChauffage] = useState(entreprise.energieChauffage || "");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    setNombreSerres(entreprise.nombreSerres ?? "");
    setSurfaceSerres(entreprise.surfaceSerres ?? "");
    setCultures(entreprise.cultures || "");
    setSerreChauffee(entreprise.serreChauffee ?? "");
    setEnergieChauffage(entreprise.energieChauffage || "");
  }, [entreprise.id, entreprise.nombreSerres, entreprise.surfaceSerres, entreprise.cultures, entreprise.serreChauffee, entreprise.energieChauffage]);

  async function enregistrer(ev) {
    ev.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      const updated = await api.patchEntreprise(entreprise.id, {
        nombreSerres: nombreSerres === "" ? null : Number(nombreSerres),
        surfaceSerres: surfaceSerres === "" ? null : Number(surfaceSerres),
        cultures: cultures.trim() || null,
        serreChauffee: serreChauffee === "" ? null : serreChauffee === "oui",
        energieChauffage: energieChauffage.trim() || null,
      });
      onMaj?.(updated);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  const champ =
    "mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm";

  return (
    <form onSubmit={enregistrer} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Nombre de serres
          <input
            type="number"
            min="0"
            value={nombreSerres}
            onChange={(e) => setNombreSerres(e.target.value)}
            className={champ}
          />
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Surface (m²)
          <input
            type="number"
            min="0"
            value={surfaceSerres}
            onChange={(e) => setSurfaceSerres(e.target.value)}
            className={champ}
          />
        </label>
      </div>
      <label className="block text-xs text-slate-500 dark:text-slate-400">
        Cultures
        <input
          type="text"
          placeholder="Ex : tomates, salades…"
          value={cultures}
          onChange={(e) => setCultures(e.target.value)}
          className={champ}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Serre déjà chauffée ?
          <select value={serreChauffee === true ? "oui" : serreChauffee === false ? "non" : ""} onChange={(e) => setSerreChauffee(e.target.value)} className={champ}>
            <option value="">Non renseigné</option>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </select>
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Énergie de chauffage
          <input
            type="text"
            placeholder="Ex : fioul, gaz, électrique…"
            value={energieChauffage}
            onChange={(e) => setEnergieChauffage(e.target.value)}
            className={champ}
          />
        </label>
      </div>
      {erreur && <p className="text-xs text-red-600 dark:text-red-400">{erreur}</p>}
      <button
        type="submit"
        disabled={enCours}
        className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium py-1.5 disabled:opacity-40"
      >
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
