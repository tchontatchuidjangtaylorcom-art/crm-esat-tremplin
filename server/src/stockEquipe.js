// « Remplir le stock de l'équipe » (administrateur) : génère en arrière-plan
// un grand nombre de fiches (jusqu'à 2 000) depuis le répertoire Sirene,
// réparties sur TOUS les secteurs, dans une taille d'entreprise choisie
// (20 à 249 salariés par défaut). Aucune recherche Claude : les fiches
// arrivent sans numéro, les agents le cherchent avec les liens de la fiche.
// Elles restent non assignées : on les donne ensuite à toute l'équipe avec
// « Distribuer des fiches » (jusqu'à 200 par personne).
//
// Un seul remplissage à la fois ; progression consultable pendant le travail.
import db from "./db.js";
import { rechercherEntreprisesParSecteur } from "./insee.js";
import { tailleEffectif } from "./taillesEffectif.js";

const MAX_TOTAL = 2000;
const PAUSE_MS = 250; // politesse envers l'API publique Sirene

let etat = { enCours: false };

export function enregistrerRoutesStockEquipe(app, { exigerAdmin, creerLeadDepuisSiren, CATEGORIES, sirenDe }) {
  app.get("/api/equipe/stock/statut", exigerAdmin, (req, res) => res.json(etat));

  app.post("/api/equipe/stock/generer", exigerAdmin, (req, res) => {
    if (etat.enCours) return res.status(409).json({ error: "Un remplissage est déjà en cours.", ...etat });
    const total = Math.min(Math.max(1, Number(req.body.total) || 0), MAX_TOTAL);
    const taille = tailleEffectif(req.body.taille) || tailleEffectif("20-249");
    const metropoleSeulement = req.body.territoire === "metropole";
    // Secteurs : tous, sauf les administrations si demandé (prospection privée).
    const cles = Object.keys(CATEGORIES).filter((cle) => req.body.avecPublic !== false || !CATEGORIES[cle].estAdministration);
    const parSecteur = Math.ceil(total / cles.length);
    const date = new Date().toISOString().slice(0, 10);
    const auteur = req.utilisateur.prenom || req.utilisateur.email;

    etat = {
      enCours: true,
      total,
      crees: 0,
      dejaConnus: 0,
      erreurs: 0,
      secteurEnCours: null,
      parSecteur: {},
      taille: taille.label,
      demarre: new Date().toISOString(),
      termine: null,
      message: null,
      par: auteur,
    };
    res.status(202).json(etat);

    (async () => {
      try {
        const connus = new Set([...db.data.entreprises, ...db.data.archives].map(sirenDe));
        // 1er tour : une part égale par secteur ; 2e tour : les secteurs qui
        // ont encore des entreprises comblent ce qui manque.
        const tours = [...cles.map((cle) => [cle, 1]), ...cles.map((cle) => [cle, 2])];
        for (const [cle, tour] of tours) {
          if (etat.crees >= total) break;
          const categorie = CATEGORIES[cle];
          etat.secteurEnCours = categorie.label;
          const objectif = tour === 1 ? Math.min(parSecteur, total - etat.crees) : total - etat.crees;
          let candidats = [];
          try {
            candidats = await rechercherEntreprisesParSecteur(
              { nafCodes: categorie.nafCodes, estAdministration: categorie.estAdministration },
              { limite: Math.min(objectif * 2, 600), tranches: taille.tranches, exclure: connus }
            );
          } catch (e) {
            etat.erreurs++;
            etat.message = `${categorie.label} : ${e.message}`;
            continue;
          }
          if (metropoleSeulement) candidats = candidats.filter((c) => !/^97/.test(String(c.codePostal || "")));
          let creesSecteur = 0;
          const lot = `Stock équipe ${date} — ${categorie.label}`;
          for (const c of candidats) {
            if (creesSecteur >= objectif || etat.crees >= total) break;
            if (connus.has(c.siren)) continue;
            try {
              const r = await creerLeadDepuisSiren(c.siren, { lot, categorieForcee: cle });
              connus.add(c.siren);
              if (r.existant) etat.dejaConnus++;
              else if (!r.archive && r.entreprise) {
                creesSecteur++;
                etat.crees++;
              }
            } catch {
              etat.erreurs++;
            }
            await new Promise((r) => setTimeout(r, PAUSE_MS));
          }
          etat.parSecteur[categorie.label] = (etat.parSecteur[categorie.label] || 0) + creesSecteur;
        }
        if (etat.crees < total) {
          etat.message = `${etat.crees} fiche(s) créée(s) sur ${total} demandées : pas assez d'entreprises nouvelles dans ces secteurs et cette taille.`;
        }
      } catch (e) {
        etat.message = e.message;
      } finally {
        etat.enCours = false;
        etat.secteurEnCours = null;
        etat.termine = new Date().toISOString();
        console.log(`[stock-equipe] ${etat.crees} fiche(s) créée(s) (${etat.taille}).`);
      }
    })();
  });
}
