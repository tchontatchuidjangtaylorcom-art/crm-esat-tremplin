import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatDateHeure } from "../constants.js";
import ChampDateHeure from "./ChampDateHeure.jsx";

// Suivi d'appel d'une fiche (voir server/src/suiviAppel.js) : l'agent note
// s'il a appelé, s'il faut rappeler, si l'entreprise est à jour et qui
// recontacter. Affiché sur la fiche et à côté des mails dans la Boîte mail,
// pour ne pas rappeler deux fois la même personne.

const OPTIONS_A_JOUR = [
  { cle: "oui", label: "À jour" },
  { cle: "non", label: "Pas à jour" },
  { cle: "a_verifier", label: "À vérifier" },
];

const champ =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100";

function versFormulaire(suivi) {
  return {
    aRappeler: Boolean(suivi?.aRappeler),
    dateRappel: suivi?.dateRappel || "",
    aJour: suivi?.aJour || null,
    nom: suivi?.interlocuteur?.nom || "",
    fonction: suivi?.interlocuteur?.fonction || "",
    telephone: suivi?.interlocuteur?.telephone || "",
    note: suivi?.note || "",
  };
}

function Choix({ actif, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        actif
          ? "bg-marine-700 border-marine-700 text-white"
          : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

export default function SuiviAppel({ entreprise, onMaj }) {
  const suivi = entreprise.suiviRetour || null;
  const confirmation = entreprise.confirmationClient || null;
  const [form, setForm] = useState(() => versFormulaire(suivi));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [enregistre, setEnregistre] = useState(false);

  // Rechargé quand le suivi change sur le serveur (ou une autre fiche).
  useEffect(() => {
    setForm(versFormulaire(suivi));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprise.id, suivi?.majLe]);

  const modifie = JSON.stringify(form) !== JSON.stringify(versFormulaire(suivi));
  const changer = (champs) => {
    setEnregistre(false);
    setForm((f) => ({ ...f, ...champs }));
  };

  async function envoyer(corps) {
    setEnCours(true);
    setErreur(null);
    try {
      const maj = await api.enregistrerSuiviAppel(entreprise.id, corps);
      onMaj?.(maj);
      return true;
    } catch (e) {
      setErreur(e.message);
      return false;
    } finally {
      setEnCours(false);
    }
  }

  async function enregistrer() {
    const ok = await envoyer({
      aRappeler: form.aRappeler,
      dateRappel: form.aRappeler ? form.dateRappel || null : null,
      aJour: form.aJour,
      interlocuteur: { nom: form.nom, fonction: form.fonction, telephone: form.telephone },
      note: form.note,
    });
    if (ok) setEnregistre(true);
  }

  const dernierAppel = suivi?.appels?.[0] || null;
  const nbAppels = suivi?.appels?.length || 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-marine-200/70 dark:border-marine-900/40 shadow-sm p-5">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100">📞 Suivi d'appel</h2>

      {/* Déjà appelé ? Toujours la première chose qu'on lit avant de décrocher. */}
      <div
        className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
          dernierAppel
            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
            : "bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300"
        }`}
      >
        <span>
          {dernierAppel ? (
            <>
              <strong>Déjà appelé</strong> le {formatDateHeure(dernierAppel.date)} par {dernierAppel.parNom}
              {nbAppels > 1 ? ` (${nbAppels} appels notés)` : ""}
            </>
          ) : (
            "Pas encore appelé"
          )}
        </span>
        <span className="flex items-center gap-2">
          {dernierAppel && (
            <button
              type="button"
              disabled={enCours}
              onClick={() => window.confirm("Annuler le dernier appel noté ?") && envoyer({ action: "annuler_appel" })}
              className="text-xs underline disabled:opacity-40"
            >
              Annuler
            </button>
          )}
          <button
            type="button"
            disabled={enCours}
            onClick={() => envoyer({ action: "appel" })}
            className="rounded-lg bg-marine-700 hover:bg-marine-800 text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-40"
          >
            J'ai appelé
          </button>
        </span>
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">À rappeler ?</p>
          <div className="flex gap-2">
            <Choix actif={form.aRappeler} onClick={() => changer({ aRappeler: true })}>
              Oui
            </Choix>
            <Choix actif={!form.aRappeler} onClick={() => changer({ aRappeler: false, dateRappel: "" })}>
              Non
            </Choix>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">L'entreprise est-elle à jour ?</p>
          <div className="flex flex-wrap gap-2">
            {OPTIONS_A_JOUR.map((o) => (
              <Choix key={o.cle} actif={form.aJour === o.cle} onClick={() => changer({ aJour: form.aJour === o.cle ? null : o.cle })}>
                {o.label}
              </Choix>
            ))}
          </div>
        </div>
      </div>

      {form.aRappeler && (
        <div className="mt-3">
          <ChampDateHeure value={form.dateRappel} onChange={(v) => changer({ dateRappel: v })} libelleDate="Rappeler le" />
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Personne à recontacter</p>
        {confirmation && (
          <p className="text-[11px] text-slate-400 mt-0.5">
            Questionnaire rempli par {confirmation.nom}
            {confirmation.fonction ? `, ${confirmation.fonction}` : ""}. À renseigner si vous devez parler à quelqu'un d'autre.
          </p>
        )}
        <div className="mt-1.5 grid sm:grid-cols-3 gap-2">
          <input value={form.nom} onChange={(e) => changer({ nom: e.target.value })} placeholder="Nom" aria-label="Nom de la personne à recontacter" className={champ} />
          <input value={form.fonction} onChange={(e) => changer({ fonction: e.target.value })} placeholder="Fonction" aria-label="Fonction de la personne à recontacter" className={champ} />
          <input value={form.telephone} onChange={(e) => changer({ telephone: e.target.value })} placeholder="Téléphone" aria-label="Téléphone de la personne à recontacter" className={champ} />
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Note</label>
        <textarea
          rows={3}
          value={form.note}
          onChange={(e) => changer({ note: e.target.value })}
          spellCheck
          lang="fr"
          placeholder="Ce qui a été dit, à quoi penser au prochain appel…"
          className={`${champ} resize-y`}
        />
      </div>

      {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!modifie || enCours}
          onClick={enregistrer}
          className="rounded-lg bg-marine-700 hover:bg-marine-800 text-white text-sm font-semibold px-4 py-2 disabled:opacity-40"
        >
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        {enregistre && !modifie && <span className="text-xs text-emerald-700 dark:text-emerald-400">✓ Enregistré</span>}
        {suivi?.majLe && (
          <span className="text-[11px] text-slate-400">
            Mis à jour le {formatDateHeure(suivi.majLe)} par {suivi.majPar}
          </span>
        )}
      </div>
    </div>
  );
}

// Suivi depuis la Boîte mail : chargé sans marquer la fiche comme vue.
export function SuiviAppelDepuisMail({ entrepriseId, onMaj }) {
  const [entreprise, setEntreprise] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annule = false;
    api
      .getSuiviAppel(entrepriseId)
      .then((d) => !annule && setEntreprise(d))
      .catch((e) => !annule && setErreur(e.message));
    return () => {
      annule = true;
    };
  }, [entrepriseId]);

  if (erreur) return <p className="mt-4 text-xs text-red-600">{erreur}</p>;
  if (!entreprise) return null;
  return (
    <div className="mt-5">
      <SuiviAppel
        entreprise={entreprise}
        onMaj={(maj) => {
          setEntreprise(maj);
          onMaj?.();
        }}
      />
    </div>
  );
}
