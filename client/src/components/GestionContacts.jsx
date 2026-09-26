import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { estNumeroTelephone, estNumeroAffichable } from "../telephone.js";
import { jouerSonConfirmation } from "../sonConfirmation.js";

function idUnique() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Gestion à chaud de plusieurs contacts nommés pour une même entreprise —
// même convention que GestionTelephones.jsx (contact "principal" + liste
// d'alternatifs promouvables), pour que l'agent puisse enrichir la fiche
// pendant un appel sans naviguer ailleurs : un standard donne souvent un nom
// différent à chaque appel (accueil, RH, dirigeant...).
//
// Suppression réservée aux administrateurs : un agent peut ajouter/modifier
// librement, mais seul un admin voit le bouton "×" qui retire une entrée —
// restriction purement d'interface (même modèle de confiance que le reste de
// ce CRM interne : pas d'application côté serveur, l'API PATCH accepte déjà
// n'importe quelle modification du dossier par l'agent qui y a accès).
export default function GestionContacts({ entreprise, onMaj }) {
  const { utilisateur } = useAuth();
  const estAdmin = utilisateur?.role === "admin";
  const [nomPrincipal, setNomPrincipal] = useState(entreprise.contact?.nom || "");
  const [fonctionPrincipal, setFonctionPrincipal] = useState(entreprise.contact?.fonction || "");
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouvelleFonction, setNouvelleFonction] = useState("");
  const [edition, setEdition] = useState(null); // { id, nom, fonction }
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [info, setInfo] = useState(null);

  const contact = entreprise.contact || {};
  const alternatifs = contact.contactsAlternatifs || [];

  async function sauvegarderContact(partiel) {
    setEnCours(true);
    setErreur(null);
    try {
      const updated = await api.patchEntreprise(entreprise.id, { contact: { ...contact, ...partiel } });
      onMaj?.(updated);
      return updated;
    } catch (e) {
      setErreur(e.message);
      return null;
    } finally {
      setEnCours(false);
    }
  }

  // Numéro de téléphone saisi dans un champ "Nom" (réflexe fréquent pendant
  // un appel) : rangé là où il sert, c'est-à-dire comme numéro principal
  // s'il n'y en a pas encore — il s'affiche alors dans le bandeau ☎ en haut
  // de la fiche —, sinon comme numéro alternatif. Rien n'est perdu.
  function champsPourNumero(numero, note) {
    if (!estNumeroAffichable(contact.telephone)) {
      return { telephone: numero, telephoneInvalide: false };
    }
    const dejaConnu = [contact.telephone, ...(contact.telephonesAlternatifs || []).map((t) => t.numero)].some(
      (n) => String(n || "").replace(/\D/g, "") === numero.replace(/\D/g, "")
    );
    if (dejaConnu) return {};
    return {
      telephonesAlternatifs: [
        ...(contact.telephonesAlternatifs || []),
        { id: idUnique(), numero, note, dateAjout: new Date().toISOString() },
      ],
    };
  }

  function messageNumeroRange(numero, champs) {
    return champs.telephone
      ? `📞 « ${numero} » est un numéro de téléphone : enregistré comme numéro principal (en haut de la fiche).`
      : `📞 « ${numero} » est un numéro de téléphone : ajouté aux numéros de la fiche.`;
  }

  async function soumettrePrincipal(ev) {
    ev.preventDefault();
    setInfo(null);
    const saisie = nomPrincipal.trim();
    if (estNumeroTelephone(saisie)) {
      const champs = champsPourNumero(saisie, fonctionPrincipal.trim());
      const updated = await sauvegarderContact({ ...champs, fonction: fonctionPrincipal.trim() });
      if (updated) {
        jouerSonConfirmation();
        setInfo(messageNumeroRange(saisie, champs));
        const nomActuel = updated.contact?.nom;
        setNomPrincipal(nomActuel && nomActuel !== "-" ? nomActuel : "");
      }
      return;
    }
    await sauvegarderContact({ nom: saisie, fonction: fonctionPrincipal.trim() });
  }

  async function ajouter(ev) {
    ev.preventDefault();
    if (!nouveauNom.trim()) return;
    setInfo(null);
    if (estNumeroTelephone(nouveauNom.trim())) {
      const numero = nouveauNom.trim();
      const champs = champsPourNumero(numero, nouvelleFonction.trim());
      const updated = await sauvegarderContact(champs);
      if (updated) {
        jouerSonConfirmation();
        setInfo(messageNumeroRange(numero, champs));
        setNouveauNom("");
        setNouvelleFonction("");
      }
      return;
    }
    const nouvelleEntree = {
      id: idUnique(),
      nom: nouveauNom.trim(),
      fonction: nouvelleFonction.trim(),
      dateAjout: new Date().toISOString(),
    };
    const updated = await sauvegarderContact({ contactsAlternatifs: [...alternatifs, nouvelleEntree] });
    if (updated) {
      setNouveauNom("");
      setNouvelleFonction("");
    }
  }

  async function enregistrerEdition() {
    const suivant = alternatifs.map((c) => (c.id === edition.id ? { ...c, nom: edition.nom.trim(), fonction: edition.fonction.trim() } : c));
    const updated = await sauvegarderContact({ contactsAlternatifs: suivant });
    if (updated) setEdition(null);
  }

  function definirCommePrincipal(alt) {
    const ancienPrincipal = contact.nom ? { id: idUnique(), nom: contact.nom, fonction: contact.fonction || "", dateAjout: new Date().toISOString() } : null;
    const autres = alternatifs.filter((c) => c.id !== alt.id);
    sauvegarderContact({
      nom: alt.nom,
      fonction: alt.fonction || "",
      contactsAlternatifs: ancienPrincipal ? [...autres, ancienPrincipal] : autres,
    });
    setNomPrincipal(alt.nom);
    setFonctionPrincipal(alt.fonction || "");
  }

  function retirer(alt) {
    sauvegarderContact({ contactsAlternatifs: alternatifs.filter((c) => c.id !== alt.id) });
  }

  return (
    <div className="space-y-2">
      <form onSubmit={soumettrePrincipal} className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500 dark:text-slate-400 flex-1 min-w-[120px]">
          Nom (principal)
          <input
            type="text"
            value={nomPrincipal}
            onChange={(e) => setNomPrincipal(e.target.value)}
            placeholder="Ex : Mme Dupont"
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400 flex-1 min-w-[100px]">
          Poste / rôle
          <input
            type="text"
            value={fonctionPrincipal}
            onChange={(e) => setFonctionPrincipal(e.target.value)}
            placeholder="Ex : RH"
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={enCours}
          className="rounded-lg bg-marine-800 hover:bg-marine-900 text-white text-xs font-medium px-3 py-[7px] disabled:opacity-40"
        >
          Enregistrer
        </button>
      </form>

      {alternatifs.length > 0 && (
        <ul className="space-y-1">
          {alternatifs.map((c) =>
            edition?.id === c.id ? (
              <li key={c.id} className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5">
                <input
                  type="text"
                  autoFocus
                  value={edition.nom}
                  onChange={(e) => setEdition({ ...edition, nom: e.target.value })}
                  className="w-28 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 text-xs"
                />
                <input
                  type="text"
                  value={edition.fonction}
                  onChange={(e) => setEdition({ ...edition, fonction: e.target.value })}
                  placeholder="Poste"
                  className="w-24 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 text-xs"
                />
                <button type="button" onClick={enregistrerEdition} className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline">
                  OK
                </button>
                <button type="button" onClick={() => setEdition(null)} className="text-[11px] text-slate-400 hover:underline">
                  Annuler
                </button>
              </li>
            ) : (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5"
              >
                <span className="text-slate-600 dark:text-slate-300 truncate">
                  {c.nom}
                  {c.fonction ? ` — ${c.fonction}` : ""}
                </span>
                <span className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEdition({ id: c.id, nom: c.nom, fonction: c.fonction || "" })}
                    className="text-slate-400 hover:text-marine-700 dark:hover:text-marine-300 px-1"
                    title="Modifier"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => definirCommePrincipal(c)}
                    className="rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 hover:bg-amber-200 dark:hover:bg-amber-900"
                  >
                    Principal
                  </button>
                  {estAdmin && (
                    <button
                      type="button"
                      onClick={() => retirer(c)}
                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 px-1"
                      title="Retirer ce contact"
                    >
                      ×
                    </button>
                  )}
                </span>
              </li>
            )
          )}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Nom du contact"
          value={nouveauNom}
          onChange={(e) => setNouveauNom(e.target.value)}
          className="flex-1 min-w-[120px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
        />
        <input
          type="text"
          placeholder="Poste (optionnel)"
          value={nouvelleFonction}
          onChange={(e) => setNouvelleFonction(e.target.value)}
          className="w-28 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={ajouter}
          disabled={!nouveauNom.trim() || enCours}
          className="rounded-lg bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium px-3 py-1.5 disabled:opacity-40 whitespace-nowrap"
        >
          {enCours ? "Ajout…" : "+ Ajouter un contact"}
        </button>
      </div>

      {info && (
        <p className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg px-2.5 py-1.5">
          {info}
        </p>
      )}

      {erreur && (
        <p className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg px-2.5 py-1.5">
          {erreur}
        </p>
      )}
    </div>
  );
}
