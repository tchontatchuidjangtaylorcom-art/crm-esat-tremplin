import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { estAdmin } from "../roles.js";
import { formatDateHeure } from "../constants.js";
import { construireSignature } from "../mailSignature.js";
import TexteFormate from "../components/TexteFormate.jsx";

// Boîte mail du CRM (voir server/src/boiteMail.js) : tous les e-mails
// envoyés et reçus au même endroit — lire, répondre, relier un mail inconnu
// à une fiche — sans quitter le CRM. Un agent ne voit que les mails des
// fiches qui lui sont visibles ; les mails « à rattacher » (expéditeur
// inconnu) sont réservés aux administrateurs.

const DOSSIERS = [
  { cle: "non_lus", label: "Non lus", icone: "🔵" },
  { cle: "recus", label: "Reçus", icone: "📥" },
  { cle: "envoyes", label: "Envoyés", icone: "📤" },
  { cle: "a_rattacher", label: "À rattacher", icone: "❓", admin: true },
  { cle: "tous", label: "Tout", icone: "🗂" },
];

const champ =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100";

export default function BoiteMail() {
  const { utilisateur } = useAuth();
  const admin = estAdmin(utilisateur);
  const [dossier, setDossier] = useState("non_lus");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState(null);
  const [selection, setSelection] = useState(null);
  const [erreur, setErreur] = useState(null);

  const charger = () =>
    api
      .listBoiteMail({ dossier, q, page })
      .then((d) => {
        setDonnees(d);
        setErreur(null);
      })
      .catch((e) => setErreur(e.message));

  useEffect(() => {
    const t = setTimeout(charger, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossier, q, page]);

  // Nouveaux mails : rafraîchi toutes les 60 s.
  useEffect(() => {
    const t = setInterval(charger, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossier, q, page]);

  async function ouvrir(m) {
    setSelection(m);
    if (!m.lu) {
      await api.marquerMailLu(m.entrepriseId, m.id).catch(() => {});
      setDonnees((d) => d && { ...d, items: d.items.map((x) => (x.id === m.id ? { ...x, lu: true } : x)) });
      if (dossier === "non_lus") setTimeout(charger, 1500);
    }
  }

  const nbPages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.parPage)) : 1;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:pr-2">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        &larr; Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-3 mb-4">📬 Boîte mail</h1>
      {erreur && <p className="mb-3 text-sm text-red-600">{erreur}</p>}
      {donnees?.releve && <EtatReleve releve={donnees.releve} onRelevee={charger} />}

      <div className="grid lg:grid-cols-[13rem_minmax(0,24rem)_minmax(0,1fr)] gap-4">
        {/* Dossiers */}
        <nav className="space-y-1">
          {DOSSIERS.filter((d) => !d.admin || admin).map((d) => {
            const compte = d.cle === "non_lus" ? donnees?.compteurs.nonLus : d.cle === "a_rattacher" ? donnees?.compteurs.aRattacher : null;
            return (
              <button
                key={d.cle}
                type="button"
                onClick={() => {
                  setDossier(d.cle);
                  setPage(1);
                  setSelection(null);
                }}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  dossier === d.cle ? "bg-marine-800 text-white font-medium" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>
                  {d.icone} {d.label}
                </span>
                {compte > 0 && <span className="rounded-full bg-red-500 text-white text-[11px] font-bold px-1.5">{compte}</span>}
              </button>
            );
          })}
        </nav>

        {/* Liste */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[calc(100vh-11rem)]">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher (entreprise, adresse, objet, texte)…"
              className={champ}
            />
          </div>
          <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {!donnees && <li className="p-4 text-sm text-slate-400">Chargement…</li>}
            {donnees?.items.length === 0 && <li className="p-4 text-sm text-slate-400">Aucun e-mail ici.</li>}
            {donnees?.items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => ouvrir(m)}
                  className={`w-full text-left px-3 py-2.5 ${selection?.id === m.id ? "bg-marine-50 dark:bg-marine-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${m.lu ? "text-slate-600 dark:text-slate-300" : "font-bold text-slate-900 dark:text-white"}`}>
                      {!m.lu && <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1.5 align-middle" />}
                      {m.direction === "envoye" ? `À : ${m.entrepriseNom || m.a}` : m.entrepriseNom || m.nomExpediteur || m.de}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatDateHeure(m.date)}</span>
                  </div>
                  <div className={`text-xs truncate ${m.lu ? "text-slate-500" : "text-slate-800 dark:text-slate-100 font-medium"}`}>{m.objet}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {m.direction === "envoye" ? "📤 " : "📥 "}
                    {m.campagne ? "Campagne · " : ""}
                    {m.aRattacher ? "❓ À rattacher · " : ""}
                    {m.desinscription ? "🚫 Désinscription · " : ""}
                    {m.extrait}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {nbPages > 1 && (
            <div className="flex items-center justify-between p-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 rounded border disabled:opacity-40">
                Précédent
              </button>
              <span>
                {page} / {nbPages} · {donnees.total} mails
              </span>
              <button type="button" disabled={page >= nbPages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded border disabled:opacity-40">
                Suivant
              </button>
            </div>
          )}
        </div>

        {/* Lecture */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 max-h-[calc(100vh-11rem)] overflow-y-auto">
          {!selection ? (
            <p className="text-sm text-slate-400">Choisissez un e-mail à gauche.</p>
          ) : (
            <Lecture
              key={selection.id}
              mail={selection}
              admin={admin}
              onMaj={() => {
                setSelection(null);
                charger();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Administrateurs : état de la relève de la boîte du pôle (IMAP OVH), pour
// voir tout de suite si les mails reçus arrivent bien dans le CRM.
function EtatReleve({ releve, onRelevee }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const heure = (d) => (d ? new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "jamais");
  async function relever() {
    setEnCours(true);
    setErreur(null);
    try {
      await api.releverBoiteMail();
      await onRelevee();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }
  if (!releve.configuree) {
    return (
      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm px-4 py-3">
        ⚠️ <strong>La réception des mails n'est pas branchée</strong> : les réponses arrivent dans la boîte OVH (contact@oeth-fiph.fr) mais
        pas dans le CRM. Sur Render → Environment, ajoutez <code>MAIL_IMAP_HOST</code>, <code>MAIL_USER</code> et <code>MAIL_PASSWORD</code>{" "}
        (serveur IMAP indiqué par OVH pour votre boîte), puis redéployez.
      </div>
    );
  }
  return (
    <div
      className={`mb-4 rounded-lg border text-sm px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 ${
        releve.derniereErreur
          ? "border-red-300 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200"
          : "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
      }`}
    >
      <span>
        {releve.derniereErreur ? (
          <>
            ❌ <strong>La relève de la boîte mail échoue</strong> : {releve.derniereErreur}
          </>
        ) : (
          <>✅ Relève de la boîte mail active (toutes les minutes) — dernière réussie à {heure(releve.derniereReussite)}</>
        )}
        {erreur && <span className="block text-xs text-red-700">{erreur}</span>}
      </span>
      <button type="button" onClick={relever} disabled={enCours} className="rounded-lg border border-current px-3 py-1 text-xs font-medium disabled:opacity-50">
        {enCours ? "Relève…" : "↻ Relever maintenant"}
      </button>
    </div>
  );
}

function Lecture({ mail, admin, onMaj }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{mail.objet}</h2>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
        <p>
          {mail.direction === "envoye" ? "À" : "De"} :{" "}
          <strong className="text-slate-700 dark:text-slate-200">
            {mail.direction === "envoye" ? mail.a : `${mail.nomExpediteur ? `${mail.nomExpediteur} — ` : ""}${mail.de}`}
          </strong>
          {mail.cc?.length > 0 && ` · Cc : ${mail.cc.join(", ")}`}
        </p>
        <p>{formatDateHeure(mail.date)}</p>
        {mail.entrepriseId && (
          <p>
            Fiche :{" "}
            <Link to={`/entreprise/${mail.entrepriseId}`} className="text-blue-600 hover:underline font-medium">
              {mail.entrepriseNom}
            </Link>
          </p>
        )}
        {mail.desinscription && <p className="text-rose-700 font-medium">🚫 Demande de désinscription : l'adresse a été retirée des campagnes.</p>}
      </div>
      <div className="mt-4 text-sm text-slate-700 dark:text-slate-200 border-t border-slate-100 dark:border-slate-700 pt-4">
        <TexteFormate texte={mail.corps} className="leading-relaxed" />
      </div>
      {mail.aRattacher && admin && <Rattacher mail={mail} onMaj={onMaj} />}
      {mail.direction === "recu" && mail.entrepriseId && <Repondre mail={mail} onMaj={onMaj} />}
    </div>
  );
}

function Repondre({ mail, onMaj }) {
  const [ouvert, setOuvert] = useState(false);
  const [corps, setCorps] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [envoye, setEnvoye] = useState(false);

  useEffect(() => {
    if (!ouvert || corps) return;
    api
      .getStatutMail()
      .then((s) => setCorps(`Bonjour,\n\n\n\n${construireSignature({ statutMail: s })}`))
      .catch(() => setCorps("Bonjour,\n\n"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  if (envoye) return <p className="mt-4 text-sm text-emerald-700">✓ Réponse envoyée (visible dans « Envoyés » et sur la fiche).</p>;
  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="mt-5 rounded-lg bg-marine-700 hover:bg-marine-800 text-white text-sm font-semibold px-4 py-2">
        ↩ Répondre
      </button>
    );
  }
  const objet = /^re\s*:/i.test(mail.objet || "") ? mail.objet : `Re: ${mail.objet || ""}`;
  return (
    <div className="mt-5 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
      <p className="text-xs text-slate-500">
        À : <strong>{mail.de}</strong> · Objet : {objet}
      </p>
      <textarea value={corps} onChange={(e) => setCorps(e.target.value)} rows={10} spellCheck lang="fr" className={`${champ} resize-y`} />
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!corps.trim() || enCours}
          onClick={async () => {
            setEnCours(true);
            setErreur(null);
            try {
              await api.envoyerEmail(mail.entrepriseId, { objet, corps, destinataire: mail.de });
              setEnvoye(true);
              setTimeout(onMaj, 1500);
            } catch (e) {
              setErreur(e.message);
            } finally {
              setEnCours(false);
            }
          }}
          className="rounded-lg bg-marine-700 hover:bg-marine-800 text-white text-sm font-semibold px-4 py-2 disabled:opacity-40"
        >
          {enCours ? "Envoi…" : "Envoyer"}
        </button>
        <button type="button" onClick={() => setOuvert(false)} className="text-sm text-slate-500 hover:underline">
          Annuler
        </button>
      </div>
    </div>
  );
}

// Mail d'un expéditeur inconnu : le relier à une fiche (son adresse y est
// ajoutée, les prochains mails arriveront directement sur la fiche).
function Rattacher({ mail, onMaj }) {
  const [entreprises, setEntreprises] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    api
      .listEntreprises()
      .then(setEntreprises)
      .catch((e) => setErreur(e.message));
  }, []);

  // Proposition : fiches dont le site / domaine ressemble à celui de l'expéditeur.
  const domaine = String(mail.de || "").split("@")[1] || "";
  const resultats = useMemo(() => {
    if (!entreprises) return [];
    const t = recherche.trim().toLowerCase();
    const racine = domaine.split(".")[0];
    return entreprises
      .filter((e) =>
        t
          ? `${e.nom} ${e.siret || ""} ${e.ville || ""}`.toLowerCase().includes(t)
          : racine.length > 3 && !/gmail|yahoo|hotmail|outlook|orange|free|wanadoo|laposte|sfr/.test(racine) &&
            `${e.nom} ${e.contact?.email || ""}`.toLowerCase().replace(/[^a-z0-9]/g, "").includes(racine.replace(/[^a-z0-9]/g, ""))
      )
      .slice(0, 8);
  }, [entreprises, recherche, domaine]);

  return (
    <div className="mt-5 border-t border-slate-100 dark:border-slate-700 pt-4 space-y-2">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">❓ Expéditeur inconnu : à quelle fiche appartient ce mail ?</p>
      <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom de l'entreprise, SIRET ou ville…" className={champ} />
      <ul className="space-y-1">
        {resultats.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">
              {e.nom} <span className="text-xs text-slate-400">{[e.codePostal, e.ville].filter(Boolean).join(" ")}</span>
            </span>
            <button
              type="button"
              onClick={() =>
                api
                  .rattacherMail(mail.id, e.id)
                  .then(onMaj)
                  .catch((err) => setErreur(err.message))
              }
              className="shrink-0 rounded-lg border border-marine-300 text-marine-800 dark:text-marine-200 text-xs px-2.5 py-1 hover:bg-marine-50"
            >
              Rattacher
            </button>
          </li>
        ))}
        {entreprises && !resultats.length && <li className="text-xs text-slate-400">{recherche ? "Aucune fiche trouvée." : "Tapez le nom de l'entreprise."}</li>}
      </ul>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <button
        type="button"
        onClick={() => window.confirm("Supprimer ce mail (publicité, spam, hors sujet) ?") && api.supprimerMailARattacher(mail.id).then(onMaj)}
        className="text-xs text-rose-600 hover:underline"
      >
        🗑 Supprimer ce mail
      </button>
    </div>
  );
}
