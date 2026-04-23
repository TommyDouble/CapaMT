/**
 * data/initial.js
 * Données initiales — premier chargement, avant persistance localStorage.
 * v6 : chaque sous-station inclut un bloc directionalModel complet.
 */

// ── Helper interne : bloc directionalModel ─────────────────────────────────
function dm(wv, iv, refYear = 2025) {
  return { referenceYear: refYear, withdrawalView: wv, injectionView: iv };
}

export const INITIAL_SUBSTATIONS = [
  // ────────────────────────────────────────────────────────────────────────
  // ss-001 — Liège Nord · 63kV · 40 MVA N-1 · urbain dense · croissance forte
  // Prélèvement dominant, faible injection (toitures PV).
  // ────────────────────────────────────────────────────────────────────────
  {
    id:'ss-001', name:'Liège Nord', code:'63N_LGE_NORD',
    commune:'Liège', voltageLevel:'63/10 kV', voltageUpstream:'63kV',
    transformers:[{id:'T1',power:40,status:'en service'},{id:'T2',power:40,status:'en service'}],
    transformerConfig:{
      transformers:[{id:'T1',power:40,role:'normal'},{id:'T2',power:40,role:'normal'}],
      coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:false,capacity:0},
      reverseCapacityRatio: 1.0,
    },
    plannableCapacity:40,
    directionalModel: dm(
      { // Vue Prélèvement — loadBT+loadMT-minInjBT-minInjMT = 18.5+11.0-1.0-0 = 28.5 ✓
        maxHistoricLoadBT: 18.5, maxHistoricLoadMT: 11.0,
        minHistoricInjectionBT: 1.0, minHistoricInjectionMT: 0.0,
        growthLoadMaxBT: 0.025, growthLoadMaxMT: 0.020,
        growthMinInjectionBT: 0.000, growthMinInjectionMT: 0.000,
      },
      { // Vue Injection — demande dominante (faible ENR), pas de contrainte inverse
        maxHistoricInjectionBT: 2.0, maxHistoricInjectionMT: 0.5,
        minHistoricLoadBT: 9.0, minHistoricLoadMT: 5.5,
        growthMaxInjectionBT: 0.060, growthMaxInjectionMT: 0.000,
        growthMinLoadBT: 0.015, growthMinLoadMT: 0.015,
      }
    ),
    // Legacy conservé pour compatibilité
    baseLoad2025:28.5, organicGrowthRate:.025, status:'actif',
    chargeHistory:[],
    connectionRequests:[
      { id:'cr-001-1', name:'Parc logistique Bierset — Ph.2', refProjet:'AMT-2024-0142',
        type:'industriel', status:'étudiée', yearSouhaitee:2027,
        dateDepot:'2024-06-15', dateOffre:'2024-11-10', reservationMonths:18, dateMES:'2027-06-01',
        raccordementDate:null,
        client:{ prelevFerme:8.0, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'process',puissance:6.0,flexible:false},{usage:'tertiaire',puissance:2.0,flexible:false}],
          detailInjection:[] },
        grd:{ prelevFerme:6.0, prelevFlexible:2.0, injFerme:0, injFlexible:0,
              decisionGRD:'acceptable', noteDecision:'Convention signée. Réservation active.' } },
      { id:'cr-001-2', name:'Recharge VE flotte Proximus', refProjet:'AMT-2024-0219',
        type:'tertiaire', status:'étudiée', yearSouhaitee:2027,
        dateDepot:'2024-09-01', dateOffre:'2025-01-10', reservationMonths:18, dateMES:'2027-01-01',
        raccordementDate:null,
        client:{ prelevFerme:1.2, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'recharge_VE',puissance:1.2,flexible:true}],
          detailInjection:[] },
        grd:{ prelevFerme:0.3, prelevFlexible:0.9, injFerme:0, injFlexible:0,
              decisionGRD:'acceptable', noteDecision:'Charge pilotable smart charging confirmée.' } },
      { id:'cr-001-3', name:'Extension Technoparc Liège', refProjet:'AMT-2025-0088',
        type:'tertiaire', status:'en_étude', yearSouhaitee:2029,
        dateDepot:'2025-04-10', dateOffre:null, reservationMonths:18, dateMES:'2029-01-01',
        raccordementDate:null,
        client:{ prelevFerme:2.5, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'tertiaire',puissance:2.5,flexible:false}],
          detailInjection:[] },
        grd:null },
      { id:'cr-001-4', name:'Datacenter CloudNode BE', refProjet:'AMT-2025-0201',
        type:'industriel', status:'conditionnel', yearSouhaitee:2030,
        dateDepot:'2025-10-01', dateOffre:null, reservationMonths:18, dateMES:'2030-01-01',
        raccordementDate:null,
        client:{ prelevFerme:14.0, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'process',puissance:14.0,flexible:false}],
          detailInjection:[] },
        grd:null,
        decisionGRD:'conditionnel', noteDecision:'Conditionnel au renforcement T1 2029.' },
    ],
    investments:[],
    notes:'Sous-station urbaine dense. Fort dynamisme EV + tertiaire. Prélèvement dominant.',
  },

  // ────────────────────────────────────────────────────────────────────────
  // ss-002 — Seraing · 36kV · 25 MVA N-1 · industriel · proche saturation
  // Prélèvement dominant, presque saturé côté retrait.
  // ────────────────────────────────────────────────────────────────────────
  {
    id:'ss-002', name:'Seraing', code:'36N_SER',
    commune:'Seraing', voltageLevel:'36/10 kV', voltageUpstream:'36kV',
    transformers:[{id:'T1',power:25,status:'en service'},{id:'T2',power:25,status:'en service'}],
    transformerConfig:{
      transformers:[{id:'T1',power:25,role:'normal'},{id:'T2',power:25,role:'normal'}],
      coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:false,capacity:0},
      reverseCapacityRatio: 0.90,
    },
    plannableCapacity:25,
    directionalModel: dm(
      { // loadBT+loadMT-minInjBT = 13.0+9.0-0.8 = 21.2 ✓
        maxHistoricLoadBT: 13.0, maxHistoricLoadMT: 9.0,
        minHistoricInjectionBT: 0.8, minHistoricInjectionMT: 0.0,
        growthLoadMaxBT: 0.012, growthLoadMaxMT: 0.012,
        growthMinInjectionBT: 0.000, growthMinInjectionMT: 0.000,
      },
      { // Zone industrielle reconversion — faible injection
        maxHistoricInjectionBT: 0.5, maxHistoricInjectionMT: 0.0,
        minHistoricLoadBT: 5.0, minHistoricLoadMT: 3.5,
        growthMaxInjectionBT: 0.030, growthMaxInjectionMT: 0.000,
        growthMinLoadBT: 0.010, growthMinLoadMT: 0.010,
      }
    ),
    baseLoad2025:21.2, organicGrowthRate:.012, status:'actif',
    chargeHistory:[],
    connectionRequests:[
      { id:'cr-002-1', name:'CMI Industrie — extension forge', refProjet:'AMT-2024-0067',
        type:'industriel', status:'étudiée', yearSouhaitee:2026,
        dateDepot:'2024-03-20', dateOffre:'2024-08-01', reservationMonths:18, dateMES:'2026-06-01',
        raccordementDate:null,
        client:{ prelevFerme:4.5, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'process',puissance:4.5,flexible:false}],
          detailInjection:[] },
        grd:{ prelevFerme:3.5, prelevFlexible:1.0, injFerme:0, injFlexible:0,
              decisionGRD:'acceptable', noteDecision:'Convention signée. MES imminente.' } },
      { id:'cr-002-2', name:'Reconversion friche Cockerill Ph.1', refProjet:'AMT-2024-0155',
        type:'tertiaire', status:'en_étude', yearSouhaitee:2028,
        dateDepot:'2024-06-01', dateOffre:null, reservationMonths:18, dateMES:'2028-01-01',
        raccordementDate:null,
        client:{ prelevFerme:2.0, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'tertiaire',puissance:2.0,flexible:false}],
          detailInjection:[] },
        grd:null,
        noteDecision:'⚠ Réservation expirée — relance en attente du promoteur.' },
    ],
    investments:[], notes:'Zone industrielle en reconversion. Proche saturation prélèvement.',
  },

  // ────────────────────────────────────────────────────────────────────────
  // ss-003 — Herstal · 63kV · 40 MVA N-1 · fort dynamisme + ENR croissant
  // Contrainte prélèvement court terme, contrainte injection émergente 2032+.
  // ────────────────────────────────────────────────────────────────────────
  {
    id:'ss-003', name:'Herstal', code:'63N_HER',
    commune:'Herstal', voltageLevel:'63/10 kV', voltageUpstream:'63kV',
    transformers:[{id:'T1',power:40,status:'en service'},{id:'T2',power:40,status:'en service'}],
    transformerConfig:{
      transformers:[{id:'T1',power:40,role:'normal'},{id:'T2',power:40,role:'normal'}],
      coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:false,capacity:0},
      reverseCapacityRatio: 1.0,
    },
    plannableCapacity:40,
    directionalModel: dm(
      { // loadBT+loadMT-minInjBT = 11.5+7.0-0.5 = 18.0 ✓
        maxHistoricLoadBT: 11.5, maxHistoricLoadMT: 7.0,
        minHistoricInjectionBT: 0.5, minHistoricInjectionMT: 0.0,
        growthLoadMaxBT: 0.030, growthLoadMaxMT: 0.025,
        growthMinInjectionBT: 0.000, growthMinInjectionMT: 0.000,
      },
      { // ENR (PV) en forte croissance → contrainte injection dès 2032
        maxHistoricInjectionBT: 3.5, maxHistoricInjectionMT: 0.0,
        minHistoricLoadBT: 4.5, minHistoricLoadMT: 2.0,
        growthMaxInjectionBT: 0.120, growthMaxInjectionMT: 0.000,
        growthMinLoadBT: 0.010, growthMinLoadMT: 0.010,
      }
    ),
    baseLoad2025:18.0, organicGrowthRate:.030, status:'actif',
    chargeHistory:[],
    connectionRequests:[
      { id:'cr-003-1', name:'Amazon Logistics HUB Hauts-Sarts', refProjet:'AMT-2024-0178',
        type:'industriel', status:'étudiée', yearSouhaitee:2027,
        dateDepot:'2024-07-10', dateOffre:'2025-01-15', reservationMonths:18, dateMES:'2027-06-01',
        raccordementDate:null,
        client:{ prelevFerme:6.0, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'process',puissance:4.0,flexible:false},{usage:'recharge_VE',puissance:2.0,flexible:false}],
          detailInjection:[] },
        grd:{ prelevFerme:5.0, prelevFlexible:1.0, injFerme:0, injFlexible:0,
              decisionGRD:'acceptable', noteDecision:'' } },
      { id:'cr-003-2', name:'Zone PME Hauts-Sarts — extension', refProjet:'AMT-2024-0231',
        type:'industriel', status:'étudiée', yearSouhaitee:2028,
        dateDepot:'2024-10-15', dateOffre:'2025-03-01', reservationMonths:18, dateMES:'2028-06-01',
        raccordementDate:null,
        client:{ prelevFerme:3.5, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'process',puissance:3.5,flexible:false}],
          detailInjection:[] },
        grd:{ prelevFerme:3.5, prelevFlexible:0, injFerme:0, injFlexible:0,
              decisionGRD:'acceptable', noteDecision:'' } },
      { id:'cr-003-3', name:'Parc PV Wandre (curtailable)', refProjet:'AMT-2025-0031',
        type:'ENR', status:'en_étude', yearSouhaitee:2027,
        dateDepot:'2025-02-01', dateOffre:null, reservationMonths:12, dateMES:'2027-01-01',
        raccordementDate:null,
        client:{ prelevFerme:0, prelevFlexible:0, injFerme:0.3, injFlexible:1.7,
          detailPrelevement:[],
          detailInjection:[{source:'PV',puissanceInstallee:2.5,puissanceContractuelle:2.0}] },
        grd:null,
        noteDecision:'⚠ Réservation expirée — contact pris le 10/03.' },
      { id:'cr-003-4', name:'Quartier durable Wandre — Ph.1', refProjet:'AMT-2025-0112',
        type:'résidentiel', status:'en_étude', yearSouhaitee:2030,
        dateDepot:'2025-07-01', dateOffre:null, reservationMonths:18, dateMES:'2030-01-01',
        raccordementDate:null,
        client:{ prelevFerme:4.0, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'tertiaire',puissance:4.0,flexible:false}],
          detailInjection:[] },
        grd:null },
      { id:'cr-003-5', name:'Data Hub Telenet — NL2', refProjet:'AMT-2025-0187',
        type:'industriel', status:'conditionnel', yearSouhaitee:2032,
        dateDepot:'2025-09-15', dateOffre:null, reservationMonths:24, dateMES:'2032-01-01',
        raccordementDate:null,
        client:{ prelevFerme:8.0, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'process',puissance:8.0,flexible:false}],
          detailInjection:[] },
        grd:null,
        decisionGRD:'conditionnel', noteDecision:'Conditionnel à un investissement réseau non planifié.' },
    ],
    investments:[], notes:'Fort dynamisme. Saturation prélèvement attendue 2031. ENR émergent.',
  },

  // ────────────────────────────────────────────────────────────────────────
  // ss-004 — Grâce-Hollogne · 63kV · 40 MVA N-1 · 1 tfo + secours MT
  // Prélèvement fort, BESS bidirectionnel (injection + prélèvement flexibles).
  // ────────────────────────────────────────────────────────────────────────
  {
    id:'ss-004', name:'Grâce-Hollogne', code:'63N_GRA_HOL',
    commune:'Grâce-Hollogne', voltageLevel:'63/10 kV', voltageUpstream:'63kV',
    transformers:[{id:'T1',power:40,status:'en service'}],
    transformerConfig:{
      transformers:[{id:'T1',power:40,role:'normal'}],
      coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:true,capacity:40},
      reverseCapacityRatio: 1.0,
    },
    plannableCapacity:40,
    directionalModel: dm(
      { // loadBT+loadMT-minInjBT = 20.0+12.0-1.0 = 31.0 ✓
        maxHistoricLoadBT: 20.0, maxHistoricLoadMT: 12.0,
        minHistoricInjectionBT: 1.0, minHistoricInjectionMT: 0.0,
        growthLoadMaxBT: 0.020, growthLoadMaxMT: 0.018,
        growthMinInjectionBT: 0.000, growthMinInjectionMT: 0.000,
      },
      { // BESS présent — injection potentielle modérée + charge min
        maxHistoricInjectionBT: 1.5, maxHistoricInjectionMT: 1.5,
        minHistoricLoadBT: 8.0, minHistoricLoadMT: 5.0,
        growthMaxInjectionBT: 0.000, growthMaxInjectionMT: 0.000,
        growthMinLoadBT: 0.015, growthMinLoadMT: 0.015,
      }
    ),
    baseLoad2025:31.0, organicGrowthRate:.020, status:'actif',
    chargeHistory:[],
    connectionRequests:[
      { id:'cr-004-1', name:'Extension Aéroport LGG (critique)', refProjet:'AMT-2024-0008',
        type:'industriel', status:'étudiée', yearSouhaitee:2026,
        dateDepot:'2024-01-10', dateOffre:'2024-05-20', reservationMonths:18, dateMES:'2026-09-01',
        raccordementDate:null,
        client:{ prelevFerme:5.0, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'process',puissance:5.0,flexible:false}],
          detailInjection:[] },
        grd:{ prelevFerme:5.0, prelevFlexible:0, injFerme:0, injFlexible:0,
              decisionGRD:'acceptable', noteDecision:'Client prioritaire — infrastructure critique.' } },
      { id:'cr-004-2', name:'BESS ENGIE — stockage bidirectionnel', refProjet:'AMT-2025-0143',
        type:'stockage', status:'en_étude', yearSouhaitee:2028,
        dateDepot:'2025-05-15', dateOffre:null, reservationMonths:18, dateMES:'2028-06-01',
        raccordementDate:null,
        client:{ prelevFerme:0, prelevFlexible:2.0, injFerme:0, injFlexible:2.0,
          detailPrelevement:[{usage:'batteries',puissance:2.0,flexible:true}],
          detailInjection:[{source:'stockage',puissanceInstallee:2.0,puissanceContractuelle:2.0}] },
        grd:null,
        noteDecision:'Analyse en cours : impact bidirectionnel sur la planification N-1.' },
    ],
    investments:[], notes:'⚠ 1 seul tfo. Secours MT via réseau LGG. T2 prévu 2027 (proj-001).',
  },

  // ────────────────────────────────────────────────────────────────────────
  // ss-005 — Waremme · 36kV · 20 MVA N-1 · rural · ENR forte croissance
  // Prélèvement confortable, injection déjà contrainte et croissante.
  // ────────────────────────────────────────────────────────────────────────
  {
    id:'ss-005', name:'Waremme', code:'36N_WAR',
    commune:'Waremme', voltageLevel:'36/10 kV', voltageUpstream:'36kV',
    transformers:[{id:'T1',power:20,status:'en service'},{id:'T2',power:20,status:'en service'}],
    transformerConfig:{
      transformers:[{id:'T1',power:20,role:'normal'},{id:'T2',power:20,role:'normal'}],
      coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:false,capacity:0},
      reverseCapacityRatio: 1.0,
    },
    plannableCapacity:20,
    directionalModel: dm(
      { // loadBT+loadMT-minInjBT = 7.5+5.0-1.0 = 11.5 ✓
        maxHistoricLoadBT: 7.5, maxHistoricLoadMT: 5.0,
        minHistoricInjectionBT: 1.0, minHistoricInjectionMT: 0.0,
        growthLoadMaxBT: 0.018, growthLoadMaxMT: 0.015,
        growthMinInjectionBT: 0.000, growthMinInjectionMT: 0.000,
      },
      { // Forte injection ENR (éolien + agrivoltaïque) en croissance rapide
        // BaseNetInj2025 = -5.5+2.5+1.5 = -1.5 → contrainte injection existante
        maxHistoricInjectionBT: 5.5, maxHistoricInjectionMT: 0.0,
        minHistoricLoadBT: 2.5, minHistoricLoadMT: 1.5,
        growthMaxInjectionBT: 0.100, growthMaxInjectionMT: 0.000,
        growthMinLoadBT: 0.010, growthMinLoadMT: 0.010,
      }
    ),
    baseLoad2025:11.5, organicGrowthRate:.018, status:'actif',
    chargeHistory:[],
    connectionRequests:[
      { id:'cr-005-1', name:'Parc éolien Hesbaye (50% garanti)', refProjet:'AMT-2024-0098',
        type:'ENR', status:'étudiée', yearSouhaitee:2026,
        dateDepot:'2024-04-01', dateOffre:'2024-08-15', reservationMonths:18, dateMES:'2026-06-01',
        raccordementDate:null,
        client:{ prelevFerme:0, prelevFlexible:0, injFerme:0.5, injFlexible:1.0,
          detailPrelevement:[],
          detailInjection:[{source:'éolien',puissanceInstallee:3.0,puissanceContractuelle:1.5}] },
        grd:{ prelevFerme:0, prelevFlexible:0, injFerme:0.5, injFlexible:1.0,
              decisionGRD:'acceptable', noteDecision:'' } },
      { id:'cr-005-2', name:'Agrivoltaïque Fernelmont', refProjet:'AMT-2024-0334',
        type:'ENR', status:'en_étude', yearSouhaitee:2028,
        dateDepot:'2024-12-01', dateOffre:null, reservationMonths:18, dateMES:'2028-06-01',
        raccordementDate:null,
        client:{ prelevFerme:0, prelevFlexible:0, injFerme:0.5, injFlexible:1.5,
          detailPrelevement:[],
          detailInjection:[{source:'PV',puissanceInstallee:2.8,puissanceContractuelle:2.0}] },
        grd:null,
        noteDecision:'Réservation expire 01/06/2026 — relancer le promoteur.' },
      { id:'cr-005-3', name:'Zone résidentielle + commerce', refProjet:'AMT-2024-0213',
        type:'résidentiel', status:'étudiée', yearSouhaitee:2027,
        dateDepot:'2024-08-20', dateOffre:'2025-01-05', reservationMonths:18, dateMES:'2027-01-01',
        raccordementDate:null,
        client:{ prelevFerme:1.8, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'tertiaire',puissance:1.8,flexible:false}],
          detailInjection:[] },
        grd:{ prelevFerme:1.8, prelevFlexible:0, injFerme:0, injFlexible:0,
              decisionGRD:'acceptable', noteDecision:'' } },
      { id:'cr-005-4', name:'Hesbaye-Frost (process froid flexible)', refProjet:'AMT-2025-0167',
        type:'industriel', status:'en_étude', yearSouhaitee:2029,
        dateDepot:'2025-08-01', dateOffre:null, reservationMonths:18, dateMES:'2029-06-01',
        raccordementDate:null,
        client:{ prelevFerme:2.0, prelevFlexible:1.5, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'process',puissance:2.0,flexible:false},{usage:'batteries',puissance:1.5,flexible:true}],
          detailInjection:[] },
        grd:null,
        noteDecision:'Flexibilité process froid — valider contrat effacement.' },
    ],
    investments:[], notes:'Zone agricole. Confortable côté prélèvement. ENR en forte croissance.',
  },

  // ────────────────────────────────────────────────────────────────────────
  // ss-006 — Verviers · 36kV · 30 MVA N-1 · tension progressive 2028–2030
  // ────────────────────────────────────────────────────────────────────────
  {
    id:'ss-006', name:'Verviers', code:'36N_VER',
    commune:'Verviers', voltageLevel:'36/10 kV', voltageUpstream:'36kV',
    transformers:[{id:'T1',power:30,status:'en service'},{id:'T2',power:30,status:'en service'}],
    transformerConfig:{
      transformers:[{id:'T1',power:30,role:'normal'},{id:'T2',power:30,role:'normal'}],
      coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:false,capacity:0},
      reverseCapacityRatio: 1.0,
    },
    plannableCapacity:30,
    directionalModel: dm(
      { // loadBT+loadMT-minInjBT = 14.5+9.0-1.0 = 22.5 ✓
        maxHistoricLoadBT: 14.5, maxHistoricLoadMT: 9.0,
        minHistoricInjectionBT: 1.0, minHistoricInjectionMT: 0.0,
        growthLoadMaxBT: 0.022, growthLoadMaxMT: 0.018,
        growthMinInjectionBT: 0.000, growthMinInjectionMT: 0.000,
      },
      { // Injection modérée (toitures), pas de contrainte inverse significative
        maxHistoricInjectionBT: 2.0, maxHistoricInjectionMT: 0.0,
        minHistoricLoadBT: 5.5, minHistoricLoadMT: 3.5,
        growthMaxInjectionBT: 0.060, growthMaxInjectionMT: 0.000,
        growthMinLoadBT: 0.015, growthMinLoadMT: 0.015,
      }
    ),
    baseLoad2025:22.5, organicGrowthRate:.022, status:'actif',
    chargeHistory:[],
    connectionRequests:[
      { id:'cr-006-1', name:'Clinique Saint-Joseph — extension', refProjet:'AMT-2024-0119',
        type:'tertiaire', status:'étudiée', yearSouhaitee:2026,
        dateDepot:'2024-05-15', dateOffre:'2024-10-10', reservationMonths:18, dateMES:'2026-06-01',
        raccordementDate:null,
        client:{ prelevFerme:1.5, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'tertiaire',puissance:1.5,flexible:false}],
          detailInjection:[] },
        grd:{ prelevFerme:1.5, prelevFlexible:0, injFerme:0, injFlexible:0,
              decisionGRD:'acceptable', noteDecision:'Client institutionnel prioritaire.' } },
      { id:'cr-006-2', name:'Résidence seniors Cité Dardenne', refProjet:'AMT-2024-0182',
        type:'résidentiel', status:'étudiée', yearSouhaitee:2027,
        dateDepot:'2024-07-01', dateOffre:'2024-12-10', reservationMonths:18, dateMES:'2027-01-01',
        raccordementDate:null,
        client:{ prelevFerme:0.8, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'tertiaire',puissance:0.8,flexible:false}],
          detailInjection:[] },
        grd:{ prelevFerme:0.8, prelevFlexible:0, injFerme:0, injFlexible:0,
              decisionGRD:'acceptable', noteDecision:'' } },
      { id:'cr-006-3', name:'Campus numérique ULiège-Est', refProjet:'AMT-2025-0044',
        type:'tertiaire', status:'en_étude', yearSouhaitee:2029,
        dateDepot:'2025-03-10', dateOffre:null, reservationMonths:18, dateMES:'2029-01-01',
        raccordementDate:null,
        client:{ prelevFerme:2.0, prelevFlexible:0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'tertiaire',puissance:2.0,flexible:false}],
          detailInjection:[] },
        grd:null },
      { id:'cr-006-4', name:'Usine textile Tissage Ardenne', refProjet:'AMT-2025-0133',
        type:'industriel', status:'conditionnel', yearSouhaitee:2028,
        dateDepot:'2025-06-01', dateOffre:null, reservationMonths:18, dateMES:'2028-01-01',
        raccordementDate:null,
        client:{ prelevFerme:4.0, prelevFlexible:1.0, injFerme:0, injFlexible:0,
          detailPrelevement:[{usage:'process',puissance:4.0,flexible:false},{usage:'batteries',puissance:1.0,flexible:true}],
          detailInjection:[] },
        grd:null,
        decisionGRD:'conditionnel', noteDecision:'Conditionnel upgrade T1+T2 2031.' },
    ],
    investments:[], notes:'Tension progressive 2028–2030. Upgrade T1+T2 planifié 2031.',
  },
];

// ── Bloc directionalModel pour les nouvelles SS créées par projets ──────────
const DM_NEW_SS_EMPTY = dm(
  { maxHistoricLoadBT:0, maxHistoricLoadMT:0, minHistoricInjectionBT:0, minHistoricInjectionMT:0,
    growthLoadMaxBT:0.015, growthLoadMaxMT:0.015, growthMinInjectionBT:0.000, growthMinInjectionMT:0.000 },
  { maxHistoricInjectionBT:0, maxHistoricInjectionMT:0, minHistoricLoadBT:0, minHistoricLoadMT:0,
    growthMaxInjectionBT:0.000, growthMaxInjectionMT:0.000, growthMinLoadBT:0.010, growthMinLoadMT:0.010 }
);

export const INITIAL_NETWORK_PROJECTS = [
  {
    id:'proj-001', name:'Installation T2 — Grâce-Hollogne (N-1)',
    type:'renforcement', year:2027, mesInitiale:2026, cost:2200, status:'validé',
    notes:'T2 commandé. Résout la vulnérabilité N-1 actuelle.',
    effects:[
      { ssId:'ss-004', action:'modify_tfo',
        tfoChanges:{ remove:[], add:[{id:'T2',power:40,role:'normal'}], modify:[] } },
    ],
  },
  {
    id:'proj-002', name:'Remplacement T1 40→63 MVA — Liège Nord',
    type:'renforcement', year:2029, mesInitiale:2028, cost:1850, status:'planifié',
    notes:'Conditionné à la validation budgétaire 2027.',
    effects:[
      { ssId:'ss-001', action:'modify_tfo',
        tfoChanges:{ remove:['T1'], add:[{id:'T1b',power:63,role:'normal'}], modify:[] } },
    ],
  },
  {
    id:'proj-003', name:'Création SS Seraing-Ouest — délestage Seraing',
    type:'création', year:2028, mesInitiale:2027, cost:3800, status:'validé',
    notes:'Délestera 10 MVA de Seraing. Désature la zone industrielle.',
    effects:[
      { ssId:'ss-new-001', action:'create_ss',
        newSS:{
          id:'ss-new-001', name:'Seraing-Ouest', code:'36N_SER_OUEST',
          commune:'Seraing', voltageLevel:'36/10 kV', voltageUpstream:'36kV',
          transformerConfig:{
            transformers:[{id:'T1',power:25,role:'normal'},{id:'T2',power:25,role:'normal'}],
            coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:false,capacity:0},
            reverseCapacityRatio:1.0,
          },
          directionalModel: DM_NEW_SS_EMPTY,
          baseLoadInitial:0, organicGrowthRate:0.015, status:'actif',
          notes:'Nouvelle SS — desserte zone industrielle Seraing-Ouest.',
        },
      },
      { ssId:'ss-002', action:'load_transfer', loadDelta:-10.0, targetSsId:'ss-new-001' },
      { ssId:'ss-new-001', action:'load_transfer', loadDelta:10.0 },
    ],
  },
  {
    id:'proj-004', name:'Upgrade T1+T2 : 30→40 MVA — Verviers',
    type:'renforcement', year:2031, mesInitiale:2030, cost:2600, status:'planifié',
    notes:'Résout la tension 2028–2030.',
    effects:[
      { ssId:'ss-006', action:'modify_tfo',
        tfoChanges:{
          remove:['T1','T2'],
          add:[{id:'T1b',power:40,role:'normal'},{id:'T2b',power:40,role:'normal'}],
          modify:[],
        },
      },
    ],
  },
  {
    id:'proj-005', name:'Décommissionnement Waremme + création Hesbaye-Centre',
    type:'suppression', year:2034, mesInitiale:2033, cost:1200, status:'planifié',
    notes:'Étude à lancer. Rationalisation réseau Hesbaye — horizon 2034.',
    effects:[
      { ssId:'ss-new-002', action:'create_ss',
        newSS:{
          id:'ss-new-002', name:'Hesbaye-Centre', code:'36N_HES_CTR',
          commune:'Waremme', voltageLevel:'150/36 kV', voltageUpstream:'150kV',
          transformerConfig:{
            transformers:[{id:'T1',power:40,role:'normal'},{id:'T2',power:40,role:'normal'}],
            coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:false,capacity:0},
            reverseCapacityRatio:1.0,
          },
          directionalModel: DM_NEW_SS_EMPTY,
          baseLoadInitial:0, organicGrowthRate:0.018, status:'actif',
          notes:'Nouvelle SS 150kV/36kV — desserte élargie zone Hesbaye.',
        },
      },
      { ssId:'ss-005', action:'load_transfer', loadDelta:-11.5, targetSsId:'ss-new-002' },
      { ssId:'ss-new-002', action:'load_transfer', loadDelta:11.5 },
      { ssId:'ss-005', action:'decommission' },
    ],
  },
];

// ── Dataset de test ─────────────────────────────────────────────────────────
export const TEST_SUBSTATIONS = [
  {
    id:'test-ss-001', name:'TEST — Sans projet réseau', code:'TEST_NO_PROJ',
    commune:'Test', voltageLevel:'63/10 kV', voltageUpstream:'63kV', status:'actif',
    transformerConfig:{
      transformers:[{id:'T1',power:40,role:'normal'},{id:'T2',power:40,role:'normal'}],
      coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:false,capacity:0},
      reverseCapacityRatio:1.0,
    },
    directionalModel: dm(
      { maxHistoricLoadBT:13.0, maxHistoricLoadMT:7.0, minHistoricInjectionBT:0.0, minHistoricInjectionMT:0.0,
        growthLoadMaxBT:0.020, growthLoadMaxMT:0.020, growthMinInjectionBT:0.000, growthMinInjectionMT:0.000 },
      { maxHistoricInjectionBT:0.0, maxHistoricInjectionMT:0.0, minHistoricLoadBT:0.0, minHistoricLoadMT:0.0,
        growthMaxInjectionBT:0.000, growthMaxInjectionMT:0.000, growthMinLoadBT:0.000, growthMinLoadMT:0.000 }
    ),
    plannableCapacity:40, baseLoad2025:20.0, organicGrowthRate:0.020,
    chargeHistory:[], investments:[], foisonnement:{},
    connectionRequests:[
      { id:'test-cr-001',name:'Client industriel A',refProjet:'TEST-001',
        type:'industriel', status:'étudiée', yearSouhaitee:2027,
        dateDepot:'2025-01-01', dateOffre:'2025-06-01', reservationMonths:18, dateMES:'2027-01-01',
        raccordementDate:null,
        client:{prelevFerme:5.0,prelevFlexible:0,injFerme:0,injFlexible:0,
          detailPrelevement:[{usage:'process',puissance:5.0,flexible:false}],detailInjection:[]},
        grd:{prelevFerme:5.0,prelevFlexible:0,injFerme:0,injFlexible:0,
          decisionGRD:'acceptable',noteDecision:'Cas test baseline'} },
    ],
    notes:'CAS TEST 1 : aucun projet réseau. Baseline directionnelle seule.',
  },
  {
    id:'test-ss-002', name:'TEST — Avec renforcement', code:'TEST_WITH_PROJ',
    commune:'Test', voltageLevel:'36/10 kV', voltageUpstream:'36kV', status:'actif',
    transformerConfig:{
      transformers:[{id:'T1',power:20,role:'normal'},{id:'T2',power:20,role:'normal'}],
      coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:false,capacity:0},
      reverseCapacityRatio:1.0,
    },
    directionalModel: dm(
      { maxHistoricLoadBT:10.0, maxHistoricLoadMT:6.0, minHistoricInjectionBT:0.0, minHistoricInjectionMT:0.0,
        growthLoadMaxBT:0.025, growthLoadMaxMT:0.025, growthMinInjectionBT:0.000, growthMinInjectionMT:0.000 },
      { maxHistoricInjectionBT:0.0, maxHistoricInjectionMT:0.0, minHistoricLoadBT:0.0, minHistoricLoadMT:0.0,
        growthMaxInjectionBT:0.000, growthMaxInjectionMT:0.000, growthMinLoadBT:0.000, growthMinLoadMT:0.000 }
    ),
    plannableCapacity:20, baseLoad2025:16.0, organicGrowthRate:0.025,
    chargeHistory:[], investments:[], foisonnement:{},
    connectionRequests:[
      { id:'test-cr-002',name:'Grand industriel (conditionnel au renforcement)',refProjet:'TEST-002',
        type:'industriel', status:'conditionnel', yearSouhaitee:2029,
        dateDepot:'2025-03-01', dateOffre:null, reservationMonths:18, dateMES:'2029-01-01',
        raccordementDate:null,
        client:{prelevFerme:8.0,prelevFlexible:0,injFerme:0,injFlexible:0,
          detailPrelevement:[{usage:'process',puissance:8.0,flexible:false}],detailInjection:[]},
        grd:null, decisionGRD:'conditionnel',
        noteDecision:'Conditionnel au renforcement T1+T2 2028' },
    ],
    notes:'CAS TEST 2 : renforcement planifié. Capacité augmente en 2028.',
  },
  {
    id:'test-ss-003', name:'TEST — Avec injection ENR', code:'TEST_ENR',
    commune:'Test', voltageLevel:'63/10 kV', voltageUpstream:'63kV', status:'actif',
    transformerConfig:{
      transformers:[{id:'T1',power:40,role:'normal'},{id:'T2',power:40,role:'normal'}],
      coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:false,capacity:0},
      reverseCapacityRatio:1.0,
    },
    directionalModel: dm(
      { maxHistoricLoadBT:14.0, maxHistoricLoadMT:8.0, minHistoricInjectionBT:0.0, minHistoricInjectionMT:0.0,
        growthLoadMaxBT:0.015, growthLoadMaxMT:0.015, growthMinInjectionBT:0.000, growthMinInjectionMT:0.000 },
      { maxHistoricInjectionBT:5.0, maxHistoricInjectionMT:0.0, minHistoricLoadBT:3.0, minHistoricLoadMT:2.0,
        growthMaxInjectionBT:0.080, growthMaxInjectionMT:0.000, growthMinLoadBT:0.010, growthMinLoadMT:0.010 }
    ),
    plannableCapacity:40, baseLoad2025:22.0, organicGrowthRate:0.015,
    chargeHistory:[], investments:[], foisonnement:{},
    connectionRequests:[
      { id:'test-cr-003',name:'Parc PV Test',refProjet:'TEST-003',
        type:'ENR', status:'étudiée', yearSouhaitee:2027,
        dateDepot:'2025-01-15', dateOffre:'2025-07-01', reservationMonths:18, dateMES:'2027-06-01',
        raccordementDate:null,
        client:{prelevFerme:0,prelevFlexible:0,injFerme:0,injFlexible:3.0,
          detailPrelevement:[],
          detailInjection:[{source:'PV',puissanceInstallee:4.0,puissanceContractuelle:3.0}]},
        grd:{prelevFerme:0,prelevFlexible:0,injFerme:0,injFlexible:3.0,
          decisionGRD:'acceptable',noteDecision:'Injection curtailable PV'} },
    ],
    notes:'CAS TEST 3 : injection ENR curtailable. Contrainte injection croissante.',
  },
  {
    id:'test-ss-004', name:'TEST — Données partielles (NaN)', code:'TEST_NAN',
    commune:'Test', voltageLevel:'63/10 kV', voltageUpstream:'63kV', status:'actif',
    transformerConfig:{
      transformers:[{id:'T1',power:40,role:'normal'}],
      coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:false,capacity:0},
      reverseCapacityRatio:1.0,
    },
    plannableCapacity:40,
    baseLoad2025: NaN,
    organicGrowthRate: null,
    chargeHistory:[], investments:[], foisonnement:{},
    connectionRequests:[
      { id:'test-cr-004',name:'Demande champs vides',refProjet:'',
        type:'industriel', status:'en_étude', yearSouhaitee:2028,
        dateDepot:'', dateOffre:null, reservationMonths:null, dateMES:null,
        raccordementDate:null,
        client:{prelevFerme:'',prelevFlexible:'',injFerme:'',injFlexible:'',
          detailPrelevement:[],detailInjection:[]},
        grd:null },
    ],
    notes:'CAS TEST 4 : données partielles. Aucun crash ne doit survenir.',
  },
];

export const TEST_NETWORK_PROJECTS = [
  {
    id:'test-proj-001', name:'TEST — Renforcement T1+T2 20→40 MVA',
    type:'renforcement', year:2028, mesInitiale:2028,
    cost:2000, status:'planifié', notes:'Projet test pour CAS 2',
    effects:[{
      ssId:'test-ss-002',
      action:'modify_tfo',
      tfoChanges:{
        remove:['T1','T2'],
        add:[{id:'T1',power:40,role:'normal'},{id:'T2',power:40,role:'normal'}],
        modify:[],
      },
      coeffN:0.90, coeffN1:1.00, mtBackup:{enabled:false,capacity:0},
    }],
  },
];
