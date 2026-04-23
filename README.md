# RESA — Planification Capacité Réseau

Application de planification de la capacité des sous-stations HTB/HTA pour la Province de Liège (2026–2035).

## Commandes

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest — 151 tests
npm run test:watch # watch mode
npm run build      # dist/ statique
npm run preview    # prévisualiser le build
```

## Architecture

```
resa-capacite/
├── index.html              Point d'entrée Vite
├── package.json
├── vite.config.js          Config Vite + Vitest (jsdom)
│
├── src/
│   ├── main.jsx            Bootstrap React (createRoot)
│   ├── constants/index.js  YEARS, ALERT_CONFIG, SCENARIO_CONFIG, FOISON_DEFAULTS…
│   ├── data/initial.js     Données initiales SS et projets (6 SS Province de Liège)
│   │
│   ├── utils/
│   │   ├── numbers.js      safeNum, safeDiv
│   │   ├── dates.js        getToday
│   │   ├── format.js       f1, pct, uid, fmtDate, statusLabel
│   │   └── normalize.js    normalizeSubstations, normalizeProjects
│   │
│   ├── engines/            Logique métier — aucune dépendance React, testable en isolation
│   │   ├── capacity.js     calcCapacityN/N1, getCapacityAtYear, getEffectiveTfoConfig
│   │   ├── project.js      getEffectiveBaseLoad (load_transfer)
│   │   ├── requests.js     Accesseurs req.client/grd, réservations effectives
│   │   ├── load.js         getOrganicLoad, getNetLoad*, getResidual*, alertes
│   │   ├── queue.js        getQueueAnalysis, getGlobalQueueStats, getExpiryInfo
│   │   ├── recommendation.js  computeRecommendation — split ferme/flexible GRD
│   │   └── projectEffects.js  computeEffectsFromBlocks — blocs wizard → effets projet
│   │
│   ├── services/storage.js saveState, loadState, hydrateInitialAppState,
│   │                       exportJSON/CSV, importJSONFile
│   │
│   └── ui/
│       ├── App.jsx          Orchestrateur (~179 lignes) : navigation, états globaux,
│       │                    autosave, handlers inter-pages. Aucun calcul métier.
│       ├── AppHeader.jsx    Header + nav + badges + toggle scénario
│       ├── shared/
│       │   ├── badges.jsx   AlertBadge, DecisionBadge, ExpiryChip, Pill, Tag
│       │   ├── charts.jsx   DualUtilBar, DualCellBadge, ResidualMiniBar, ScenarioToggle
│       │   ├── forms.jsx    FormRow, Section, DetailInjEditor, DetailPrevEditor, PowerFields
│       │   └── ExportImportMenu.jsx
│       └── pages/
│           ├── overview/OverviewPage.jsx
│           ├── substations/
│           │   ├── SubstationListPage.jsx
│           │   ├── SubstationDetail.jsx
│           │   ├── EditRequestPanel.jsx
│           │   ├── EditSubstationPanel.jsx
│           │   └── tabs/  EvolutionTab  DemandesQueueTab  ChargeHistoryTab  InvestissementsTab
│           ├── queue/GlobalQueuePage.jsx
│           ├── projects/NetworkProjectsPage.jsx  (wizard renforcement/création/suppression)
│           └── intake/SaisiePage.jsx
│
└── tests/
    ├── smoke/
    │   ├── app.render.test.jsx   Rendu React minimal de App
    │   └── assembly.test.js      Imports, wiring moteurs, storage
    ├── engines/  capacity  load  queue  recommendation  projectEffects
    ├── services/ storage
    └── utils/    numbers
```

## Rôle de App.jsx

`App.jsx` est un orchestrateur de ~179 lignes. Il contient :
- lecture unique du storage via `hydrateInitialAppState()`
- 6 états globaux : `substations`, `networkProjects`, `activityLog`, `scenario`, navigation, banner session
- handlers de coordination inter-pages (`handleUpdate`, `handleSaisieSubmit`, `handleImport`…)
- autosave via `useEffect`
- rendu conditionnel des 6 pages

Il ne contient aucun calcul métier, aucun formulaire, aucun détail d'écran.

## Où ajouter du code

| Besoin | Où |
|---|---|
| Nouveau calcul métier | `src/engines/` + test dans `tests/engines/` |
| Nouvel écran | `src/ui/pages/` (appelle les engines, n'en recrée pas) |
| Nouvelle constante partagée | `src/constants/index.js` |
| Changer le format de persistance | `src/services/storage.js` (bumper `STORAGE_VERSION`) |

## Format de persistance

Version courante : **v5** — `{ version, savedAt, substations, networkProjects, activityLog, scenario }`
