import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import Header from "../components/Header.jsx";
import StatCard from "../components/StatCard.jsx";
import EntrepriseTable from "../components/EntrepriseTable.jsx";
import BarreActionsGroupees from "../components/BarreActionsGroupees.jsx";
import RechercheSiren from "../components/RechercheSiren.jsx";
import DialerPanel from "../components/DialerPanel.jsx";
import UserMenu from "../components/UserMenu.jsx";
import Sidebar from "../components/Sidebar.jsx";
import DemandeLeads from "../components/DemandeLeads.jsx";
import SelecteurTerritoire from "../components/SelecteurTerritoire.jsx";
import { territoireDe } from "../territoires.js";
import ImportLot from "../components/ImportLot.jsx";
import EnrichissementTelephones from "../components/EnrichissementTelephones.jsx";
import KpiObjectifMensuel from "../components/KpiObjectifMensuel.jsx";
import BanniereSupervision from "../components/BanniereSupervision.jsx";
import { useTheme } from "../useTheme.js";
import { useAuth } from "../AuthContext.jsx";
import { useSupervision } from "../SupervisionContext.jsx";
import { ORDRE_STATUTS } from "../constants.js";

const TAILLES_PAGE = [10, 20, 50];

// Sorties considérées comme des fiches "qualifiées" pour l'objectif mensuel
// de prospection (dossier envoyé en atelier ou réglé, pas un abandon).
const STATUTS_QUALIFIES = new Set(["fiche", "fiche_one_shot", "conforme"]);
const OBJECTIF_MENSUEL_MIN = 20;
const OBJECTIF_MENSUEL_MAX = 30;

// Une fiche en statut "mail" dont le contact doit aussi rappeler (voir
// ActionsRapidesStatut, case "Le contact doit aussi me rappeler") compte
// aussi dans le filtre "Me rappelle".
function correspondStatut(e, filtre) {
  return e.statut === filtre || (filtre === "me_rappelle" && e.statut === "mail" && Boolean(e.aussiMeRappelle));
}

function correspondRecherche(e, recherche) {
  if (!recherche.trim()) return true;
  const q = recherche.trim().toLowerCase();
  return e.nom.toLowerCase().includes(q) || e.siret.includes(q) || e.codePostal.includes(q);
}

// Tri par en-tête de colonne (voir EntrepriseTable) : "contact" trie sur la
// présence d'un numéro de téléphone, "commentaire" sur la date du dernier
// commentaire (toujours en tête du tableau, voir ajouterCommentaire côté
// serveur qui l'unshift). Les dossiers sans commentaire n'ont pas de date à
// comparer : ils restent en fin de liste quel que soit le sens du tri plutôt
// que de se mêler arbitrairement aux dossiers datés.
function valeurTri(e, colonne) {
  if (colonne === "contact") return e.contact?.telephone ? 1 : 0;
  if (colonne === "commentaire") {
    const date = e.commentaires?.[0]?.date;
    return date ? new Date(date).getTime() : null;
  }
  return 0;
}

function comparerTri(a, b, tri) {
  const va = valeurTri(a, tri.colonne);
  const vb = valeurTri(b, tri.colonne);
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  return tri.direction === "desc" ? vb - va : va - vb;
}

export default function Dashboard() {
  const { theme, basculer } = useTheme();
  const { utilisateur } = useAuth();
  const { agentSupervise } = useSupervision();
  const estAdmin = utilisateur?.role === "admin" || utilisateur?.role === "super_admin";
  // Mode Manager : un admin consulte le pipeline "comme si" il était l'agent
  // choisi (voir UserMenu > "Voir le compte de…") — jamais l'inverse.
  const commeAgentId = estAdmin ? agentSupervise?.id : null;
  const [toutesEntreprises, setEntreprises] = useState([]);
  // Périmètre de travail d'un admin, qui voit tout le pipeline : "tous",
  // "moi" (les leads qu'il s'est assignés, pour les appeler comme un agent)
  // ou "non_assignes" (à distribuer). Un agent ne reçoit de toute façon que
  // ses propres leads du serveur ; en Mode Manager, on montre ceux de
  // l'agent supervisé, sans ce filtre.
  const [perimetre, setPerimetreState] = useState(() => {
    try {
      return localStorage.getItem("crm-perimetre-leads") || "tous";
    } catch {
      return "tous";
    }
  });
  function setPerimetre(valeur) {
    setPerimetreState(valeur);
    try {
      localStorage.setItem("crm-perimetre-leads", valeur);
    } catch {
      // stockage indisponible : le choix vaut pour la session en cours
    }
  }
  const perimetreActif = estAdmin && !commeAgentId ? perimetre : "tous";

  // Territoire de travail (métropole, La Réunion, Guadeloupe…), déduit du
  // code postal de chaque fiche — voir territoires.js. Mémorisé : l'agent
  // qui travaille La Réunion le matin la retrouve en rechargeant la page.
  const [territoire, setTerritoireState] = useState(() => {
    try {
      return localStorage.getItem("crm-territoire") || "tous";
    } catch {
      return "tous";
    }
  });
  function setTerritoire(valeur) {
    setTerritoireState(valeur);
    try {
      localStorage.setItem("crm-territoire", valeur);
    } catch {
      // stockage indisponible : le choix vaut pour la session en cours
    }
  }
  const entreprisesDuTerritoire = useMemo(
    () => (territoire === "tous" ? toutesEntreprises : toutesEntreprises.filter((e) => territoireDe(e.codePostal) === territoire)),
    [toutesEntreprises, territoire]
  );
  const entreprises = useMemo(() => {
    if (perimetreActif === "moi") return entreprisesDuTerritoire.filter((e) => e.assigneA === utilisateur?.id);
    if (perimetreActif === "non_assignes") return entreprisesDuTerritoire.filter((e) => !e.assigneA);
    return entreprisesDuTerritoire;
  }, [entreprisesDuTerritoire, perimetreActif, utilisateur?.id]);
  const nbMesLeads = useMemo(
    () => entreprisesDuTerritoire.filter((e) => e.assigneA === utilisateur?.id).length,
    [entreprisesDuTerritoire, utilisateur?.id]
  );
  const nbNonAssignes = useMemo(() => entreprisesDuTerritoire.filter((e) => !e.assigneA).length, [entreprisesDuTerritoire]);
  // Nombre de fiches par territoire, dans le périmètre choisi (Mes leads…).
  const comptesTerritoires = useMemo(() => {
    const c = {};
    let total = 0;
    for (const e of toutesEntreprises) {
      if (perimetreActif === "moi" && e.assigneA !== utilisateur?.id) continue;
      if (perimetreActif === "non_assignes" && e.assigneA) continue;
      const cle = territoireDe(e.codePostal);
      c[cle] = (c[cle] || 0) + 1;
      total += 1;
    }
    return { parTerritoire: c, total };
  }, [toutesEntreprises, perimetreActif, utilisateur?.id]);
  const [categories, setCategories] = useState([]);
  const [lots, setLots] = useState([]);
  const [agents, setAgents] = useState([]);
  // Liste d'assignation : l'admin connecté en tête, sous "Moi", pour
  // s'attribuer un lead (ou une vague) en un clic.
  const agentsAssignables = useMemo(() => {
    const moi = agents.find((a) => a.id === utilisateur?.id);
    if (!moi) return agents;
    return [{ ...moi, prenom: `Moi (${moi.prenom || moi.email})`, role: null }, ...agents.filter((a) => a.id !== moi.id)];
  }, [agents, utilisateur?.id]);
  const [archives, setArchives] = useState([]);
  const [nbArchivees, setNbArchivees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState(null);
  const [filtreCategorie, setFiltreCategorie] = useState("");
  const [filtreLot, setFiltreLot] = useState("");
  const [prioritairesUniquement, setPrioritairesUniquement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [tailleParPage, setTailleParPage] = useState(20);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState(() => new Set());
  // Tri actif sur une colonne du tableau ({ colonne, direction }) — null tant
  // qu'aucun en-tête n'a été cliqué, auquel cas le tri par défaut (priorité
  // au déficit d'UB) s'applique, voir entreprisesFiltrees ci-dessous.
  const [tri, setTri] = useState(null);

  // Premier clic sur une colonne : ordre "le plus pertinent en premier"
  // (avec numéro / commentaire le plus récent). Un second clic sur la même
  // colonne inverse le sens ; cliquer une autre colonne repart à "desc".
  function basculerTri(colonne) {
    setTri((actuel) =>
      actuel?.colonne === colonne ? { colonne, direction: actuel.direction === "desc" ? "asc" : "desc" } : { colonne, direction: "desc" }
    );
  }

  function charger() {
    const appels = [
      api.listEntreprises(commeAgentId),
      api.listCategories(),
      api.listLots(),
      api.listArchives(commeAgentId),
    ];
    if (estAdmin) appels.push(api.listUtilisateurs());
    return Promise.all(appels)
      .then(([e, c, l, a, u]) => {
        setEntreprises(e);
        setCategories(c);
        setLots(l);
        setArchives(a);
        setNbArchivees(a.length);
        if (u) setAgents(u.filter((util) => util.statut === "valide"));
        setErreur(null);
      })
      .catch((e) => setErreur(e.message));
  }

  useEffect(() => {
    setLoading(true);
    charger().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estAdmin, commeAgentId]);

  // Revient à la première page dès qu'un filtre ou la taille de page change,
  // pour ne jamais rester bloqué sur une page qui n'a plus de résultats.
  useEffect(() => {
    setPage(1);
  }, [filtreStatut, filtreCategorie, filtreLot, prioritairesUniquement, recherche, tailleParPage, tri]);

  // Reçoit les mises à jour émises par le panneau d'appel (module AGIR / VoIP)
  // sans avoir à tout recharger depuis l'API.
  useEffect(() => {
    function onMaj(ev) {
      const maj = ev.detail;
      setEntreprises((prev) => prev.map((e) => (e.id === maj.id ? maj : e)));
    }
    function onArchive(ev) {
      setEntreprises((prev) => prev.filter((e) => e.id !== ev.detail.id));
      setArchives((prev) => [ev.detail, ...prev]);
      setNbArchivees((n) => n + 1);
    }
    window.addEventListener("entreprise:maj", onMaj);
    window.addEventListener("entreprise:archivee", onArchive);
    return () => {
      window.removeEventListener("entreprise:maj", onMaj);
      window.removeEventListener("entreprise:archivee", onArchive);
    };
  }, []);

  // Retire de la sélection toute entreprise qui n'est plus dans la liste
  // active (archivée, réassignée hors de vue en Mode Manager…) — la
  // sélection elle-même survit sinon aux changements de page/filtre, pour
  // permettre de cocher des lignes sur plusieurs pages avant d'agir dessus.
  useEffect(() => {
    setSelection((prev) => {
      if (prev.size === 0) return prev;
      const idsPresents = new Set(entreprises.map((e) => e.id));
      const filtree = new Set([...prev].filter((id) => idsPresents.has(id)));
      return filtree.size === prev.size ? prev : filtree;
    });
  }, [entreprises]);

  // Chaque compteur de facette (statut, catégorie, lot) s'appuie sur les
  // MÊMES filtres actifs que la liste, à l'exception de sa propre dimension —
  // sinon un compteur peut afficher un nombre que la liste, elle, filtre à
  // zéro (ex. "À relancer : 2" alors que ces 2 dossiers sont exclus par
  // "Prioritaires uniquement"), ce qui donne l'impression d'un filtre cassé.
  const compteurs = useMemo(() => {
    const c = Object.fromEntries(ORDRE_STATUTS.map((s) => [s, 0]));
    for (const e of entreprises) {
      if (prioritairesUniquement && !e.oeth?.assujetti) continue;
      if (filtreCategorie && e.categorie?.cle !== filtreCategorie) continue;
      if (filtreLot && e.lot !== filtreLot) continue;
      if (!correspondRecherche(e, recherche)) continue;
      if (c[e.statut] !== undefined) c[e.statut] += 1;
      if (e.statut === "mail" && e.aussiMeRappelle && c.me_rappelle !== undefined) c.me_rappelle += 1;
    }
    return c;
  }, [entreprises, prioritairesUniquement, filtreCategorie, filtreLot, recherche]);

  const compteursCategorie = useMemo(() => {
    const c = {};
    for (const e of entreprises) {
      if (prioritairesUniquement && !e.oeth?.assujetti) continue;
      if (filtreStatut && !correspondStatut(e, filtreStatut)) continue;
      if (filtreLot && e.lot !== filtreLot) continue;
      if (!correspondRecherche(e, recherche)) continue;
      const cle = e.categorie?.cle;
      if (cle) c[cle] = (c[cle] || 0) + 1;
    }
    return c;
  }, [entreprises, prioritairesUniquement, filtreStatut, filtreLot, recherche]);

  const compteursLot = useMemo(() => {
    const c = {};
    for (const e of entreprises) {
      if (prioritairesUniquement && !e.oeth?.assujetti) continue;
      if (filtreStatut && !correspondStatut(e, filtreStatut)) continue;
      if (filtreCategorie && e.categorie?.cle !== filtreCategorie) continue;
      if (!correspondRecherche(e, recherche)) continue;
      if (e.lot) c[e.lot] = (c[e.lot] || 0) + 1;
    }
    return c;
  }, [entreprises, prioritairesUniquement, filtreStatut, filtreCategorie, recherche]);

  // Vagues regroupées par SECTEUR RÉEL des fiches (catégorie calculée), pas
  // par nom de vague : une vague mal nommée (ex. « nettoyage 1 » contenant
  // aussi des fiches Industrie) apparaît sous chacun des secteurs qu'elle
  // contient, avec le bon compte. Mêmes filtres que les autres compteurs,
  // sauf secteur et vague (c'est ce qu'on choisit ici).
  const vaguesParSecteur = useMemo(() => {
    const groupes = new Map();
    for (const e of entreprises) {
      if (!e.lot) continue;
      if (prioritairesUniquement && !e.oeth?.assujetti) continue;
      if (filtreStatut && !correspondStatut(e, filtreStatut)) continue;
      if (!correspondRecherche(e, recherche)) continue;
      const cle = e.categorie?.cle || "autre";
      if (!groupes.has(cle)) groupes.set(cle, new Map());
      const lotsDuSecteur = groupes.get(cle);
      lotsDuSecteur.set(e.lot, (lotsDuSecteur.get(e.lot) || 0) + 1);
    }
    return categories
      .filter((c) => groupes.has(c.value))
      .map((c) => {
        const lotsDuSecteur = [...groupes.get(c.value)].map(([lot, nombre]) => ({ lot, nombre }));
        lotsDuSecteur.sort((a, b) => a.lot.localeCompare(b.lot, "fr", { numeric: true }));
        return { cle: c.value, label: c.label, total: lotsDuSecteur.reduce((t, l) => t + l.nombre, 0), lots: lotsDuSecteur };
      });
  }, [entreprises, categories, prioritairesUniquement, filtreStatut, recherche]);

  // Toutes les vagues existantes par secteur, sans filtre : sert à proposer
  // le prochain nom de vague (ex. « Sécurité 2 ») lors d'une génération.
  const lotsParSecteur = useMemo(() => {
    const m = {};
    for (const e of toutesEntreprises) {
      if (!e.lot) continue;
      const cle = e.categorie?.cle || "autre";
      (m[cle] ||= new Set()).add(e.lot);
    }
    return m;
  }, [toutesEntreprises]);

  // Fiches qualifiées ce mois-ci : une sortie "fiche"/"fiche one-shot"/
  // "conforme" journalisée dans le mois courant, comptée une seule fois par
  // entreprise même si plusieurs sorties qualifiées s'y sont enchaînées.
  // La liste (pas seulement le nombre) sert au détail dépliable de l'objectif :
  // qualification retenue = la plus récente du mois pour chaque entreprise.
  const fichesQualifieesCeMois = useMemo(() => {
    const maintenant = new Date();
    const idsArchives = new Set(archives.map((e) => e.id));
    const liste = [];
    for (const e of [...toutesEntreprises, ...archives]) {
      const sortie = (e.historiqueAppels || []).find((h) => {
        if (h.type !== "sortie" || !STATUTS_QUALIFIES.has(h.issue)) return false;
        const d = new Date(h.date);
        return d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth();
      });
      if (sortie) liste.push({ entreprise: e, sortie, archivee: idsArchives.has(e.id) });
    }
    return liste.sort((a, b) => new Date(b.sortie.date) - new Date(a.sortie.date));
  }, [toutesEntreprises, archives]);
  const nbQualifieesCeMois = fichesQualifieesCeMois.length;

  const nbPrioritaires = useMemo(() => entreprises.filter((e) => e.oeth?.assujetti).length, [entreprises]);

  const nbSansTelephone = useMemo(() => toutesEntreprises.filter((e) => !e.contact?.telephone).length, [toutesEntreprises]);

  const entreprisesFiltrees = useMemo(() => {
    let liste = entreprises.filter((e) => {
      if (prioritairesUniquement && !e.oeth?.assujetti) return false;
      if (filtreStatut && !correspondStatut(e, filtreStatut)) return false;
      if (filtreCategorie && e.categorie?.cle !== filtreCategorie) return false;
      if (filtreLot && e.lot !== filtreLot) return false;
      return correspondRecherche(e, recherche);
    });

    // Tri actif sur une colonne (voir basculerTri) sinon, par défaut,
    // priorité au déficit d'unités bénéficiaires le plus élevé en tête.
    liste = [...liste].sort((a, b) => (tri ? comparerTri(a, b, tri) : (b.oeth?.deficit || 0) - (a.oeth?.deficit || 0)));
    return liste;
  }, [entreprises, filtreStatut, filtreCategorie, filtreLot, prioritairesUniquement, recherche, tri]);

  const nbPages = Math.max(1, Math.ceil(entreprisesFiltrees.length / tailleParPage));
  const pageCourante = Math.min(page, nbPages);
  const entreprisesPage = useMemo(
    () => entreprisesFiltrees.slice((pageCourante - 1) * tailleParPage, pageCourante * tailleParPage),
    [entreprisesFiltrees, pageCourante, tailleParPage]
  );

  function assignerEntreprise(id, utilisateurId) {
    return api.assignerEntreprise(id, utilisateurId).then((maj) => {
      setEntreprises((prev) => prev.map((e) => (e.id === id ? maj : e)));
    });
  }

  function assignerLotEntier(utilisateurId) {
    if (!filtreLot) return;
    return api.assignerLot(filtreLot, utilisateurId).then(charger);
  }

  function basculerSelection(id) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Coche/décoche l'ensemble des lignes visibles (la page courante) —
  // "Sélectionner les N résultats filtrés" dans la barre d'actions groupées
  // couvre le cas de tout le filtre au-delà de la page affichée.
  function basculerSelectionPage(idsPage) {
    const tousCoches = idsPage.every((id) => selection.has(id));
    setSelection((prev) => {
      const next = new Set(prev);
      idsPage.forEach((id) => (tousCoches ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function selectionnerToutFiltre() {
    setSelection(new Set(entreprisesFiltrees.map((e) => e.id)));
  }

  function viderSelection() {
    setSelection(new Set());
  }

  async function assignerSelectionGroupee(utilisateurId) {
    const { entreprises: maj } = await api.assignerGroupe([...selection], utilisateurId);
    const parId = new Map(maj.map((e) => [e.id, e]));
    setEntreprises((prev) => prev.map((e) => parId.get(e.id) || e));
    setSelection(new Set());
  }

  async function changerStatutSelectionGroupee(statut) {
    const { archive, entreprises: maj } = await api.changerStatutGroupe([...selection], statut);
    if (archive) {
      const idsMaj = new Set(maj.map((e) => e.id));
      setEntreprises((prev) => prev.filter((e) => !idsMaj.has(e.id)));
      setArchives((prev) => [...maj, ...prev]);
      setNbArchivees((n) => n + maj.length);
    } else {
      const parId = new Map(maj.map((e) => [e.id, e]));
      setEntreprises((prev) => prev.map((e) => parId.get(e.id) || e));
    }
    setSelection(new Set());
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
        <Header />
        <UserMenu theme={theme} onBasculerTheme={basculer} />
      </div>

      <BanniereSupervision />

      <KpiObjectifMensuel
        valeur={nbQualifieesCeMois}
        min={OBJECTIF_MENSUEL_MIN}
        max={OBJECTIF_MENSUEL_MAX}
        fiches={fichesQualifieesCeMois}
      />

      {erreur && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          Impossible de charger les données ({erreur}). Vérifiez que le serveur API tourne sur le port 4000.
        </div>
      )}

      {/* Bloc d'import indépendant, pleine largeur : ni imbriqué dans la barre
          latérale (qui reste "sticky" et courte), ni limité à sa largeur
          étroite — ses propres onglets/listes défilent au besoin sans jamais
          bloquer le défilement général de la page. Réservé aux admins :
          l'import en masse est une décision de constitution de pipeline. */}
      {estAdmin && !commeAgentId && (
        <div className="mb-4">
          <EnrichissementTelephones manquants={nbSansTelephone} onMaj={charger} />
          <ImportLot categories={categories} agents={agentsAssignables} lots={lots} lotsParSecteur={lotsParSecteur} onImporte={charger} />
        </div>
      )}

      {/* Recherche des numéros par Claude pour l'agent : uniquement ses
          propres fiches sans numéro (le serveur limite le périmètre et la
          taille de chaque lancement). */}
      {!estAdmin && <EnrichissementTelephones manquants={nbSansTelephone} onMaj={charger} />}

      {/* Demande de leads en libre-service : agents, et admins qui prospectent
          eux-mêmes (fiches attribuées à leur propre compte — elles
          apparaissent alors dans "Mes leads"). Pas en Mode Manager : la
          demande serait faite au nom de l'admin, pas de l'agent consulté. */}
      {!commeAgentId && (
        <DemandeLeads
          categories={categories}
          onMaj={charger}
          onDemandeEnvoyee={estAdmin ? () => setPerimetre("moi") : undefined}
          territoire={territoire === "tous" ? "" : territoire}
        />
      )}

      <SelecteurTerritoire
        valeur={territoire}
        onChange={setTerritoire}
        comptes={comptesTerritoires.parTerritoire}
        total={comptesTerritoires.total}
      />

      <div className="flex flex-col lg:flex-row gap-6">
        <Sidebar
          categories={categories}
          compteursCategorie={compteursCategorie}
          filtreCategorie={filtreCategorie}
          onFiltreCategorie={setFiltreCategorie}
          lots={lots}
          compteursLot={compteursLot}
          filtreLot={filtreLot}
          onFiltreLot={setFiltreLot}
          vaguesParSecteur={vaguesParSecteur}
          onFiltreVague={(cle, lot) => {
            setFiltreCategorie(cle);
            setFiltreLot(lot);
          }}
        />

        <div className="flex-1 min-w-0">
          <RechercheSiren
            entreprises={toutesEntreprises}
            archives={archives}
            onEntreprise={(entreprise, existant, archive) => {
              if (archive) {
                setNbArchivees((n) => n + (existant ? 0 : 1));
                return;
              }
              setEntreprises((prev) => {
                const dejaPresente = prev.some((e) => e.id === entreprise.id);
                if (dejaPresente) return prev.map((e) => (e.id === entreprise.id ? entreprise : e));
                return existant ? prev : [entreprise, ...prev];
              });
            }}
          />

          {estAdmin && !commeAgentId && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div
                role="tablist"
                aria-label="Périmètre des leads affichés"
                className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-0.5"
              >
                {[
                  { valeur: "tous", label: "Tous les leads", nombre: entreprisesDuTerritoire.length },
                  { valeur: "moi", label: "👤 Mes leads", nombre: nbMesLeads },
                  { valeur: "non_assignes", label: "Non assignés", nombre: nbNonAssignes },
                ].map((o) => (
                  <button
                    key={o.valeur}
                    role="tab"
                    aria-selected={perimetreActif === o.valeur}
                    onClick={() => setPerimetre(o.valeur)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition whitespace-nowrap ${
                      perimetreActif === o.valeur
                        ? "bg-marine-800 text-white dark:bg-marine-200 dark:text-marine-900"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    {o.label} <span className="opacity-70">({o.nombre})</span>
                  </button>
                ))}
              </div>
              {perimetreActif === "moi" && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Leads que vous vous êtes assignés — la téléphonie n'appelle que ceux-ci.
                </span>
              )}
            </div>
          )}

          <DialerPanel entreprises={entreprisesFiltrees} />

          <div className="flex flex-wrap gap-2 mb-3">
            {ORDRE_STATUTS.map((statut) => (
              <StatCard
                key={statut}
                statut={statut}
                count={compteurs[statut]}
                active={filtreStatut === statut}
                onClick={() => setFiltreStatut(filtreStatut === statut ? null : statut)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Entreprises
              {filtreStatut ? ` — statut : ${filtreStatut}` : ""}
              {filtreCategorie ? ` — secteur filtré` : ""}
              {filtreLot ? ` — ${filtreLot}` : ""}
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={prioritairesUniquement}
                  onChange={(e) => setPrioritairesUniquement(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Prioritaires uniquement (effectif ≥ 20) — {nbPrioritaires}/{entreprises.length}
              </label>

              <span
                className="text-sm text-slate-400 dark:text-slate-500"
                title="Dossiers 'conforme'/'refus'/'mort' archivés automatiquement, hors pipeline actif"
              >
                Archivées : {nbArchivees}
              </span>

              <input
                type="text"
                placeholder="Rechercher (société, SIRET, code postal)…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="w-72 max-w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>

          {estAdmin && filtreLot && (
            <div className="flex flex-wrap items-center gap-2 mb-3 text-sm bg-marine-50 dark:bg-marine-950/30 border border-marine-200 dark:border-marine-900/50 rounded-lg px-3 py-2">
              <span className="text-slate-600 dark:text-slate-300">
                Assigner toute la vague « {filtreLot} » à :
              </span>
              <select
                onChange={(e) => e.target.value && assignerLotEntier(e.target.value).then(() => (e.target.value = ""))}
                defaultValue=""
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-2 py-1 text-sm"
              >
                <option value="" disabled>
                  Choisir un agent…
                </option>
                {agentsAssignables.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.prenom || a.email} {a.role === "admin" || a.role === "super_admin" ? "(admin)" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={() => assignerLotEntier(null)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
              >
                Retirer l'assignation
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-slate-400 dark:text-slate-500 text-sm">Chargement…</div>
          ) : (
            <>
              <BarreActionsGroupees
                nbSelectionnes={selection.size}
                nbFiltre={entreprisesFiltrees.length}
                estAdmin={estAdmin}
                agents={agentsAssignables}
                onAssigner={assignerSelectionGroupee}
                onChangerStatut={changerStatutSelectionGroupee}
                onSelectionnerToutFiltre={selectionnerToutFiltre}
                onViderSelection={viderSelection}
              />

              <EntrepriseTable
                entreprises={entreprisesPage}
                estAdmin={estAdmin}
                agents={agentsAssignables}
                onAssigner={assignerEntreprise}
                selection={selection}
                onToggleSelection={basculerSelection}
                onToggleSelectionTout={basculerSelectionPage}
                tri={tri}
                onTrier={basculerTri}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-sm text-slate-500 dark:text-slate-400">
                <label className="flex items-center gap-2">
                  Afficher
                  <select
                    value={tailleParPage}
                    onChange={(e) => setTailleParPage(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
                  >
                    {TAILLES_PAGE.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  par page — {entreprisesFiltrees.length} au total
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pageCourante <= 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-40"
                  >
                    Précédent
                  </button>
                  <span>
                    Page {pageCourante} / {nbPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(nbPages, p + 1))}
                    disabled={pageCourante >= nbPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-40"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
