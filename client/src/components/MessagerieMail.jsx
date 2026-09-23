import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useContenuAide } from "../useContenuAide.js";
import { formatDateHeure } from "../constants.js";

// Fil de messagerie mail réel avec le contact de l'entreprise (boîte IMAP/SMTP
// du pôle — voir server/src/mail.js). Reste utilisable même sans boîte
// connectée : affiche juste un message explicatif et masque l'envoi.
export default function MessagerieMail({ entreprise, onMaj }) {
  const [statutMail, setStatutMail] = useState(null);
  const [objet, setObjet] = useState("");
  const [corps, setCorps] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const { data: modeles } = useContenuAide("modeles-mails", api.getModelesMails);

  useEffect(() => {
    api
      .getStatutMail()
      .then(setStatutMail)
      .catch(() => setStatutMail({ configuree: false }));
  }, []);

  // Marque les mails reçus comme lus dès que ce fil est affiché (= la fiche
  // est ouverte), pour faire disparaître la notification globale.
  useEffect(() => {
    const nonLus = (entreprise.emails || []).some((m) => m.direction === "recu" && !m.lu);
    if (nonLus) {
      api.marquerEmailsLus(entreprise.id).then(onMaj).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprise.id]);

  // Bloc de signature adapté au collecteur réel de l'entreprise : privé
  // (AGEFIPH) ou public (FIPHFP, avec mention de la mise en relation ESAT).
  // Utilise la vraie adresse de la boîte connectée quand elle est configurée,
  // plutôt qu'un domaine fictif en dur.
  function signaturePourEntreprise() {
    const ligneEmail = statutMail?.adresse ? `\n✉️ ${statutMail.adresse}` : "";
    const ligneTelephone = "\n📞 [Numéro du pôle]";
    if (entreprise.collecteur === "FIPHFP") {
      return `Pôle FIPHFP\nN'hésitez pas à nous solliciter pour une mise en relation avec un ESAT partenaire.\n[Signature]${ligneEmail}${ligneTelephone}`;
    }
    return `Pôle OETH / AGEFIPH\n[Signature]${ligneEmail}${ligneTelephone}`;
  }

  function inserer(modele) {
    setObjet(modele.objet);
    setCorps(modele.corps.replaceAll("{{SIGNATURE}}", signaturePourEntreprise()));
  }

  async function envoyer(ev) {
    ev.preventDefault();
    if (!objet.trim() || !corps.trim()) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      const updated = await api.envoyerEmail(entreprise.id, { objet, corps });
      onMaj(updated);
      setObjet("");
      setCorps("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  const emails = entreprise.emails || [];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-purple-200/70 dark:border-purple-900/40 shadow-sm p-5">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Boîte mail — Pôle OETH/AGEFIPH</h2>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
        {entreprise.contact?.email
          ? `Contact : ${entreprise.contact.email}`
          : "Aucune adresse mail connue pour ce contact."}
      </p>

      {statutMail && !statutMail.configuree && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-2 mb-4">
          Boîte mail non connectée pour l'instant — utilisez les modèles à copier-coller depuis le panneau "Modèles
          de mails" en haut de l'écran.
        </p>
      )}

      <ul className="space-y-3 max-h-80 overflow-y-auto mb-4">
        {emails.map((m) => (
          <li
            key={m.id}
            className={`rounded-lg p-3 text-sm ${
              m.direction === "recu"
                ? "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                : "bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {m.direction === "recu" ? `De : ${m.de}` : "Envoyé par le pôle"}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{formatDateHeure(m.date)}</span>
            </div>
            <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{m.objet}</p>
            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">{m.corps}</p>
          </li>
        ))}
        {emails.length === 0 && (
          <li className="text-sm text-slate-400 dark:text-slate-500">
            Aucun mail échangé avec ce contact pour l'instant.
          </li>
        )}
      </ul>

      {entreprise.contact?.email && (
        <form onSubmit={envoyer} className="space-y-2 pt-3 border-t border-purple-100 dark:border-purple-900/30">
          {modeles?.modeles?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {modeles.modeles.map((m) => (
                <button
                  key={m.cle}
                  type="button"
                  onClick={() => inserer(m)}
                  className="text-[11px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  {m.titre}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            placeholder="Objet"
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Votre message…"
            value={corps}
            onChange={(e) => setCorps(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          {erreur && <p className="text-xs text-red-600 dark:text-red-400">{erreur}</p>}
          <button
            type="submit"
            disabled={!objet.trim() || !corps.trim() || envoiEnCours || statutMail?.configuree === false}
            className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
          >
            {envoiEnCours ? "Envoi…" : "Envoyer (signé Pôle OETH / AGEFIPH)"}
          </button>
        </form>
      )}
    </div>
  );
}
