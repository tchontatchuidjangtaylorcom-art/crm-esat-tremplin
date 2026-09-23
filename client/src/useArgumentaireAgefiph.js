import { useEffect, useState } from "react";
import { api } from "./api.js";

let cache = null;

// Contenu statique de l'affiche AGEFIPH (argumentaire, dates clés, barème) :
// chargé une seule fois depuis l'API et partagé entre le tiroir d'aide-mémoire
// et la fiche entreprise, pour éviter de le refetcher à chaque ouverture.
export function useArgumentaireAgefiph() {
  const [data, setData] = useState(cache);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (cache) return;
    api
      .getArgumentaireAgefiph()
      .then((d) => {
        cache = d;
        setData(d);
      })
      .catch((e) => setErreur(e.message));
  }, []);

  return { data, erreur };
}
