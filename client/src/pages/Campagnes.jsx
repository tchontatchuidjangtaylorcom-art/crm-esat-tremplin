import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { formatDateHeure } from "../constants.js";
import { TAILLES_EFFECTIF } from "../taillesEffectif.js";

// Campagnes d'e-mails (super-administrateur, voir server/src/campagnes.js) :
// un modèle envoyé à toutes les fiches d'une cible, au rythme d'une montée en
// charge progressive (pour ne pas faire classer oeth-fiph.fr en spam), avec
// désinscription en un clic et trace de chaque envoi sur la fiche.

const LIBELLE_STATUT = {
  en_cours: { label: "En cours", classe: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  en_pause: { label: "En pause", classe: "bg-amber-100 text-amber-800 border-amber-300" },
  terminee: { label: "Terminée", classe: "bg-slate-100 text-slate-700 border-slate-300" },
  annulee: { label: "Annulée", classe: "bg-rose-100 text-rose-700 border-rose-300" },
};

const champ =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100";

export default function Campagnes() {
  const { utilisateur } = useAuth();
  const [donnees, setDonnees] = useState(null);
  const [categories, setCategories] = useState([]);
  const [lots, setLots] = useState([]);
  const [modeles, setModeles] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [info, setInfo] = useState(null);

  const [nom, setNom] = useState("");
  const [filtres, setFiltres] = useState({ collecteur: "AGEFIPH", categorie: "", lot: "", taille: "", statuts: null, delaiJours: 30 });
  const [objet, setObjet] = useState("");
  const [corps, setCorps] = useState("");
  const [formatOfficiel, setFormatOfficiel] = useState(true);
  const [apercu, setApercu] = useState(null);
  const [enCours, setEnCours] = useState(null);
  const [plafond, setPlafond] = useState("");

  const charger = () =>
    api
      .listCampagnes()
      .then((d) => {
        setDonnees(d);
        setPlafond((p) => p || String(d.etat.plafondMax || ""));
        setFiltres((f) => (f.statuts ? f : { ...f, statuts: d.statutsParDefaut }));
      })
      .catch((e) => setErreur(e.message));

  useEffect(() => {
    if (utilisateur?.role !== "super_admin") return;
    charger();
    api.listCategories().then(setCategories).catch(() => {});
    api.listLots().then(setLots).catch(() => {});
    api
      .getModelesMails()
      .then((r) => setModeles(Array.isArray(r) ? r : r?.modeles || []))
      .catch(() => {});
    const t = setInterval(charger, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utilisateur?.role]);

  // Aperçu de la cible à chaque changement de critère.
  const cleFiltres = JSON.stringify(filtres);
  useEffect(() => {
    if (!filtres.statuts) return;
    const t = setTimeout(() => {
      api
        .apercuCampagne({ filtres })
        .then(setApercu)
        .catch(() => setApercu(null));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleFiltres]);

  const modelesProposes = useMemo(
    () => modeles.filter((m) => (filtres.collecteur === "FIPHFP" ? m.secteur === "public" : m.secteur !== "public")),
    [modeles, filtres.collecteur]
  );

  if (utilisateur?.role !== "super_admin") {
    return (
      <div className="p-6 max-w-3xl mx-auto text-sm text-slate-600 dark:text-slate-300">
        Page réservée au super-administrateur. <Link to="/" className="text-blue-600 hover:underline">Retour</Link>
      </div>
    );
  }

  async function agir(cle, fn) {
    setEnCours(cle);
    setErreur(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  }

  const majFiltre = (cle, valeur) => setFiltres((f) => ({ ...f, [cle]: valeur }));
  const basculerStatut = (s) =>
    setFiltres((f) => ({ ...f, statuts: f.statuts.includes(s) ? f.statuts.filter((x) => x !== s) : [...f.statuts, s] }));

  const etat = donnees?.etat;
  const pret = nom.trim() && objet.trim() && corps.trim() && apercu?.nombre > 0;

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-6xl mx-auto">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        &larr; Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-3">📨 Campagnes d'e-mails</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        Un modèle envoyé à toute une cible, étalé {etat?.horaires || "sur les heures de bureau"}, avec une montée en charge
        progressive pour ne pas finir en spam. Chaque mail contient un lien « Se désinscrire » et apparaît sur la fiche.
      </p>

      {erreur && <p className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2">{erreur}</p>}
      {info && <p className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-sm px-3 py-2">{info}</p>}

      {etat && (
        <div className="grid sm:grid-cols-4 gap-3 mb-6">
          <Tuile titre="Envoyés aujourd'hui" valeur={`${etat.envoyesAujourdhui} / ${etat.plafondDuJour}`} />
          <Tuile
            titre="Montée en charge"
            valeur={etat.premierEnvoi ? `Jour ${etat.jourDeMontee}` : "Pas encore commencé"}
            detail={etat.paliers.map((p) => `${p.plafond}/j`).join(" → ") + ` → ${etat.plafondMax}/j`}
          />
          <Tuile titre="Envoi en ce moment" valeur={etat.horaireOuvert ? "Ouvert" : "Fermé"} detail={etat.horaires} />
          <Tuile titre="Désinscrits" valeur={etat.nbDesinscriptions} detail="jamais recontactés par e-mail" />
        </div>
      )}
      {etat && (
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Expéditeur des campagnes : <strong>{etat.expediteur}</strong>
          {etat.sousDomaine
            ? " (sous-domaine dédié : la réputation de l'adresse des agents est protégée)."
            : " — conseillé : un sous-domaine dédié (variable CAMPAGNES_FROM sur Render). Les réponses arrivent toujours dans la boîte du pôle."}{" "}
          Les adresses dont le domaine ne reçoit pas de courrier sont écartées automatiquement.
        </p>
      )}
      {etat && !etat.envoiConfigure && (
        <p className="mb-4 rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
          L'envoi d'e-mails n'est pas configuré (clé Resend manquante) : aucune campagne ne partira.
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* 1. Cible */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">1. Qui reçoit ?</h2>
          <label className="block text-xs text-slate-500">
            Employeurs
            <select value={filtres.collecteur} onChange={(e) => majFiltre("collecteur", e.target.value)} className={champ}>
              <option value="AGEFIPH">Privés (AGEFIPH)</option>
              <option value="FIPHFP">Publics (FIPHFP)</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-slate-500">
              Secteur
              <select value={filtres.categorie} onChange={(e) => majFiltre("categorie", e.target.value)} className={champ}>
                <option value="">Tous les secteurs</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-500">
              Vague
              <select value={filtres.lot} onChange={(e) => majFiltre("lot", e.target.value)} className={champ}>
                <option value="">Toutes les vagues</option>
                {lots.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-500">
              Taille
              <select value={filtres.taille} onChange={(e) => majFiltre("taille", e.target.value)} className={champ}>
                <option value="">Toutes tailles</option>
                {TAILLES_EFFECTIF.map((t) => (
                  <option key={t.cle} value={t.cle}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-500">
              Pas d'autre campagne depuis
              <select value={filtres.delaiJours} onChange={(e) => majFiltre("delaiJours", Number(e.target.value))} className={champ}>
                {[7, 14, 30, 60, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} jours
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Statut des fiches</p>
            <div className="flex flex-wrap gap-1.5">
              {donnees &&
                Object.entries(donnees.statutsCiblables).map(([cle, label]) => {
                  const actif = filtres.statuts?.includes(cle);
                  return (
                    <button
                      key={cle}
                      type="button"
                      onClick={() => basculerStatut(cle)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${
                        actif ? "bg-marine-700 text-white border-marine-700" : "border-slate-300 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Jamais les Clients Potentiels, RDV ni dossiers archivés.</p>
          </div>
          {apercu && (
            <div className="rounded-lg bg-marine-50 dark:bg-marine-950/30 border border-marine-200 dark:border-marine-900/50 px-3 py-2 text-sm">
              <strong className="text-marine-800 dark:text-marine-200">{apercu.nombre} fiche{apercu.nombre > 1 ? "s" : ""}</strong> recevront le mail
              {apercu.nombre > 0 && etat ? ` — environ ${apercu.joursEstimes} jour${apercu.joursEstimes > 1 ? "s" : ""} ouvré${apercu.joursEstimes > 1 ? "s" : ""} au rythme actuel` : ""}.
              <span className="block text-xs text-slate-500 mt-0.5">
                Écartées : {apercu.exclusions.sansEmail} sans e-mail · {apercu.exclusions.desinscrits} désinscrites ·{" "}
                {apercu.exclusions.dejaRecu} déjà contactées récemment
              </span>
            </div>
          )}
        </section>

        {/* 2. Message */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">2. Quel message ?</h2>
          <div className="flex flex-wrap gap-1.5">
            {modelesProposes.map((m) => (
              <button
                key={m.cle}
                type="button"
                onClick={() => {
                  setObjet(m.objet);
                  setCorps(m.corps);
                  if (!nom.trim()) setNom(m.titre.replace(/^\d+\.\s*/, ""));
                }}
                className="rounded-full border border-marine-300 text-marine-800 dark:text-marine-200 px-2.5 py-0.5 text-xs hover:bg-marine-50 dark:hover:bg-marine-950/40"
              >
                {m.titre}
              </button>
            ))}
          </div>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de la campagne (ex : Relance EHPAD octobre)" className={champ} />
          <input value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Objet du mail" className={champ} />
          <textarea value={corps} onChange={(e) => setCorps(e.target.value)} rows={12} placeholder="Texte du mail" className={`${champ} resize-y`} />
          <p className="text-[11px] text-slate-400">
            Remplacés pour chaque entreprise : {"{{ENTREPRISE}}"} (nom), {"{{ANNEE}}"}, {"{{ANNEE_SUIVANTE}}"}, {"{{SIGNATURE}}"}.
          </p>
          <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={formatOfficiel} onChange={(e) => setFormatOfficiel(e.target.checked)} className="mt-1" />
            Mise en page officielle (bandeau du pôle + bouton « Calculer ma contribution » et lien pour choisir un créneau)
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={!objet.trim() || !corps.trim() || enCours}
              onClick={() =>
                agir("test", async () => {
                  const r = await api.testCampagne({ objet, corps, formatOfficiel, entrepriseId: apercu?.exemples?.[0]?.id });
                  setInfo(`Test envoyé à ${r.destinataire}${apercu?.exemples?.[0] ? ` (rempli avec « ${apercu.exemples[0].nom} »)` : ""}.`);
                })
              }
              className="rounded-lg border border-marine-300 text-marine-800 dark:text-marine-200 text-sm px-3 py-2 disabled:opacity-40"
            >
              {enCours === "test" ? "Envoi…" : "M'envoyer un test"}
            </button>
            <button
              type="button"
              disabled={!pret || enCours}
              onClick={() => {
                if (
                  !window.confirm(
                    `Lancer « ${nom} » vers ${apercu.nombre} entreprise(s) ?\n\nLes mails partiront progressivement (${etat?.plafondDuJour} au plus aujourd'hui), ${etat?.horaires}. Vous pourrez mettre en pause à tout moment.`
                  )
                )
                  return;
                agir("lancer", async () => {
                  await api.creerCampagne({ nom, objet, corps, formatOfficiel, filtres });
                  setInfo(`Campagne « ${nom} » lancée.`);
                  setNom("");
                  await charger();
                  setFiltres((f) => ({ ...f }));
                });
              }}
              className="rounded-lg bg-marine-700 hover:bg-marine-800 text-white text-sm font-semibold px-4 py-2 disabled:opacity-40"
            >
              {enCours === "lancer" ? "Lancement…" : `🚀 Lancer la campagne${apercu?.nombre ? ` (${apercu.nombre})` : ""}`}
            </button>
          </div>
        </section>
      </div>

      {/* Campagnes */}
      <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Campagnes</h2>
      <div className="space-y-3 mb-8">
        {donnees?.campagnes.length === 0 && <p className="text-sm text-slate-400">Aucune campagne pour l'instant.</p>}
        {donnees?.campagnes.map((c) => {
          const s = LIBELLE_STATUT[c.statut] || { label: c.statut, classe: "" };
          const fait = c.envoyes + c.erreurs + c.ignores;
          return (
            <div key={c.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="min-w-0">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold mr-2 ${s.classe}`}>{s.label}</span>
                  <strong className="text-slate-800 dark:text-slate-100">{c.nom}</strong>
                  <span className="block text-xs text-slate-500 truncate">
                    {c.objet} · lancée le {formatDateHeure(c.dateCreation)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {c.statut === "en_cours" && <BoutonAction onClick={() => agir(c.id, async () => { await api.actionCampagne(c.id, "pause"); await charger(); })}>⏸ Pause</BoutonAction>}
                  {c.statut === "en_pause" && <BoutonAction onClick={() => agir(c.id, async () => { await api.actionCampagne(c.id, "reprendre"); await charger(); })}>▶ Reprendre</BoutonAction>}
                  {(c.statut === "en_cours" || c.statut === "en_pause") && (
                    <BoutonAction
                      onClick={() =>
                        window.confirm(`Annuler « ${c.nom} » ? Les ${c.restants} mails restants ne partiront pas.`) &&
                        agir(c.id, async () => {
                          await api.actionCampagne(c.id, "annuler");
                          await charger();
                        })
                      }
                    >
                      ✕ Annuler
                    </BoutonAction>
                  )}
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${c.total ? Math.round((fait / c.total) * 100) : 0}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                <strong className="text-emerald-700">{c.envoyes} envoyés</strong> · {c.restants} restants · {c.erreurs} erreurs · {c.ignores} écartés · {c.total} au total
              </p>
              {c.motifPause && <p className="text-xs text-amber-700 mt-1">{c.motifPause}</p>}
              {c.derniersEnvois.length > 0 && (
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="cursor-pointer">Derniers envois</summary>
                  <ul className="mt-1 space-y-0.5">
                    {c.derniersEnvois.map((e, i) => (
                      <li key={i}>
                        {formatDateHeure(e.date)} — {e.nom} ({e.email}) :{" "}
                        <span className={e.statut === "envoye" ? "text-emerald-700" : e.statut === "erreur" ? "text-red-600" : "text-slate-500"}>
                          {e.statut === "envoye" ? "envoyé" : e.statut === "erreur" ? `erreur — ${e.erreur}` : `écarté — ${e.erreur}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {/* Réglages */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 max-w-xl">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Plafond quotidien</h2>
        <p className="text-xs text-slate-500 mb-3">
          Maximum d'e-mails de campagne par jour une fois la montée en charge terminée (4 semaines). À adapter à votre forfait
          Resend (formule gratuite : 100/jour seulement).
        </p>
        <div className="flex gap-2">
          <input type="number" min={50} max={20000} value={plafond} onChange={(e) => setPlafond(e.target.value)} className={`${champ} w-40`} />
          <button
            type="button"
            disabled={enCours}
            onClick={() =>
              agir("plafond", async () => {
                await api.reglagesCampagnes({ plafondMax: Number(plafond) });
                setInfo("Plafond enregistré.");
                await charger();
              })
            }
            className="rounded-lg bg-slate-900 text-white text-sm font-medium px-4 disabled:opacity-40"
          >
            Enregistrer
          </button>
        </div>
      </section>
    </div>
  );
}

function Tuile({ titre, valeur, detail }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
      <p className="text-xs text-slate-500">{titre}</p>
      <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{valeur}</p>
      {detail && <p className="text-[11px] text-slate-400">{detail}</p>}
    </div>
  );
}

function BoutonAction({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg border border-slate-300 dark:border-slate-600 text-xs px-2.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-700">
      {children}
    </button>
  );
}
