// Statuts possibles d'un dossier, avec libellé et style du badge.
export const STATUTS = {
  nouveau: { label: "Nouveau", badge: "bg-sky-100 text-sky-700 border border-sky-300" },
  a_relancer: { label: "À relancer", badge: "bg-orange-100 text-orange-700 border border-orange-300" },
  nrp: { label: "NRP", badge: "bg-red-100 text-red-700 border border-red-300" },
  me_rappelle: { label: "Me rappelle", badge: "bg-purple-100 text-purple-700 border border-purple-300" },
  a_rappeler: { label: "À rappeler", badge: "bg-blue-100 text-blue-700 border border-blue-300" },
  rdv: { label: "RDV", badge: "bg-green-100 text-green-700 border border-green-300" },
  mail: { label: "Mail", badge: "bg-cyan-100 text-cyan-700 border border-cyan-300" },
  autre: { label: "Autre", badge: "bg-gray-100 text-gray-700 border border-gray-300" },
  fiche: { label: "Fiche Potentielle", badge: "bg-amber-100 text-amber-800 border border-amber-400 font-bold" },
  fiche_one_shot: { label: "Fiche one-shot", badge: "bg-indigo-100 text-indigo-700 border border-indigo-300" },
  conforme: { label: "Conforme", badge: "bg-emerald-100 text-emerald-700 border border-emerald-300" },
  refus: { label: "Refus", badge: "bg-rose-100 text-rose-700 border border-rose-300" },
  mort: { label: "Mort", badge: "bg-neutral-800 text-white border border-neutral-900" },
};

// Statuts qui font quitter le pipeline actif (archivage automatique côté
// serveur dès la sortie de dossier) : utile au frontend pour ne pas les
// compter dans les indicateurs de la file active. "conforme" est distinct de
// "refus"/"mort" — un dossier réglé n'est pas un échec de prospection.
export const STATUTS_ARCHIVES = ["conforme", "refus", "mort"];

// Ordre d'affichage des compteurs sur le tableau de bord. "refus"/"mort" en
// sont délibérément absents : ces dossiers sont archivés automatiquement dès
// le passage du statut (voir la purge côté serveur), donc ce compteur
// resterait toujours à 0 dans la liste active — remplacé par l'indicateur
// "Archivées".
export const ORDRE_STATUTS = [
  "nouveau",
  "a_relancer",
  "nrp",
  "me_rappelle",
  "a_rappeler",
  "rdv",
  "mail",
  "autre",
  "fiche",
  "fiche_one_shot",
];

// Profils ciblés par défaut par le dialer automatique : prospects jamais
// contactés ou injoignables la dernière fois — les meilleurs candidats pour
// un enchaînement d'appels sortants.
export const SEGMENTS_DIALER_PAR_DEFAUT = ["nouveau", "nrp"];

// Menu "NOUVELLE ISSUE D'APPEL" du module AGIR.
export const ISSUES_APPEL = [
  { value: "nrp", label: "NRP (Non Répondant)", needsDate: false },
  { value: "me_rappelle", label: "Me rappelle", needsDate: true },
  { value: "a_rappeler", label: "À rappeler", needsDate: true },
  { value: "rdv", label: "RDV", needsDate: true },
  { value: "mail", label: "Mail", needsDate: false },
  { value: "autre", label: "Autre", needsDate: false },
];

// Menu "SORTIE DU DOSSIER" du module AGIR.
export const SORTIES_DOSSIER = [
  { value: "fiche", label: "Fiche Potentielle" },
  { value: "fiche_one_shot", label: "Fiche one-shot → atelier" },
  { value: "conforme", label: "Conforme — dossier réglé (archivé)" },
  { value: "refus", label: "Refus (dossier clos)" },
  { value: "mort", label: "Mort (dossier clos)" },
];

// Liste fusionnée utilisée par le panneau d'appel (module VoIP) : l'agent
// choisit une issue parmi les deux menus AGIR en une seule liste.
export const ISSUES_FIN_APPEL = [
  ...ISSUES_APPEL.map((i) => ({ ...i, kind: "appel" })),
  ...SORTIES_DOSSIER.map((s) => ({ ...s, kind: "sortie", needsDate: false })),
];

export function formatMontant(montant) {
  if (montant === null || montant === undefined) return "-";
  return montant.toLocaleString("fr-FR") + " €";
}

export function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}

export function formatDateHeure(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR");
}

export function formatDuree(secondes) {
  if (!Number.isFinite(secondes)) return "-";
  const m = Math.floor(secondes / 60);
  const s = Math.floor(secondes % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
