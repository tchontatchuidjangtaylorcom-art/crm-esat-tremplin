import { useSyncExternalStore } from "react";

// Fiche entreprise actuellement ouverte : publiée par EntrepriseDetail pour
// que les panneaux d'outils (ex. calcul rapide ESAT Tremplin / TIH), qui ne
// connaissent pas la page en cours, puissent pré-remplir leurs champs avec
// l'effectif et les BOETH de la fiche et y enregistrer une correction.
// `null` hors d'une fiche.
let fiche = null;
const abonnes = new Set();

export function publierFicheOuverte(valeur) {
  fiche = valeur;
  abonnes.forEach((f) => f());
}

export function useFicheOuverte() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => fiche
  );
}
