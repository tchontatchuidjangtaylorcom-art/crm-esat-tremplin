// « Confirmer ma fiche » : pendant l'appel, l'agent envoie au client, en un
// clic depuis la boîte mail de la fiche, un lien personnel vers une page
// publique (/vitrine/ma-fiche/<jeton>). Le client y confirme son effectif et
// son nombre de bénéficiaires (RQTH), voit le nombre d'unités manquantes et la
// contribution ESTIMÉE recalculés en direct, puis valide : la fiche du CRM est
// mise à jour et marquée « confirmée par le client » (date, nom et fonction du
// signataire, chiffres avant/après). L'agent qui suit la fiche et les
// administrateurs sont prévenus (cloche + e-mail).
//
// Le jeton, aléatoire, ne donne accès qu'à cette fiche : nom de l'entreprise,
// effectif, bénéficiaires et estimation — jamais les notes internes, contacts
// ou historique du CRM.
import crypto from "crypto";
import { nanoid } from "nanoid";
import db from "./db.js";
import { envoyerMail, adresseMailPole, telephonePole } from "./mail.js";
import { calculerObligationOeth, simulerContributionOeth, smicPourExercice, exerciceParDefaut } from "./oeth.js";
import { lienRendezVousClient } from "./vitrineRdv.js";
import { determinerCollecteur } from "./secteurs.js";
import { SITE_URL } from "./seo.js";

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CONFIRMATIONS_PAR_JOUR = 10;

export function lienFicheClient(entreprise) {
  entreprise.ficheClient = entreprise.ficheClient || {};
  let cree = false;
  if (!entreprise.ficheClient.jeton) {
    entreprise.ficheClient.jeton = crypto.randomBytes(18).toString("base64url");
    cree = true;
  }
  return { url: `${SITE_URL}/vitrine/ma-fiche/${entreprise.ficheClient.jeton}`, cree };
}

function ficheParJeton(jeton) {
  const j = String(jeton || "");
  if (j.length < 16) return null;
  return db.data.entreprises.find((e) => e.ficheClient?.jeton === j) || null;
}

// Ce que voit le client : jamais plus que ses propres chiffres.
// Aucun bénéficiaire : depuis quand ? La surcontribution s'applique quand
// l'entreprise n'a employé aucun bénéficiaire (ni sous-traité suffisamment)
// sur les 4 dernières années : pour l'exercice 2026, à 0 depuis 2023 ou
// avant → surcontribution ; depuis 2024 ou plus récemment → contribution
// classique. « Je ne sais pas » → contribution classique (à vérifier avec le
// conseiller).
export const DEPUIS_ZERO = {
  recent: "Depuis 2024 ou plus récemment",
  2023: "Depuis 2023",
  avant: "Avant 2023 (ou jamais)",
  inconnu: "Ne sait pas",
};
const surcontributionSelon = (depuisZero) => (depuisZero === "2023" || depuisZero === "avant" ? true : depuisZero ? false : null);

function resume(entreprise, effectif = entreprise.effectif, rqth = entreprise.effectifBeneficiaire, depuisZero = null) {
  const collecteur = determinerCollecteur(entreprise);
  const oeth = calculerObligationOeth({
    effectif: Number(effectif) || 0,
    effectifBeneficiaire: Number(rqth) || 0,
    dateCreation: entreprise.dateCreation,
  });
  // Réponse « depuis quand à 0 » : recalcul avec la surcontribution décidée.
  const decision = Number(rqth) === 0 ? surcontributionSelon(depuisZero) : null;
  if (decision !== null && oeth.assujetti && !oeth.neutralisation?.neutralise) {
    const exercice = exerciceParDefaut();
    const sim = simulerContributionOeth({
      effectif: Number(effectif) || 0,
      boeth: 0,
      smicHoraire: smicPourExercice(exercice),
      surcontributionDeclaree: decision,
    });
    oeth.montantEstime = Math.round(sim.contributionNette);
    oeth.surcontribution = sim.surcontribution;
  }
  return {
    collecteur,
    assujetti: oeth.assujetti,
    unitesRequises: oeth.unitesRequises,
    unitesManquantes: oeth.deficit,
    conforme: oeth.conforme,
    neutralise: Boolean(oeth.neutralisation?.neutralise),
    exercice: oeth.exercice,
    // Montant estimé : seulement pour le privé (calcul de droit commun
    // AGEFIPH) ; le calcul FIPHFP du secteur public est présenté par le
    // conseiller.
    montantEstime: collecteur === "AGEFIPH" ? oeth.montantEstime : null,
    surcontribution: collecteur === "AGEFIPH" ? oeth.surcontribution : false,
  };
}

const entier = (v) => {
  const n = Number(String(v ?? "").replace(/\s/g, ""));
  return Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : null;
};

function echapper(t) {
  return String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

export function enregistrerRoutesFicheClient(
  app,
  { exigerAuth, chargerEntrepriseAutorisee, findEntreprise, enrichir, ajouterEmailFiche, trouverUtilisateurParId, estAdmin }
) {
  const nomDe = (id) => {
    const u = id && trouverUtilisateurParId(id);
    return u ? u.prenom || u.email : null;
  };

  // Lien de la fiche (pour tester la page ou le copier pendant l'appel).
  app.get("/api/entreprises/:id/fiche-client/lien", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
    const { url, cree } = lienFicheClient(req.entreprise);
    if (cree) await db.write();
    res.json({ url });
  });

  // Envoi en un clic du lien « Confirmer ma fiche » au client.
  app.post("/api/entreprises/:id/fiche-client/envoyer", exigerAuth, chargerEntrepriseAutorisee, async (req, res) => {
    const entreprise = req.entreprise;
    const destinataire = String(req.body.destinataire || entreprise.contact?.email || "").trim();
    if (!EMAIL_VALIDE.test(destinataire)) return res.status(400).json({ error: "Indiquez l'adresse e-mail du client." });
    const copies = (Array.isArray(req.body.cc) ? req.body.cc : []).map((a) => String(a || "").trim()).filter(Boolean);
    const invalide = copies.find((a) => !EMAIL_VALIDE.test(a));
    if (invalide) return res.status(400).json({ error: `Adresse en copie invalide : ${invalide}` });

    const { url } = lienFicheClient(entreprise);
    const pole = { email: adresseMailPole(), telephone: telephonePole() };
    const nomPole = determinerCollecteur(entreprise) === "FIPHFP" ? "Pôle FIPHFP" : "Pôle OETH / AGEFIPH";
    const sujet = `Votre fiche OETH à confirmer — ${entreprise.nom}`;
    const texte =
      `Bonjour,\n\nSuite à notre échange téléphonique, voici le lien pour vérifier et confirmer les informations de ` +
      `${entreprise.nom} concernant l'obligation d'emploi des travailleurs handicapés (OETH) :\n\n${url}\n\n` +
      `Il vous suffit de confirmer votre effectif et votre nombre de salariés bénéficiaires (RQTH) : l'estimation ` +
      `de votre situation se met à jour immédiatement. Cela ne prend qu'une minute.\n\n` +
      `Cordialement,\n${nomPole}\n${pole.email}${pole.telephone ? ` · ${pole.telephone}` : ""}`;
    const html =
      `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1e293b;max-width:600px">` +
      `<p>Bonjour,</p><p>Suite à notre échange téléphonique, voici le lien pour vérifier et confirmer les informations de <strong>${echapper(entreprise.nom)}</strong> concernant l'obligation d'emploi des travailleurs handicapés (OETH).</p>` +
      `<p style="margin:28px 0"><a href="${echapper(url)}" style="background:#1e3a8a;color:#fff;text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:bold;display:inline-block">Vérifier et confirmer ma fiche</a></p>` +
      `<p>Il vous suffit de confirmer votre effectif et votre nombre de salariés bénéficiaires (RQTH) : l'estimation de votre situation se met à jour immédiatement. Cela ne prend qu'une minute.</p>` +
      `<p>Cordialement,<br>${echapper(nomPole)}<br>${echapper(pole.email)}${pole.telephone ? ` · ${echapper(pole.telephone)}` : ""}</p>` +
      `<p style="font-size:12px;color:#64748b">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : ${echapper(url)}</p></div>`;

    try {
      await envoyerMail({ to: destinataire, cc: copies, subject: sujet, text: texte, html, fromName: nomPole });
    } catch (e) {
      return res.status(e.code === "MAIL_NON_CONFIGURE" ? 503 : 502).json({ error: e.message });
    }

    entreprise.contact = entreprise.contact || {};
    for (const a of [destinataire, ...copies]) ajouterEmailFiche(entreprise.contact, a, "Fiche à confirmer envoyée");
    entreprise.ficheClient.envois = [
      { date: new Date().toISOString(), a: destinataire, cc: copies, par: req.utilisateur.id },
      ...(entreprise.ficheClient.envois || []),
    ].slice(0, 20);
    entreprise.emails = entreprise.emails || [];
    entreprise.emails.unshift({
      id: nanoid(),
      direction: "envoye",
      de: adresseMailPole(),
      a: destinataire,
      ...(copies.length ? { cc: copies } : {}),
      objet: sujet,
      corps: texte,
      piecesJointes: [],
      date: new Date().toISOString(),
      lu: true,
    });
    entreprise.commentaires = Array.isArray(entreprise.commentaires) ? entreprise.commentaires : [];
    entreprise.commentaires.unshift({
      id: nanoid(),
      date: new Date().toISOString(),
      auteur: "Système",
      texte: `📋 Fiche à confirmer envoyée au client (${destinataire}) par ${req.utilisateur.prenom || req.utilisateur.email}.`,
    });
    await db.write();
    res.json(enrichir(entreprise));
  });

  // ---- Page publique du client ----
  app.get("/api/vitrine/ma-fiche/:jeton", (req, res) => {
    const entreprise = ficheParJeton(req.params.jeton);
    if (!entreprise) {
      return res.status(404).json({
        error: `Ce lien n'est plus valide. Contactez-nous à ${adresseMailPole()}${telephonePole() ? ` ou au ${telephonePole()}` : ""}.`,
      });
    }
    const c = entreprise.confirmationClient;
    res.json({
      entreprise: entreprise.nom || "",
      siret: entreprise.siret || "",
      ville: [entreprise.codePostal, entreprise.ville].filter(Boolean).join(" "),
      effectif: entreprise.effectif ?? null,
      rqth: entreprise.effectifBeneficiaire ?? 0,
      calcul: resume(entreprise),
      dejaConfirmee: c ? { date: c.date, nom: c.nom, effectif: c.effectif, rqth: c.rqth } : null,
      pole: { email: adresseMailPole(), telephone: telephonePole() },
    });
  });

  // Recalcul en direct pendant la saisie (aucune écriture).
  app.get("/api/vitrine/ma-fiche/:jeton/calcul", (req, res) => {
    const entreprise = ficheParJeton(req.params.jeton);
    if (!entreprise) return res.status(404).json({ error: "Lien invalide." });
    const effectif = entier(req.query.effectif);
    const rqth = entier(req.query.rqth);
    if (effectif === null || rqth === null) return res.status(400).json({ error: "Nombres invalides." });
    const depuisZero = DEPUIS_ZERO[req.query.depuisZero] ? String(req.query.depuisZero) : null;
    res.json(resume(entreprise, effectif, rqth, depuisZero));
  });

  app.post("/api/vitrine/ma-fiche/:jeton", async (req, res) => {
    const b = req.body || {};
    if (b.siteWeb) return res.json({ ok: true }); // champ piège anti-robots
    const entreprise = ficheParJeton(req.params.jeton);
    if (!entreprise) return res.status(404).json({ error: "Ce lien n'est plus valide." });

    const effectif = entier(b.effectif);
    const rqth = entier(b.rqth);
    const nom = String(b.nom || "").trim().slice(0, 120);
    const fonction = String(b.fonction || "").trim().slice(0, 120);
    const commentaire = String(b.commentaire || "").trim().slice(0, 1000);
    if (effectif === null || effectif < 1) return res.status(400).json({ error: "Indiquez votre effectif (nombre de salariés)." });
    if (rqth === null) return res.status(400).json({ error: "Indiquez le nombre de salariés bénéficiaires (0 si aucun)." });
    if (rqth > effectif) return res.status(400).json({ error: "Le nombre de bénéficiaires ne peut pas dépasser l'effectif." });
    if (!nom) return res.status(400).json({ error: "Indiquez votre nom (personne qui confirme)." });
    if (b.certifie !== true) return res.status(400).json({ error: "Merci de cocher la case de confirmation." });

    const aujourdhui = new Date().toISOString().slice(0, 10);
    const duJour = (entreprise.ficheClient.historique || []).filter((h) => h.date.startsWith(aujourdhui)).length;
    if (duJour >= MAX_CONFIRMATIONS_PAR_JOUR) {
      return res.status(429).json({ error: "Trop de confirmations aujourd'hui pour ce dossier. Contactez votre conseiller." });
    }

    const avant = { effectif: entreprise.effectif ?? null, rqth: entreprise.effectifBeneficiaire ?? 0 };
    const maintenant = new Date().toISOString();
    entreprise.effectif = effectif;
    entreprise.effectifBeneficiaire = rqth;
    const depuisZero = rqth === 0 && DEPUIS_ZERO[b.depuisZero] ? String(b.depuisZero) : null;
    const telephone = String(b.telephone || "").trim().slice(0, 30);
    entreprise.confirmationClient = { date: maintenant, effectif, rqth, depuisZero, nom, fonction, telephone, commentaire, avant, vuPar: [] };
    if (telephone) {
      entreprise.contact = entreprise.contact || {};
      if (!entreprise.contact.telephone) entreprise.contact.telephone = telephone;
    }
    entreprise.ficheClient.historique = [{ date: maintenant, effectif, rqth, nom }, ...(entreprise.ficheClient.historique || [])].slice(0, 50);

    const calcul = resume(entreprise, effectif, rqth, depuisZero);
    const changement = (a, b2) => (a === b2 ? `${b2}` : `${b2} (avant : ${a ?? "non renseigné"})`);
    const ligne =
      `✅ Fiche confirmée par le client — ${nom}${fonction ? `, ${fonction}` : ""} : effectif ${changement(avant.effectif, effectif)}, ` +
      `bénéficiaires RQTH ${changement(avant.rqth, rqth)} → ${calcul.unitesManquantes} unité(s) manquante(s)` +
      (calcul.montantEstime != null ? `, contribution estimée ${calcul.montantEstime.toLocaleString("fr-FR")} €` : "") +
      `.${depuisZero ? ` Aucun bénéficiaire : ${DEPUIS_ZERO[depuisZero].toLowerCase()}${calcul.surcontribution ? " (surcontribution)" : ""}.` : ""}` +
      `${telephone ? ` Téléphone : ${telephone}.` : ""}${commentaire ? ` Message : ${commentaire}` : ""}`;
    entreprise.commentaires = Array.isArray(entreprise.commentaires) ? entreprise.commentaires : [];
    entreprise.commentaires.unshift({ id: nanoid(), date: maintenant, auteur: "Client", texte: ligne });
    await db.write();

    // E-mail à l'agent qui suit la fiche et à la boîte du pôle (administrateurs).
    const agent = entreprise.assigneA ? trouverUtilisateurParId(entreprise.assigneA) : null;
    const destinataires = [...new Set([agent?.email, adresseMailPole()].filter(Boolean))];
    for (const to of destinataires) {
      try {
        await envoyerMail({
          to,
          subject: `✅ Fiche confirmée par le client — ${entreprise.nom}`,
          text: `${ligne}\n\nAgent : ${nomDe(entreprise.assigneA) || "non assigné"}\nFiche : ${SITE_URL}/entreprise/${entreprise.id}`,
          fromName: "CRM — Fiche client",
        });
      } catch (e) {
        console.error(`[fiche-client] Échec de l'e-mail à ${to} :`, e.message);
      }
    }
    // Lien de prise de rendez-vous de la fiche, proposé juste après la
    // confirmation (la réservation prévient le CRM, voir vitrineRdv.js).
    const rdv = lienRendezVousClient(entreprise);
    if (rdv.cree) await db.write();
    res.json({ ok: true, calcul, rdvUrl: new URL(rdv.url).pathname });
  });

  // « Recevoir mon lien » (lien perdu) : le client tape son e-mail ; s'il est
  // connu sur une fiche, le lien lui est ENVOYÉ PAR MAIL — jamais affiché à
  // l'écran, et la réponse est toujours la même (on ne révèle pas si une
  // adresse est connue). Limité à 3 demandes par heure et par connexion.
  const demandesLien = new Map();
  app.post("/api/vitrine/lien-dossier", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!EMAIL_VALIDE.test(email) || email.length > 200) return res.status(400).json({ error: "Adresse e-mail invalide." });
    const ip =
      String(req.headers["cf-connecting-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0]).trim() || req.ip || "?";
    const maintenant = Date.now();
    const recents = (demandesLien.get(ip) || []).filter((t) => maintenant - t < 3600_000);
    if (recents.length >= 3) return res.status(429).json({ error: "Trop de demandes. Réessayez dans une heure." });
    demandesLien.set(ip, [...recents, maintenant]);

    const fiches = db.data.entreprises
      .filter((e) =>
        [e.contact?.email, ...(e.contact?.emailsAlternatifs || []).map((a) => a.email)]
          .filter(Boolean)
          .some((a) => a.toLowerCase() === email)
      )
      .slice(0, 3);
    let aEcrire = false;
    for (const e of fiches) {
      const { url, cree } = lienFicheClient(e);
      aEcrire = aEcrire || cree;
      try {
        await envoyerMail({
          to: email,
          subject: `Votre lien pour confirmer la fiche de ${e.nom}`,
          text:
            `Bonjour,\n\nVoici votre lien personnel pour vérifier et confirmer les informations de ${e.nom} :\n\n${url}\n\n` +
            `Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.\n\n` +
            `${adresseMailPole()}${telephonePole() ? ` · ${telephonePole()}` : ""}`,
          fromName: determinerCollecteur(e) === "FIPHFP" ? "Pôle FIPHFP" : "Pôle OETH / AGEFIPH",
        });
      } catch (err) {
        console.error("[fiche-client] Envoi du lien impossible :", err.message);
      }
    }
    if (aEcrire) await db.write();
    res.json({ ok: true });
  });

  // Notifications : fiches confirmées non encore ouvertes, pour l'agent qui
  // suit la fiche (ou son superviseur) et pour les administrateurs.
  return {
    confirmationsPour(utilisateur) {
      const limite = Date.now() - 14 * 24 * 3600 * 1000;
      return db.data.entreprises
        .filter((e) => {
          const c = e.confirmationClient;
          if (!c || new Date(c.date).getTime() < limite || (c.vuPar || []).includes(utilisateur.id)) return false;
          return estAdmin(utilisateur) || e.assigneA === utilisateur.id || e.superviseurId === utilisateur.id;
        })
        .map((e) => ({ id: e.id, nom: e.nom, date: e.confirmationClient.date, par: e.confirmationClient.nom }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    marquerVue(entreprise, utilisateur) {
      const c = entreprise.confirmationClient;
      if (!c || (c.vuPar || []).includes(utilisateur.id)) return false;
      c.vuPar = [...(c.vuPar || []), utilisateur.id];
      return true;
    },
  };
}
