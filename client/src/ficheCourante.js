import { useSyncExternalStore } from "react";

// Fiche entreprise ouverte dans cet onglet ({ id, nom, collecteur }), pour
// que les panneaux d'aide (argumentaire, script) s'adaptent : une fiche
// publique (collecteur FIPHFP) affiche le pitch du secteur public.
let courante = null;
const abonnes = new Set();

export function definirFicheCourante(fiche) {
  const suivante = fiche ? { id: fiche.id, nom: fiche.nom, collecteur: fiche.collecteur } : null;
  if (JSON.stringify(suivante) === JSON.stringify(courante)) return;
  courante = suivante;
  abonnes.forEach((f) => f());
}

function abonner(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export function useFicheCourante() {
  return useSyncExternalStore(abonner, () => courante);
}
