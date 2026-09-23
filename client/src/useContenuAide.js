import { useEffect, useState } from "react";

const caches = new Map();

// Charge un contenu d'aide statique (argumentaire AGEFIPH, script de vente,
// modèles de mails…) une seule fois par clé, et le partage entre tous les
// composants qui le consomment (barre d'outils, panneau, fiche entreprise).
export function useContenuAide(cle, fetcher) {
  const [data, setData] = useState(() => caches.get(cle) ?? null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (caches.has(cle)) return;
    fetcher()
      .then((d) => {
        caches.set(cle, d);
        setData(d);
      })
      .catch((e) => setErreur(e.message));
  }, [cle, fetcher]);

  return { data, erreur };
}
