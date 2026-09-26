import { nanoid } from "nanoid";

// Garde-fous sur les champs de contact d'une entreprise : un agent qui saisit
// vite pendant un appel peut taper un e-mail dans le champ "numéro", ou un
// numéro dans le champ "nom" du contact. Sans correction, le bandeau ☎ de la
// fiche affiche alors un e-mail comme numéro (lien tel: inutilisable) et le
// vrai numéro reste invisible, enfoui dans le nom du contact.

// Numéro saisi à la main : chiffres, espaces, points, tirets, parenthèses,
// barre oblique, "+" — entre 8 et 15 chiffres (10 en France, jusqu'à 15 en
// international), aucune lettre.
export function estNumeroTelephone(valeur) {
  if (typeof valeur !== "string") return false;
  const v = valeur.trim();
  if (!/^[+\d\s.()\-/]+$/.test(v)) return false;
  const chiffres = v.replace(/\D/g, "").length;
  return chiffres >= 8 && chiffres <= 15;
}

// Numéro principal exploitable, même saisi librement ("01 23 45 67 89 poste
// 3") : on ne l'écrase jamais, un nouveau numéro va alors en alternatif.
function aUnNumeroPrincipal(contact) {
  const t = String(contact.telephone || "");
  return !t.includes("@") && t.replace(/\D/g, "").length >= 8;
}

function estEmail(valeur) {
  return typeof valeur === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur.trim());
}

function ajouterEmail(contact, email, note) {
  const propre = email.trim();
  const connus = [contact.email, ...(contact.emailsAlternatifs || []).map((e) => e.email)]
    .filter(Boolean)
    .map((e) => e.toLowerCase());
  if (connus.includes(propre.toLowerCase())) return;
  if (!contact.email) {
    contact.email = propre;
  } else {
    contact.emailsAlternatifs = [
      ...(contact.emailsAlternatifs || []),
      { id: nanoid(), email: propre, note, dateAjout: new Date().toISOString() },
    ];
  }
}

function ajouterNumero(contact, numero, note) {
  const chiffres = numero.replace(/\D/g, "");
  const connus = [contact.telephone, ...(contact.telephonesAlternatifs || []).map((t) => t.numero)]
    .filter(Boolean)
    .map((n) => String(n).replace(/\D/g, ""));
  if (connus.includes(chiffres)) return;
  if (!aUnNumeroPrincipal(contact)) {
    contact.telephone = numero.trim();
    contact.telephoneInvalide = false;
  } else {
    contact.telephonesAlternatifs = [
      ...(contact.telephonesAlternatifs || []),
      { id: nanoid(), numero: numero.trim(), note, dateAjout: new Date().toISOString() },
    ];
  }
}

// Remet chaque information à sa place, sans jamais rien perdre. Retourne
// true si le contact a été modifié.
export function reparerChampsContact(contact) {
  if (!contact || typeof contact !== "object") return false;
  const avant = JSON.stringify(contact);

  // E-mail saisi comme numéro principal → rangé dans les e-mails.
  if (estEmail(contact.telephone)) {
    const email = contact.telephone;
    contact.telephone = "";
    ajouterEmail(contact, email, "Déplacé depuis le champ téléphone");
  }
  // Idem pour les numéros alternatifs.
  if (Array.isArray(contact.telephonesAlternatifs)) {
    const emails = contact.telephonesAlternatifs.filter((t) => estEmail(t?.numero));
    if (emails.length) {
      contact.telephonesAlternatifs = contact.telephonesAlternatifs.filter((t) => !estEmail(t?.numero));
      for (const t of emails) ajouterEmail(contact, t.numero, t.note || "Déplacé depuis les numéros");
    }
  }

  // Numéro saisi comme nom du contact principal → rangé dans les numéros.
  if (estNumeroTelephone(contact.nom)) {
    const numero = contact.nom;
    contact.nom = "";
    ajouterNumero(contact, numero, contact.fonction || "Déplacé depuis le nom du contact");
  }

  // Plus de numéro principal valide mais un alternatif l'est : il est promu,
  // pour que le bandeau ☎ de la fiche affiche toujours un numéro appelable.
  if (!String(contact.telephone || "").trim() && Array.isArray(contact.telephonesAlternatifs)) {
    const valide = contact.telephonesAlternatifs.find((t) => estNumeroTelephone(t?.numero));
    if (valide) {
      contact.telephone = valide.numero;
      contact.telephoneInvalide = false;
      contact.telephonesAlternatifs = contact.telephonesAlternatifs.filter((t) => t !== valide);
    }
  }

  return JSON.stringify(contact) !== avant;
}
