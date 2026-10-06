import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm";
const bouton = "rounded-lg bg-marine-700 hover:bg-marine-800 text-white text-sm font-medium px-4 py-2 disabled:opacity-50";

async function appel(url, corps) {
  const res = await fetch(url, corps ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) } : undefined);
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Erreur HTTP ${res.status}`);
  return d;
}

function Message({ m }) {
  if (!m) return null;
  return <p className={`text-xs ${m.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{m.texte}</p>;
}

// « Mon compte » (clic sur son nom en haut du CRM) : nom, adresse e-mail de
// connexion et mot de passe — voir server/src/monCompte.js.
export default function MonCompte({ onFermer }) {
  const [compte, setCompte] = useState(null);
  const [profil, setProfil] = useState({ prenom: "", nom: "" });
  const [email, setEmail] = useState({ email: "", motDePasse: "" });
  const [mdp, setMdp] = useState({ actuel: "", nouveau: "", confirmation: "" });
  const [messages, setMessages] = useState({});
  const [enCours, setEnCours] = useState(null);
  const [aRecharger, setARecharger] = useState(false);

  useEffect(() => {
    appel("/api/moi/compte")
      .then((c) => {
        setCompte(c);
        setProfil({ prenom: c.prenom, nom: c.nom });
        setEmail({ email: c.email, motDePasse: "" });
      })
      .catch((e) => setMessages({ general: { texte: e.message } }));
  }, []);

  async function soumettre(cle, action) {
    setEnCours(cle);
    setMessages((m) => ({ ...m, [cle]: null }));
    try {
      const texte = await action();
      setMessages((m) => ({ ...m, [cle]: { ok: true, texte } }));
    } catch (e) {
      setMessages((m) => ({ ...m, [cle]: { texte: e.message } }));
    } finally {
      setEnCours(null);
    }
  }

  function fermer() {
    if (aRecharger) window.location.reload();
    else onFermer();
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4" onClick={fermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mon compte"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-5 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">👤 Mon compte</h2>
          <button type="button" onClick={fermer} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
            Fermer
          </button>
        </div>
        <Message m={messages.general} />
        {!compte ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : (
          <>
            <form
              className="space-y-2"
              onSubmit={(ev) => {
                ev.preventDefault();
                soumettre("profil", async () => {
                  await appel("/api/moi/profil", profil);
                  setARecharger(true);
                  return "Nom enregistré.";
                });
              }}
            >
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mon nom</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Prénom
                  <input value={profil.prenom} onChange={(e) => setProfil((p) => ({ ...p, prenom: e.target.value }))} className={champ} />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Nom
                  <input value={profil.nom} onChange={(e) => setProfil((p) => ({ ...p, nom: e.target.value }))} className={champ} />
                </label>
              </div>
              <button type="submit" disabled={enCours === "profil"} className={bouton}>
                Enregistrer le nom
              </button>
              <Message m={messages.profil} />
            </form>

            <form
              className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4"
              onSubmit={(ev) => {
                ev.preventDefault();
                soumettre("email", async () => {
                  const r = await appel("/api/moi/email", email);
                  setCompte((c) => ({ ...c, email: r.email }));
                  setEmail((x) => ({ ...x, motDePasse: "" }));
                  setARecharger(true);
                  return `Adresse enregistrée : connectez-vous désormais avec ${r.email}.`;
                });
              }}
            >
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mon adresse e-mail de connexion</p>
              <input type="email" required value={email.email} onChange={(e) => setEmail((x) => ({ ...x, email: e.target.value }))} className={champ} />
              {compte.aMotDePasse && (
                <label className="block text-xs text-slate-500 dark:text-slate-400">
                  Mot de passe actuel (pour confirmer)
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={email.motDePasse}
                    onChange={(e) => setEmail((x) => ({ ...x, motDePasse: e.target.value }))}
                    className={champ}
                  />
                </label>
              )}
              <button type="submit" disabled={enCours === "email" || email.email.trim().toLowerCase() === compte.email} className={bouton}>
                Changer l'adresse
              </button>
              <Message m={messages.email} />
            </form>

            <form
              className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (mdp.nouveau !== mdp.confirmation) {
                  setMessages((m) => ({ ...m, mdp: { texte: "Les deux nouveaux mots de passe ne sont pas identiques." } }));
                  return;
                }
                soumettre("mdp", async () => {
                  await appel("/api/moi/mot-de-passe", { actuel: mdp.actuel, nouveau: mdp.nouveau });
                  setMdp({ actuel: "", nouveau: "", confirmation: "" });
                  setCompte((c) => ({ ...c, aMotDePasse: true }));
                  return "Mot de passe enregistré.";
                });
              }}
            >
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {compte.aMotDePasse ? "Changer mon mot de passe" : "Créer un mot de passe"}
              </p>
              {!compte.aMotDePasse && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Vous vous connectez aujourd'hui par lien e-mail : un mot de passe vous permet aussi de vous connecter directement.
                </p>
              )}
              {compte.aMotDePasse && (
                <label className="block text-xs text-slate-500 dark:text-slate-400">
                  Mot de passe actuel
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={mdp.actuel}
                    onChange={(e) => setMdp((x) => ({ ...x, actuel: e.target.value }))}
                    className={champ}
                  />
                </label>
              )}
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Nouveau mot de passe (8 caractères minimum)
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={mdp.nouveau}
                  onChange={(e) => setMdp((x) => ({ ...x, nouveau: e.target.value }))}
                  className={champ}
                />
              </label>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Confirmer le nouveau mot de passe
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={mdp.confirmation}
                  onChange={(e) => setMdp((x) => ({ ...x, confirmation: e.target.value }))}
                  className={champ}
                />
              </label>
              <button type="submit" disabled={enCours === "mdp"} className={bouton}>
                Enregistrer le mot de passe
              </button>
              <Message m={messages.mdp} />
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
