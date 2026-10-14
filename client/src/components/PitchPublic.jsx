import { useIdentiteActuelle } from "../identite.js";

// Argumentaire et script pour les employeurs PUBLICS (collecteur FIPHFP) :
// affichés à la place de ceux du privé quand la fiche ouverte est publique
// (voir PanelOutilsVente.jsx). Différences clés avec le privé : on parle
// d'« agents » et de « structure », la contribution est versée au FIPHFP
// lors de la déclaration annuelle (pas de DSN, pas d'URSSAF, pas
// d'AGEFIPH), et les interlocuteurs sont la DRH, le DGS ou le référent
// handicap. Le pôle ne se présente jamais comme le FIPHFP lui-même.
// Rédaction prudente et générale, à faire valider par l'équipe.

const ARGUMENTAIRE = [
  {
    titre: "Qui appelle-t-on ?",
    points: [
      "Employeurs publics d'au moins 20 agents (en équivalent temps plein) : mairies, communautés de communes, départements, régions, hôpitaux, EHPAD publics, établissements publics.",
      "Interlocuteurs : DRH / service RH, DGS (directeur général des services) en mairie, référent handicap s'il existe.",
    ],
  },
  {
    titre: "La règle",
    points: [
      "Même obligation que dans le privé : au moins 6 % de bénéficiaires de l'obligation d'emploi (agents RQTH, etc.).",
      "À défaut, la structure verse une contribution au FIPHFP (Fonds pour l'insertion des personnes handicapées dans la fonction publique), lors de sa déclaration annuelle.",
      "⚠️ Pas de DSN, pas d'URSSAF, pas d'AGEFIPH pour un employeur public : ne jamais en parler.",
    ],
  },
  {
    titre: "Nos leviers pour réduire la contribution",
    points: [
      "Recenser les bénéficiaires déjà présents : un handicap n'est pas toujours visible ni déclaré (agents RQTH, reclassés, etc.).",
      "Recrutement et apprentissage de personnes en situation de handicap.",
      "Maintien dans l'emploi : aménagements de poste, que le FIPHFP peut aider à financer.",
      "Achats auprès d'ESAT, d'entreprises adaptées ou de travailleurs indépendants handicapés (TIH).",
    ],
  },
  {
    titre: "Vocabulaire",
    points: [
      "« agents » (pas « salariés »), « structure » ou « collectivité » (pas « entreprise »), « déclaration annuelle au FIPHFP » (pas « DSN »).",
      "Nous sommes un pôle qui accompagne les employeurs publics : nous ne sommes pas le FIPHFP et ne réclamons aucun paiement.",
    ],
  },
];

const SCRIPT = [
  {
    titre: "1. Standard / accueil",
    lignes: [
      { type: "instruction", texte: "Mairie ou collectivité : demander le service RH, sinon le DGS. Hôpital / EHPAD public : la DRH." },
      {
        type: "texte",
        texte:
          "« Bonjour, c'est [Prénom], du pôle OETH. Je souhaiterais parler à la personne en charge des ressources humaines — ou au référent handicap — au sujet de l'obligation d'emploi des travailleurs handicapés de votre structure. Pouvez-vous me la passer, s'il vous plaît ? »",
      },
    ],
  },
  {
    titre: "2. Accroche (RH / DGS)",
    lignes: [
      {
        type: "texte",
        texte:
          "« Bonjour, c'est [Prénom], du pôle OETH. Je vous appelle au sujet de l'obligation d'emploi des travailleurs handicapés : comme tout employeur public d'au moins 20 agents, votre structure doit compter 6 % de bénéficiaires ; à défaut, une contribution est versée au FIPHFP lors de la déclaration annuelle. Je souhaitais faire le point avec vous sur votre situation et sur les moyens de la réduire. »",
      },
    ],
  },
  {
    titre: "3. Questions de découverte",
    lignes: [
      { type: "texte", texte: "« Combien d'agents compte votre structure aujourd'hui ? »" },
      { type: "texte", texte: "« Combien de bénéficiaires de l'obligation d'emploi avez-vous déclarés l'an dernier ? »" },
      { type: "texte", texte: "« Avez-vous versé une contribution au FIPHFP lors de votre dernière déclaration ? »" },
      { type: "texte", texte: "« Travaillez-vous déjà avec un ESAT ou une entreprise adaptée (espaces verts, restauration, entretien…) ? »" },
      { type: "instruction", texte: "Noter les chiffres dans la fiche (effectif, RQTH) : l'estimation se met à jour." },
    ],
  },
  {
    titre: "4. Proposition",
    lignes: [
      {
        type: "texte",
        texte:
          "« Nous pouvons vous aider à recenser les bénéficiaires déjà présents, à mobiliser les aides du FIPHFP pour le maintien dans l'emploi, et à orienter une partie de vos achats vers des ESAT ou des entreprises adaptées — ce qui réduit la contribution. Un échange de 15 minutes suffit pour faire le point. »",
      },
    ],
  },
  {
    titre: "5. Clôture",
    lignes: [
      {
        type: "texte",
        texte:
          "« Je vous propose un rendez-vous téléphonique avec un conseiller : quel créneau vous conviendrait ? Je vous envoie aussi un récapitulatif par e-mail. »",
      },
      { type: "instruction", texte: "Envoyer le modèle « Public » depuis la boîte mail de la fiche, et poser le RDV ou le rappel." },
    ],
  },
];

export function ArgumentairePublic() {
  return (
    <div className="space-y-4 text-sm">
      {ARGUMENTAIRE.map((s) => (
        <div key={s.titre}>
          <h3 className="font-semibold text-indigo-800 dark:text-indigo-300 mb-1.5">{s.titre}</h3>
          <ul className="space-y-1.5">
            {s.points.map((p, i) => (
              <li key={i} className="text-slate-700 dark:text-slate-200 leading-relaxed flex gap-2">
                <span className="text-indigo-500 shrink-0">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function ScriptPublic() {
  const { prenom } = useIdentiteActuelle();
  const perso = (t) => t.replaceAll("[Prénom]", prenom);
  return (
    <div className="space-y-5 text-sm">
      {SCRIPT.map((s) => (
        <div key={s.titre}>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">{s.titre}</h3>
          <div className="space-y-2">
            {s.lignes.map((l, i) =>
              l.type === "instruction" ? (
                <p key={i} className="text-xs italic text-amber-700 dark:text-amber-400 flex gap-1.5">
                  <span aria-hidden>🎯</span>
                  <span>{perso(l.texte)}</span>
                </p>
              ) : (
                <p
                  key={i}
                  className="text-slate-700 dark:text-slate-200 leading-relaxed bg-indigo-50/60 dark:bg-indigo-950/30 border-l-2 border-indigo-400 rounded-r-md px-3 py-2"
                >
                  {perso(l.texte)}
                </p>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
