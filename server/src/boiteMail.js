// Boîte mail du CRM (page « 📬 Boîte mail ») : tous les e-mails envoyés et
// reçus au même endroit, sans quitter le CRM.
//
//  - Reçus : relevés dans la boîte du pôle (IMAP, voir relaverBoiteMail dans
//    mail.js). Un mail dont l'expéditeur correspond à une fiche (adresse
//    principale, secondaire, ou adresse à qui on a écrit) est rangé sur la
//    fiche ; les autres ne sont plus jetés mais gardés « à rattacher »
//    (visibles des administrateurs, qui les relient à une fiche en un clic).
//  - Envoyés : mails des agents et des campagnes, lus sur les fiches.
//  - Un agent ne voit que les mails des fiches qui lui sont visibles.
//  - Réponse « Désinscription » (lien mailto des campagnes) : l'adresse est
//    désinscrite automatiquement.
import { nanoid } from "nanoid";
import db from "./db.js";
import { estDesinscritOuDesinscrire } from "./campagnes.js";
import { estImapConfigure, adresseMailPole } from "./mail.js";

// État de la relève IMAP (affiché aux administrateurs dans la Boîte mail) :
// sans ça, une relève non branchée ou en échec ne se voyait nulle part.
export const etatReleve = { derniereTentative: null, derniereReussite: null, derniereErreur: null, recusDepuisDemarrage: 0 };

const PAR_PAGE = 50;
const norm = (a) => String(a || "").trim().toLowerCase();

function nonRattaches() {
  db.data.mailsNonRattaches = db.data.mailsNonRattaches || [];
  return db.data.mailsNonRattaches;
}

// Fiche (active, sinon archivée) à laquelle appartient une adresse.
export function trouverFicheExpediteur(adresse) {
  const a = norm(adresse);
  if (!a) return null;
  const correspond = (e) =>
    norm(e.contact?.email) === a ||
    (e.contact?.emailsAlternatifs || []).some((x) => norm(x.email) === a) ||
    (e.emails || []).some((m) => m.direction === "envoye" && (norm(m.a) === a || (m.cc || []).some((c) => norm(c) === a)));
  return db.data.entreprises.find(correspond) || db.data.archives?.find(correspond) || null;
}

// Appelé par la relève pour chaque mail reçu.
export function rangerMailRecu(mail) {
  etatReleve.recusDepuisDemarrage++;
  // Notifications envoyées par le CRM lui-même à la boîte du pôle (« CRM —
  // Fiche client », « CRM — Rendez-vous client »…) : déjà visibles dans le
  // CRM, on ne les range pas.
  if (norm(mail.de) === norm(adresseMailPole())) return "interne";
  const entree = {
    id: nanoid(),
    direction: "recu",
    de: mail.de,
    nomExpediteur: mail.nomExpediteur || null,
    objet: mail.objet,
    corps: mail.texte,
    date: mail.date,
    lu: false,
    messageId: mail.messageId,
  };
  // Réponse au lien « Se désinscrire » (mailto) d'une campagne.
  if (/d[ée]sinscri|unsubscribe/i.test(mail.objet || "")) {
    if (estDesinscritOuDesinscrire(mail.de, "réponse « Désinscription »")) entree.desinscription = true;
  }
  const fiche = trouverFicheExpediteur(mail.de);
  if (fiche) {
    fiche.emails = fiche.emails || [];
    if (mail.messageId && fiche.emails.some((m) => m.messageId === mail.messageId)) return fiche;
    fiche.emails.unshift(entree);
    return fiche;
  }
  if (mail.messageId && nonRattaches().some((m) => m.messageId === mail.messageId)) return null;
  nonRattaches().unshift(entree);
  // Garde-fou de taille : les 2 000 plus récents.
  if (nonRattaches().length > 2000) nonRattaches().length = 2000;
  return null;
}

function extrait(texte) {
  return String(texte || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function enregistrerRoutesBoiteMail(app, { exigerAuth, exigerAdmin, estAdmin, estVisiblePar, ajouterEmailFiche, releverMaintenant }) {
  app.post("/api/boite-mail/relever", exigerAdmin, async (req, res) => {
    if (!estImapConfigure()) return res.status(400).json({ error: "Relève non configurée sur le serveur (MAIL_IMAP_HOST, MAIL_USER, MAIL_PASSWORD)." });
    await releverMaintenant?.();
    res.json({ configuree: true, ...etatReleve });
  });

  // Liste : dossier = tous | recus | envoyes | non_lus | a_rattacher.
  app.get("/api/boite-mail", exigerAuth, (req, res) => {
    const u = req.utilisateur;
    const admin = estAdmin(u);
    const dossier = String(req.query.dossier || "recus");
    const q = norm(req.query.q);
    const page = Math.max(1, Number(req.query.page) || 1);

    let items = [];
    if (dossier === "a_rattacher") {
      if (!admin) return res.status(403).json({ error: "Réservé aux administrateurs." });
      items = nonRattaches().map((m) => ({ ...m, aRattacher: true }));
    } else {
      for (const e of db.data.entreprises) {
        if (!estVisiblePar(e, u)) continue;
        for (const m of e.emails || []) {
          if (dossier === "recus" && m.direction !== "recu") continue;
          if (dossier === "envoyes" && m.direction !== "envoye") continue;
          if (dossier === "non_lus" && !(m.direction === "recu" && !m.lu)) continue;
          items.push({ ...m, entrepriseId: e.id, entrepriseNom: e.nom });
        }
      }
      if (admin && (dossier === "recus" || dossier === "non_lus" || dossier === "tous")) {
        for (const m of nonRattaches()) {
          if (dossier === "non_lus" && m.lu) continue;
          items.push({ ...m, aRattacher: true });
        }
      }
    }
    if (q) {
      items = items.filter((m) =>
        [m.de, m.a, m.objet, m.entrepriseNom, m.nomExpediteur, m.corps].some((v) => norm(v).includes(q))
      );
    }
    items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const compteurs = { nonLus: 0, aRattacher: admin ? nonRattaches().filter((m) => !m.lu).length : 0 };
    for (const e of db.data.entreprises) {
      if (!estVisiblePar(e, u)) continue;
      for (const m of e.emails || []) if (m.direction === "recu" && !m.lu) compteurs.nonLus++;
    }
    compteurs.nonLus += compteurs.aRattacher;

    res.json({
      releve: admin ? { configuree: estImapConfigure(), ...etatReleve } : undefined,
      total: items.length,
      page,
      parPage: PAR_PAGE,
      compteurs,
      items: items.slice((page - 1) * PAR_PAGE, page * PAR_PAGE).map((m) => ({
        id: m.id,
        direction: m.direction,
        de: m.de,
        nomExpediteur: m.nomExpediteur || null,
        a: m.a || null,
        cc: m.cc || [],
        objet: m.objet,
        extrait: extrait(m.corps),
        corps: m.corps,
        date: m.date,
        lu: m.direction === "envoye" ? true : Boolean(m.lu),
        campagne: Boolean(m.campagneId),
        desinscription: Boolean(m.desinscription),
        entrepriseId: m.entrepriseId || null,
        entrepriseNom: m.entrepriseNom || null,
        aRattacher: Boolean(m.aRattacher),
      })),
    });
  });

  // Marque un mail lu (fiche visible, ou mail à rattacher pour un admin).
  app.post("/api/boite-mail/lu", exigerAuth, async (req, res) => {
    const { entrepriseId, mailId } = req.body;
    if (!entrepriseId) {
      if (!estAdmin(req.utilisateur)) return res.status(403).json({ error: "Réservé aux administrateurs." });
      const m = nonRattaches().find((x) => x.id === mailId);
      if (m) m.lu = true;
    } else {
      const e = db.data.entreprises.find((x) => x.id === entrepriseId);
      if (!e || !estVisiblePar(e, req.utilisateur)) return res.status(404).json({ error: "Fiche introuvable." });
      const m = (e.emails || []).find((x) => x.id === mailId);
      if (m) m.lu = true;
    }
    await db.write();
    res.json({ ok: true });
  });

  // Relie un mail « à rattacher » à une fiche : il rejoint le fil de la
  // fiche et l'adresse de l'expéditeur est ajoutée à ses contacts (les
  // prochains mails de cette personne y arriveront directement).
  app.post("/api/boite-mail/a-rattacher/:id/rattacher", exigerAdmin, async (req, res) => {
    const i = nonRattaches().findIndex((x) => x.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: "Mail introuvable." });
    const e = db.data.entreprises.find((x) => x.id === req.body.entrepriseId);
    if (!e) return res.status(404).json({ error: "Fiche introuvable." });
    const [m] = nonRattaches().splice(i, 1);
    e.emails = e.emails || [];
    e.emails.unshift({ ...m, lu: true });
    e.emails.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    e.contact = e.contact || {};
    ajouterEmailFiche(e.contact, m.de, `Ajoutée en rattachant un mail reçu (${req.utilisateur.prenom || req.utilisateur.email})`);
    await db.write();
    res.json({ ok: true, entrepriseId: e.id, entrepriseNom: e.nom });
  });

  // Supprime un mail « à rattacher » (publicité, spam, mail hors sujet).
  app.delete("/api/boite-mail/a-rattacher/:id", exigerAdmin, async (req, res) => {
    const i = nonRattaches().findIndex((x) => x.id === req.params.id);
    if (i !== -1) nonRattaches().splice(i, 1);
    await db.write();
    res.json({ ok: true });
  });
}
