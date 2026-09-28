const BASE = "/api";

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // 502/503/504 sans message de notre API : c'est l'hébergeur (Render) qui
    // répond à la place du serveur, le temps qu'il redémarre (déploiement ou
    // relance automatique) — quelques dizaines de secondes en général.
    if (!body.error && [502, 503, 504].includes(res.status)) {
      const erreur = new Error(
        "Le serveur redémarre (mise à jour ou relance automatique) — réessayez dans une trentaine de secondes."
      );
      erreur.code = "SERVEUR_INDISPONIBLE";
      throw erreur;
    }
    const erreur = new Error(body.error || `Erreur HTTP ${res.status}`);
    erreur.code = body.code;
    // Crédit de l'API Claude épuisé : affiche le bandeau de recharge
    // (voir AlerteCreditsIA.jsx), quel que soit l'écran qui a déclenché l'appel.
    if (body.lienRecharge) {
      erreur.lienRecharge = body.lienRecharge;
      window.dispatchEvent(new CustomEvent("ia:credits-epuises", { detail: { lien: body.lienRecharge, message: body.error } }));
    }
    throw erreur;
  }
  return res.json();
}

// Requêtes en lecture seule : si le serveur est en train de redémarrer, on
// patiente et on réessaie automatiquement plutôt que d'afficher une erreur.
async function avecReprise(appel, { tentatives = 3, delaiMs = 8000 } = {}) {
  for (let essai = 0; ; essai++) {
    try {
      return await appel();
    } catch (e) {
      if (e.code !== "SERVEUR_INDISPONIBLE" || essai >= tentatives) throw e;
      await new Promise((resolve) => setTimeout(resolve, delaiMs));
    }
  }
}

export const api = {
  listEntreprises: (commeAgentId) =>
    fetch(`${BASE}/entreprises${commeAgentId ? `?commeAgentId=${commeAgentId}` : ""}`).then(handle),

  listCategories: () => fetch(`${BASE}/categories`).then(handle),

  getStatutIA: () => fetch(`${BASE}/ia/statut`).then(handle),

  getModelesDisponiblesIA: () => fetch(`${BASE}/ia/modeles-disponibles`).then(handle),

  getEntreprise: (id) => fetch(`${BASE}/entreprises/${id}`).then(handle),

  patchEntreprise: (id, data) =>
    fetch(`${BASE}/entreprises/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handle),

  enregistrerAppel: (id, { issue, date, details, dureeSecondes }) =>
    fetch(`${BASE}/entreprises/${id}/appels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issue, date, details, dureeSecondes }),
    }).then(handle),

  enregistrerSortie: (id, { sortie, details, dureeSecondes }) =>
    fetch(`${BASE}/entreprises/${id}/sortie`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortie, details, dureeSecondes }),
    }).then(handle),

  ajouterCommentaire: (id, { texte, auteur }) =>
    fetch(`${BASE}/entreprises/${id}/commentaires`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texte, auteur }),
    }).then(handle),

  rechercherSiren: (siren, lot) =>
    fetch(`${BASE}/leads/siren`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siren, lot: lot || null }),
    }).then(handle),

  importerLot: (lot, sirens, assigneA) =>
    fetch(`${BASE}/leads/siren/lot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lot, sirens, assigneA: assigneA || null }),
    }).then(handle),

  // Recherche seule (rien n'est créé côté serveur) : réessai automatique
  // pendant un redémarrage du serveur.
  rechercherProspectsParSecteur: (categorie, { departement, limite } = {}) =>
    avecReprise(() =>
      fetch(`${BASE}/leads/secteur/rechercher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorie, departement: departement || null, limite }),
      }).then(handle)
    ),

  importerProspectsParSecteur: (categorie, lot, sirens, assigneA, rechercheTelephoneIA = true) =>
    fetch(`${BASE}/leads/secteur/importer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorie, lot, sirens, assigneA: assigneA || null, rechercheTelephoneIA }),
    }).then(handle),

  getDemandeLeads: () => fetch(`${BASE}/leads/demande`).then(handle),
  demanderLeads: (categorie, departement) =>
    fetch(`${BASE}/leads/demande`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorie: categorie || null, departement: departement || null }),
    }).then(handle),

  lancerEnrichissementTelephones: (inclureDejaTentees = false) =>
    fetch(`${BASE}/leads/enrichir-telephones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inclureDejaTentees }),
    }).then(handle),

  getStatutEnrichissementTelephones: () => fetch(`${BASE}/leads/enrichir-telephones/statut`).then(handle),

  listLots: () => fetch(`${BASE}/lots`).then(handle),

  listArchives: (commeAgentId) =>
    fetch(`${BASE}/archives${commeAgentId ? `?commeAgentId=${commeAgentId}` : ""}`).then(handle),

  assignerEntreprise: (id, utilisateurId) =>
    fetch(`${BASE}/entreprises/${id}/assigner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utilisateurId: utilisateurId || null }),
    }).then(handle),

  assignerGroupe: (ids, utilisateurId) =>
    fetch(`${BASE}/entreprises/assigner-groupe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, utilisateurId: utilisateurId || null }),
    }).then(handle),

  changerStatutGroupe: (ids, statut) =>
    fetch(`${BASE}/entreprises/statut-groupe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, statut }),
    }).then(handle),

  assignerLot: (lot, utilisateurId) =>
    fetch(`${BASE}/lots/${encodeURIComponent(lot)}/assigner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utilisateurId: utilisateurId || null }),
    }).then(handle),

  signalerTelephoneInvalide: (id) =>
    fetch(`${BASE}/entreprises/${id}/telephone-invalide`, { method: "POST" }).then(handle),

  rechercherContactAlternatif: (id) =>
    fetch(`${BASE}/entreprises/${id}/rechercher-contact`, { method: "POST" }).then(handle),

  poserQuestionContactIA: (id, question) =>
    fetch(`${BASE}/entreprises/${id}/question-contact-ia`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }).then(handle),

  genererEmailIA: (id) => fetch(`${BASE}/entreprises/${id}/generer-email`, { method: "POST" }).then(handle),

  // Outil "ESAT Tremplin / TIH" du CRM (voir PanelEsatTremplin.jsx) : barème
  // de contribution par unité manquante, au SMIC actuel — même moteur que le
  // simulateur public et les fiches entreprise.
  getBaremeOeth: () => fetch(`${BASE}/oeth/bareme`).then(handle),

  // Assistant de questions "domaine" (bouton flottant au-dessus du chat
  // d'équipe, voir AssistantDomaineCrm.jsx) : question libre sur l'OETH, la
  // contribution/surcontribution, ESAT Tremplin ou TIH — sans lien avec une
  // entreprise précise.
  demanderAssistantDomaine: (question) =>
    fetch(`${BASE}/assistant-domaine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }).then(handle),

  analyserDicteeIA: (id, transcription) =>
    fetch(`${BASE}/entreprises/${id}/dictee-ia`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcription }),
    }).then(handle),

  getArgumentaireAgefiph: () => fetch(`${BASE}/argumentaire-agefiph`).then(handle),

  // Édition réservée aux super-administrateurs (voir exigerSuperAdmin côté
  // serveur) — les boutons correspondants ne s'affichent que pour ce rôle,
  // mais le serveur revalide de toute façon en cas d'appel direct.
  modifierArgumentaireAgefiph: (contenu) =>
    fetch(`${BASE}/argumentaire-agefiph`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contenu),
    }).then(handle),

  reinitialiserArgumentaireAgefiph: () => fetch(`${BASE}/argumentaire-agefiph/reinitialiser`, { method: "POST" }).then(handle),

  getScriptVente: () => fetch(`${BASE}/script-vente`).then(handle),

  modifierScriptVente: (sections) =>
    fetch(`${BASE}/script-vente`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections }),
    }).then(handle),

  reinitialiserScriptVente: () => fetch(`${BASE}/script-vente/reinitialiser`, { method: "POST" }).then(handle),

  getModelesMails: () => fetch(`${BASE}/modeles-mails`).then(handle),

  modifierModelesMails: (modeles) =>
    fetch(`${BASE}/modeles-mails`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modeles }),
    }).then(handle),

  reinitialiserModelesMails: () => fetch(`${BASE}/modeles-mails/reinitialiser`, { method: "POST" }).then(handle),

  // Public, sans authentification (landing page /vitrine).
  getVitrine: () => fetch(`${BASE}/vitrine`).then(handle),

  simulerObligationsOeth: (q) => fetch(`${BASE}/vitrine/simulation?q=${encodeURIComponent(q)}`).then(handle),

  // saisie : { effectif, boeth, coutMainOeuvreSousTraitance, nbEcap,
  // depensesDeductibles, aEmployeBoeth4Ans } — voir simulerContributionOeth.
  getReferentielVitrine: () => fetch(`${BASE}/vitrine/referentiel`).then(handle),

  // Page publique "Pilotage handicap" : rendez-vous expert et démo.
  getDisponibilitesRdv: () => fetch(`${BASE}/vitrine/rdv/disponibilites`).then(handle),

  reserverRdv: (donnees) =>
    fetch(`${BASE}/vitrine/rdv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(donnees),
    }).then(handle),

  getOptionsDemo: () => fetch(`${BASE}/vitrine/demo/options`).then(handle),

  signalerSollicitation: (donnees) =>
    fetch(`${BASE}/vitrine/vigilance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(donnees),
    }).then(handle),

  demanderDemo: (donnees) =>
    fetch(`${BASE}/vitrine/demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(donnees),
    }).then(handle),

  simulerContributionVitrine: (saisie) =>
    fetch(`${BASE}/vitrine/calculer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saisie),
    }).then(handle),

  telechargerSyntheseSimulation: async (saisie) => {
    const res = await fetch(`${BASE}/vitrine/synthese-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saisie),
    });
    if (!res.ok) await handle(res);
    return res.blob();
  },

  contacterConseillerVitrine: ({ nom, email, telephone, entreprise, message }) =>
    fetch(`${BASE}/vitrine/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, email, telephone, entreprise, message }),
    }).then(handle),

  getStatutMail: () => fetch(`${BASE}/emails/statut`).then(handle),

  getEmailsNonLus: () => fetch(`${BASE}/emails/non-lus`).then(handle),

  marquerEmailsLus: (id) => fetch(`${BASE}/entreprises/${id}/emails/lu`, { method: "POST" }).then(handle),

  envoyerEmail: (id, { objet, corps, joindrePdf = true, destinataire }) =>
    fetch(`${BASE}/entreprises/${id}/emails/envoyer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objet, corps, joindrePdf, destinataire }),
    }).then(handle),

  soumettreFicheProspection: (id, donnees) =>
    fetch(`${BASE}/entreprises/${id}/fiche-prospection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(donnees),
    }).then(handle),

  getAuthConfig: () => fetch(`${BASE}/auth/config`).then(handle),

  demanderLien: (email, { prenom, nom } = {}) =>
    fetch(`${BASE}/auth/demander-lien`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, prenom: prenom || "", nom: nom || "" }),
    }).then(handle),

  connexionMotDePasse: (email, motDePasse) =>
    fetch(`${BASE}/auth/connexion-mot-de-passe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, motDePasse }),
    }).then(handle),

  connexionGoogle: (idToken) =>
    fetch(`${BASE}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }).then(handle),

  getMoi: () => fetch(`${BASE}/auth/moi`).then(handle),

  deconnexion: () => fetch(`${BASE}/auth/deconnexion`, { method: "POST" }).then(handle),

  listUtilisateurs: () => fetch(`${BASE}/utilisateurs`).then(handle),

  creerUtilisateur: ({ email, prenom, nom, telephone, siret, role, motDePasse }) =>
    fetch(`${BASE}/utilisateurs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        prenom: prenom || "",
        nom: nom || "",
        telephone: telephone || "",
        siret: siret || "",
        role: role || "agent",
        motDePasse: motDePasse || "",
      }),
    }).then(handle),

  definirMotDePasse: (id, motDePasse) =>
    fetch(`${BASE}/utilisateurs/${id}/mot-de-passe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motDePasse: motDePasse || "" }),
    }).then(handle),

  renvoyerLien: (id) => fetch(`${BASE}/utilisateurs/${id}/renvoyer-lien`, { method: "POST" }).then(handle),

  validerUtilisateur: (id, role) =>
    fetch(`${BASE}/utilisateurs/${id}/valider`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }).then(handle),

  refuserUtilisateur: (id) => fetch(`${BASE}/utilisateurs/${id}/refuser`, { method: "POST" }).then(handle),

  supprimerUtilisateur: (id) => fetch(`${BASE}/utilisateurs/${id}`, { method: "DELETE" }).then(handle),

  listCollegues: () => fetch(`${BASE}/utilisateurs/collegues`).then(handle),

  listCanauxChat: () => fetch(`${BASE}/chat/canaux`).then(handle),

  listMessagesChat: (canalId) => fetch(`${BASE}/chat/canaux/${canalId}/messages`).then(handle),

  envoyerMessageChat: (canalId, texte) =>
    fetch(`${BASE}/chat/canaux/${canalId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texte }),
    }).then(handle),

  marquerCanalLu: (canalId) => fetch(`${BASE}/chat/canaux/${canalId}/lu`, { method: "POST" }).then(handle),

  creerGroupeChat: (nom, membres) =>
    fetch(`${BASE}/chat/groupes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, membres }),
    }).then(handle),

  ouvrirConversationPrivee: (utilisateurId) =>
    fetch(`${BASE}/chat/prive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utilisateurId }),
    }).then(handle),

  getNotifications: (commeAgentId) =>
    fetch(`${BASE}/notifications${commeAgentId ? `?commeAgentId=${commeAgentId}` : ""}`).then(handle),

  envoyerBattementPresence: () => fetch(`${BASE}/presence/battement`, { method: "POST" }).then(handle),

  getMesKpisPresence: ({ semaine = 0, commeAgentId } = {}) => {
    const params = new URLSearchParams({ semaine: String(semaine) });
    if (commeAgentId) params.set("commeAgentId", commeAgentId);
    return fetch(`${BASE}/presence/moi?${params}`).then(handle);
  },

  getKpisEquipePresence: ({ semaine = 0 } = {}) =>
    fetch(`${BASE}/presence/equipe?semaine=${semaine}`).then(handle),
};
