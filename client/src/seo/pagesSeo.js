// Référentiel SEO des pages publiques (titres, descriptions, priorités).
// Source unique, lue à la fois :
//  - par le serveur (server/src/seo.js) qui injecte ces balises dans le HTML
//    envoyé à Google et aux aperçus de liens (LinkedIn, e-mail, messageries
//    — qui n'exécutent pas le JavaScript) ;
//  - par le navigateur (VitrineApp.jsx) qui met à jour le titre lors de la
//    navigation entre pages.
// Fichier JavaScript pur (sans JSX) pour rester importable côté Node.

export const NOM_SITE = "Pôle OETH / AGEFIPH / FIPHFP";
export const IMAGE_PARTAGE = "/og-image.png"; // 1200 × 630
export const EMAIL_CONTACT = "contact@oeth-fiph.fr";
export const TELEPHONE_CONTACT = "+33 7 44 12 79 17";

// `titre` : ~60 caractères max (au-delà, Google tronque).
// `description` : ~155 caractères max, orientée action.
export const PAGES_SEO = {
  "/vitrine": {
    titre: "Simulateur OETH / DOETH 2026 — Estimez votre taxe Agefiph",
    description:
      "Simulateur gratuit de contribution OETH 2026 : quota de 6 %, BOETH, sous-traitance EA/ESAT/TIH, déductions et codes DSN. Résultat immédiat, sans inscription.",
    priorite: 1.0,
    frequence: "weekly",
  },
  "/vitrine/faq": {
    titre: "FAQ OETH / DOETH — Obligation d'emploi des travailleurs handicapés",
    description:
      "Calcul de la contribution Agefiph, seuils d'effectif, plafonds OETH, déclaration obligatoire d'emploi (DOETH), BOETH, ESAT/EA, codes DSN : 25 réponses claires.",
    priorite: 0.9,
    frequence: "monthly",
  },
  "/vitrine/actualites": {
    titre: "Actualités OETH 2026 — SMIC, échéances DSN et coefficients",
    description:
      "Les repères réglementaires OETH à jour : SMIC 2026, déclaration DSN d'avril, coefficients 400/500/600, contribution majorée, seuils et déductions.",
    priorite: 0.8,
    frequence: "weekly",
  },
  "/vitrine/pilotage": {
    titre: "Pilotage de la politique handicap — Préparez votre DOETH",
    description:
      "Suivi des BOETH et des RQTH, feuille de route, achats inclusifs, maintien dans l'emploi et préparation de la DOETH. Échangez avec un expert ou demandez une démo.",
    priorite: 0.8,
    frequence: "monthly",
  },
  "/vitrine/vigilance": {
    titre: "Vigilance OETH — Vérifiez une sollicitation avant de payer",
    description:
      "Appel ou e-mail au sujet d'un « dossier OETH » ? Les bons réflexes : seule l'URSSAF recouvre la contribution. Faites vérifier gratuitement une sollicitation.",
    priorite: 0.7,
    frequence: "monthly",
  },
  "/vitrine/notre-demarche": {
    titre: "Notre démarche — Emploi direct et inclusion des travailleurs handicapés",
    description:
      "Notre approche de l'obligation d'emploi : recrutement direct, accompagnement Cap Emploi et solutions ESAT/EA, pour une inclusion durable dans l'entreprise.",
    priorite: 0.6,
    frequence: "monthly",
  },
};

export function seoPourChemin(chemin) {
  const propre = (chemin || "/").replace(/\/+$/, "") || "/";
  return PAGES_SEO[propre] || null;
}
