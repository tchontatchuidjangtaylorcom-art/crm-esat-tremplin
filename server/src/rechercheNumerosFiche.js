// Recherche de numéros à la demande, depuis une fiche entreprise (bouton
// « Rechercher d'autres numéros » sous le nom de l'entreprise) : typiquement
// quand le numéro connu n'est pas attribué. La recherche IA (voir
// rechercheContact.js) prend 30 s à 2 min : elle tourne en arrière-plan,
// l'agent continue ses appels ailleurs, et les numéros trouvés sont ajoutés
// d'eux-mêmes à la fiche.
//
// Contrairement à l'enrichissement en lot (appliquerResultatRechercheIA dans
// index.js, qui remplace le numéro principal), rien n'est écrasé ici : les
// numéros trouvés s'AJOUTENT aux numéros supplémentaires de la fiche, que
// l'agent appelle directement ou passe en principal (« Prioritaire »). Le
// numéro principal n'est rempli que s'il est vide.
import { nanoid } from "nanoid";
import db from "./db.js";
import { rechercherContactAlternatif, estRechercheIaConfiguree } from "./rechercheContact.js";

// État par fiche (mémoire du processus, comme les autres traitements en
// arrière-plan) : sert à ne pas lancer deux recherches à la fois sur la même
// fiche et à informer l'interface de la fin de la recherche.
const recherches = new Map();

const chiffres = (n) => String(n || "").replace(/\D/g, "");

function ajouterNumerosTrouves(entreprise, resultat, auteur, { ajouterEmailFiche } = {}) {
  const contact = (entreprise.contact ||= {});
  const maintenant = new Date().toISOString();
  const connus = new Set(
    [contact.telephone, ...(contact.telephonesAlternatifs || []).map((t) => t.numero)].map(chiffres).filter(Boolean)
  );

  const nouveaux = [];
  for (const t of resultat.telephones || []) {
    if (!t.numero || connus.has(chiffres(t.numero))) continue;
    connus.add(chiffres(t.numero));
    nouveaux.push(t);
  }

  let aTrouvePrincipal = false;
  if (nouveaux.length && chiffres(contact.telephone).length < 9) {
    contact.telephone = nouveaux[0].numero;
    contact.telephoneInvalide = false;
    aTrouvePrincipal = true;
  }
  const enSupplement = aTrouvePrincipal ? nouveaux.slice(1) : nouveaux;
  if (enSupplement.length) {
    contact.telephonesAlternatifs = [
      ...(contact.telephonesAlternatifs || []),
      ...enSupplement.map((t) => ({
        id: nanoid(),
        numero: t.numero,
        note: `Trouvé par l'IA${t.libelle ? ` — ${t.libelle}` : ""}`,
        dateAjout: maintenant,
      })),
    ];
  }

  // Contact RH : même règle que l'enrichissement en lot.
  const rh = resultat.contactRH;
  let rhAjoute = false;
  if (rh?.nom) {
    const sansNom = !contact.nom || contact.nom === "-";
    const dejaConnu = [contact.nom, ...(contact.contactsAlternatifs || []).map((c) => c.nom)].some(
      (n) => n && n.toLowerCase() === rh.nom.toLowerCase()
    );
    if (sansNom) {
      contact.nom = rh.nom;
      contact.fonction = rh.fonction || "-";
      rhAjoute = true;
    } else if (!dejaConnu) {
      contact.contactsAlternatifs = [
        ...(contact.contactsAlternatifs || []),
        { id: nanoid(), nom: rh.nom, fonction: rh.fonction || "", dateAjout: maintenant },
      ];
      rhAjoute = true;
    }
  }

  // E-mails publiés trouvés en même temps (contact RH, adresse RH /
  // recrutement, adresse de contact générale) : ajoutés à la fiche.
  const emails = [];
  const ajouterEmail = (email, note) => {
    if (email && ajouterEmailFiche?.(contact, email, note)) emails.push(email);
  };
  if (rh?.email) ajouterEmail(rh.email, `RH — ${rh.nom} (trouvé par l'IA)`);
  ajouterEmail(resultat.emailRH, "Adresse RH / recrutement (trouvée par l'IA)");
  ajouterEmail(resultat.emailGeneral, "Adresse de contact (trouvée par l'IA)");
  if (rhAjoute) entreprise.rechercheContactRH = { date: maintenant, resultat: "trouve" };

  const lignes = nouveaux.map(
    (t) => `${t.numero}${t.libelle ? ` (${t.libelle})` : ""}${t.source ? ` — ${t.source}` : ""}`
  );
  if (rhAjoute) lignes.push(`contact : ${rh.nom}${rh.fonction ? `, ${rh.fonction}` : ""}`);
  if (emails.length) lignes.push(`e-mail${emails.length > 1 ? "s" : ""} : ${emails.join(", ")}`);
  entreprise.commentaires = Array.isArray(entreprise.commentaires) ? entreprise.commentaires : [];
  entreprise.commentaires.unshift({
    id: nanoid(),
    date: maintenant,
    auteur: "Assistant IA",
    texte: lignes.length
      ? `Recherche de numéros lancée par ${auteur} — trouvé : ${lignes.join(" ; ")}. À vérifier à l'appel.`
      : `Recherche de numéros lancée par ${auteur} — aucun nouveau numéro trouvé.`,
  });

  return { nouveaux: nouveaux.map((t) => t.numero), contactRH: rhAjoute ? rh.nom : null, emails };
}

export function enregistrerRoutesRechercheNumeros(
  app,
  { exigerAuth, exigerAdmin, chargerEntrepriseAutorisee, findEntreprise, ajouterEmailFiche, marquerRechercheTelephone, dejaRecherchee }
) {
  app.get("/api/entreprises/:id/recherche-numeros", exigerAuth, chargerEntrepriseAutorisee, (req, res) => {
    res.json(recherches.get(req.entreprise.id) || { enCours: false });
  });

  // Recherche Claude (payante) : réservée aux administrateurs.
  app.post("/api/entreprises/:id/recherche-numeros", exigerAdmin, chargerEntrepriseAutorisee, async (req, res) => {
    if (!estRechercheIaConfiguree()) {
      return res.status(503).json({ error: "Recherche IA non configurée (renseignez ANTHROPIC_API_KEY)." });
    }
    const id = req.entreprise.id;
    // Lancement automatique à l'ouverture d'une fiche (voir
    // BoutonRechercheNumeros.jsx) : seulement si la fiche n'a pas de numéro et
    // n'a jamais été cherchée — jamais de dépense répétée sur la même fiche.
    if (req.body?.auto === true) {
      const aUnNumero = chiffres(req.entreprise.contact?.telephone).length >= 9;
      if (aUnNumero || dejaRecherchee?.(req.entreprise) || recherches.get(id)?.enCours) {
        return res.json({ lance: false, ...(recherches.get(id) || { enCours: false }) });
      }
    }
    const enCours = recherches.get(id);
    if (enCours?.enCours) return res.status(409).json({ error: "Une recherche est déjà en cours pour cette fiche.", ...enCours });

    const auteur = req.utilisateur.prenom || req.utilisateur.email;
    const etat = { enCours: true, demarre: new Date().toISOString(), par: auteur, auto: req.body?.auto === true };
    recherches.set(id, etat);
    res.status(202).json(etat);

    try {
      const resultat = await rechercherContactAlternatif(req.entreprise);
      // La fiche a pu être archivée ou modifiée pendant la recherche : on
      // repart de l'objet à jour.
      const entreprise = findEntreprise(id);
      if (!entreprise) throw new Error("Fiche introuvable (archivée pendant la recherche ?).");
      Object.assign(etat, ajouterNumerosTrouves(entreprise, resultat, auteur, { ajouterEmailFiche }));
      marquerRechercheTelephone?.(entreprise, etat.nouveaux.length ? "trouve" : "introuvable");
      await db.write();
    } catch (e) {
      console.error(`[recherche-numeros] ${req.entreprise.nom} :`, e.message);
      etat.erreur = e.message;
      const entreprise = findEntreprise(id);
      if (entreprise) {
        marquerRechercheTelephone?.(entreprise, "erreur", e.message);
        await db.write().catch(() => {});
      }
    } finally {
      etat.enCours = false;
      etat.termine = new Date().toISOString();
    }
  });
}
