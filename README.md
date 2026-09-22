# CRM OETH / AGEFIPH

Application de gestion des dossiers OETH / AGEFIPH : tableau de bord avec
compteurs de statuts, liste des entreprises, et fiche entreprise avec module
d'appel "AGIR".

## Stack technique

- **Frontend** : React 18 + Vite + Tailwind CSS (SPA rapide, hot-reload instantané)
- **Backend** : Node.js + Express (API REST)
- **Stockage** : `lowdb` (base JSON locale, fichier `server/data/db.json`) —
  aucune compilation native requise, s'installe sans souci sous Windows.
  Migration future possible vers PostgreSQL/SQLite sans changer le frontend.

## Structure du projet

```
crm-oeth-agefip/
├── package.json          # scripts racine (lance client + serveur ensemble)
├── server/
│   ├── package.json
│   ├── data/db.json       # généré automatiquement au 1er lancement (jeu de données de test)
│   └── src/
│       ├── index.js       # API Express (routes REST)
│       ├── db.js          # connexion lowdb
│       ├── seed.js        # données de test (HAYAT&CO + 5 exemples)
│       ├── oeth.js        # moteur de calcul de l'obligation OETH (UB, déficit, montant)
│       └── secteurs.js    # classification des secteurs + argumentaire par catégorie
└── client/
    ├── package.json
    ├── vite.config.js     # proxy /api -> http://localhost:4000
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx         # routage + CallProvider/CallPanel globaux
        ├── api.js          # appels fetch vers l'API
        ├── constants.js    # statuts, libellés AGIR, formatage
        ├── components/
        │   ├── Header.jsx
        │   ├── StatCard.jsx
        │   ├── StatusBadge.jsx
        │   └── EntrepriseTable.jsx
        ├── telephony/
        │   ├── provider.js     # interface VoIP pluggable (simulateur ; point de branchement Twilio/Aircall/SIP)
        │   ├── CallContext.jsx # état de l'appel en cours + enregistrement de l'issue
        │   └── CallPanel.jsx   # panneau "Appel en cours" flottant
        └── pages/
            ├── Dashboard.jsx        # tableau de bord principal
            └── EntrepriseDetail.jsx # fiche entreprise + module AGIR + obligation OETH
```

## Installation (étape par étape dans VS Code)

Prérequis : [Node.js](https://nodejs.org/) version 18 ou supérieure.

1. Ouvrez le dossier `crm-oeth-agefip` dans VS Code.
2. Ouvrez un terminal intégré (`Ctrl + ù` ou menu *Terminal > Nouveau terminal*).
3. Installez les dépendances (racine, serveur et client) :

   ```bash
   npm install
   npm run install:all
   ```

4. Lancez l'application (backend + frontend en parallèle) :

   ```bash
   npm run dev
   ```

5. Ouvrez votre navigateur sur **http://localhost:5173**. L'API tourne sur
   `http://localhost:4000` (les appels `/api/...` du frontend y sont
   automatiquement redirigés).

Au premier lancement, le fichier `server/data/db.json` est créé automatiquement
avec le jeu de données de test (dont **HAYAT&CO**, SIRET 93945511900015).

### Lancer séparément (optionnel)

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:client
```

## Fonctionnalités

- **Tableau de bord** : message d'accueil personnalisé, compteurs cliquables
  par statut, filtre "Prioritaires uniquement (effectif ≥ 20)" (activé par
  défaut), filtre par catégorie de secteur, recherche par société/SIRET/code
  postal, tableau trié par déficit d'unités bénéficiaires décroissant (les
  dossiers les plus urgents en tête), badges de statut colorés et bouton
  d'appel VoIP.
- **Fiche entreprise** : informations structure (SIRET, téléphone cliquable
  → ouvre le module d'appel, contact, type de contrat, ESAT associé),
  catégorie de secteur avec argumentaire commercial suggéré, et panneau
  "Obligation OETH" avec effectif/bénéficiaires recrutés éditables.
- **Moteur de calcul OETH/AGEFIPH** (`server/src/oeth.js`, recalculé à chaque
  lecture — jamais stocké en dur) :
  - Seuil d'assujettissement à 20 salariés.
  - Unités bénéficiaires (UB) requises = effectif × 6 %, arrondi à l'entier
    inférieur (ex. 149 salariés → 8 UB), conforme au barème légal par palier.
  - Déficit = UB requises − bénéficiaires recrutés (saisi dans la fiche).
  - Coefficient appliqué : 400/500/600 × SMIC horaire selon la taille de
    l'entreprise (20-199 / 200-749 / 750+), ou 1500 × SMIC horaire en
    surcontribution maximale si 0 bénéficiaire recruté.
  - Montant estimé = déficit × coefficient × taux horaire SMIC (11,88 €).
- **Classification sectorielle** (`server/src/secteurs.js`) : Mairie/service
  public, Restauration, Logistique, Conseil, Commerce, Industrie, Espaces
  verts, Fournitures de bureau, Autre — chacune avec un argumentaire adapté
  (ex. orientation vers un ESAT Tremplin, ou rappel FIPHFP pour le public).
- **Module AGIR** :
  - *Nouvelle issue d'appel* : NRP, Me rappelle, À rappeler (+ date), RDV
    (+ date), Mail, Autre — met à jour le statut du dossier et l'historique.
  - *Sortie du dossier* : Fiche → atelier, Fiche one-shot → atelier, Mort
    (dossier clos).
- **Module de téléphonie VoIP** (`client/src/telephony/`) :
  - Cliquer sur l'icône/numéro de téléphone ouvre un panneau "Appel en cours"
    flottant, visible sur toutes les pages.
  - `provider.js` expose une interface pluggable (`call(numero, callbacks)`)
    actuellement branchée sur un **simulateur** (connexion puis appel actif
    avec chronomètre) — commentaires en tête de fichier expliquant comment la
    remplacer par le Twilio Voice SDK, Aircall Everywhere, ou un softphone SIP
    générique (JsSIP/WebRTC), sans toucher au reste de l'app.
  - À la fin de l'appel, le panneau **oblige** à sélectionner une issue (menu
    fusionné AGIR : NRP, Me rappelle, À rappeler, RDV, Mail, Autre, Fiche,
    Fiche one-shot, Mort) avant de se refermer normalement ; la durée de
    l'appel est enregistrée avec l'historique.
- **Messagerie / historique** : fil chronologique fusionnant les issues
  d'appel (avec durée) et les commentaires libres, avec ajout de commentaire
  en direct.

## Points d'attention

- Le SMIC horaire brut et les coefficients (400/500/600/1500) sont des
  constantes dans `server/src/oeth.js`, à ajuster à chaque revalorisation
  légale ou si votre expert-comptable applique une méthode différente.
- Le module VoIP est un **simulateur** : aucun appel réel n'est passé tant
  qu'un vrai provider (Twilio/Aircall/SIP) n'est pas branché dans
  `provider.js`.

## Étapes suivantes possibles

- Authentification multi-utilisateurs (actuellement mono-utilisateur "Philippe").
- Export CSV / impression des fiches.
- Intégration d'un vrai provider VoIP (Twilio, Aircall, ou SIP/WebRTC via JsSIP).
- Migration de lowdb vers une vraie base de données (PostgreSQL, SQLite) si le
  volume de dossiers grandit.
