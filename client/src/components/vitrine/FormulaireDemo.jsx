import { useEffect, useState } from "react";
import { api } from "../../api.js";

const CLASSE_INPUT =
  "w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400";

const VIDE = {
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  entreprise: "",
  fonction: "",
  taille: "",
  sujets: [],
  message: "",
  consentement: false,
  siteWeb: "",
};

// Formulaire "Demander une démo" : coordonnées, fonction, taille de
// l'organisation, sujets d'intérêt. Listes fournies par le serveur
// (/api/vitrine/demo/options) qui les revalide à la réception.
export default function FormulaireDemo() {
  const [options, setOptions] = useState({ fonctions: [], tailles: [], sujets: [] });
  const [form, setForm] = useState(VIDE);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [envoye, setEnvoye] = useState(false);

  useEffect(() => {
    api
      .getOptionsDemo()
      .then((o) =>
        setOptions({
          fonctions: Array.isArray(o?.fonctions) ? o.fonctions : [],
          tailles: Array.isArray(o?.tailles) ? o.tailles : [],
          sujets: Array.isArray(o?.sujets) ? o.sujets : [],
        })
      )
      .catch(() => {});
  }, []);

  const champ = (cle) => ({ value: form[cle], onChange: (e) => setForm((f) => ({ ...f, [cle]: e.target.value })) });

  function basculerSujet(sujet) {
    setForm((f) => ({ ...f, sujets: f.sujets.includes(sujet) ? f.sujets.filter((x) => x !== sujet) : [...f.sujets, sujet] }));
  }

  async function envoyer(ev) {
    ev.preventDefault();
    if (form.sujets.length === 0) return setErreur("Sélectionnez au moins un sujet.");
    setEnvoi(true);
    setErreur(null);
    try {
      await api.demanderDemo(form);
      setEnvoye(true);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (envoye) {
    return (
      <div className="text-center py-10">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto text-2xl">✓</div>
        <p className="text-xl font-semibold mt-4">Demande envoyée</p>
        <p className="text-sm text-slate-400 mt-2">Un expert revient vers vous rapidement pour organiser la démonstration.</p>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer}>
      <p className="font-semibold">Parlons de vos besoins</p>
      <p className="text-sm text-slate-400 mt-1">
        Laissez-nous vos coordonnées et les sujets qui vous intéressent : un expert revient vers vous rapidement.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        <label className="text-xs text-slate-400">
          Prénom *
          <input required className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("prenom")} />
        </label>
        <label className="text-xs text-slate-400">
          Nom *
          <input required className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("nom")} />
        </label>
        <label className="text-xs text-slate-400">
          E-mail professionnel *
          <input required type="email" className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("email")} />
        </label>
        <label className="text-xs text-slate-400">
          Téléphone *
          <input required type="tel" className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("telephone")} />
        </label>
        <label className="text-xs text-slate-400">
          Entreprise / organisation *
          <input required className={`mt-1.5 ${CLASSE_INPUT}`} {...champ("entreprise")} />
        </label>
        <label className="text-xs text-slate-400">
          Fonction *
          <select required className={`mt-1.5 ${CLASSE_INPUT} cursor-pointer`} {...champ("fonction")}>
            <option className="bg-marine-950" value="">
              Sélectionnez votre fonction
            </option>
            {options.fonctions.map((o) => (
              <option key={o} className="bg-marine-950" value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400 sm:col-span-2">
          Taille de l'organisation *
          <select required className={`mt-1.5 ${CLASSE_INPUT} cursor-pointer`} {...champ("taille")}>
            <option className="bg-marine-950" value="">
              Sélectionnez une tranche d'effectif
            </option>
            {options.tailles.map((o) => (
              <option key={o} className="bg-marine-950" value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-slate-400 mt-4">Quels sujets vous intéressent ? *</p>
      <div className="flex flex-wrap gap-2 mt-2">
        {options.sujets.map((sujet) => {
          const actif = form.sujets.includes(sujet);
          return (
            <button
              key={sujet}
              type="button"
              onClick={() => basculerSujet(sujet)}
              aria-pressed={actif}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                actif ? "border-teal-400 bg-teal-400/15 text-teal-200" : "border-white/15 text-slate-300 hover:bg-white/10"
              }`}
            >
              {actif ? "✓ " : ""}
              {sujet}
            </button>
          );
        })}
      </div>

      <label className="block text-xs text-slate-400 mt-4">
        Votre message
        <textarea
          rows={4}
          placeholder="Présentez-nous votre besoin, votre contexte ou vos disponibilités."
          className={`mt-1.5 ${CLASSE_INPUT} resize-none`}
          {...champ("message")}
        />
      </label>

      {/* Champ piège anti-robots, invisible pour les humains. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" {...champ("siteWeb")} />

      <label className="flex items-start gap-2.5 mt-4 text-xs text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          required
          checked={form.consentement}
          onChange={(e) => setForm((f) => ({ ...f, consentement: e.target.checked }))}
          className="mt-0.5 accent-teal-400"
        />
        J'accepte que les informations saisies soient utilisées pour répondre à ma demande. Elles ne seront pas utilisées à
        d'autres fins sans mon accord.
      </label>

      {erreur && <p className="text-sm text-red-400 mt-3">{erreur}</p>}
      <button
        type="submit"
        disabled={envoi}
        className="mt-5 w-full rounded-xl bg-teal-400 hover:bg-teal-300 text-marine-950 text-sm font-bold py-3.5 transition disabled:opacity-40"
      >
        {envoi ? "Envoi…" : "Envoyer ma demande"}
      </button>
    </form>
  );
}
