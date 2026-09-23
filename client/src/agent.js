// Identité de l'agent actuellement connecté au CRM.
//
// En dur pour l'instant : l'authentification multi-agent (inscription,
// validation par un admin, sessions) n'est pas encore branchée — ce fichier
// est le point unique à remplacer par la session réelle le jour où elle
// existe, sans avoir à chercher chaque usage un par un (UserMenu, script de
// vente, auteur des commentaires…).
export const AGENT_ACTUEL = {
  prenom: "Philippe",
  nom: "Tchams",
  role: "Télépro",
  bureau: "BUREAU HAYAT&CO",
};
