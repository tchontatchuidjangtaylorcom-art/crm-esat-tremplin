import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

const euros = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

// Page Campagnes : pour les fiches de la cible qui n'ont pas d'e-mail, l'IA
// cherche sur le web une adresse réellement publiée (voir
// server/src/emailsEnLot.js). Payant : nombre de fiches choisi, coût estimé
// affiché et confirmé avant de lancer.
export default function RechercheEmailsEnLot({ filtres, onFin }) {
  const [apercu, setApercu] = useState(null);
  const [nombre, setNombre] = useState(50);
  const [etat, setEtat] = useState(null);
  const [erreur, setErreur] = useState(null);
  const enCoursAvant = useRef(false);

  const cle = JSON.stringify(filtres);
  useEffect(() => {
    if (!filtres.statuts) return;
    const t = setTimeout(() => {
      api
        .apercuEmailsEnLot({ filtres })
        .then((a) => {
          setApercu(a);
          setNombre((n) => Math.max(1, Math.min(n, a.aChercher || 1, a.maxParLot)));
        })
        .catch(() => setApercu(null));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, etat?.enCours]);

  // Suivi de la recherche en cours (toutes les 4 s).
  useEffect(() => {
    let actif = true;
    const lire = () =>
      api
        .statutEmailsEnLot()
        .then((e) => {
          if (!actif) return;
          setEtat(e);
          if (enCoursAvant.current && !e.enCours) onFin?.();
          enCoursAvant.current = e.enCours;
        })
        .catch(() => {});
    lire();
    const t = setInterval(lire, 4000);
    return () => {
      actif = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lancer() {
    const n = Math.min(nombre, apercu.aChercher, apercu.maxParLot);
    const min = euros(n * apercu.coutParFiche.min);
    const max = euros(n * apercu.coutParFiche.max);
    if (
      !window.confirm(
        `Chercher sur internet l'e-mail de ${n} entreprise(s) ?\n\nRecherche PAYANTE (crédits Anthropic) : environ ${min} à ${max}.\nSeules les adresses réellement publiées sont gardées. Vous pouvez arrêter à tout moment.`
      )
    )
      return;
    setErreur(null);
    try {
      setEtat(await api.lancerEmailsEnLot({ filtres, nombre: n }));
      enCoursAvant.current = true;
    } catch (e) {
      setErreur(e.message);
    }
  }

  if (etat?.enCours) {
    const pct = etat.total ? Math.round((etat.faites / etat.total) * 100) : 0;
    return (
      <div className="rounded-lg border border-violet-200 dark:border-violet-900/50 bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-sm space-y-1.5">
        <p className="font-medium text-violet-800 dark:text-violet-200">
          🔎 Recherche des e-mails en cours : {etat.faites} / {etat.total}
        </p>
        <div className="h-2 rounded-full bg-violet-100 dark:bg-violet-900/50 overflow-hidden">
          <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          <strong className="text-emerald-700">{etat.trouves} trouvés</strong> · {etat.introuvables} sans adresse publiée · {etat.erreurs} erreurs
          {etat.enTrain ? ` — en cours : ${etat.enTrain}` : ""}
        </p>
        <button
          type="button"
          onClick={() => api.arreterEmailsEnLot().then(setEtat)}
          disabled={etat.arretDemande}
          className="rounded-lg border border-slate-300 text-xs px-2.5 py-1 disabled:opacity-40"
        >
          {etat.arretDemande ? "Arrêt après la fiche en cours…" : "⏹ Arrêter"}
        </button>
      </div>
    );
  }

  if (!apercu) return null;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm space-y-2">
      <p className="text-slate-700 dark:text-slate-200">
        🔎 <strong>{apercu.aChercher}</strong> fiche{apercu.aChercher > 1 ? "s" : ""} de cette cible sans e-mail, jamais cherchée
        {apercu.aChercher > 1 ? "s" : ""}. L'IA peut chercher sur internet leur adresse <strong>réellement publiée</strong> (site,
        mentions légales, annuaires) — jamais une adresse devinée.
      </p>
      {etat?.fin && (
        <p className="text-xs text-slate-500">
          Dernière recherche : {etat.trouves} e-mail{etat.trouves > 1 ? "s" : ""} trouvé{etat.trouves > 1 ? "s" : ""} sur {etat.faites} fiche
          {etat.faites > 1 ? "s" : ""} — {etat.fin}
        </p>
      )}
      {apercu.aChercher > 0 && apercu.iaConfiguree && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-500 flex items-center gap-1.5">
            Fiches à chercher
            <input
              type="number"
              min={1}
              max={Math.min(apercu.aChercher, apercu.maxParLot)}
              value={nombre}
              onChange={(e) => setNombre(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
            />
          </label>
          <span className="text-xs text-slate-500">
            ≈ {euros(Math.min(nombre, apercu.aChercher) * apercu.coutParFiche.min)} à{" "}
            {euros(Math.min(nombre, apercu.aChercher) * apercu.coutParFiche.max)}
          </span>
          <button type="button" onClick={lancer} className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-1.5">
            Chercher les e-mails
          </button>
        </div>
      )}
      {!apercu.iaConfiguree && <p className="text-xs text-amber-700">Recherche IA non configurée (ANTHROPIC_API_KEY).</p>}
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </div>
  );
}
