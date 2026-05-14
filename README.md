# RESA - Planification Capacite Reseau

Application de planification de la capacite des sous-stations HTB/HTA pour la Province de Liege, avec file d'attente, evaluation technique directionnelle, suivi CAPAC et cycle offre/raccordement.

## Commandes

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run test:watch # watch mode
npm run build      # dist/ statique
npm run preview    # previsualiser le build
```

## Etat du projet

- Application Vite + React, logique metier isolee dans `src/engines/`.
- Modele dossier canonique: `customer`, `assessment`, `offer`, `capacityImpact`.
- Persistance locale en **v12**. Les sessions pre-v12 sont ignorees volontairement pour repartir d'un jeu d'exemple propre.
- `node_modules/`, `dist/`, `.DS_Store` et les caches locaux sont ignores par Git.

## Architecture

```text
resa-capacite/
├── index.html
├── package.json
├── vite.config.js          Config Vite + Vitest (jsdom)
├── README.md
│
├── src/
│   ├── main.jsx            Bootstrap React (createRoot)
│   ├── constants/
│   │   ├── index.js        YEARS, alertes, profils d'etude, foisonnement
│   │   └── workflowActions.js
│   ├── data/initial.js     Donnees initiales SS et projets reseau
│   │
│   ├── utils/
│   │   ├── numbers.js      safeNum, safeDiv
│   │   ├── dates.js        getToday
│   │   ├── format.js       formatteurs UI
│   │   ├── coordinates.js  Normalisation lat/lng WGS84
│   │   └── normalize.js    normalisation SS, projets, demandes
│   │
│   ├── engines/            Logique metier pure, testable hors React
│   │   ├── requestModel.js       Accesseurs et normalisation canonique
│   │   ├── capacitySplit.js      Splits permanent/flexible
│   │   ├── capacityImpact.js     Reservation active, liberee, raccordee
│   │   ├── capacityEvaluation.js Evaluation amont/poste/reseau/finale
│   │   ├── workflowRules.js      Guards workflow client/etude/offre
│   │   ├── queueCockpit.js       Agregation file globale actionnable
│   │   ├── queueOrdering.js      Priorite FIFO
│   │   ├── dataQuality.js        Warnings et niveau de confiance
│   │   ├── queue.js              Analyse file par sous-station
│   │   ├── requests.js           Accesseurs et conditions projet
│   │   ├── alerts.js             Niveaux d'alerte directionnels
│   │   ├── directionalSubstation.js
│   │   └── projectEffects.js
│   │
│   ├── services/storage.js Persistance, import/export JSON/CSV
│   │
│   └── ui/
│       ├── App.jsx         Orchestrateur React, navigation, autosave
│       ├── hooks/          Navigation et raccourcis clavier
│       ├── shell/          Sidebar, topbar, theme
│       ├── shared/         Badges, charts, formulaires, modales
│       └── pages/
│           ├── overview/
│           ├── queue/      Cockpit global de file d'attente
│           ├── requests/   Page dossier + workflow client/etude/offre
│           ├── substations/
│           ├── projects/
│           ├── map/        Carte réseau Leaflet sans géocodage externe
│           └── intake/
│
└── tests/
    ├── engines/            Tests unitaires metier
    ├── pages/              Smoke tests React par ecran
    ├── services/
    ├── smoke/
    └── utils/
```

## Rôle de `App.jsx`

`App.jsx` reste l'orchestrateur principal. Il contient :

- hydratation initiale via `hydrateInitialAppState()`;
- etats globaux: sous-stations, projets reseau, journal d'activite, banniere de session;
- navigation centralisee via `useNavigation()`;
- autosave local;
- handlers de coordination entre pages;
- rendu conditionnel des vues principales.

Les calculs metier restent dans `src/engines/`.

## Où ajouter du code

| Besoin | Où |
|---|---|
| Nouveau calcul métier | `src/engines/` + test dans `tests/engines/` |
| Nouvel écran | `src/ui/pages/` (appelle les engines, ne recrée pas les calculs) |
| Nouveau composant partagé | `src/ui/shared/` ou sous-composant de page |
| Nouvelle constante partagée | `src/constants/` |
| Changer le format de persistance | `src/services/storage.js` (bumper `STORAGE_VERSION`) |

## Format de persistance

Version courante : **v12**.

```js
{
  version,
  savedAt,
  substations,
  networkProjects,
  activityLog
}
```

Les imports pre-v12 ne sont pas migres automatiquement: la refonte repart sur des donnees d'exemple normalisees.
