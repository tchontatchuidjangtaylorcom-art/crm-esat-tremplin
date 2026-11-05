// Suivi d'appel d'une fiche (case demandée par l'équipe) : à côté des retours
// de mail et des fiches confirmées par le client, l'agent note s'il a appelé,
// s'il faut rappeler, si l'entreprise est à jour et qui recontacter quand ce
// n'est pas la personne qui a répondu. Évite de rappeler deux fois la même
// personne ; l'agent et les administrateurs voient la même information.
// Ne change ni le statut de la fiche ni les KPI d'appels (voir /appels).
import { nanoid } from "nanoid";
import db from "./db.js";

export const LIBELLES_A_JOUR = { oui: "À jour", non: "Pas à jour", a_verifier: "À vérifier" };
const MAX_APPELS = 50;

const texte = (v, max) => String(v ?? "").trim().slice(0, max);
const dateFr = (d) => new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

function memeInterlocuteur(a = {}, b = {}) {
  return ["nom", "fonction", "telephone"].every((c) => (a[c] || "") === (b[c] || ""));
}

// Applique une mise à jour (seuls les champs présents changent) et inscrit ce
// qui a changé dans l'historique de la fiche. `maintenant` : pour les tests.
export function appliquerSuiviAppel(entreprise, corps, utilisateur, maintenant = new Date()) {
  const b = corps || {};
  const auteur = utilisateur?.prenom || utilisateur?.email || "Agent";
  const avant = entreprise.suiviRetour || {};
  const suivi = { appels: [], aRappeler: false, dateRappel: null, aJour: null, interlocuteur: {}, note: "", ...avant };
  const traces = [];

  if (b.action === "appel") {
    suivi.appels = [
      { id: nanoid(), date: maintenant.toISOString(), parId: utilisateur?.id || null, parNom: auteur },
      ...(suivi.appels || []),
    ].slice(0, MAX_APPELS);
    traces.push("appel passé");
    // Le rappel prévu est fait : il ne doit plus sonner.
    if (suivi.aRappeler && suivi.dateRappel && new Date(suivi.dateRappel).getTime() <= maintenant.getTime()) {
      suivi.aRappeler = false;
      suivi.dateRappel = null;
    }
  } else if (b.action === "annuler_appel") {
    if (!suivi.appels?.length) throw new Error("Aucun appel à annuler.");
    suivi.appels = suivi.appels.slice(1);
    traces.push("dernier appel noté annulé");
  } else if (b.action !== undefined) {
    throw new Error("Action inconnue.");
  }

  if ("aRappeler" in b || "dateRappel" in b) {
    const aRappeler = "aRappeler" in b ? b.aRappeler === true : suivi.aRappeler;
    let date = "dateRappel" in b ? texte(b.dateRappel, 30) || null : suivi.dateRappel;
    if (date && !Number.isFinite(new Date(date).getTime())) throw new Error("Date de rappel invalide.");
    if (!aRappeler) date = null;
    if (aRappeler !== avant.aRappeler || date !== (avant.dateRappel ?? null)) {
      traces.push(aRappeler ? `à rappeler${date ? ` le ${dateFr(date)}` : ""}` : "plus à rappeler");
    }
    suivi.aRappeler = aRappeler;
    suivi.dateRappel = date;
  }

  if ("aJour" in b) {
    const aJour = b.aJour && LIBELLES_A_JOUR[b.aJour] ? b.aJour : null;
    if (aJour !== (avant.aJour ?? null)) traces.push(aJour ? LIBELLES_A_JOUR[aJour].toLowerCase() : "« à jour » retiré");
    suivi.aJour = aJour;
  }

  if ("interlocuteur" in b) {
    const i = b.interlocuteur || {};
    const interlocuteur = { nom: texte(i.nom, 120), fonction: texte(i.fonction, 120), telephone: texte(i.telephone, 30) };
    if (!memeInterlocuteur(interlocuteur, avant.interlocuteur)) {
      const detail = [interlocuteur.nom, interlocuteur.fonction, interlocuteur.telephone].filter(Boolean).join(", ");
      traces.push(detail ? `personne à recontacter : ${detail}` : "personne à recontacter retirée");
    }
    suivi.interlocuteur = interlocuteur;
  }

  if ("note" in b) {
    const note = texte(b.note, 2000);
    if (note !== (avant.note || "")) traces.push(note ? `note : ${note}` : "note retirée");
    suivi.note = note;
  }

  // La date de rappel de la fiche suit le suivi (badge d'échéance, liste) ;
  // retirée seulement si elle venait du suivi et que le statut n'en a pas besoin.
  if (suivi.dateRappel) {
    if (entreprise.dateRappel !== suivi.dateRappel) entreprise.echeanceProgrammeePar = utilisateur?.id || entreprise.echeanceProgrammeePar;
    entreprise.dateRappel = suivi.dateRappel;
  } else if (avant.dateRappel && entreprise.dateRappel === avant.dateRappel && !["a_rappeler", "fiche"].includes(entreprise.statut)) {
    entreprise.dateRappel = null;
  }

  if (!traces.length) return false;

  suivi.majLe = maintenant.toISOString();
  suivi.majPar = auteur;
  entreprise.suiviRetour = suivi;
  entreprise.commentaires = Array.isArray(entreprise.commentaires) ? entreprise.commentaires : [];
  entreprise.commentaires.unshift({ id: nanoid(), date: maintenant.toISOString(), auteur, texte: `📞 Suivi d'appel : ${traces.join(" · ")}.` });
  return true;
}

// Rappel prévu depuis le suivi, pour l'alerte /api/echeances.
export function rappelDuSuivi(entreprise) {
  const s = entreprise.suiviRetour;
  return s?.aRappeler && s.dateRappel ? s.dateRappel : null;
}

export function enregistrerRoutesSuiviAppel(app, { exigerAuth, chargerEntrepriseAutorisee, enrichir }) {
  // Lecture seule : contrairement à GET /api/entreprises/:id, n'efface aucune
  // notification « non vue » (utilisée depuis la Boîte mail).
  app.get("/api/entreprises/:id/suivi-appel", exigerAuth, chargerEntrepriseAutorisee, (req, res) => {
    const e = req.entreprise;
    res.json({
      id: e.id,
      nom: e.nom,
      suiviRetour: e.suiviRetour || null,
      confirmationClient: e.confirmationClient
        ? { nom: e.confirmationClient.nom, fonction: e.confirmationClient.fonction, date: e.confirmationClient.date }
        : null,
    });
  });

  app.post("/api/entreprises/:id/suivi-appel", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
    try {
      if (appliquerSuiviAppel(req.entreprise, req.body, req.utilisateur)) await db.write();
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    res.json(enrichir(req.entreprise));
  });
}
