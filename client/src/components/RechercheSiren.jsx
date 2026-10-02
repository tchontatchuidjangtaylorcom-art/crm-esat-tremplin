import { useDeferredValue, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { STATUTS } from "../constants.js";

// Recherche d'entreprise sur tout le CRM (fiches actives et archivées, quels
// que soient les filtres du tableau) : par nom, même approximatif (fautes de
// frappe tolérées), par SIRET/SIREN ou par numéro de téléphone. Les résultats
// s'affichent pendant la frappe ; un clic ouvre la fiche dans un nouvel
// onglet. Un SIREN/SIRET inconnu du CRM peut toujours créer le lead depuis le
// répertoire Sirene (INSEE), comme avant.

const MAX_RESULTATS = 8;

function normaliser(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Numéro comparable quel que soit le format : "+33 1 46 70 14 40",
// "01.46.70.14.40" → "146701440" (sans le 0 ni l'indicatif).
function chiffresTelephone(numero) {
  let d = String(numero || "").replace(/\D/g, "");
  if (d.startsWith("0033")) d = d.slice(4);
  else if (d.startsWith("33") && d.length === 11) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

// Distance d'édition bornée (Levenshtein), pour tolérer une ou deux fautes.
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let precedente = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const courante = [i];
    let minLigne = i;
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      courante[j] = Math.min(precedente[j] + 1, courante[j - 1] + 1, precedente[j - 1] + cout);
      minLigne = Math.min(minLigne, courante[j]);
    }
    if (minLigne > max) return max + 1;
    precedente = courante;
  }
  return precedente[b.length];
}

// Un mot de la recherche correspond à un mot du nom : début de mot, contenu,
// ou à une/deux fautes près (selon la longueur).
function correspondanceMot(terme, mots) {
  let meilleur = 0;
  const tolerance = terme.length >= 7 ? 2 : terme.length >= 4 ? 1 : 0;
  for (const mot of mots) {
    if (mot.startsWith(terme)) return 3;
    if (terme.length >= 3 && mot.includes(terme)) meilleur = Math.max(meilleur, 2);
    else if (tolerance && distance(terme, mot.slice(0, terme.length + tolerance), tolerance) <= tolerance) {
      meilleur = Math.max(meilleur, 1);
    }
  }
  return meilleur;
}

function indexer(e, archivee) {
  const telephones = [e.contact?.telephone, ...(e.contact?.telephonesAlternatifs || []).map((t) => t.numero)]
    .filter(Boolean)
    .map(chiffresTelephone)
    .filter((d) => d.length >= 6);
  const nom = normaliser(e.nom);
  return { e, archivee, nom, mots: nom.split(" ").filter(Boolean), siret: String(e.siret || "").replace(/\D/g, ""), telephones };
}

function scorer(entree, requete) {
  const brut = requete.trim();
  const chiffres = brut.replace(/\D/g, "");
  const estNumerique = chiffres.length >= 4 && /^[\d\s.+()/-]+$/.test(brut);
  if (estNumerique) {
    let score = 0;
    if (entree.siret.startsWith(chiffres)) score = 100;
    else if (chiffres.length >= 6 && entree.siret.includes(chiffres)) score = 80;
    const tel = chiffresTelephone(chiffres);
    if (tel.length >= 4 && entree.telephones.some((t) => t.includes(tel))) score = Math.max(score, 95);
    return score;
  }
  const q = normaliser(brut);
  if (q.length < 2) return 0;
  if (entree.nom === q) return 90;
  if (entree.nom.startsWith(q)) return 85;
  if (q.length >= 3 && entree.nom.includes(q)) return 75;
  const termes = q.split(" ").filter(Boolean);
  const scores = termes.map((t) => correspondanceMot(t, entree.mots));
  if (scores.some((s) => s === 0)) return 0;
  // 60 si tous les mots correspondent exactement, jusqu'à 40 si approximatif.
  return 30 + (scores.reduce((a, b) => a + b, 0) / termes.length) * 10;
}

// Un clic sur un résultat ouvre d'abord un petit panneau sur place : ouvrir
// la fiche (nouvel onglet), l'afficher dans la liste du tableau de bord, ou —
// administrateur — l'assigner directement à quelqu'un (`agents`).
export default function RechercheSiren({
  onEntreprise,
  entreprises = [],
  archives = [],
  agents = null,
  onAssigner,
  onAfficherDansListe,
}) {
  const [detail, setDetail] = useState(null);
  const [infoAssignation, setInfoAssignation] = useState(null);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const [selection, setSelection] = useState(0);
  const saisieDifferee = useDeferredValue(saisie);
  const zone = useRef(null);

  const index = useMemo(
    () => [...entreprises.map((e) => indexer(e, false)), ...archives.map((e) => indexer(e, true))],
    [entreprises, archives]
  );

  const resultats = useMemo(() => {
    if (saisieDifferee.trim().length < 2) return [];
    return index
      .map((entree) => ({ entree, score: scorer(entree, saisieDifferee) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.entree.nom.localeCompare(b.entree.nom))
      .slice(0, MAX_RESULTATS);
  }, [index, saisieDifferee]);

  const chiffresSaisis = saisie.replace(/\D/g, "");
  const sirenSaisi = chiffresSaisis.length === 14 ? chiffresSaisis.slice(0, 9) : chiffresSaisis.length === 9 ? chiffresSaisis : null;
  const proposerCreation = Boolean(sirenSaisi) && /^[\d\s.-]+$/.test(saisie.trim()) && !resultats.some((r) => r.entree.siret.startsWith(sirenSaisi));

  function ouvrirFiche(id) {
    window.open(`/entreprise/${id}`, "_blank", "noopener,noreferrer");
    setOuvert(false);
  }

  async function creerDepuisSirene() {
    setEnCours(true);
    setMessage(null);
    setOuvert(false);
    try {
      const resultat = await api.rechercherSiren(sirenSaisi);
      onEntreprise?.(resultat.entreprise, resultat.existant, resultat.archive);
      setMessage({
        type: "success",
        texte: resultat.existant
          ? `Fiche déjà existante pour ${resultat.entreprise.nom} — ouverture dans un nouvel onglet.`
          : resultat.archive
          ? `${resultat.entreprise.nom} est radiée d'après le Sirene : dossier archivé automatiquement, aucune action requise.`
          : `Lead créé et qualifié automatiquement : ${resultat.entreprise.nom} (${resultat.entreprise.collecteur}).`,
      });
      window.open(`/entreprise/${resultat.entreprise.id}`, "_blank", "noopener,noreferrer");
      setSaisie("");
    } catch (e) {
      setMessage({ type: "error", texte: e.message });
    } finally {
      setEnCours(false);
    }
  }

  function soumettre(ev) {
    ev.preventDefault();
    if (resultats[selection]) {
      // Entrée : panneau d'actions du résultat sélectionné.
      const id = resultats[selection].entree.e.id;
      setOuvert(true);
      return setDetail((d) => (d === id ? null : id));
    }
    if (proposerCreation) return creerDepuisSirene();
    setMessage({
      type: "error",
      texte: saisie.trim()
        ? "Aucune entreprise trouvée dans le CRM. Pour créer un lead, saisissez son SIREN (9 chiffres) ou SIRET (14 chiffres)."
        : "Tapez un nom d'entreprise, un SIRET ou un numéro de téléphone.",
    });
  }

  function surTouche(ev) {
    if (!resultats.length) return;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setOuvert(true);
      setSelection((s) => Math.min(s + 1, resultats.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setSelection((s) => Math.max(s - 1, 0));
    } else if (ev.key === "Escape") {
      setOuvert(false);
    }
  }

  const listeVisible = ouvert && saisie.trim().length >= 2 && (resultats.length > 0 || proposerCreation || saisieDifferee === saisie);

  return (
    <form
      onSubmit={soumettre}
      ref={zone}
      onBlur={(ev) => {
        if (!zone.current?.contains(ev.relatedTarget)) setOuvert(false);
      }}
      className="relative flex flex-wrap items-center gap-x-3 gap-y-2 mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-4 py-3"
    >
      <div className="relative flex-1 min-w-[260px] max-w-2xl">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder="Rechercher une entreprise : nom, SIRET ou téléphone (ou SIREN pour créer un lead)"
          aria-label="Rechercher une entreprise"
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value);
            setSelection(0);
            setOuvert(true);
            setMessage(null);
          }}
          onFocus={() => setOuvert(true)}
          onKeyDown={surTouche}
          autoComplete="off"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marine-400"
        />

        {listeVisible && (
          <ul className="absolute left-0 right-0 top-full mt-1 z-30 max-h-96 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl divide-y divide-slate-100 dark:divide-slate-700">
            {resultats.map(({ entree }, i) => {
              const e = entree.e;
              const statut = STATUTS[e.statut] || { label: e.statut, badge: "" };
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => {
                      setInfoAssignation(null);
                      setDetail((d) => (d === e.id ? null : e.id));
                    }}
                    onMouseEnter={() => setSelection(i)}
                    className={`w-full text-left px-3 py-2 ${i === selection ? "bg-marine-50 dark:bg-marine-900/40" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{e.nom}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {entree.archivee && (
                          <span className="rounded-full bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-200">
                            archivée
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statut.badge}`}>{statut.label}</span>
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {[
                        [e.codePostal, e.ville].filter(Boolean).join(" "),
                        e.siret ? `SIRET ${e.siret}` : null,
                        e.contact?.telephone ? `☎ ${e.contact.telephone}` : null,
                        e.assigneANom ? `👤 ${e.assigneANom}` : "Non assigné",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </button>
                  {detail === e.id && (
                    <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5 pt-1 bg-marine-50/60 dark:bg-marine-900/20 text-xs">
                      <button
                        type="button"
                        onClick={() => ouvrirFiche(e.id)}
                        className="rounded-lg bg-marine-700 hover:bg-marine-800 text-white font-medium px-3 py-1.5"
                      >
                        ↗ Ouvrir la fiche
                      </button>
                      {!entree.archivee && onAfficherDansListe && (
                        <button
                          type="button"
                          onClick={() => {
                            onAfficherDansListe(e);
                            setOuvert(false);
                          }}
                          className="rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 hover:bg-white dark:hover:bg-slate-700"
                        >
                          📋 Afficher dans la liste
                        </button>
                      )}
                      {!entree.archivee && agents && onAssigner && (
                        <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          Assigner à
                          <select
                            value={e.assigneA || ""}
                            onChange={async (ev) => {
                              const id = ev.target.value || null;
                              const nom = agents.find((a) => a.id === id);
                              try {
                                await onAssigner(e.id, id);
                                setInfoAssignation(
                                  id ? `✓ Attribuée à ${nom ? nom.prenom || nom.email : "?"}` : "✓ Fiche retirée"
                                );
                              } catch (err) {
                                setInfoAssignation(`Erreur : ${err.message}`);
                              }
                            }}
                            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
                          >
                            <option value="">Non assigné</option>
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.role === null ? a.prenom : [a.prenom, a.nom].filter(Boolean).join(" ") || a.email}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {infoAssignation && <span className="text-emerald-700 dark:text-emerald-400">{infoAssignation}</span>}
                    </div>
                  )}
                </li>
              );
            })}
            {proposerCreation && (
              <li>
                <button
                  type="button"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={creerDepuisSirene}
                  className="w-full text-left px-3 py-2 text-sm text-marine-700 dark:text-marine-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  ➕ Pas dans le CRM : créer le lead depuis le répertoire INSEE (SIREN {sirenSaisi})
                </button>
              </li>
            )}
            {resultats.length === 0 && !proposerCreation && (
              <li className="px-3 py-3 text-sm text-slate-400 dark:text-slate-500">
                Aucune entreprise ne correspond dans le CRM.
              </li>
            )}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={enCours}
        className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium px-4 py-2 disabled:opacity-40"
      >
        {enCours ? "Création…" : "Rechercher"}
      </button>
      {message && (
        <span
          className={`text-sm ${message.type === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
        >
          {message.texte}
        </span>
      )}
    </form>
  );
}
