# RESA Capacité v3.2 — Audit consolidé et feuille de route

> **Document de pilotage produit** — audience mixte (direction, équipe technique, experts métier power system, propriétaire produit)
>
> **Date** : 15 mai 2026
>
> **Sources intégrées** :
> - Audit interne `AUDIT.md` (Power System engineer · Planning operator · Senior UX/UI · Senior Full-Stack — mai 2026)
> - Audit interne `AUDIT_RESA_CAPACITE_2026-05-15.md` (revue transversale 15 mai 2026)
> - Analyse complémentaire « Expert Power System / GRD wallon » (présent document)
> - Analyse complémentaire « Analyste fonctionnel senior » (présent document)
> - Analyse complémentaire « Architecte logiciel / Tech lead » (présent document)
> - Lecture directe du code (`src/`, ~14 080 LOC, 99 tests passants)

---

## Préambule — Comment lire ce document

Ce rapport consolide les deux audits déjà réalisés et y ajoute trois analyses spécialisées indépendantes (métier, fonctionnelle, architecturale) pour produire **une vision unifiée et une feuille de route activable**.

Il s'organise en cinq parties :

- **Partie I — Compréhension de l'application** : ce que l'app fait, son architecture, sa navigation, ses choix structurants. Cette partie démontre que toute la suite repose sur une bonne compréhension du contexte.
- **Partie II — Revue page par page** : un chapitre dédié à chacune des 9 vues, avec la même grille d'analyse à six axes (UX, UI, fonctionnalités métier, code & architecture, performance, accessibilité & sécurité). Pour chaque axe, quatre sous-rubriques : ce qui est bien fait, ce qui peut être amélioré, ce qui doit absolument être modifié, ce qui manque à forte valeur ajoutée.
- **Partie III — Analyses transversales** : six lectures thématiques qui dépassent le découpage par page (modèle métier, architecture, UX/UI, sécurité/conformité, performance, qualité/CI).
- **Partie IV — Feuille de route priorisée** : Quick wins / P0 / P1 / P2 avec effort, impact et justification ; séquencement chronologique sur cinq mois.
- **Partie V — Conclusion** : verdict synthétique, top 15 d'actions, risques à remonter à la direction.

**Convention de priorité** dans tout le document :

| Code | Sens |
|---|---|
| **P0** | Bloquant production / risque légal ou métier majeur — à traiter immédiatement |
| **P1** | Indispensable pour atteindre le niveau « outil métier fiable » — trimestre en cours ou suivant |
| **P2** | Polish, scalabilité, différenciation — à programmer ensuite |

**Convention d'effort** :

| Code | Sens |
|---|---|
| **XS** | ≤ 1 jour homme |
| **S** | 1-3 jours |
| **M** | 3-7 jours |
| **L** | 1-3 semaines |
| **XL** | > 3 semaines |

---

# PARTIE I — COMPRÉHENSION DE L'APPLICATION

## 1. Vue d'ensemble produit

**RESA Capacité v3.2 — directional** est une application web de **planification de la capacité des sous-stations HTB/HTA** pour la **province de Liège**. Elle s'adresse principalement aux **opérateurs de planification réseau** (chargés de raccordement, ingénieurs études, responsables portefeuille) d'un Gestionnaire de Réseau de Distribution (GRD) belge — typiquement RESA, mais le modèle se transpose à ORES, Sibelga ou aux GRD voisins.

Le **cœur de la valeur métier** se situe sur trois axes :

1. **Évaluation directionnelle** de la capacité disponible d'une sous-station, en distinguant **prélèvement** (soutirage par les clients) et **injection** (apport ENR), aux horizons N et N-1 (capacité normale et après contingence).
2. **Pilotage du cycle de vie** d'une demande de raccordement, de la prise en charge initiale jusqu'au raccordement effectif, en passant par l'étude technique, la procédure CAPAC (avis Elia), la formulation et l'acceptation d'une offre.
3. **Anticipation des saturations** réseau via une **matrice de saturation 2026-2035** et la planification des **projets réseau** (renforcement, création de poste, suppression, transfert de charge).

L'application est aujourd'hui un **prototype avancé** (proof-of-concept aboutie), techniquement saine sur le plan métier, mais **non déployable telle quelle** chez un GRD réel pour les raisons documentées en Partie III.

## 2. Architecture technique

### 2.1 Stack

- **Frontend** : Vite 8 + React 18.3 (composants fonctionnels, hooks). Aucun framework de routing — la navigation est gérée par un hook maison.
- **Persistance** : `localStorage` du navigateur uniquement (clé `STORAGE_VERSION = 12`).
- **Visualisations** : Chart.js 4 pour les graphes ; Leaflet 1.9 + react-leaflet 4.2 pour la carte.
- **Tests** : Vitest 4 + Testing Library + jsdom — 99 tests passants en ~1 s, sur 23 fichiers.
- **Build** : Vite 8 (bundle main 855 KB minifié / 250 KB gzip).
- **Dépendances runtime** : 5 seulement (react, react-dom, react-leaflet, leaflet, chart.js) — surface d'attaque réduite, `npm audit` à 0 vulnérabilité.
- **Aucune** : TypeScript, ESLint, Prettier, Husky, CI/CD, Dockerfile, backend.

### 2.2 Structure des dossiers

```text
src/
  main.jsx                Bootstrap React (createRoot)
  constants/              YEARS, alertes, foisonnement, workflowActions
  data/initial.js         Seed embarqué (~24 KB, 4 SS de démo + projets)
  utils/                  numbers, dates, format, coordinates, normalize
  engines/                Logique métier pure (sans React)
    requestModel.js       Accesseurs + normalisation canonique
    capacity.js           Capacités N et N-1 d'un poste
    capacityImpact.js     Statut FIFO d'une réservation
    capacityEvaluation.js Évaluation amont/poste/réseau
    capacitySplit.js      Splits permanent/flexible
    directionalSubstation.js  Vue prélèvement/injection (≈ 474 LOC)
    projectEffects.js     Effets des projets réseau sur les TFO
    queue.js              File par sous-station
    queueCockpit.js       Agrégation file globale actionnable
    queueOrdering.js      Tri FIFO
    requests.js           Accesseurs demande + conditions projet
    alerts.js             Niveaux d'alerte directionnels
    dataQuality.js        Warnings et niveau de confiance
    workflowRules.js      Guards workflow client/étude/offre
    statusSummary.js
  services/storage.js     Persistance localStorage + import/export JSON
  ui/
    App.jsx               Orchestrateur global (≈ 256 LOC)
    hooks/                useNavigation, useKeyboardShortcuts
    shell/                Sidebar, Topbar, ThemeToggle
    shared/               ModalShell, Sparkline, badges, charts, forms, etc.
    pages/
      overview/           Vue d'ensemble — matrice de saturation
      substations/        Liste, détail, 4 onglets, archive
      queue/              Cockpit file globale (QueueCockpitTable ≈ 630 LOC)
      requests/           Dossier de demande (RequestWorkflowPanels ≈ 1076 LOC)
      projects/           Portefeuille de projets réseau + wizard
      map/                Carte Leaflet
      intake/             SaisieModal (création de demande)
```

### 2.3 Persistance v12

Format JSON unique sauvegardé en `localStorage` à chaque mutation :

```json
{
  "version": 12,
  "savedAt": "...",
  "substations": [ ... ],
  "networkProjects": [ ... ],
  "activityLog": [ ... ]
}
```

Les sessions pré-v12 sont **ignorées** (et non migrées), avec un re-seed depuis `data/initial.js`.

### 2.4 Modèle de données canonique

Une **demande de raccordement** est structurée en quatre sous-objets canoniques (`requestModel.js`) :

- `customer` — données client (référence, contact, adresse, EAN, usage, puissances demandées, statut intake)
- `assessment` — étude technique (prise en charge, CAPAC, profil d'étude, résultat final permanent/flexible, statut)
- `offer` — offre commerciale (statut, dates clés, validité, retention)
- `capacityImpact` — état FIFO de la réservation (NONE / QUEUE_RESERVED / STUDY_RESERVED / ACQUIRED / RELEASED / CONNECTED_RESERVED / CONNECTED_RELEASED)

Cette canonicalisation, **stabilisée et testée**, est l'un des principaux actifs techniques du projet.

### 2.5 Navigation

Hook `useNavigation()` qui maintient en local React :
- `view` — vue courante parmi `overview | list | file_attente | investissements | carte | detail | request_case`
- `selectedId`, `selectedTab`, `selectedReqId`, `prevView`

**Pas de routing URL** : pas d'historique navigateur, pas de deep-linking, pas de partage par URL, pas de back/forward natif. L'utilisateur ne peut pas **partager** une vue avec un collègue. Le scroll n'est pas restauré ni remis à zéro lors d'un changement de vue.

### 2.6 État global

`App.jsx` est l'**orchestrateur principal** : trois `useState` (substations, networkProjects, activityLog), cinq autres (modales, banner), un `useEffect` autosave. Un seul Context `ProjectsCtx` qui n'expose que `networkProjects` en lecture. Tout le reste descend en **props drilling** (24+ props vers `Sidebar`, 7-12 vers chaque page). Aucun store applicatif (Zustand/Jotai/Redux).

### 2.7 Découpage métier / présentation

Excellente séparation `engines/` (sans React, testable hors DOM) vs `ui/`. C'est le **meilleur point structurel** de l'application : une éventuelle réécriture du front (vers Next.js, vers TypeScript, vers une autre techno UI) **conserve la couche métier intacte**.

## 3. Périmètre fonctionnel — les 9 vues

| # | Identifiant | Libellé | Rôle dans le parcours |
|---|---|---|---|
| 1 | `overview` | Vue d'ensemble | Matrice de saturation 2026-2035, KPIs globaux, points d'attention |
| 2 | `list` | Sous-stations | Annuaire des 43 SS, recherche par nom/code |
| 3 | `file_attente` | File d'attente globale | Cockpit de toutes les demandes actives toutes SS confondues, étapes de workflow filtrables |
| 4 | `investissements` | Projets réseau | Portefeuille de projets, statuts, budgets, impacts SS |
| 5 | `carte` | Carte réseau | Vue géographique des SS, demandes, projets (Leaflet + OSM) |
| 6 | `detail` | Sous-station | Page deep-dive avec **4 onglets** : Évolution, Investissements, Capacité raccordée, Demandes en attente |
| 7 | `request_case` | Dossier de demande | Workflow complet client → étude → CAPAC → offre → raccordement |
| 8 | (modale) | `SaisieModal` | Création d'une demande (intake initial) |
| 9 | (drawer) | `ActivityLogDrawer` | Journal d'activité, 50 dernières entrées de session |

### Workflow opérateur typique

```
                    ┌────────────────┐
                    │ Sidebar nav    │
                    └────────┬───────┘
                             ▼
                    ┌────────────────┐
   Arrivée matinale │ Overview       │ → scan saturations, KPIs réservations
                    └────────┬───────┘
                             │
              ┌──────────────┼──────────────────┐
              ▼              ▼                  ▼
       ┌──────────┐  ┌──────────────┐   ┌────────────┐
       │ Liste SS │  │ File globale │   │ Projets    │
       └────┬─────┘  └──────┬───────┘   └─────┬──────┘
            │               │                  │
            ▼               ▼                  ▼
       ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
       │ SS detail   │  │ Dossier req  │◄─┤ Conditionnel │
       │ (4 onglets) │  │ (workflow)   │  └──────────────┘
       └─────────────┘  └──────────────┘
                 ▲              │
                 │              ▼
                 │       ┌──────────────┐
                 └───────┤ Carte / Map  │
                         └──────────────┘
```

**Points d'entrée principaux** : `+ Nouvelle demande` (modale globale, partout) ; clic SS / clic demande dans n'importe quelle vue.

## 4. Ce que l'application FAIT et NE FAIT PAS

### 4.1 Ce qu'elle fait bien

- **Évaluation directionnelle** de la capacité d'une SS à N et N-1, en prélèvement et en injection, avec ratio inverse paramétrable.
- **Application des projets réseau** aux configurations TFO (par année / par MES).
- **File d'attente FIFO** avec tri par date de complétude, filtrable par étape de workflow.
- **Cycle de dossier** complet (intake, étude, CAPAC binaire, offre, raccordement, libération) avec garde-fous workflow.
- **Matrice de saturation** sur horizon 2026-2035 avec différenciation prélèvement / injection / pire-cas.
- **Carte interactive** des SS, demandes et projets avec géoréférencement.
- **Import/export JSON** complet de l'état applicatif.
- **Dark mode** complet, vocabulaire métier respecté (MVA, kV, prélèvement, injection).
- **Tests unitaires** des engines métier (99 tests passants).

### 4.2 Ce qu'elle ne fait pas (et qu'on pourrait attendre)

- **Aucun backend**, donc aucun multi-utilisateur, aucun partage de données, aucun audit trail serveur.
- **Aucune authentification ni rôle** (lecture / opérateur / valideur / manager).
- **Aucune signature électronique** d'offre, aucun export PDF contractuel, aucun horodatage de signature.
- **Pas de gestion de pièces jointes** par dossier (devis, schémas, PV, mails CAPAC).
- **Pas de notifications** ni de rappels (offre J-90/J-30/J-7, relances client, SLA CWaPE).
- **Pas de système de tâches / propriétaire de dossier** (« mes dossiers », « relance prévue le … »).
- **CAPAC modélisé en binaire** (envoyé / pas envoyé) sans numéro Elia, sans scope P/Q, sans niveau amont.
- **Pas de modélisation de Q réactif**, pas de cos φ, pas de chute de tension MT, pas de topologie des départs HTA.
- **Pas de scénarios comparables** (sans/avec projet, central/prudent/stress) dans l'UI alors que les profils existent en code.
- **Pas de templates client par type** d'usage (résidentiel, PME, industriel, BESS, PV, éolien).
- **Pas de recherche globale** (command palette, recherche d'adresse).
- **Pas d'actions batch** sur la file.
- **Pas de versionning d'offre** (`offer.versions[]` absent).
- **Pas de mode mobile** réellement utilisable (sidebar masquée < 900 px sans trigger hamburger).

### 4.3 Ambiguïtés à noter

- Le **statut « en_cours »** d'un projet est traité comme « sécurisé » dans les calculs, sans distinction « budget engagé / chantier engagé / MES certaine / hypothèse non sécurisée ».
- Les **coefficients `coeffN = 0.90` / `coeffN1 = 1.00`** sont contre-intuitifs vs la pratique GRD wallonne courante (cf. Partie III.1) — la convention n'est pas documentée.
- Le **foisonnement** est appliqué à la demande client mais on ignore s'il l'est aussi à la base historique de charge, créant un risque conceptuel.
- Le `reverseCapacityRatio` est un **proxy composite** (tension + amont + protection) traité comme une simple symétrie — l'utilisateur ne le sait pas.

---

# PARTIE II — REVUE PAGE PAR PAGE

Chaque chapitre suit la même grille à **six axes** :

1. **UX — parcours opérateur**
2. **UI — design et présentation**
3. **Fonctionnalités métier**
4. **Architecture & qualité du code**
5. **Performance**
6. **Accessibilité & sécurité**

Et pour chaque axe, quatre sous-rubriques :

- ✓ **Ce qui est bien fait**
- 🔧 **Ce qui peut être amélioré**
- ⚠ **Ce qui doit absolument être modifié**
- ➕ **Manquant à forte valeur ajoutée**

Si un axe ne mérite aucun commentaire spécifique sur une page, c'est explicitement noté.

---

## Chapitre 1 — `OverviewPage` (Vue d'ensemble)

**Rôle** — Écran d'arrivée matinale. L'opérateur ouvre l'app, scanne en 10 secondes les saturations 2026-2035, les inversions de flux, les réservations qui expirent. C'est un poste de pilotage *macro*, pas une to-do list.

### 1.1 UX — parcours opérateur

- ✓ **Bien fait** — La matrice 43 SS × 10 années est un format universel des plans capacitaires GRD ; le tooltip au survol (cap N-1 / charge / résiduel / projets) donne exactement ce qu'un ingénieur cherche au premier coup d'œil. Le KPI « Inversion de flux » est un signal métier ENR rarement traité.
- 🔧 **À améliorer** — La page est **purement diagnostique** : elle invite à observer, pas à agir. Aucune notion de « ma journée », de « X dossiers à reprendre », de « Y décisions attendues ». La cliquabilité des cellules année est ambiguë (le nom de SS est cliquable, les cellules non, alors qu'on attendrait un drill-down SS × année).
- ⚠ **À modifier absolument** — Le bandeau « Conditionnels exclus » en bas à droite, en italique gris, est trop discret : un opérateur peut prendre la matrice pour la vérité absolue sans réaliser qu'elle filtre des hypothèses. Doit devenir un toggle explicite « Inclure / Exclure conditionnels » en tête de matrice.
- ➕ **Manquant à forte VA** — Toggle Prélèvement / Injection / Pire-cas sur la matrice (cohérent avec MapPage qui l'a déjà). Drill-down sur cellule vers `SubstationDetail` avec onglet Évolution et année présélectionnée. Export PDF « Revue mensuelle réseau Liège » d'un clic. Mode « écart vs trimestre précédent » (delta % par ligne SS).

### 1.2 UI — design et présentation

- ✓ **Bien fait** — Sparklines de tendance résiduel MVA, code couleur saturation conforme aux conventions, usage propre du portal React pour les tooltips (pas de clipping).
- 🔧 **À améliorer** — Double convention visuelle pour signaler une inversion : dot bleu « INV YYYY » à côté du nom et dot teal sous chaque cellule. Il faut unifier. Le texte du tooltip listant 10 années sur 1 ligne est illisible.
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Légende couleur visible en permanence (aujourd'hui implicite). Densité configurable (compact / confort) pour utilisateurs sur petit écran.

### 1.3 Fonctionnalités métier

- ✓ **Bien fait** — Calcul de saturation directionnel correct, KPI inversion de flux pertinent, prise en compte des projets sécurisés.
- 🔧 **À améliorer** — Les réservations urgentes sont plafonnées à 5 avec un « +N autre(s) » non cliquable. Sur un portefeuille avec 30 offres expirantes, l'information est perdue.
- ⚠ **À modifier absolument** — Le filtre « inclure les conditionnels » doit être exposé (cf. UX).
- ➕ **Manquant à forte VA** — Surface d'alerte « saturation aval probable » par feeder HTA (en attendant la topologie complète). Comparateur de scénarios (central / prudent / stress) sur la matrice.

### 1.4 Architecture & qualité du code

- ✓ **Bien fait** — Délégation aux engines (alerts, capacity), composant clair sous 250 LOC.
- 🔧 **À améliorer** — Quelques inline styles et magic numbers (`118`, `18ms`) à extraire en tokens.
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Tests d'intégration sur la matrice (visual regression Chromatic / Playwright).

### 1.5 Performance

- ✓ **Bien fait** — Le tooltip est porté en `createPortal`, donc rendu détaché de la grille.
- 🔧 **À améliorer** — La matrice est calculée à chaque render d'`App` parce que `getEffectiveSubstations()` n'est pas mémorisé (cf. Partie III.5).
- ⚠ **À modifier absolument** — Aucun localement, mais bénéficie directement du fix global `useMemo` sur `App.jsx:71`.
- ➕ **Manquant à forte VA** — Memoization de la matrice par `(substations, projects, years)`.

### 1.6 Accessibilité & sécurité

- ✓ **Bien fait** — Aucun élément cliquable de type `<div role="button">` détecté sur cette page.
- 🔧 **À améliorer** — Couleurs comme seul signal de saturation (problème daltoniens) ; ajouter une icône secondaire ou un motif.
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — `aria-label` sur les cellules de matrice pour lecteurs d'écran (« Liège-Nord, 2027, taux 87 %, projet PR-12 prévu »).

---

## Chapitre 2 — `SubstationListPage` (Liste des sous-stations)

**Rôle** — Annuaire des 43 SS, point de passage quand l'opérateur ne connaît pas la SS par cœur. Valeur métier secondaire — la file et la matrice priment — mais nécessaire pour la prise de connaissance.

### 2.1 UX — parcours opérateur

- ✓ **Bien fait** — Recherche client `name`/`code` fonctionnelle, colonnes orientées métier (Prélèvement / Injection / 1ʳᵉ saturation P|I).
- 🔧 **À améliorer** — `onSelect(sub.id)` ouvre **toujours** l'onglet Évolution. Si l'opérateur cherche une SS pour voir sa file, c'est un clic supplémentaire systématique. L'animation `stagger-item` avec délai cumulé sur 43 SS donne l'impression que la page « charge » alors que les données sont déjà là.
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Multi-tri (taux 2026 puis commune), filtres facettés (commune, niveau de tension, statut, voltage upstream), colonne « demandes actives » cliquable.

### 2.2 UI — design et présentation

- ✓ **Bien fait** — Colonne Injection refondue v3.1 (capacité ENR + année d'inversion) ; préfixe P/I sur « 1ʳᵉ saturation » très explicite.
- 🔧 **À améliorer** — Trois tranches d'années 26–28 / 29–31 / 32–35 : choix arbitraire. 2027 (échéance contractuelle fréquente) est noyé dans la tranche.
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Picker de colonnes selon métier (étude vs portefeuille), densité configurable.

### 2.3 Fonctionnalités métier

- ✓ **Bien fait** — Direction de la première saturation visible.
- 🔧 **À améliorer** — Aucune visualisation des projets impactants ; la colonne « 1ʳᵉ saturation » mélange avec/sans projet sans le signaler.
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Colonne « MVA réservés » avec mini-barre, « demandes actives (n) » cliquable vers la SS onglet Demandes, vue carte miniature au survol.

### 2.4 Architecture & qualité du code

- ✓ **Bien fait** — Composant simple, dérivations claires.
- 🔧 **À améliorer** — Tri/filtre non extraits (state local éparpillé).
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Composant `<DataTable>` générique partagé avec la file globale et l'onglet Demandes du détail SS.

### 2.5 Performance

- Pas de remarque spécifique. La page est légère ; les économies viendront du fix global de `getEffectiveSubstations`.

### 2.6 Accessibilité & sécurité

- ✓ **Bien fait** — Aucun.
- 🔧 **À améliorer** — Pas de `<th scope="col">` ni de `<td headers="...">` sur le tableau.
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Navigation clavier sur les lignes (j/k, Enter pour ouvrir).

---

## Chapitre 3 — `GlobalQueuePage` (Cockpit file d'attente)

**Rôle** — **La** page de travail quotidienne de l'opérateur file. Il y arrive plusieurs fois par jour : tri par priorité, actions à poser (lancer étude, demander CAPAC, relance client). Valeur métier **maximale** ; les améliorations ici ont le ROI le plus élevé.

### 3.1 UX — parcours opérateur

- ✓ **Bien fait** — `QUEUE_WORKFLOW_STEPS` en pills filtrantes (mapping mental du cycle de vie), KPIs « À traiter / CAPAC bloquants / Offres expirées / MVA file active », chips de filtres actifs avec retrait individuel, Esc et click-outside ferment le menu flottant.
- 🔧 **À améliorer** — Aucun **aperçu rapide** sur ligne (popover / peek panel droit) : pour décider, il faut basculer en `RequestCasePage`. Le sort par défaut « priorité desc » n'est pas explicité dans le sous-titre — l'opérateur peut se perdre dans le tri après quelques clics.
- ⚠ **À modifier absolument** — « À traiter maintenant » affiche 60 actions sur 66 demandes ⇒ noyade complète. Doit séparer « action obligatoire maintenant », « suivi », « lecture », « bloqué externe », « donnée incomplète ». Aucune notion d'**owner / mes dossiers** : tant que ce n'est pas posé (au moins comme placeholder en mono-user), l'utilisateur ne peut pas filtrer son propre travail.
- ➕ **Manquant à forte VA** — **Actions batch** (sélection multiple, « envoyer CAPAC pour 10 dossiers », « relancer 8 clients »). **Filtres sauvegardés + favoris** (« mes ENR injection en attente CAPAC »). **Indicateur de vieillissement** (jours depuis dernière action, code couleur > 15j / > 30j). **Vue Kanban alternative** par étape workflow. **Section « récemment vus »**.

### 3.2 UI — design et présentation

- ✓ **Bien fait** — `MetricCard` rapide à scanner, FilterChips standards.
- 🔧 **À améliorer** — Aucun sticky header : sur 13 colonnes en horizontal avec `minWidth: 1380`, l'utilisateur perd l'orientation au scroll. `PillButton` Step n'a pas de compteur d'urgence (« Étude (12) » et non « Étude (12 dont 3 hors SLA) »).
- ⚠ **À modifier absolument** — `FloatingMenu` custom : doit avoir une flèche pointer + navigation clavier ; aujourd'hui Esc et click-outside OK mais arrows non.
- ➕ **Manquant à forte VA** — Pagination + virtualisation `react-window` ; column visibility toggle (les 13 colonnes ne servent pas toutes en même temps).

### 3.3 Fonctionnalités métier

- ✓ **Bien fait** — Consolidation étape / action / sens / puissance / contrainte / réservation / décision / échéance.
- 🔧 **À améliorer** — Tri queue avec fallback `'9999-12-31'` (`queueOrdering.js:11`) : les demandes sans date partent silencieusement en queue. Risque CWaPE (non-discrimination).
- ⚠ **À modifier absolument** — Pas de « dépilage formel » ni passe-droit stratégique justifié (`req.fifoException = { reason, justification, approvedBy, approvedAt }` à introduire avec audit log). Sans cela, conformité CWaPE non démontrable.
- ➕ **Manquant à forte VA** — Owner / équipe / SLA / date dernière action / âge blocage en colonnes. Phrase décisionnelle par ligne (« Conditionnée au projet PR-23 MES 2028 »).

### 3.4 Architecture & qualité du code

- ✓ **Bien fait** — Engine `queueCockpit.js` séparé de la vue, agrégation testable.
- 🔧 **À améliorer** — Aucun.
- ⚠ **À modifier absolument** — `QueueCockpitTable.jsx` à **630 LOC** : extraire `HeaderButton`, `SortMenu`, `FloatingMenu`, `QueueRow`, `cells/*` (cf. Partie III.2).
- ➕ **Manquant à forte VA** — Composant `<DataTable>` partagé (file globale, liste SS, onglet Demandes).

### 3.5 Performance

- ✓ **Bien fait** — Aucun.
- 🔧 **À améliorer** — `computeCapacityImpact` est recalculé 10+ fois dans le graphe d'appel (cf. Partie III.5).
- ⚠ **À modifier absolument** — Pas de virtualisation : 400+ lignes potentielles chargées dans le DOM en une fois ⇒ INP dégradé.
- ➕ **Manquant à forte VA** — Cache mémoïsé par `req.id+updatedAt` (WeakMap) et `React.memo` sur les rows.

### 3.6 Accessibilité & sécurité

- ✓ **Bien fait** — Esc ferme le menu flottant.
- 🔧 **À améliorer** — Aucun `aria-label` sur les boutons icon-only (sort, ouvrir menu, fermer chip).
- ⚠ **À modifier absolument** — `<div role="button" tabIndex={0}>` dans certains contrôles : remplacer par `<button>` natifs.
- ➕ **Manquant à forte VA** — Tests `jest-axe` automatisés sur cette page (la plus utilisée donc la plus critique).

---

## Chapitre 4 — `NetworkProjectsPage` (Projets réseau)

**Rôle** — Usage moins fréquent mais plus stratégique. Vue de gouvernance des projets de renforcement / création / suppression / transfert. Consultée quand un dossier client bute sur une saturation, ou en revue mensuelle portefeuille.

### 4.1 UX — parcours opérateur

- ✓ **Bien fait** — Double bandeau d'alerte « SS dont saturation dépend d'un projet non validé » (P / I) — analyse de criticité rare dans les outils du marché ; type icon `— / ✦ / ⛔` rapide à scanner ; KPIs « Validés / À valider / Enveloppe estimée » au niveau direction de service.
- 🔧 **À améliorer** — « SS impactées » tronqué à 3 avec un `+N` non cliquable.
- ⚠ **À modifier absolument** — Bouton « Annuler » d'un projet à 2 M€ sans confirmation ni justification ; bouton « Supprimer » (statut annulé) sans dialog ni gestion de cascade (`conditionedOnProjectIds` sur les demandes orphelines). À encapsuler dans un `<ConfirmDialog>` avec justification obligatoire.
- ➕ **Manquant à forte VA** — **Vue ROI projet** : MVA libérés, demandes débloquées, demandes conditionnelles dépendantes. **Timeline Gantt** projets × années avec jalons (avis amont, validation budget, chantier, MES). **Statuts plus fins** : « budget engagé / chantier engagé / MES certaine / hypothèse ». **Panel latéral « demandes dépendant de ce projet »**.

### 4.2 UI — design et présentation

- ✓ **Bien fait** — Graphique `ProjectBudgetChart` empilé par statut × année, lecture financière propre.
- 🔧 **À améliorer** — Aucune timeline visuelle dédiée projets (le graphe représente le coût, pas le séquencement).
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Heatmap projet × SS impactées au survol.

### 4.3 Fonctionnalités métier

- ✓ **Bien fait** — 4 types d'effets (modify_tfo, load_transfer, create_ss, decommission) couvrent l'essentiel du screening capacitaire.
- 🔧 **À améliorer** — Pas de `replace_tfo` distinct de add+remove (perte de traçabilité). Pas de modification du `reverseCapacityRatio` ni du `directionalModel` dans les effets — limitations métier réelles. Statuts « validé » et « en_cours » traités identiquement dans `filterSecuredProjects` (audit 2 point 4).
- ⚠ **À modifier absolument** — **Wizard d'édition risqué** : `ProjectWizard` reconstruit un projet depuis `allSubstations` (vue déjà influencée par d'autres projets). Risque : l'édition d'un projet peut absorber les effets d'un autre. Doit reconstruire les blocs depuis le projet édité + base non modifiée + ordre explicite des effets.
- ➕ **Manquant à forte VA** — **Rampe de mise en service** (`commissioningProfile: { startConstructionAt, mvaProgress: [{date, ratio}] }`) au lieu d'un step au 1ᵉʳ janvier. **Dépendances inter-projets** (un renforcement amont conditionne un renforcement aval).

### 4.4 Architecture & qualité du code

- ✓ **Bien fait** — `projectEffects.js` engine pur et testé.
- 🔧 **À améliorer** — `getEffectiveTfoConfig` (`capacity.js:65`) applique les effets dans l'ordre du tableau sans tri par date / priorité ⇒ régression silencieuse possible.
- ⚠ **À modifier absolument** — Ajouter `.sort((a,b) => a.year - b.year || (a.priority||0) - (b.priority||0))` + détection de conflits (2 projets sur même TFO même année) avec warning UI.
- ➕ **Manquant à forte VA** — Validation des invariants projet (MVA cohérents, coordonnées dans la Wallonie, etc.) avec rapport d'erreurs.

### 4.5 Performance

- Pas de remarque spécifique au-delà du recalcul `getEffectiveSubstations` global.

### 4.6 Accessibilité & sécurité

- ✓ **Bien fait** — Aucun.
- 🔧 **À améliorer** — Annulation sans confirmation : risque opérationnel élevé sur des projets multi-millions d'euros.
- ⚠ **À modifier absolument** — Voir 4.1 (confirmation + justification + audit log).
- ➕ **Manquant à forte VA** — Rôle « gestionnaire portefeuille » pour valider / annuler un projet (RBAC post-backend).

---

## Chapitre 5 — `MapPage` (Carte réseau)

**Rôle** — Usage occasionnel mais à fort impact : visualiser la géographie, placer une demande géoréférencée, présenter à un comité. Sert aussi de mode placement quand l'opérateur veut associer une demande à une coordonnée GPS.

### 5.1 UX — parcours opérateur

- ✓ **Bien fait** — Toggle « Pire / Prélèvement / Injection » cohérent avec la matrice ; panel latéral « Demandes non positionnées » avec bouton « Placer » qui guide vers la complétude des données ; clustering implicite par `(SS, coords)`.
- 🔧 **À améliorer** — Mode `placingFor` : si l'opérateur change d'avis, seul un `✕` dans la barre quitte le mode, le clic carte engagé est irréversible (pas d'annulation post-placement).
- ⚠ **À modifier absolument** — Aucun layer toggle : impossible de masquer projets / demandes / SS indépendamment. Visibilité tout-ou-rien sur les demandes via un seul switch.
- ➕ **Manquant à forte VA** — **Recherche d'adresse / géocodage** + suggestion automatique de SS d'attache la plus proche ; **mesure de distance** ; **lasso de sélection** ; **fond de carte alternatif** (satellite, Walonmap) ; **mode présentation** plein écran pour comités ; **heatmap charge réseau** par maille.

### 5.2 UI — design et présentation

- ✓ **Bien fait** — Polyline demande↔SS d'attache visuelle, légende alertes en bas à droite.
- 🔧 **À améliorer** — Sur mobile, la légende est rejetée hors écran ; popup Leaflet en HTML brut peu stylable.
- ⚠ **À modifier absolument** — Bug `var(--surface)` au lieu de `--bg-surface` (la toolbar peut tomber transparente en dark mode).
- ➕ **Manquant à forte VA** — Layer « projets réseau » avec icônes distinctes par type d'effet.

### 5.3 Fonctionnalités métier

- ✓ **Bien fait** — Cohérence Pire/P/I avec l'overview.
- 🔧 **À améliorer** — Pas de filtre temporel : le sélecteur Année influence la couleur des SS mais pas la visibilité des demandes (toutes les demandes actives sont affichées peu importe leur MES souhaitée).
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Couleur SS reflétant le pire-cas du portefeuille, pas seulement de la base ; isochrones de raccordement (zones desservies par X SS).

### 5.4 Architecture & qualité du code

- ✓ **Bien fait** — `mapHelpers.js` extrait, géoréférencement testable.
- 🔧 **À améliorer** — Popup HTML brut hors DOM React rend la maintenance fragile.
- ⚠ **À modifier absolument** — `map.remove()` absent dans le `useEffect return` ⇒ fuite mémoire (Leaflet recrée des handlers à chaque démontage).
- ➕ **Manquant à forte VA** — Lazy load du composant (`React.lazy(() => import('./MapPage.jsx'))`) ⇒ -50 KB gzip sur le bundle initial.

### 5.5 Performance

- ✓ **Bien fait** — Aucun.
- 🔧 **À améliorer** — Leaflet + react-leaflet (~50 KB gzip) inclus dans le main bundle.
- ⚠ **À modifier absolument** — Code-splitter cette route (action P0 globale).
- ➕ **Manquant à forte VA** — Clustering `leaflet.markercluster` pour gros volumes (200+ demandes).

### 5.6 Accessibilité & sécurité

- ✓ **Bien fait** — Aucun.
- 🔧 **À améliorer** — Aucune navigation clavier sur les marqueurs ; popup non `aria-live`.
- ⚠ **À modifier absolument** — Dépendance externe à OpenStreetMap et Google Fonts (`index.html:7-9`) — fuite IP utilisateur, problème GDPR et offline. Self-host fonts + reverse-proxy tuiles (ou Mapbox/MapTiler B2B).
- ➕ **Manquant à forte VA** — Politique de confidentialité tuiles + CSP serveur configurés.

---

## Chapitre 6 — `SubstationDetail` (4 onglets)

**Rôle** — Page deep-dive sur une SS. L'opérateur y arrive depuis la liste, la matrice, la file ou la carte. Quatre onglets couvrent les 4 vues métier d'une SS : **Évolution** (courbes de capacité), **Investissements** (projets impactants), **Capacité raccordée** (clients raccordés et libérations à venir), **Demandes en attente** (file locale).

### 6.1 UX — parcours opérateur

- ✓ **Bien fait** — `DirectionalHeader` (4 cartes Cap directe N-1 / Cap inverse N-1 / Prélèvement / Injection) visuellement excellent ; `AssumptionsBanner` collapsible expose les hypothèses directionnelles — transparence rare dans les outils GRD.
- 🔧 **À améliorer** — `initialTab` est forcé à `'evolution'` même si l'opérateur arrive depuis la file (où on attendrait l'onglet Demandes). L'onglet Demandes duplique l'information de `GlobalQueuePage` sans signaler ce qui est inclus / exclu par rapport à la vue globale. Création de demande depuis cet écran (`CustomerRequestForm`) bypasse `SaisieModal` et ne consigne pas dans `activityLog` global.
- ⚠ **À modifier absolument** — Bouton « Paramètres » de la SS (paramètres techniques) accessible sans confirmation ni rôle — un opérateur de planification peut modifier les paramètres calculatoires par accident.
- ➕ **Manquant à forte VA** — **Bandeau « Verdict SS »** synthétique au-dessus du Header (« OK jusqu'en 2031, puis saturation par prélèvement industriel, PR-23 résout »). **Comparateur de scénarios** (sans/avec projet, central/prudent/stress) sur l'onglet Évolution. **Onglet « Historique »** des modifications de paramètres et événements d'exploitation. **Export PDF « Fiche SS »** synthétique. **Mémo SS** persistant et collaboratif.

### 6.2 UI — design et présentation

- ✓ **Bien fait** — Tabs claires, toast feedback sur les enregistrements.
- 🔧 **À améliorer** — `AssumptionsBanner` détail caché par défaut : l'opérateur peut prendre les chiffres pour acquis sans voir que `growth +9 %/an` influe l'horizon ; déplié, c'est dense.
- ⚠ **À modifier absolument** — `AnnualTable` utilise `key={Math.random()}` pour des cellules (`AnnualTable.jsx:58`) — brise la réconciliation React, re-mount complet à chaque render. **Bug latent à corriger d'urgence**.
- ➕ **Manquant à forte VA** — Hiérarchie visuelle « Décision → Action → Justification → Détails » à appliquer dans l'onglet Demandes (et plus largement).

### 6.3 Fonctionnalités métier

- ✓ **Bien fait** — Quatre onglets bien découpés sémantiquement.
- 🔧 **À améliorer** — Onglet Évolution : 4 modes (vue, mode, année, view) = combinatoire élevée pour novices ; « Résultante vs Composantes » non documenté.
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Vue **comparative jumelle** Prélèvement / Injection dans Évolution (alignée verticalement) plutôt qu'un toggle qui masque l'une des vues.

### 6.4 Architecture & qualité du code

- ✓ **Bien fait** — Composants `tabs/components/` (AnnualTable, CapacityCompare, ComponentDetail, DirectionalChart, QueueRow, SummaryCards) bien découpés.
- 🔧 **À améliorer** — Aucun.
- ⚠ **À modifier absolument** — `key={Math.random()}` (cf. 6.2).
- ➕ **Manquant à forte VA** — Tests visuels (Chromatic) sur DirectionalChart.

### 6.5 Performance

- ✓ **Bien fait** — Aucun.
- 🔧 **À améliorer** — Aucun.
- ⚠ **À modifier absolument** — `chart.destroy()` absent en `useEffect return` dans `DirectionalChart.jsx` ⇒ fuite mémoire.
- ➕ **Manquant à forte VA** — Mémoisation des séries de données par `(sub.id, mode, view)`.

### 6.6 Accessibilité & sécurité

- ✓ **Bien fait** — Aucun.
- 🔧 **À améliorer** — Charts sans `aria-label` ni légende clavier-accessible.
- ⚠ **À modifier absolument** — Tabs non `role="tablist"` / `role="tab"` (à vérifier dans le code).
- ➕ **Manquant à forte VA** — Mode « lecture seule » pour utilisateurs sans droit d'édition (préparable même en mono-user).

---

## Chapitre 7 — `RequestCasePage` (Dossier de demande)

**Rôle** — **La page la plus complexe et la plus utilisée** (1076 LOC dans `RequestWorkflowPanels.jsx`). L'opérateur y passe le plus de temps par dossier : lecture, prise en charge, encodage retour CAPAC, formulation d'offre, suivi acceptation, raccordement. Chaque dossier représente un client réel et plusieurs heures de travail cumulées sur sa vie.

### 7.1 UX — parcours opérateur

- ✓ **Bien fait** — `CaseTimeline` horizontale 12 jalons automatiques + ajout manuel ; triade `NetworkConditionBanner` + `DecisionBanner` + « Prochaine action » bien posée ; `primaryAction = getPrimaryAction(req)` délégué au moteur ; `persistReq` + `logActivity` couplés à chaque mutation (embryon d'audit trail).
- 🔧 **À améliorer** — `CaseTimeline` horizontale (12 jalons × 118 px) ⇒ scroll horizontal forcé, jamais visible en entier sur 13''. `technicalPanelRef.scrollIntoView` (`RequestCasePage.jsx:187`) déplace le scroll sans signal visuel — l'opérateur cherche pourquoi rien ne semble se passer. Notes internes en bas de page (devraient surfacer en tête comme briefing).
- ⚠ **À modifier absolument** — **Pas de bandeau « Verdict synthétique »** en tête (« ✓ Acceptable / ⚠ Conditionnel à PR-23 / ✕ Refusé saturation » avec raison limitante en 1 phrase). Le verdict existe en données (`getPrimaryAction`, `assessment.final`) mais n'est pas remonté en signal visuel dominant — c'est le manque le plus coûteux fonctionnellement.
- ➕ **Manquant à forte VA** — **Mode communication client** (email templates pré-remplis avec merge tags) ; **système de tâches / rappels** par dossier (relance J+15) ; **diff visuel** sur changements de puissance demandée.

### 7.2 UI — design et présentation

- ✓ **Bien fait** — Composants découpés (`CaseHeader`, `CaseTimeline`, `CaseInternalNotes`, `CaseNetworkSummary`, `CasePowerComparison`, `RequestReadOnlySections`).
- 🔧 **À améliorer** — Densité visuelle élevée, manque de hiérarchie « Décision / Action / Justification / Détails » (point 5 audit 2).
- ⚠ **À modifier absolument** — `RequestWorkflowPanels.jsx` à **1076 LOC** : à découper d'urgence en 8 fichiers < 200 LOC (cf. Partie III.2).
- ➕ **Manquant à forte VA** — Layout 3 colonnes responsive : 1) verdict + actions, 2) workflow + édition, 3) historique + notes.

### 7.3 Fonctionnalités métier

- ✓ **Bien fait** — Workflow workflow client → étude → CAPAC → offre → raccordement complet ; guards `workflowRules.js`.
- 🔧 **À améliorer** — `customer.client.reference` saisi librement, pas de format imposé (REF-SS-YYYY-NN) ⇒ doublons potentiels. `req.changeHistory` défini mais **jamais alimenté**.
- ⚠ **À modifier absolument** — **L'éditeur d'offre n'existe pas** : on n'édite que le **statut** de l'offre (`offer.status`), pas son **contenu** (puissance offerte, conditions, prix, validité, version). C'est l'output principal du métier — manquant le plus structurant. **Geler l'étude** (`assessment.frozenAt + snapshotHash`) au passage `finalized` pour empêcher mutation post-finalisation. **Signature offre** absente (`offer.signedBy/signedAt/hash`) — bloquant CWaPE.
- ➕ **Manquant à forte VA** — **Pièces jointes par dossier** (devis client, schéma site, PV constat, mail CAPAC) avec versionnage. **Versioning d'offre** (`offer.versions[]`) avec diff visible. **Identifiant contractuel** auto-généré.

### 7.4 Architecture & qualité du code

- ✓ **Bien fait** — Délégation systématique aux engines (`workflowActions`, `getPrimaryAction`, `requestModel`).
- 🔧 **À améliorer** — `req.milestones` et `req.changeHistory` cohabitent comme 2 sources de vérité historique.
- ⚠ **À modifier absolument** — Découpage de `RequestWorkflowPanels.jsx` (cf. 7.2).
- ➕ **Manquant à forte VA** — Tests d'intégration sur le workflow complet (intake → libération) avec Testing Library + fixtures réutilisables.

### 7.5 Performance

- ✓ **Bien fait** — Aucun.
- 🔧 **À améliorer** — Re-renders sur chaque frappe input à cause du `useState` racine d'`App.jsx`.
- ⚠ **À modifier absolument** — Aucun localement, mais bénéficie directement de Zustand + mémoisation `computeCapacityImpact`.
- ➕ **Manquant à forte VA** — Lazy load des panels (TechnicalAssessmentPanel, CapacEditor, OfferModal) une fois découpés.

### 7.6 Accessibilité & sécurité

- ✓ **Bien fait** — Toast feedback sur les modifications.
- 🔧 **À améliorer** — Suppression de jalons manuels sans confirmation (perte irréversible).
- ⚠ **À modifier absolument** — Actions destructives partout sans `<ConfirmDialog>` ni justification ; `offer.status = 'offer_accepted'` se clique sans demander de signature, sans pièce jointe, sans `acceptedBy`.
- ➕ **Manquant à forte VA** — Lock pessimiste (« qui regarde ce dossier maintenant ») à préfigurer même en mono-user.

---

## Chapitre 8 — `SaisieModal` (Intake)

**Rôle** — Point d'entrée de toute demande dans le système. L'opérateur clique « + Nouvelle demande » depuis la sidebar, choisit la SS, remplit le formulaire client. C'est le « front desk » du parcours.

### 8.1 UX — parcours opérateur

- ✓ **Bien fait** — Modal sobre, 2 étapes implicites (choix SS → formulaire) ; réutilisation de `CustomerRequestForm` partagé avec `RequestCasePage` (DRY exemplaire).
- 🔧 **À améliorer** — Aucun mode brouillon : toute frappe partielle est perdue à la fermeture (Esc, click outside, refresh). `SubstationSelector` = liste de boutons sans recherche (> 43 SS rapidement ingérable).
- ⚠ **À modifier absolument** — **`onSubmit` ne navigue pas vers le dossier créé** (`App.jsx:100-109`). L'opérateur vient de créer un dossier, il s'attend à atterrir dedans pour poursuivre — au lieu de ça la modale ferme et le dossier est créé « dans le vide ».
- ➕ **Manquant à forte VA** — **Suggestion SS depuis adresse client** (géocoder + nearest SS) ; **brouillon persistant** local avec récupération ; **templates par type** (résidentiel BT / PME HTA / BESS / PV / éolien) ; **détection doublon** client.

### 8.2 UI — design et présentation

- ✓ **Bien fait** — Pattern modal classique avec backdrop.
- 🔧 **À améliorer** — `SubstationSelector` n'affiche aucune aide à la décision (résiduel dispo, année saturation) à côté de chaque SS — l'opérateur choisit à l'aveugle.
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Combobox `<SubstationSelector>` searchable avec preview résiduel et stats.

### 8.3 Fonctionnalités métier

- ✓ **Bien fait** — Formulaire partagé avec le dossier (un seul lieu de vérité formulaire client).
- 🔧 **À améliorer** — Aucun.
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Validation EAN (14 chiffres) ; rattachement contact technique vs administratif ; champs PAU/PAC ; tension de raccordement ; modèle compteur.

### 8.4 Architecture & qualité du code

- ✓ **Bien fait** — Composant simple, délégation au handler `App`.
- 🔧 **À améliorer** — Aucun.
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Schémas Zod sur la création (réutilisables backend phase 2).

### 8.5 Performance

- Pas de remarque spécifique.

### 8.6 Accessibilité & sécurité

- ✓ **Bien fait** — Aucun.
- 🔧 **À améliorer** — Modale sans `role="dialog"`, sans `aria-modal`, sans focus trap (problème commun à tout `ModalShell`).
- ⚠ **À modifier absolument** — Idem.
- ➕ **Manquant à forte VA** — Tests `jest-axe` sur la modale après refonte `ModalShell`.

---

## Chapitre 9 — `ActivityLogDrawer` (Journal d'activité)

**Rôle** — Drawer accessible depuis la sidebar. Affiche le journal de session (50 dernières entrées). Usage faible mais sensible : permet à l'opérateur de retrouver ce qu'il vient de faire ou de démontrer une action à un collègue.

### 9.1 UX — parcours opérateur

- ✓ **Bien fait** — Drawer slide-in avec backdrop, bouton fermeture clair.
- 🔧 **À améliorer** — « Journal de session » est trompeur : un opérateur lit « session » comme « depuis ma connexion » alors que c'est « depuis le dernier reset » (peut être plusieurs semaines en mono-user). Pas de pagination ni infinite scroll.
- ⚠ **À modifier absolument** — Suppression d'entrée = suppression **de la donnée demande** dans la SS (`App.jsx:111 handleLogDelete`), pas juste du log. Le label « la suppression retire l'entrée du réseau » est facilement raté ⇒ **risque opérationnel majeur**. **Limite à 50 entrées silencieuse** : les actions plus anciennes disparaissent sans notification ni export, un opérateur en gros volume perd l'historique en 1-2 jours.
- ➕ **Manquant à forte VA** — Filtres (par type, par SS, par jour), recherche, export CSV/PDF du log, historique illimité (backend), confirmation forte de suppression.

### 9.2 UI — design et présentation

- ✓ **Bien fait** — Aucun.
- 🔧 **À améliorer** — Pas de différence visuelle entre une entrée « audit » et une entrée « action sans création » (alors que `isAudit` existe dans `CaseActivityLog`).
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Timeline visuelle par jour avec regroupement.

### 9.3 Fonctionnalités métier

- ✓ **Bien fait** — Cohérence mono-source (suppression cascade).
- 🔧 **À améliorer** — Cette cohérence est aussi le risque (cf. 9.1).
- ⚠ **À modifier absolument** — **Distinguer suppression du log et suppression de la donnée** (séparer en deux actions explicites).
- ➕ **Manquant à forte VA** — Audit trail immuable côté backend (append-only) au lieu de log mutable local.

### 9.4 Architecture & qualité du code

- ✓ **Bien fait** — Réutilisation de `ActivityLogList` partagée avec d'autres écrans.
- 🔧 **À améliorer** — `.slice(0, 50)` magic number à exposer en constante.
- ⚠ **À modifier absolument** — Aucun.
- ➕ **Manquant à forte VA** — Aucun spécifique.

### 9.5 Performance

- Pas de remarque spécifique (volume bornévolontairement à 50).

### 9.6 Accessibilité & sécurité

- ✓ **Bien fait** — Aucun.
- 🔧 **À améliorer** — Pas de focus trap, pas de retour focus au déclencheur (commun à `ModalShell` et `Drawer`).
- ⚠ **À modifier absolument** — Confirmation de suppression obligatoire avec rappel explicite de la cascade.
- ➕ **Manquant à forte VA** — `aria-live` sur les nouvelles entrées (annonce screen reader).

---

# PARTIE III — ANALYSES TRANSVERSALES

Six lectures thématiques qui dépassent le découpage par page. Elles s'appuient sur les deux audits initiaux complétés des trois analyses spécialisées.

## 1. Modèle métier Power System

### 1.1 Forces

- **Séparation directionnelle prélèvement/injection** documentée en tête de `directionalSubstation.js`, conventions de signe explicites.
- **Capacités N et N-1 distinctes** (`capacity.js:15-55`) avec application des effets projet.
- **Chaîne d'évaluation 3 couches** amont/poste/réseau combinée via `min()` — sémantique correcte du point de vue limitatif.
- **Foisonnement paramétrable** par type de client (`constants/index.js:22-29`).
- **Réservations rigide vs flexible** structurées dans le modèle.
- **Modèle dossier canonique** (`customer / assessment / offer / capacityImpact`) cohérent.
- **Workflow guards** corrects (`workflowRules.js`) : impossible de finaliser une offre sans étude valide.

### 1.2 Trous métier critiques

Synthèse fusionnée des constats des deux audits (PS-1 à PS-15, OP-1 à OP-29) et de la revue power system complémentaire (MET-1 à MET-10). Présentation par sévérité.

#### P0 — Bloquants production

| # | Sujet | Constat | Référence |
|---|---|---|---|
| **PS-1** | **N-1 unidirectionnel** | `calcCapacityN1` ne couvre que la perte d'un transfo HV/MT côté prélèvement. Aucun scénario contingence injection (perte d'un transfo + départ PV 100 %), aucun cas N-1 sur bay HTA / arrivée 70 kV / jdb couplage. Les offres injection sont **potentiellement surévaluées**. | `capacity.js:28-55` |
| **PS-2** | **Aucune marge opérationnelle** | 100 % de la capacité N-1 sont consommables alors que la pratique réseau réserve typiquement 80-90 % (instabilité, échauffement). Marge à introduire `securityMargin` configurable par poste. | `capacityEvaluation.js:100-103` |
| **PS-9** | **Coefficients N et N-1 contre-intuitifs** | `coeffN: 0.90` mais `coeffN1: 1.00` ⇒ N-1 paraît plus permissive que N. Pratique RESA/ORES inverse : `coeffN ≈ 1.0` puis `coeffN1 ≈ 0.85-0.90` en planification annuelle. **À challenger avec un expert RESA — c'est la formule la plus structurante**. | `projectEffects.js:54-55, 73-74` |
| **MET-1** | **Foisonnement appliqué demande sans cohérence base** | `maxHistoricLoadBT` est probablement déjà un pic foisonné côté SCADA, mais le calcul applique un coefficient supplémentaire à la demande client. Risque de **double-foisonnement** ou de **désalignement** conceptuel non documenté. | `capacityEvaluation.js:97-104` |
| **MET-2** | **Pas de statut « offre signée, raccordement en cours »** | Entre `offer_accepted` et `offer_connected`, il manque la fenêtre contractuelle (travaux client + raccordement physique). Juridiquement c'est le moment de la réservation ferme. | `constants/index.js:39` |
| **MET-3** | **Étude non gelée après finalisation** | `assessment.final` reste mutable après `studied`. Deux opérateurs peuvent voir des chiffres différents. Manque `assessment.frozenAt + snapshotHash`. | `workflowRules.js:34-39` |
| **OP-13** | **SLA CWaPE 2 mois non tracé** | Aucun bandeau rouge si `takenInChargeAt + 60j < today`. | global |
| **OP-16** | **Signature client offre absente** | Pas de `offer.signedBy / signedAt / hash`. Offre actuelle non binding légalement. | global |

#### P1 — Indispensables qualité métier

| # | Sujet | Constat |
|---|---|---|
| **PS-3** | Pas de saisonnalité foisonnement (résidentiel hiver ≈ 2× été ignoré). |
| **PS-4** | BESS double-compté (charge + décharge sommées au lieu de `max`). |
| **PS-5** | Pas de profils horaires (`maxHistoric*` agrégés à l'année, PV nuit = 0 ignoré). |
| **PS-6** | Pas de Q réactif, pas de cos φ, pas de chute de tension MT. |
| **PS-7** | `reqClientPrelevFlexible` retourne 0 hardcodé ⇒ aucun client jamais marqué flexible côté demande. |
| **PS-8** | `curtailable: true` jamais exploité par les moteurs. |
| **MET-4** | ENR foisonnement 0.60 confondu conceptuellement avec facteur de capacité. |
| **MET-6** | CAPAC binaire : pas de numéro Elia, pas de scope P/Q, pas de niveau amont, pas de SLA. |
| **MET-7** | `conditionedOnProjectIds` existe pour requests mais pas entre projets. |
| **MET-8** | Tri queue avec fallback `'9999-12-31'` silencieux (risque CWaPE non-discrimination). |

#### P2 — Polish métier

| # | Sujet | Constat |
|---|---|---|
| **PS-10** | Rampe MES projets absente (step 1ᵉʳ janvier au lieu de 12-18 mois progressifs). |
| **PS-11** | Pas de topologie départ HTA (1 poste = 1 capacité globale). |
| **PS-12** | Seuils alerte 70/85/100 % identiques pour tous postes. |
| **PS-13** | FIFO vs projets conditionnels mal articulé. |
| **PS-14** | Données initiales non sourcées (Verviers ratio inverse 1.0 improbable ; Herstal injection +9%/an non documenté). |
| **MET-9** | `reverseCapacityRatio` traité comme symétrie pure (en réalité composite tension + amont + protection). |
| **MET-10** | Effets projet appliqués dans l'ordre liste, non triés par date / priorité. |

### 1.3 Recommandations métier clés (Top 10 priorisé)

| # | Action | Priorité | Effort |
|---|---|---|---|
| **R1** | Clarifier `coeffN`/`coeffN1` avec expert RESA, documenter la convention dans header, rendre `coeffN1` configurable par poste | P0 | XS |
| **R2** | Geler l'étude (`assessment.frozenAt + snapshotHash`) au passage `canFinalizeAssessment` | P0 | S |
| **R3** | Implémenter `reqClientPrelevFlexible` réel + UI saisie P_ferme / P_flexible côté client | P0 | S |
| **R4** | N-1 bidirectionnel (perte transfo / départ HTA / arrivée amont) avec paramètre `direction` | P0 | M |
| **R5** | BESS exclusif (flag `exclusiveWith` ou `exclusiveLoadInjection`) | P0 | S |
| **R6** | Foisonnement cohérent base/demande : préciser dans header `directionalSubstation.js` + corriger les calculs | P0 | S |
| **R7** | Enrichir CAPAC (`number, scope: {P, Q, voltageLevel}, depEliaProjects[], partialDecisions[]`) + relance auto | P1 | M |
| **R8** | Marge opérationnelle (`securityMargin = 0.85` configurable par poste) | P1 | XS |
| **R9** | Rampe projets (`commissioningProfile`) avec interpolation | P1 | M |
| **R10** | Effets projets triés + détection conflits (2 projets même TFO même année ⇒ warning) | P2 | XS |

**Effort cumulé R1+R2+R6+R8+R10 ≈ 5 jours-homme** pour le **sprint de durcissement métier minimal viable** avant tout déploiement chez RESA.

## 2. Architecture & code

### 2.1 Forces architecturales

- **Engines purs sans React** : `engines/` n'importe rien de React. Couche métier 100 % testable hors DOM. **C'est le principal actif technique du projet** — il survit à n'importe quelle réécriture front.
- **Modèle canonique versionné** (`STORAGE_VERSION = 12`) avec normalisations centralisées (`utils/normalize.js`).
- **5 dépendances runtime** seulement ⇒ surface d'attaque minimale, `npm audit` à 0 vuln.
- **99 tests Vitest** passants en ~1 s, structure de tests propre par couche.
- **Hooks UI extraits** (`useNavigation`, `useKeyboardShortcuts`) ⇒ refacto vers un router sans douleur.

### 2.2 Dette technique

#### Architecture globale

- **`App.jsx` est un god component** : tout l'état (substations, projects, log, modales, navigation) en `useState` ; 24+ props drillées vers la Sidebar et chaque page.
- **Pas de store applicatif** (Zustand / Jotai / Redux). Toute frappe input ⇒ re-render `App` ⇒ re-render cascade.
- **`computeCapacityImpact` recalculé 10+ fois** dans le graphe d'appels (à la normalisation + dans `directionalSubstation:41`, `queue:48`, `capacityEvaluation:36/62`, `queueCockpit:166/225`, `requests:56-80`, `statusSummary`). À 500 demandes × 10 ans, c'est plusieurs milliers d'itérations à chaque rerender.
- **`getEffectiveSubstations()` sans `useMemo`** (`App.jsx:71`) : recalculé à chaque frappe clavier.

#### Code qualité

- **Aucun ESLint, Prettier, Husky, lint-staged, EditorConfig, `.nvmrc`**.
- **Aucun TypeScript** : 14 080 LOC sans types ⇒ refactor à risque.
- **Aucune CI** (`.github/workflows/` absent).
- **`vite.config.js` minimaliste** : pas d'alias `@/`, pas de `manualChunks`, pas de variables d'environnement, pas de bundle visualizer.
- **Plugin React Vite** : utiliser `@vitejs/plugin-react` standard, dont la version courante intègre les optimisations OXC, plutôt que la dépendance dépréciée `@vitejs/plugin-react-oxc`.
- **666 occurrences de `style={{` inline** dans 30 fichiers : impossible de garantir cohérence, dark mode, responsive.
- **Syntaxe Tailwind utilisée** sans Tailwind installé : code zombie à clarifier (adopter ou supprimer).

#### Bugs latents

- **`key={Math.random()}`** (`AnnualTable.jsx:58`) : brise la réconciliation React ⇒ re-mount complet à chaque render.
- **`uid()` non cryptographique** (`format.js:12` — `Date.now() + Math.random()`) : risque de collision batch + clock skew. Remplacer par `crypto.randomUUID()`.
- **`var(--surface)` inexistante** (`MapPage`) : doit être `--bg-surface`.
- **`map.remove()` absent** dans `MapPage` ⇒ fuite mémoire Leaflet.
- **`chart.destroy()` absent** dans `DirectionalChart` ⇒ fuite mémoire Chart.js.
- **`QuotaExceededError` silencieux** (`storage.js:35`) : `try/catch (_) {}` masque la perte de données.
- **JSON corrompu silencieux** (`storage.js:51`) : `catch (_) { return null }` rebascule sur initial sans alerte.

#### Fichiers monstres

| Fichier | LOC | Plan de découpage |
|---|---|---|
| `src/ui/pages/requests/components/RequestWorkflowPanels.jsx` | **1076** | Extraire `panels/TechnicalAssessmentPanel`, `panels/CapacTrackingEditor`, `panels/CapacReturnModal`, `modals/OfferStatusModal`, `cards/CapacitySplitCard`, `cards/AssessmentResultCard`, `cards/DecisionBanner`, `wizards/SubstationWizardModal` → 8 fichiers < 200 LOC. |
| `src/ui/pages/queue/components/QueueCockpitTable.jsx` | **630** | Extraire `HeaderButton`, `SortMenu`, `FloatingMenu`, `QueueRow`, `cells/*`. |
| `src/engines/directionalSubstation.js` | **474** | Découper en `loads.js`, `injections.js`, `aggregator.js`, `helpers.js` + JSDoc strict. |

### 2.3 Stack cible (industrialisation)

**Phase 1 — Hardening front (3 semaines)** : Zustand slices + persist plugin, schémas Zod, design system primitives, a11y AA, code splitting + virtualisation, jest-axe.

**Phase 2 — Backend lecture (4 semaines)** : NestJS + Prisma + PostgreSQL JSONB + Keycloak read-only + TanStack Query (feature flag `USE_BACKEND` pour migration progressive).

**Phase 3 — Backend écriture + audit (4 semaines)** : POST/PUT/DELETE + audit log immuable + RBAC + locks pessimistes.

**Phase 4 — Conformité CWaPE (4 semaines)** : signature DocuSign / itsme, PDF généré, SLA tracker, notifications BullMQ.

**Phase 5 — TypeScript progressif (4 semaines parallélisables)** : engines en premier, modèles partagés `@app/types` (Zod-inferred).

Stack technique recommandée :

| Couche | Choix |
|---|---|
| Frontend store | Zustand (court terme) + TanStack Query (post-backend) |
| Backend API | NestJS (TypeScript, modulaire, OpenAPI, intercepteurs audit) |
| Base de données | PostgreSQL 16 + Prisma + JSONB (mapping direct depuis canonique v12) |
| Authentification | Keycloak (on-prem) ou Auth0 (SaaS) avec SSO Azure AD / Entra ID |
| Validation | Zod côté API et front, schémas partagés |
| Jobs asynchrones | BullMQ (Redis) — notifications J-90/J-30/J-7, recalculs lourds |
| Monitoring erreurs | Sentry (front + back) |
| Logs / Traces | OpenTelemetry → Grafana Loki + Tempo + Prometheus |
| Génération PDF | Puppeteer (server) ou react-pdf |
| Signature | DocuSign ou itsme (Belgique-spécifique) |

**Compatibilité données localStorage** : le format v12 est déjà JSONB-compatible. L'import depuis localStorage est trivial (POST chaque substation avec son `data`).

## 3. UX / UI / Design System

### 3.1 Forces

- **Tokens CSS structurés** (couleurs prélèvement rose / injection teal, tokens charts, dark mode complet).
- **Vocabulaire métier respecté** (MVA, kV, prélèvement, injection, foisonnement, N-1).
- **Centralisation des configs badges** (`ALERT_CONFIG`, `DECISION_CONFIG`, `CAPACITY_IMPACT_CONFIG`).
- **Animations cohérentes** avec courbes cubic-bezier (`v3-slideInRight`, `go-fadeUp`).
- **Pattern Sidebar / Topbar / Content** clair, sémantique GridOps respectée.

### 3.2 Dette de design system

- **Pas de primitives partagées** : aucun `<Button>`, `<Card>`, `<Stack>`, `<Text variant>` factory.
- **~50 variantes de badges** réimplémentant le même template (badges.jsx).
- **Aucune échelle spacing ni radius unifiée** (3, 4, 5, 6, 8, 10 px coexistent).
- **Échelle typographique absente** (20/16/14/13/11/10 sans cohérence).
- **Composants manquants critiques** : Tooltip, Toast, ConfirmDialog, Combobox/Autocomplete, DataTable virtualisable, Pagination, Tabs unifiés, EmptyState, Skeleton, Breadcrumb multi-niveau.
- **Tableaux** : pas de sticky header, pas de virtualisation, pas de column visibility toggle, pas de sélection multiple / batch actions.
- **Dark mode trop sombre** (`#151B2B`, fatigue oculaire) ; `TYPE_COLORS` non adaptés au thème.
- **Carte Leaflet** : pas de clustering, pas de layer toggle, pas de cleanup, pas de navigation clavier.

### 3.3 Accessibilité (≈ WCAG 2.1 A, pas AA)

Manques principaux :

- `<div role="button" tabIndex={0}>` au lieu de `<button>` (cf. `ThemeToggle.jsx:33`).
- Aucun `aria-label` sur boutons icon-only (close, sort, sidebar nav).
- `ModalShell` sans focus trap, sans `aria-modal="true"`, sans scroll lock body, sans return focus au trigger.
- Aucun `aria-live` sur toasts ni badges urgents.
- Tableaux sans `<th scope="col">` ni `<td headers="...">`.
- Inputs sans `<label htmlFor>` (placeholder seul).
- Statuts par couleur seule (problème daltoniens).
- Charts sans `aria-label`.
- Aucune navigation clavier sur marqueurs de carte.

### 3.4 Responsive et mobile

- 3 breakpoints (1100/900/640) mais `QueueCockpitTable` 13 colonnes force scroll horizontal < 1280 px.
- Modales `min(560px, 92vw)` débordent en 375 px.
- Sidebar mobile = `translateX(-100%)` mais **aucun trigger hamburger visible** dans Topbar ⇒ navigation mobile cassée.

## 4. Sécurité, conformité & données

### 4.1 État positif

- `npm audit` 0 vulnérabilité.
- Pas de `dangerouslySetInnerHTML`, pas de `eval`, pas de `new Function`.
- Pas de fetch API applicatif détecté (import/export local simple).
- Pas d'envoi externe des données métier.

### 4.2 Risques actuels

| # | Risque | Mitigation |
|---|---|---|
| **S-1** | Données client en clair dans localStorage | Chiffrer si on garde local (`crypto.subtle`) ; mieux : passer au backend |
| **S-2** | Google Fonts CDN ⇒ fuite IP utilisateur vers Google | Self-host fonts (woff2 local) |
| **S-3** | OpenStreetMap public tiles ⇒ idem | Reverse-proxy + cache interne ou MapTiler/Mapbox B2B |
| **S-4** | Aucune Content-Security-Policy | Définir CSP stricte (`connect-src`, `img-src`, `font-src`, `frame-ancestors`) |
| **S-5** | Aucun SRI sur les CDN | `integrity="sha384-..."` si on garde le CDN |
| **S-6** | `importJSONFile` accepte tout JSON v12 sans schéma | Zod schema strict + taille max + preview |
| **S-7** | Pas de rate limit côté API future | `@nestjs/throttler` + reverse proxy |
| **S-8** | `uid()` non cryptographique | `crypto.randomUUID()` |
| **S-9** | CSV injection Excel possible | Préfixer `'` les cellules commençant par `= + - @` |
| **S-10** | Actions destructives sans gouvernance serveur | Confirmation forte + justification + audit immuable |

### 4.3 Conformité CWaPE / RGIE / GDPR

- **Audit trail immuable** absent (`changeHistory` défini mais jamais alimenté).
- **Signature offre** absente (pas de `offer.signedBy/signedAt/hash`, pas d'intégration DocuSign/itsme).
- **PDF contractuel structuré** absent (entête GRD, puissances, prix, conditions, validité, n° contractuel REF-SS-YYYY-NN).
- **SLA CWaPE 2 mois** non tracé (bandeau rouge si dépassement).
- **Notifications offre J-90/J-30/J-7** absentes.
- **Délai max raccordement après acceptation** non compté.
- **Export GDPR** par client (droit d'accès) absent.
- **RGIE Art. 235** (présence agent BA5) non modélisable.
- **Indicateurs CWaPE trimestriels** (taux raccordement ENR) non exportables.

### 4.4 Verdict conformité

**Déploiement opérationnel chez un GRD réel impossible en l'état**. Quatre éléments incontournables avant production : (1) backend + audit log immuable, (2) signature + PDF offre, (3) SLA tracker + notifications, (4) RBAC + traces utilisateur.

## 5. Performance & scalabilité

### 5.1 État actuel

- Bundle main : **855 KB minifié / 250 KB gzip**, aucune route splittée.
- Leaflet et Chart.js sont dans le chemin principal (chargés même pour qui n'ouvre pas la carte).
- Calculs métier répétés ~10× dans le graphe sans cache.
- Aucune virtualisation (`react-window` ou `@tanstack/react-virtual` absent).
- Cleanup Leaflet et Chart.js absent ⇒ fuites mémoire.
- Vite 8 + plugin Babel déprécié.

### 5.2 Stratégie cible

#### Code-splitting (`vite.config.js` à enrichir)

```js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react':   ['react', 'react-dom'],
        'vendor-leaflet': ['leaflet', 'react-leaflet'],
        'vendor-chart':   ['chart.js'],
      },
    },
  },
  chunkSizeWarningLimit: 300,
},
```

#### Routes lazy

```js
const MapPage = React.lazy(() => import('./pages/map/MapPage.jsx'));
const NetworkProjectsPage = React.lazy(() => import('./pages/projects/NetworkProjectsPage.jsx'));
```

Gain attendu : bundle initial **~120 KB gzip** (au lieu de 250).

#### Memoization

- `useMemo` urgent sur `App.jsx:71`.
- Cache `computeCapacityImpact` par `(req.id, req.updatedAt)` (WeakMap).
- `React.memo` sur `QueueRow`, `Badge`, `Pill`, `KpiCard`, `Sparkline`.

#### Virtualisation

`react-window` ou `@tanstack/react-virtual` pour `GlobalQueuePage`. Test perf cible : 5 000 demandes en < 100 ms first paint.

### 5.3 Web Vitals cibles

| Metric | Aujourd'hui (estim.) | Cible prod |
|---|---|---|
| LCP | ~2.5 s | < 1.5 s |
| TBT | ~600 ms | < 200 ms |
| CLS | bon | < 0.05 |
| INP | non mesuré (suspect) | < 200 ms |
| Bundle initial gzip | 250 KB | < 120 KB |

Ajouter **Lighthouse CI** en GitHub Actions, budget bundle CI strict.

### 5.4 Dataset de stress

Tester avec **50 SS / 5 000 demandes / 200 projets** : mesurer rendu overview, file, dossier, import et export. Aujourd'hui non testé.

## 6. Tests, CI/CD, DX

### 6.1 État actuel

- **99 tests** sur 23 fichiers (Vitest 4) — bonne couverture des engines.
- **Smoke tests** UI minimaux (« ne crash pas »).
- **0 e2e**, **0 a11y test**, **0 visual regression**, **0 perf test**.
- **0 outil DX** : pas d'ESLint, Prettier, Husky, EditorConfig.
- **0 CI** : pas de `.github/workflows/`.
- **0 Dockerfile**.
- **0 versioning UI** (pas de `__APP_VERSION__` ni `__BUILD_TIME__` visible).

### 6.2 Pyramide cible

```
        /\
       /e2e\          ~15 specs Playwright (parcours métier)
      /------\
     / intégr.\       ~50 tests Testing Library (workflow Intake→Raccordé)
    /----------\
   /  composants\     ~80 tests UI (badges, forms, modales)
  /--------------\
 / engines + utils\   ~300 tests Vitest + property-based (capacity, split, queue)
/__________________\
```

Cible : **400-500 tests**, < 30 s en CI sans e2e, < 5 min avec e2e.

### 6.3 Outillage manquant

| Outil | Fichier attendu |
|---|---|
| ESLint flat config (`@eslint/js + react + react-hooks + jsx-a11y + import + unicorn + vitest`) | `eslint.config.js` |
| Prettier | `.prettierrc` |
| Husky + lint-staged | `.husky/pre-commit` + section `package.json` |
| EditorConfig | `.editorconfig` |
| Node version pinning | `.nvmrc` |
| TypeScript | `tsconfig.json` |
| Contributor guide | `CONTRIBUTING.md` |
| ADR | `docs/adr/` |
| GitHub Actions | `.github/workflows/{ci,release,preview}.yml` |
| Dockerfile front | racine |

### 6.4 CI/CD cible (GitHub Actions)

```yaml
ci.yml :
  lint:    npm ci && npm run lint && npm run format:check
  test:    npm ci && npm run test -- --coverage  -> upload codecov
  build:   npm ci && npm run build  -> verify dist size budget
  e2e:     npx playwright test
  a11y:    lighthouse-ci on preview
```

`release.yml` : `release-please` ou `changesets` → semver auto + CHANGELOG + tag git.

`preview.yml` : déploie chaque PR sur Vercel/Netlify preview pour QA.

### 6.5 Observabilité

- **Sentry** front + back (DSN env, source maps CI, releases liées au git SHA).
- **OpenTelemetry** → Grafana Loki/Tempo/Prometheus pour traces, logs structurés et métriques.
- **RUM Web Vitals** via Sentry Performance ou `web-vitals`.
- **Bug reports utilisateur in-app** : bouton « Signaler un problème » en footer + ErrorBoundary enrichi (« Recharger / Signaler »).
- **SLO cibles raisonnables** : disponibilité 99.5 %, latence API p95 < 500 ms, erreur rate front < 0.1 %, build vert CI 95 %, couverture tests > 60 % global / > 80 % engines.

---

# PARTIE IV — FEUILLE DE ROUTE PRIORISÉE

Cette partie traduit les analyses précédentes en **plan d'action séquencé**. Trois lectures complémentaires :

- **§1 — Quick wins** : actions XS/S à très haut impact, à réaliser en première semaine.
- **§2 à §4 — Backlog P0/P1/P2** : tableau exhaustif des actions, regroupées par priorité métier.
- **§5 — Vue chronologique** : séquencement sur 5 mois avec ressources cibles (1 PO + 2 dev + 1 QA).

## 1. Quick wins (1 semaine, 1 dev)

Toutes ces actions sont **XS ou S**, n'impactent pas la conception métier, et débloquent / sécurisent immédiatement le reste de la roadmap.

**Règle de suivi à appliquer à chaque implémentation de la roadmap** : conserver la tâche visible dans le tableau, puis mettre à jour son statut avec trois niveaux distincts : **Développé**, **Commit local**, **Push GitHub**. Lorsque l'action touche la CI, ajouter aussi le résultat GitHub Actions.

| # | Action | Effort | Impact | Lieu | Statut |
|---|---|---|---|---|---|
| QW-1 | Ajouter ESLint + Prettier + Husky + lint-staged + EditorConfig + `.nvmrc` | XS | 4 | `.eslintrc`, `.prettierrc`, `.husky/`, `package.json`, `.editorconfig`, `.nvmrc` | **Terminé** — développé, commité localement (`32693e9`, `a20dfce`) et poussé sur `origin/main` |
| QW-2 | GitHub Actions CI minimale (lint + test + build sur PR) | XS | 4 | `.github/workflows/ci.yml` | **Terminé** — workflow `CI` déclenché sur GitHub Actions, run `25933063052`, statut `success` |
| QW-3 | `useMemo` sur `getEffectiveSubstations` | XS | 5 | `App.jsx:71` | **Terminé** — Développé : oui ; Commit local : `f09b475` ; Push GitHub : `origin/main` (`f09b475`) |
| QW-4 | Fix `key={Math.random()}` ⇒ id stable | XS | 3 | `AnnualTable.jsx:58` | **Terminé** — Développé : oui ; Commit local : `f09b475` ; Push GitHub : `origin/main` (`f09b475`) |
| QW-5 | Fix `var(--surface)` ⇒ `var(--bg-surface)` | XS | 3 | `MapPage.jsx` | **Terminé** — Développé : oui ; Commit local : `f09b475` ; Push GitHub : `origin/main` (`f09b475`) |
| QW-6 | Cleanup `map.remove()` et `chart.destroy()` en `useEffect return` | XS | 3 | `MapPage.jsx`, `DirectionalChart.jsx` | **Vérifié / déjà couvert** — Développé : vérification documentée ; Commit local : `f09b475` ; Push GitHub : `origin/main` (`f09b475`) ; Chart.js détruit déjà ses instances ; `MapPage` utilise `react-leaflet` sans carte Leaflet manuelle à nettoyer |
| QW-7 | Utiliser `@vitejs/plugin-react` standard intégrant les optimisations OXC, sans dépendance dépréciée `@vitejs/plugin-react-oxc` | XS | 2 | `vite.config.js` | **Terminé / corrigé** — Développé : oui ; Commit local initial : `4c4ecdb` ; Push GitHub : `origin/main` (`4c4ecdb`) ; CI GitHub : `25945877447` success ; micro-correction dédiée : retrait de `@vitejs/plugin-react-oxc` |
| QW-8 | Reset scroll content (`scrollTop = 0`) à chaque changement de `view`/`selectedId`/`selectedReqId` | XS | 4 | `App.jsx` ou `useNavigation.js` | **Terminé** — Développé : oui ; Commit local : `f09b475` ; Push GitHub : `origin/main` (`f09b475`) |
| QW-9 | Gestion `QuotaExceededError` explicite (alerte utilisateur + proposition d'export) | XS | 4 | `storage.js:35` | **Terminé** — Développé : oui ; Commit local : `4c4ecdb` ; Push GitHub : `origin/main` (`4c4ecdb`) |
| QW-10 | CSV escaping (guillemets, `;`, retours ligne, neutralisation formules Excel `= + - @`) | S | 3 | `storage.js` | **Terminé** — Développé : oui ; Commit local : `4c4ecdb` ; Push GitHub : `origin/main` (`4c4ecdb`) |
| QW-11 | `crypto.randomUUID()` à la place de `Date.now() + Math.random()` | XS | 2 | `format.js:12` | **Terminé** — Développé : oui ; Commit local : `f09b475` ; Push GitHub : `origin/main` (`f09b475`) |
| QW-12 | Marge opérationnelle `securityMargin = 0.85` configurable par poste | XS | 4 | `transformerConfig` + `capacityEvaluation.js:100` | **Reporté** — validation métier requise avant modification des calculs capacitaires |
| QW-13 | Bandeau confirmation forte sur « Repartir des données d'exemple » (App.jsx:161) | XS | 4 | `App.jsx:151-164` | **Terminé** — Développé : oui ; Commit local : `4c4ecdb` ; Push GitHub : `origin/main` (`4c4ecdb`) |
| QW-14 | `useMemo` sur `getEffectiveSubstations` + cache `computeCapacityImpact` (WeakMap) | S | 5 | `App.jsx`, `capacityImpact.js` | **Terminé** — Développé : oui ; Commit local : `f09b475` ; Push GitHub : `origin/main` (`f09b475`) ; CI GitHub : `25934624241` success |

### Journal d'implémentation

| Date | Élément roadmap | Développé | Commit local | Push GitHub | Vérification |
|---|---|---|---|---|---|
| 2026-05-15 | QW-1 + QW-2 / Top 15 #1 — Socle qualité ESLint, Prettier, Husky, lint-staged, EditorConfig, `.nvmrc`, GitHub Actions CI | Oui | Oui — `32693e9 chore: add quality tooling` + `a20dfce style: format codebase and fix lint issues` | Oui — commits poussés sur `origin/main` jusqu'à `a20dfce` | `npm run ci` local OK ; GitHub Actions `CI` run `25933063052` OK |
| 2026-05-15 | QW-3 + QW-4 + QW-5 + QW-6 + QW-8 + QW-11 + QW-14 / Top 15 #2 — Performance et quick wins sûrs | Oui | Oui — `f09b475 perf: memoize capacity calculations and quick wins` | Oui — commit poussé sur `origin/main` (`f09b475`) | `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run ci`, `git diff --check` locaux OK ; GitHub Actions `CI` run `25934624241` OK |
| 2026-05-16 | QW-7 + QW-9 + QW-10 + QW-13 — Quick wins sûrs restants ; QW-12 reporté | Oui | Oui — `4c4ecdb feat: complete safe quick wins` | Oui — commit poussé sur `origin/main` (`4c4ecdb`) | `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run ci`, `git diff --check` locaux OK ; GitHub Actions `CI` run `25945877447` OK |

**Effort cumulé : ~5-6 jours-homme.** Impact perçu massif sur perf et sécurité opérationnelle.

## 2. P0 — Bloquants production (~3 mois)

### 2.1 Métier Power System

| # | Action | Effort |
|---|---|---|
| P0-PS-1 | Clarifier `coeffN`/`coeffN1` avec expert RESA + documenter convention | XS |
| P0-PS-2 | N-1 bidirectionnel (perte transfo / départ HTA / arrivée amont) | M |
| P0-PS-3 | BESS exclusif (flag `exclusiveWith`) | S |
| P0-PS-4 | Foisonnement cohérent base/demande (header + correction calcul) | S |
| P0-PS-5 | Implémenter `reqClientPrelevFlexible` réel + UI saisie P_ferme/P_flexible | S |
| P0-PS-6 | Geler l'étude post-finalisation (`assessment.frozenAt + snapshotHash`) | S |

### 2.2 Backend, multi-user, audit

| # | Action | Effort |
|---|---|---|
| P0-BE-1 | Backend NestJS + PostgreSQL (JSONB) + Prisma + Docker compose | L |
| P0-BE-2 | Auth Keycloak (ou Auth0) avec SSO Azure AD / Entra ID | M |
| P0-BE-3 | Migration data localStorage → API (bouton « Synchroniser cette session » + feature flag `USE_BACKEND`) | M |
| P0-BE-4 | TanStack Query côté front (remplace lecture localStorage) | M |
| P0-BE-5 | RBAC : analyste / valideur / manager / admin | M |
| P0-BE-6 | Audit log immuable serveur (table `events` append-only) | M |
| P0-BE-7 | Locks pessimistes sur dossier en édition | S |

### 2.3 Conformité CWaPE / juridique

| # | Action | Effort |
|---|---|---|
| P0-CW-1 | Signature offre + PDF généré (DocuSign / itsme) + hash | L |
| P0-CW-2 | Bandeau SLA CWaPE 2 mois (`takenInChargeAt + 60j < today`) + colonne « jours en étude » colorée | XS |
| P0-CW-3 | Notifications offre (J-90 / J-30 / J-7 / expirée) — email + UI toast persistant | M |
| P0-CW-4 | Champs raccordement : EAN (14 chiffres validés), PAU/PAC, secteur, tension, modèle compteur | S |
| P0-CW-5 | Export PDF offre structuré (entête GRD, puissances, prix, conditions, validité, n° contractuel REF-SS-YYYY-NN) | M |
| P0-CW-6 | Dépilage / passe-droit FIFO formalisé (`req.fifoException = { reason, justification, approvedBy, approvedAt }`) | S |

### 2.4 Front-end hardening

| # | Action | Effort |
|---|---|---|
| P0-FE-1 | Store Zustand (slices substations/projects/activity/nav/ui) + suppression props drilling | M |
| P0-FE-2 | Schémas Zod sur import + structures canoniques | S |
| P0-FE-3 | Composants design system primitives : Button, Card, Modal (focus trap, aria-modal, scroll lock), Tooltip, Toast, ConfirmDialog, Combobox searchable, DataTable virtualisable, Pagination | L |
| P0-FE-4 | Découper `RequestWorkflowPanels.jsx` (1076 → 8 fichiers < 200 LOC) | M |
| P0-FE-5 | A11y WCAG AA minimum : `<button>` à la place de `<div role="button">`, `aria-label` icon-only, `<label htmlFor>` inputs, focus trap modales, scroll lock body, return focus trigger | S |
| P0-FE-6 | Code-splitting routes (`React.lazy`) + `manualChunks` Vite | S |
| P0-FE-7 | Sentry front + back (DSN env, source maps CI, releases) + ErrorBoundary enrichi (« Recharger / Signaler ») | XS |
| P0-FE-8 | Bandeau « Verdict synthétique » sur RequestCasePage en tête | XS |
| P0-FE-9 | Navigation auto vers RequestCasePage après création depuis SaisieModal | XS |

## 3. P1 — Niveau outil métier fiable (Q+1)

### 3.1 Power System (raffinement)

| # | Action | Effort |
|---|---|---|
| P1-PS-1 | Saisonnalité foisonnement (`FOISON_DEFAULTS.residentiel = { winter: 1.0, summer: 0.5 }`) | S |
| P1-PS-2 | Profils horaires simplifiés (jour/nuit, été/hiver) dans `directionalModel` | M |
| P1-PS-3 | Module Q réactif (`engines/reactiveCapacity.js`) avec cos φ par type, chute tension MT | L |
| P1-PS-4 | Exploiter `curtailable: true` sur composants PV ⇒ réduction réservation | S |
| P1-PS-5 | Validation invariants SS (`min < max`, `growth ∈ [-5%, +15%]`, etc.) avec warnings UI | S |
| P1-PS-6 | CAPAC enrichi : numéro Elia, scope P/Q, niveau amont, SLA Elia, relance auto J+30 | M |
| P1-PS-7 | Rampe MES projets (`commissioningProfile`) avec interpolation | M |

### 3.2 Opérateur / Workflow

| # | Action | Effort |
|---|---|---|
| P1-OP-1 | Vue « Ma journée » (homepage alternative) : dossiers assignés, prochaines actions, échéances | M |
| P1-OP-2 | Owner / équipe / âge dossier / date dernière action / SLA dans la file globale | M |
| P1-OP-3 | Actions batch sur la file (sélection multiple, envoyer CAPAC, relancer, exporter, marquer sans suite) | M |
| P1-OP-4 | Distinction « action obligatoire maintenant » / « suivi » / « lecture » / « bloqué externe » / « donnée incomplète » | S |
| P1-OP-5 | Filtres sauvegardés + favoris dans la file | S |
| P1-OP-6 | Système de tâches / rappels par dossier (relance J+15, attente client jusqu'au YYYY-MM-DD) | M |
| P1-OP-7 | Templates client par type d'usage (résidentiel BT / PME / industriel / BESS / PV / éolien) | M |
| P1-OP-8 | Versionning offre (`offer.versions[]` avec diff visible) | S |
| P1-OP-9 | Pièces jointes par dossier (devis, schémas, PV, mails CAPAC) avec versionnage | M |
| P1-OP-10 | Recherche avancée persistable + favoris | S |
| P1-OP-11 | Étapes manquantes du cycle : visite site, devis détaillé, RGIE signé, PV mise en service | M |
| P1-OP-12 | Export Excel mensuel filtrable depuis cockpit | S |
| P1-OP-13 | Dashboard management (KPI mensuels) | M |

### 3.3 UX / UI

| # | Action | Effort |
|---|---|---|
| P1-UX-1 | Design tokens : échelle spacing 4/8/12/16/24/32, radius 4/6/8/10, échelle type 28/20/16/14/13/11 | S |
| P1-UX-2 | Extraire styles inline vers classes CSS (top 20 patterns) | M |
| P1-UX-3 | Badge factory unique `<StatusBadge config={...} size="sm" />` consolidant les 50 variantes | S |
| P1-UX-4 | Tableaux : sticky header + footer pagination, virtualisation, column visibility toggle, sort highlight, batch select | M |
| P1-UX-5 | FloatingMenu : Escape close + click outside + arrow pointer + keyboard nav | S |
| P1-UX-6 | Carte : clustering (`leaflet.markercluster`), layer toggle, zoom-to-selection, cleanup | M |
| P1-UX-7 | Dark mode : éclaircir `--bg-surface` dark, adapter `TYPE_COLORS` | XS |
| P1-UX-8 | Mobile responsive : tableaux en cards, modales fullscreen, sidebar overlay swipeable, trigger hamburger visible | M |
| P1-UX-9 | Empty states + skeleton loading + ErrorBoundary « Recharger » | S |
| P1-UX-10 | Iconography : adopter Lucide ou Tabler, supprimer emoji des badges | S |
| P1-UX-11 | Command palette Cmd+K (recherche SS / demande / projet) | M |
| P1-UX-12 | Comparateur de scénarios (sans/avec projet, central/prudent/stress) sur Évolution et matrice | M |
| P1-UX-13 | Suggestion SS depuis adresse client + brouillon persistant SaisieModal | M |

### 3.4 Full-stack

| # | Action | Effort |
|---|---|---|
| P1-FS-1 | TypeScript progressif : engines en `.ts` d'abord, modèles partagés `@app/types` (Zod-inferred) | L |
| P1-FS-2 | Tests Playwright e2e (3 parcours métier : intake→raccordé, dépilage FIFO, projet MES) | M |
| P1-FS-3 | Tests `jest-axe` sur composants critiques | S |
| P1-FS-4 | Couverture mesurée Vitest (seuil CI 60 % global, 80 % engines) | XS |
| P1-FS-5 | Multi-tab sync localStorage (avant backend) (`storage` event) | S |
| P1-FS-6 | Self-host fonts Google + reverse-proxy tuiles OSM | S |
| P1-FS-7 | CSP stricte (`<meta http-equiv>` ou header serveur) | XS |
| P1-FS-8 | Versioning UI (`__APP_VERSION__` / `__BUILD_TIME__` visible footer) | XS |

## 4. P2 — Polish, scalabilité, différenciation

| # | Action | Effort |
|---|---|---|
| P2-1 | Snapshots / backup automatiques localStorage (10 derniers, restore UI) | S |
| P2-2 | i18n (i18next) FR / NL / EN pour expansion Wallonie / Flandre / Bruxelles | M |
| P2-3 | Topologie départs HTA dans le modèle (saturation par feeder) | L |
| P2-4 | Critical Path sur projets conditionnants (avis amont → approval → chantier → MES) | M |
| P2-5 | Heatmap charge réseau sur la carte | S |
| P2-6 | Intégration ELIA CAPAC (API ou webform) au lieu d'encodage manuel | L |
| P2-7 | Templates offres personnalisables par GRD (ORES vs RESA vs Sibelga) | S |
| P2-8 | CRM léger : vue par client (tous dossiers, historique, contacts) | M |
| P2-9 | Mode simulation / brouillon (toute frappe non sauvegardée tant que « Appliquer » non cliqué) | M |
| P2-10 | Print stylesheet + export PDF rapport tableau | S |
| P2-11 | Glossaire métier intégré (tooltips `?` sur FIFO, foisonnement, CAPAC, N-1) | XS |
| P2-12 | Test visuel (Chromatic / Percy) sur composants partagés | S |
| P2-13 | Documentation : ADR, guide opérateur, manuel d'hypothèses métier signé par expert HTB/HTA | M |
| P2-14 | Carte : recherche d'adresse / géocodage + isochrones | M |
| P2-15 | Fond de carte alternatif (Walonmap, satellite, cadastre) | S |
| P2-16 | Vue ROI projet (MVA libérés, demandes débloquées) + timeline Gantt projets | M |
| P2-17 | Onglet « Historique SS » (modifications de paramètres, événements d'exploitation) | M |
| P2-18 | Export PDF « Fiche SS » synthétique | S |
| P2-19 | Mémo SS persistant et collaboratif (note libre éditable) | S |
| P2-20 | Vue carte miniature au survol d'une SS dans la liste | S |
| P2-21 | Dataset de stress (50 SS / 5 000 demandes / 200 projets) + bench Vitest | S |
| P2-22 | Bundle size budget CI (alerte > 300 KB gzip) | XS |
| P2-23 | RUM Web Vitals (Sentry Performance) | XS |

## 5. Vue chronologique sur 5 mois

Hypothèse ressources : **1 PO + 2 développeurs + 1 QA**.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Mois 1                                                                   │
├──────────────────────────────────────────────────────────────────────────┤
│ Semaine 1 — Quick wins (QW-1 à QW-14)                                    │
│ Semaine 2-4 — Hardening front (P0-FE-1 à P0-FE-9)                        │
│   + Sentry + Zod + Zustand + design system primitives + code-splitting   │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│ Mois 2-3                                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│ Backend & multi-user (P0-BE-1 à P0-BE-7)                                 │
│   NestJS + PostgreSQL + Keycloak + TanStack Query                        │
│   Migration data localStorage → API (feature flag)                       │
│   RBAC + audit log immuable                                              │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│ Mois 3-4 (parallèle backend)                                             │
├──────────────────────────────────────────────────────────────────────────┤
│ Métier directionnel pro (P0-PS-1 à P0-PS-6 + P1-PS-1 à P1-PS-7)          │
│   coeffN/coeffN1, N-1 bidir, BESS exclusif, foisonnement, gel étude      │
│   CAPAC enrichi, Q réactif, saisonnalité                                 │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│ Mois 4                                                                   │
├──────────────────────────────────────────────────────────────────────────┤
│ Conformité CWaPE (P0-CW-1 à P0-CW-6)                                     │
│   Signature DocuSign/itsme, PDF offre, SLA, notifications,               │
│   dépilage formalisé, champs raccordement                                │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│ Mois 4-5                                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│ UX professionnelle (P1-UX-1 à P1-UX-13)                                  │
│   Design tokens, badge factory, tableaux pro, command palette,           │
│   comparateur scénarios, mobile, dark mode raffiné                       │
│ Opérateur (P1-OP-1 à P1-OP-13)                                           │
│   Ma journée, owner/SLA/âge, batch actions, templates, tâches/rappels    │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│ Mois 5+                                                                  │
├──────────────────────────────────────────────────────────────────────────┤
│ Industrialisation (P1-FS-1 à P1-FS-8)                                    │
│   TypeScript progressif, Playwright e2e, jest-axe, CSP, observabilité    │
│ + sélection P2 selon priorités produit                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Cible finale** : un outil comparable, en niveau, à Linear (UX), Salesforce (data tables), Power BI (charts), ArcGIS (carte), avec une couche métier réseau au standard ORES / RESA / Elia.

---

# PARTIE V — CONCLUSION ET RISQUES

## 1. Verdict synthétique

**RESA Capacité v3.2 est « l'os d'une excellente application »** :

- **Forces structurelles** — engines purs et testés, modèle canonique versionné, vocabulaire métier juste, séparation propre engines/UI, dark mode complet, 99 tests passants, 5 dépendances runtime, 0 vulnérabilité npm. C'est le meilleur prototype B2B métier examiné depuis longtemps sur sa couche calculatoire.
- **Manque la chair** — backend multi-utilisateur, conformité CWaPE (signature, SLA, audit), finesse métier directionnelle (N-1 INJ bidirectionnelle, foisonnement cohérent, gel étude, BESS exclusif, profils horaires, Q réactif), composants UX professionnels (design system primitives, virtualisation, command palette, batch actions) et accessibilité WCAG AA.

**Niveau actuel** : prototype avancé / outil métier local robuste utilisable en démo interne uniquement.

**Niveau cible** : outil opérationnel multi-utilisateur déployable chez un GRD belge (RESA, ORES, Sibelga) avec couche métier au standard et conformité réglementaire (CWaPE, RGIE, GDPR).

**Effort estimé pour atteindre la cible** : **~5 mois × 1 PO + 2 dev + 1 QA**.

L'investissement est **largement justifié** par la qualité du socle existant : la couche `engines/` est l'un des principaux actifs du projet et survit à n'importe quel refactor front. La trajectoire n'est pas une réécriture mais un **enrichissement incrémental** sur quatre piliers parallélisables (hardening front, backend, métier directionnel, conformité CWaPE).

## 2. Top 15 actions prioritaires (synthèse exécutable)

Classement par ratio **impact / effort** pour un démarrage immédiat.

| # | Action | Pri | Effort | Impact | Pourquoi en premier | Statut |
|---|---|---|---|---|---|---|
| 1 | ESLint + Prettier + Husky + GitHub Actions CI | P0 | XS | ★★★★ | Filet de sécurité immédiat, prérequis à tout refacto | **Terminé** — développé, commité localement et poussé sur GitHub (`origin/main`, `a20dfce`) |
| 2 | `useMemo(getEffectiveSubstations)` + cache `computeCapacityImpact` | P0 | XS | ★★★★★ | Gain perf 30-50 % immédiat, 10+ recalculs N² supprimés | **Terminé** — Développé : oui ; Commit local : `f09b475` ; Push GitHub : `origin/main` (`f09b475`) ; CI GitHub : `25934624241` success |
| 3 | Sentry front + back + ErrorBoundary « Recharger / Signaler » | P0 | XS | ★★★★★ | Sans télémétrie, chaque déploiement est à l'aveugle | À faire |
| 4 | Schémas Zod + remplacer `try/catch (_) {}` (storage + import) | P0 | S | ★★★★★ | Sécurité données + base réutilisable backend | À faire |
| 5 | Clarifier `coeffN`/`coeffN1` avec expert RESA + documenter | P0 | XS | ★★★★★ | Seul point qui invaliderait toutes les sorties chiffrées | À faire |
| 6 | Marge opérationnelle `securityMargin` configurable par poste | P0 | XS | ★★★★ | Évite saturation à la 1ʳᵉ contingence | À faire |
| 7 | Code-splitting routes + `manualChunks` + plugin React standard | P0 | S | ★★★★ | Bundle 250 → 120 KB gzip, démos plus rapides | À faire |
| 8 | Composants design system primitives (Modal a11y, Tooltip, Toast, ConfirmDialog, DataTable, Combobox) | P0 | L | ★★★★ | Bloque toutes les autres améliorations UX/a11y | À faire |
| 9 | Découper `RequestWorkflowPanels.jsx` (1076 LOC → 8 fichiers) | P0 | M | ★★★ | Bloque toute évolution du workflow |
| 10 | Migration store Zustand + suppression props drilling | P1 | M | ★★★★ | Prérequis à TanStack Query / backend |
| 11 | Geler l'étude (`assessment.frozenAt + snapshotHash`) | P0 | S | ★★★★★ | Pré-requis conformité CWaPE et offre binding |
| 12 | Backend MVP (NestJS + Postgres + Keycloak read-only + TanStack Query) | P0 | XL | ★★★★★ | Pivot du produit : multi-user et audit deviennent faisables |
| 13 | Signature offre + PDF + DocuSign/itsme + audit log immuable | P0 | XL | ★★★★★ | Conformité légale ; obligatoire pour production GRD |
| 14 | Tests Playwright e2e (3 parcours métier) + jest-axe + coverage | P1 | M | ★★★ | Aucune confiance hors engines sans e2e |
| 15 | TypeScript progressif (engines d'abord) | P1 | L | ★★★★ | 14 kLOC sans types = refactor à risque |

## 3. Risques à signaler immédiatement à la direction

Quatre risques majeurs identifiés par les deux audits initiaux et confirmés par les analyses spécialisées :

### 3.1 Risque légal / CWaPE

Sans audit trail, sans signature, sans SLA tracé, **toute contestation est juridiquement perdue**. Le déploiement actuel n'est possible **qu'en démo interne**. L'usage opérationnel exposerait le GRD à des contentieux clients et à un non-respect des décisions CWaPE sur les délais de raccordement.

**Mesure immédiate** : ne pas autoriser d'usage opérationnel tant que P0-BE-6 (audit immuable) et P0-CW-1 (signature offre) ne sont pas livrés.

### 3.2 Risque opérationnel — perte de données

Un seul utilisateur, un seul navigateur, une seule base. Un `localStorage.clear()` accidentel, un quota plein silencieux, un JSON corrompu, ou simplement un changement de poste utilisateur — et le travail est **détruit sans alerte**.

**Mesure immédiate** : exécuter QW-9 (gestion quota explicite) et QW-13 (confirmation forte sur reset) dans la semaine. Préparer un export automatique périodique en attendant le backend.

### 3.3 Risque technique métier — capacités d'injection surévaluées

Le N-1 actuel ne couvre que la perte d'un transfo HV/MT côté prélèvement. Les capacités d'injection N-1 sont calculées via un simple ratio `reverseCapacityRatio` qui n'est pas physique. Conséquence concrète : **des offres d'injection peuvent être impossibles à honorer en cas de contingence réelle** (perte d'un transfo + parc PV à 100 % de production), exposant le GRD à des litiges clients et des problèmes d'exploitation.

**Mesure immédiate** : challenger P0-PS-1 (`coeffN`/`coeffN1`) avec un expert RESA dans le mois et exécuter P0-PS-2 (N-1 bidirectionnel) au plus vite.

### 3.4 Risque de transition énergétique

`reqClientPrelevFlexible` retourne `0` en dur, `curtailable: true` n'est jamais exploité, le `flexible` n'apparaît jamais côté demande. Conséquence : **des raccordements ENR sont refusés alors qu'ils seraient acceptables en contrat flexible** (CWaPE 2024). Cela aggrave les délais de transition et expose le GRD à des plaintes producteurs.

**Mesure immédiate** : prioriser P0-PS-5 (`reqClientPrelevFlexible` réel) dans le sprint métier.

---

## Synthèse en une phrase

> RESA v3.2 est **l'os d'une excellente application** (engines testés, modèle canonique, dark mode, vocabulaire métier juste) **à laquelle il manque la chair** : backend multi-utilisateur, conformité CWaPE, finesse métier directionnelle (N-1 INJ, foisonnement, gel étude, profils, Q réactif), composants UX professionnels et accessibilité AA. **Cinq mois bien investis suffisent à la rendre déployable en environnement GRD belge réel.**

---

## Annexes

### A. Sources et méthode

Ce document s'appuie sur :

1. **`AUDIT.md`** (29 KB, mai 2026) — audit interne Power System + Planning Operator + UX/UI + Full-Stack, 425 lignes, 60+ items chiffrés (PS-1 à PS-15, OP-1 à OP-29, UX-1 à UX-22, FS-1 à FS-22, P0/P1/P2 plan d'actions).
2. **`AUDIT_RESA_CAPACITE_2026-05-15.md`** (20 KB, 15 mai 2026) — audit interne transversal (Power System, Planning Operator, UX/UI, FullStackDev, sécurité, performance, QA), 429 lignes, plan de route semaine par semaine.
3. **Analyse complémentaire « Expert Power System / GRD wallon »** — revue ciblée des formules de capacité, conventions de signe, foisonnement, BESS, CAPAC, projets et données initiales. 10 manques métier critiques (MET-1 à MET-10), 10 recommandations ordonnées (R1 à R10).
4. **Analyse complémentaire « Analyste fonctionnel senior »** — revue page par page (9 vues), parcours utilisateur, frictions opérateur, fonctions manquantes à forte VA, synthèse transversale (5 points + top 8 features).
5. **Analyse complémentaire « Architecte logiciel / Tech lead »** — état architectural, state management, découpage modules, performance, testing, build/DX, CI/CD, migration vers stack production, sécurité, observabilité. 11 sections + top 12 actions.
6. **Lecture directe du code** : `package.json`, `App.jsx`, `useNavigation.js`, `Sidebar.jsx`, arborescence `src/`, `README.md`, ainsi que validation croisée des constats des audits sur les engines.

### B. Glossaire métier rapide

- **GRD** — Gestionnaire de Réseau de Distribution (RESA, ORES, Sibelga, etc.)
- **HTB / HTA** — Haute Tension B (> 50 kV) / A (1-50 kV) — niveaux de tension de distribution
- **SS** — Sous-station (« poste ») électrique de transformation
- **TFO** — Transformateur
- **N / N-1** — Capacité en régime normal / après perte d'un élément (contingence)
- **CAPAC** — Procédure d'avis Elia (gestionnaire réseau transport) pour les raccordements > 5 MVA
- **CWaPE** — Commission wallonne pour l'énergie (régulateur)
- **RGIE** — Règlement Général sur les Installations Électriques (norme belge)
- **Foisonnement** — Coefficient appliqué pour tenir compte de la non-simultanéité des pics de consommation
- **Curtailment / Écrêtage** — Réduction commandée de production ou consommation
- **BESS** — Battery Energy Storage System (stockage par batteries)
- **EAN** — European Article Number, identifiant unique d'un point de raccordement (14 chiffres)
- **PAU / PAC** — Point d'Accès Utilisateur / Point d'Accès Clientèle
- **FIFO** — First-In First-Out, règle de file d'attente non-discriminatoire imposée par la CWaPE

### C. Inventaire des fichiers code mentionnés

```
src/
  ui/App.jsx                                             ≈ 256 LOC — orchestrateur
  ui/hooks/useNavigation.js                              ≈ 70 LOC
  ui/pages/overview/OverviewPage.jsx
  ui/pages/substations/SubstationListPage.jsx
  ui/pages/substations/SubstationDetail.jsx
  ui/pages/substations/tabs/{Evolution,Investissements,ConnectedCapacity,DemandesQueue}Tab.jsx
  ui/pages/substations/tabs/components/AnnualTable.jsx   ⚠ key={Math.random()}
  ui/pages/substations/tabs/components/DirectionalChart.jsx  ⚠ chart.destroy() absent
  ui/pages/queue/GlobalQueuePage.jsx
  ui/pages/queue/components/QueueCockpitTable.jsx        ≈ 630 LOC — à découper
  ui/pages/projects/NetworkProjectsPage.jsx
  ui/pages/projects/components/ProjectWizard.jsx         ⚠ reconstruction depuis allSubstations
  ui/pages/requests/RequestCasePage.jsx
  ui/pages/requests/components/RequestWorkflowPanels.jsx ≈ 1076 LOC — à découper
  ui/pages/map/MapPage.jsx                               ⚠ map.remove() absent, var(--surface)
  ui/pages/intake/SaisieModal.jsx                        ⚠ pas de nav post-création
  ui/shared/ActivityLogDrawer.jsx                        ⚠ suppression cascade silencieuse
  ui/shared/ModalShell.jsx                               ⚠ pas de focus trap / aria-modal
  ui/shared/badges.jsx                                   ≈ 50 variantes à factoriser

  engines/capacity.js                                    coeffN/coeffN1, getEffectiveTfoConfig
  engines/capacityEvaluation.js                          marge opérationnelle manquante
  engines/capacityImpact.js                              statuts FIFO
  engines/directionalSubstation.js                       ≈ 474 LOC — à découper
  engines/projectEffects.js                              4 types d'effets
  engines/queueOrdering.js                               fallback '9999-12-31' silencieux
  engines/requests.js                                    reqClientPrelevFlexible hardcodé 0
  engines/workflowRules.js                               gel étude absent
  
  services/storage.js                                    ⚠ try/catch (_) silencieux, pas de Zod
  utils/format.js                                        ⚠ uid() non cryptographique
  data/initial.js                                        ⚠ 24 KB dans bundle, sources non documentées
```

### D. Convention de codification des actions

Toutes les actions du backlog sont identifiables par un préfixe :

- `QW-N` — Quick win (semaine 1)
- `P0-PS-N` — P0 Power System
- `P0-BE-N` — P0 Backend
- `P0-CW-N` — P0 Conformité CWaPE
- `P0-FE-N` — P0 Front-end hardening
- `P1-PS-N` / `P1-OP-N` / `P1-UX-N` / `P1-FS-N` — P1 par axe
- `P2-N` — P2 polish / scalabilité

Cette codification permet de référencer une action depuis le code, les tickets, les commits, et de tracer l'avancement.

---

*Fin du document — 15 mai 2026.*
