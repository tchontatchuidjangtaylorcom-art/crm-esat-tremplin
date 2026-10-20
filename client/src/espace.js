import { useEffect, useState } from "react";

// Espace de travail affiché (OETH, CEE… voir server/src/espaces.js) : retenu
// dans le navigateur et envoyé au serveur dans l'en-tête X-Espace de chaque
// requête /api, qui ne renvoie alors que les fiches de cet espace.
const CLE = "crm-espace";

export function espaceChoisi() {
  try {
    return localStorage.getItem(CLE) || "oeth";
  } catch {
    return "oeth";
  }
}

function memoriser(id) {
  try {
    localStorage.setItem(CLE, id);
  } catch {
    // Stockage indisponible : l'espace par défaut du compte s'applique.
  }
}

// Changer d'espace recharge le CRM sur le tableau de bord : toutes les
// listes (fiches, vagues, compteurs…) repartent de l'espace choisi.
export function changerEspace(id) {
  memoriser(id);
  window.location.assign("/");
}

// Ajoute l'en-tête X-Espace à toutes les requêtes /api du CRM, y compris
// celles faites directement avec fetch() par les composants.
export function installerEnteteEspace() {
  if (typeof window === "undefined" || window.__enteteEspaceInstalle) return;
  window.__enteteEspaceInstalle = true;
  const fetchOrigine = window.fetch.bind(window);
  window.fetch = (entree, options = {}) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree?.url || "";
    const versApi = url.startsWith("/api") || url.startsWith(`${window.location.origin}/api`);
    if (!versApi) return fetchOrigine(entree, options);
    const entetes = new Headers(options.headers || (entree instanceof Request ? entree.headers : undefined));
    if (!entetes.has("X-Espace")) entetes.set("X-Espace", espaceChoisi());
    return fetchOrigine(entree, { ...options, headers: entetes });
  };
}

// Espaces ouverts au compte connecté (une seule requête pour toute la page).
let chargement = null;
export function chargerEspaces() {
  if (!chargement) {
    chargement = fetch("/api/espaces")
      .then((r) => (r.ok ? r.json() : { espaces: [], courant: "oeth" }))
      .then((d) => {
        // Espace retenu plus autorisé (ou jamais choisi) : celui du serveur.
        if (d.courant && d.courant !== espaceChoisi()) memoriser(d.courant);
        return d;
      })
      .catch(() => {
        chargement = null;
        return { espaces: [], courant: espaceChoisi() };
      });
  }
  return chargement;
}

export function useEspaces() {
  const [donnees, setDonnees] = useState({ espaces: [], courant: espaceChoisi(), charge: false });
  useEffect(() => {
    let actif = true;
    chargerEspaces().then((d) => actif && setDonnees({ ...d, charge: true }));
    return () => {
      actif = false;
    };
  }, []);
  const espace = donnees.espaces.find((e) => e.id === donnees.courant) || null;
  return {
    ...donnees,
    espace,
    // Fonctions propres à OETH (calcul AGEFIPH, argumentaire, ESAT…) :
    // seulement dans l'espace OETH.
    estOeth: donnees.courant === "oeth",
  };
}
