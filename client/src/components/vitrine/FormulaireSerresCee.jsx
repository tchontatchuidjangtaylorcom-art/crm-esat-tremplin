import { useState } from "react";
import { api } from "../../api.js";

const CLASSE_INPUT =
  "w-full rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

const VIDE = {
  entreprise: "",
  nom: "",
  telephone: "",
  email: "",
  commune: "",
  nombreSerres: "",
  surfaceSerres: "",
  cultures: "",
  serreChauffee: "",
  energieChauffage: "",
  message: "",
  siteWeb: "",
};

// Formulaire de qualification de la page publique CEE — serres agricoles
// (/vitrine/cee-serres). Mêmes champs serre que InfosSerreCee.jsx côté CRM
// (nombreSerres, surfaceSerres, cultures, serreChauffee, energieChauffage),
// pour que la demande se transforme en fiche CRM sans aucune ressaisie par
// l'agent qui rappelle (voir server/src/leadsSite.js,
// POST /api/vitrine/cee-serres). Aucun calcul ni chiffre d'économie ici :
// c'est un conseiller qui vérifie l'éligibilité du dossier après l'envoi.
export default function FormulaireSerresCee({ id }) {
  const [form, setForm] = useState(VIDE);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [envoye, setEnvoye] = useState(false);

  const champ = (cle) => ({ value: form[cle], onChange: (e) => setForm((f) => ({ ...f, [cle]: e.target.value })) });

  async function envoyer(ev) {
    ev.preventDefault();
    const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    if (!form.nom.trim()) return setErreur("Indiquez votre nom.");
    if (!emailValide && !form.telephone.trim()) {
      return setErreur("Indiquez un e-mail valide ou un numéro de téléphone, pour qu'un conseiller puisse vous recontacter.");
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await api.demanderContactSerresCee({
        entreprise: form.entreprise.trim(),
        nom: form.nom.trim(),
        telephone: form.telephone.trim(),
        email: form.email.trim(),
        commune: form.commune.trim(),
        nombreSerres: form.nombreSerres === "" ? null : Number(form.nombreSerres),
        surfaceSerres: form.surfaceSerres === "" ? null : Number(form.surfaceSerres),
        cultures: form.cultures.trim(),
        serreChauffee: form.serreChauffee === "" ? null : form.serreChauffee === "oui",
        energieChauffage: form.energieChauffage.trim(),
        message: form.message.trim(),
        siteWeb: form.siteWeb,
      });
      setEnvoye(true);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (envoye) {
    return (
      <div id={id} className="text-center py-10 scroll-mt-24">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl">✓</div>
        <p className="text-xl font-semibold mt-4">Demande envoyée</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
          Un conseiller vous recontacte sous 24 h pour vérifier l'éligibilité de votre dossier au dispositif CEE. Rien n'est
          signé ni facturé avant cet échange.
        </p>
      </div>
    );
  }

  return (
    <form id={id} onSubmit={envoyer} className="scroll-mt-24">
      <p className="font-semibold">Laissez vos coordonnées</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Un conseiller reprend votre dossier et vérifie si votre exploitation entre dans le dispositif CEE.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Nom de l'exploitation / entreprise
          <input className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("entreprise")} />
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Nom du gérant *
          <input required className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("nom")} />
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Téléphone
          <input type="tel" className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("telephone")} />
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400">
          E-mail
          <input type="email" className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("email")} />
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">
          Commune / adresse
          <input className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("commune")} />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Nombre de serres
          <input type="number" min="0" className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("nombreSerres")} />
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Surface (m²)
          <input type="number" min="0" className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("surfaceSerres")} />
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">
          Cultures
          <input placeholder="Ex : tomates, salades…" className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("cultures")} />
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Serre déjà chauffée ?
          <select className={`mt-1.5 ${CLASSE_INPUT} cursor-pointer`} {...champ("serreChauffee")}>
            <option className="bg-white dark:bg-slate-900" value="">
              Non renseigné
            </option>
            <option className="bg-white dark:bg-slate-900" value="oui">
              Oui
            </option>
            <option className="bg-white dark:bg-slate-900" value="non">
              Non
            </option>
          </select>
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Énergie de chauffage actuelle
          <input placeholder="Ex : fioul, gaz, électrique…" className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("energieChauffage")} />
        </label>
      </div>

      <label className="block text-xs text-slate-500 dark:text-slate-400 mt-4">
        Votre message (facultatif)
        <textarea rows={3} className={`mt-1.5 ${CLASSE_INPUT} resize-none`} {...champ("message")} />
      </label>

      {/* Champ piège anti-robots, invisible pour les humains. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" {...champ("siteWeb")} />

      {erreur && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{erreur}</p>}
      <button
        type="submit"
        disabled={envoi}
        className="mt-5 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-3.5 transition disabled:opacity-40"
      >
        {envoi ? "Envoi…" : "Être recontacté par un conseiller"}
      </button>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
        Les informations saisies sont utilisées pour étudier votre demande et vous recontacter. L'éligibilité de votre dossier
        au dispositif CEE est vérifiée par un conseiller avant toute confirmation ou signature.
      </p>
    </form>
  );
}
