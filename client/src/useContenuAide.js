import { useEffect, useState } from "react";

const caches = new Map();
const enCours = new Map();
const PREFIXE_STOCKAGE = "aide:";

function lireStocke(cle) {
  try {
    const texte = localStorage.getItem(PREFIXE_STOCKAGE + cle);
    return texte ? JSON.parse(texte) : null;
  } catch {
    return null;
  }
}

// Un seul appel réseau par clé et par chargement de page, partagé entre le
// préchargement et les composants qui en ont besoin.
function charger(cle, fetcher) {
  if (caches.has(cle)) return Promise.resolve(caches.get(cle));
  if (enCours.has(cle)) return enCours.get(cle);
  const promesse = fetcher()
    .then((d) => {
      caches.set(cle, d);
      try {
        localStorage.setItem(PREFIXE_STOCKAGE + cle, JSON.stringify(d));
      } catch {
        // Stockage plein ou indisponible : le cache mémoire suffit.
      }
      return d;
    })
    .finally(() => enCours.delete(cle));
  enCours.set(cle, promesse);
  return promesse;
}

// Télécharge les contenus d'aide en tâche de fond dès l'ouverture du CRM,
// pour qu'ils s'affichent sans attente au premier clic.
export function prechargerContenusAide(liste) {
  for (const [cle, fetcher] of liste) charger(cle, fetcher).catch(() => {});
}

// Charge un contenu d'aide statique (argumentaire AGEFIPH, script de vente,
// modèles de mails…) et le partage entre tous les composants qui le
// consomment. La dernière version reçue est gardée sur l'appareil : elle
// s'affiche immédiatement (même après rechargement de la page ou sur un
// réseau mobile lent), puis est remplacée par la version à jour du serveur.
export function useContenuAide(cle, fetcher) {
  const [data, setData] = useState(() => caches.get(cle) ?? lireStocke(cle));
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let actif = true;
    charger(cle, fetcher)
      .then((d) => actif && setData(d))
      .catch((e) => {
        // On n'affiche l'erreur que s'il n'y a rien de mieux à montrer.
        if (actif && !lireStocke(cle)) setErreur(e.message);
      });
    return () => {
      actif = false;
    };
  }, [cle, fetcher]);

  return { data, erreur };
}
