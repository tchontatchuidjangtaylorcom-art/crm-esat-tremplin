const BASE = "/api";

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  listEntreprises: () => fetch(`${BASE}/entreprises`).then(handle),

  listCategories: () => fetch(`${BASE}/categories`).then(handle),

  getStatutIA: () => fetch(`${BASE}/ia/statut`).then(handle),

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

  listArchives: () => fetch(`${BASE}/archives`).then(handle),

  assignerEntreprise: (id, utilisateurId) =>
    fetch(`${BASE}/entreprises/${id}/assigner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utilisateurId: utilisateurId || null }),
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

  getArgumentaireAgefiph: () => fetch(`${BASE}/argumentaire-agefiph`).then(handle),

  getScriptVente: () => fetch(`${BASE}/script-vente`).then(handle),

  getModelesMails: () => fetch(`${BASE}/modeles-mails`).then(handle),

  getStatutMail: () => fetch(`${BASE}/emails/statut`).then(handle),

  getEmailsNonLus: () => fetch(`${BASE}/emails/non-lus`).then(handle),

  marquerEmailsLus: (id) => fetch(`${BASE}/entreprises/${id}/emails/lu`, { method: "POST" }).then(handle),

  envoyerEmail: (id, { objet, corps, joindrePdf = true }) =>
    fetch(`${BASE}/entreprises/${id}/emails/envoyer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objet, corps, joindrePdf }),
    }).then(handle),

  getAuthConfig: () => fetch(`${BASE}/auth/config`).then(handle),

  demanderLien: (email) =>
    fetch(`${BASE}/auth/demander-lien`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
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

  validerUtilisateur: (id, role) =>
    fetch(`${BASE}/utilisateurs/${id}/valider`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }).then(handle),

  refuserUtilisateur: (id) => fetch(`${BASE}/utilisateurs/${id}/refuser`, { method: "POST" }).then(handle),
};
