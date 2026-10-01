import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { formatDateHeure } from "../constants.js";

// Supervision (super-administrateur uniquement, voir server/src/journalAudit.js) :
//  - Journal d'activité : qui a fait quoi, sur quelle fiche, depuis son compte
//    ou depuis celui d'un agent (Mode Manager), avec les alertes « en sa
//    faveur » (fiche d'un autre agent qu'on s'attribue, qualifiée en CP…) ;
//  - Conversations : tout le chat interne en lecture seule (chaque lecture
//    est elle-même inscrite au journal).
export default function Supervision() {
  const { utilisateur } = useAuth();
  const [onglet, setOnglet] = useState("journal");

  if (utilisateur?.role !== "super_admin") {
    return (
      <div className="p-6 max-w-3xl mx-auto text-sm text-slate-600 dark:text-slate-300">
        Page réservée au super-administrateur. <Link to="/" className="text-blue-600 hover:underline">Retour</Link>
      </div>
    );
  }

  const bouton = (cle, libelle) => (
    <button
      type="button"
      onClick={() => setOnglet(cle)}
      className={`px-4 py-2 text-sm font-medium rounded-lg ${
        onglet === cle ? "bg-marine-700 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
      }`}
    >
      {libelle}
    </button>
  );

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        &larr; Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-3 mb-4">🛡 Supervision</h1>
      <div className="flex gap-2 mb-4">
        {bouton("journal", "📋 Journal d'activité")}
        {bouton("conversations", "💬 Conversations")}
      </div>
      {onglet === "journal" ? <Journal /> : <Conversations />}
    </div>
  );
}

const champ =
  "rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm";

function Journal() {
  const [equipe, setEquipe] = useState([]);
  const [personne, setPersonne] = useState("");
  const [alertes, setAlertes] = useState(false);
  const [modeManager, setModeManager] = useState(false);
  const [q, setQ] = useState("");
  const [lignes, setLignes] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    api.listUtilisateurs().then(setEquipe).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      const p = new URLSearchParams({ limite: "500" });
      if (personne) p.set("utilisateurId", personne);
      if (alertes) p.set("alertes", "1");
      if (modeManager) p.set("modeManager", "1");
      if (q.trim()) p.set("q", q.trim());
      fetch(`/api/supervision/journal?${p}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((l) => {
          setLignes(l);
          setErreur(null);
        })
        .catch((e) => setErreur(e.message));
    }, 250);
    return () => clearTimeout(id);
  }, [personne, alertes, modeManager, q]);

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select value={personne} onChange={(e) => setPersonne(e.target.value)} className={champ}>
          <option value="">Toute l'équipe</option>
          {equipe.map((u) => (
            <option key={u.id} value={u.id}>
              {[u.prenom, u.nom].filter(Boolean).join(" ") || u.email}
              {u.role !== "agent" ? ` (${u.role === "super_admin" ? "super-admin" : "admin"})` : ""}
            </option>
          ))}
        </select>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Fiche, action, détail…" className={`flex-1 min-w-[12rem] ${champ}`} />
        <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={alertes} onChange={(e) => setAlertes(e.target.checked)} />
          ⚠️ Alertes seulement
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={modeManager} onChange={(e) => setModeManager(e.target.checked)} />
          👁 Depuis le compte d'un agent
        </label>
      </div>
      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
      {lignes && lignes.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Aucune action trouvée.</p>}
      {lignes && lignes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Qui</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Fiche</th>
                <th className="py-2">Détail</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr
                  key={l.id}
                  className={`border-b border-slate-100 dark:border-slate-700/60 align-top ${l.alerte ? "bg-red-50 dark:bg-red-950/30" : ""}`}
                >
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-500 dark:text-slate-400">{formatDateHeure(l.date)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{l.nom}</span>
                    {l.role !== "agent" && (
                      <span className="ml-1 text-[10px] uppercase text-slate-400">{l.role === "super_admin" ? "super-admin" : "admin"}</span>
                    )}
                    {l.modeManager && (
                      <div className="text-xs text-amber-700 dark:text-amber-400">👁 compte de {l.modeManager.nom || "?"}</div>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{l.action}</td>
                  <td className="py-2 pr-3">
                    {l.entrepriseId ? (
                      <a href={`/entreprise/${l.entrepriseId}`} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                        {l.entrepriseNom}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 text-slate-600 dark:text-slate-300">
                    {l.alerte && <div className="font-semibold text-red-700 dark:text-red-400">⚠️ {l.alerte}</div>}
                    {l.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">500 dernières actions au plus — affinez avec les filtres.</p>
        </div>
      )}
    </div>
  );
}

function Conversations() {
  const [liste, setListe] = useState(null);
  const [actif, setActif] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filtre, setFiltre] = useState("");

  useEffect(() => {
    fetch("/api/supervision/conversations")
      .then((r) => (r.ok ? r.json() : []))
      .then(setListe)
      .catch(() => setListe([]));
  }, []);

  useEffect(() => {
    if (!actif) return;
    fetch(`/api/supervision/conversations/${encodeURIComponent(actif.id)}/messages`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [actif]);

  const visibles = (liste || []).filter((c) => !filtre.trim() || `${c.nom}`.toLowerCase().includes(filtre.trim().toLowerCase()));
  const icone = { general: "📢", groupe: "👥", prive: "🔒" };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm flex flex-col md:flex-row md:h-[70vh] min-h-[420px] overflow-hidden">
      <div className="md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-2">
          <input type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="🔍 Chercher une personne" className={`w-full ${champ}`} />
        </div>
        <ul className="overflow-y-auto max-h-60 md:max-h-none flex-1">
          {liste === null && <li className="p-3 text-sm text-slate-400">Chargement…</li>}
          {visibles.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setActif(c)}
                className={`w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 ${
                  actif?.id === c.id ? "bg-marine-50 dark:bg-marine-900/40" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}
              >
                <div className="flex justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                    {icone[c.type] || "💬"} {c.nom}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{c.nbMessages}</span>
                </div>
                {c.dernierMessage && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {c.dernierMessage.auteur} : {c.dernierMessage.texte}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        {!actif ? (
          <p className="m-auto p-6 text-sm text-slate-400">Choisissez une conversation à gauche.</p>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {icone[actif.type]} {actif.nom}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lecture seule{actif.membres ? ` — membres : ${actif.membres.join(", ")}` : ""} · cette consultation est notée dans le journal.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 && <p className="text-sm text-slate-400">Aucun message.</p>}
              {messages.map((m) => (
                <div key={m.id} className="text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-100">{m.auteurNom}</span>{" "}
                  <span className="text-xs text-slate-400">{formatDateHeure(m.date)}</span>
                  <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{m.texte}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
