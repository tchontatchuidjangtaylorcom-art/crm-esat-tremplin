const BASE = "/api";

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur HTTP ${res.status}`);
  }
  return res.json();
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

  rechercherProspectsParSecteur: (categorie, { departement, limite } = {}) =>
    fetch(`${BASE}/leads/secteur/rechercher`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorie, departement: departement || null, limite }),
    }).then(handle),

  importerProspectsParSecteur: (categorie, lot, sirens, assigneA, rechercheTelephoneIA = true) =>
    fetch(`${BASE}/leads/secteur/importer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorie, lot, sirens, assigneA: assigneA || null, rechercheTelephoneIA }),
    }).then(handle),

  lancerEnrichissementTelephones: () =>
    fetch(`${BASE}/leads/enrichir-telephones`, { method: "POST" }).then(handle),

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

  analyserDicteeIA: (id, transcription) =>
    fetch(`${BASE}/entreprises/${id}/dictee-ia`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcription }),
    }).then(handle),

  getArgumentaireAgefiph: () => fetch(`${BASE}/argumentaire-agefiph`).then(handle),

  getScriptVente: () => fetch(`${BASE}/script-vente`).then(handle),

  getModelesMails: () => fetch(`${BASE}/modeles-mails`).then(handle),

  // Public, sans authentification (landing page /vitrine).
  getVitrine: () => fetch(`${BASE}/vitrine`).then(handle),

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

  demanderLien: (email) =>
    fetch(`${BASE}/auth/demander-lien`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
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
};
