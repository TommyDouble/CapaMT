/**
 * data/initial.js
 *
 * Donnees initiales v10, generees autour du modele cible:
 * customer / assessment / offer / capacityImpact.
 *
 * Objectif du jeu d'exemple: disposer d'un dossier de chaque type client
 * dans chaque situation metier representative.
 */

import { ACTION_CODES } from '../constants/workflowActions.js';

function dm(wv, iv, refYear = 2025) {
  return { referenceYear: refYear, withdrawalView: wv, injectionView: iv };
}

function address(city, street = '', number = '', postalCode = '') {
  return {
    street,
    number,
    postalCode,
    city,
    country: 'Belgique',
    freeform: [street, number, postalCode, city].filter(Boolean).join(' '),
  };
}

function date(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function split(requested, permanent, source, reason, confidence = 'HIGH', validUntil) {
  const req = round(requested);
  const perm = Math.max(0, Math.min(req, round(permanent)));
  const flexible = round(req - perm);
  const status = req <= 0 || perm >= req
    ? 'OK'
    : perm <= 0
      ? 'FULL_FLEX'
      : 'LIMIT';
  return { requested: req, permanent: perm, flexible, status, reason, confidence, source, validUntil };
}

function pending(requested, source, reason) {
  return {
    requested: round(requested),
    permanent: 0,
    flexible: 0,
    status: 'PENDING',
    reason,
    confidence: 'LOW',
    source,
  };
}

function cloneItems(items, prefix) {
  return (items || []).map((item, index) => ({ id: `${prefix}-${index + 1}`, ...item }));
}

function customer({
  subId, name, reference, type, requestDate, readyForStudyAt,
  load = 0, injection = 0, year, mes, city, siteLabel,
  loadItems = [], injectionItems = [], statusOverride,
  coordinates,
}) {
  const complete = requestDate && (load + injection > 0) && mes;
  return {
    status: statusOverride || (complete ? 'ready_for_study' : 'incomplete'),
    source: 'manual',
    createdAt: `${requestDate || '2026-01-01'}T08:00:00.000Z`,
    updatedAt: `${requestDate || '2026-01-01'}T08:00:00.000Z`,
    requestDate,
    readyForStudyAt,
    client: { name, reference, type },
    site: {
      label: siteLabel || name,
      commune: city || '',
      address: address(city || ''),
      coordinates: coordinates || { lat: null, lng: null, source: 'manual' },
    },
    requested: {
      direction: load > 0 && injection > 0 ? 'BOTH' : injection > 0 ? 'INJECTION' : 'LOAD',
      load: round(load),
      injection: round(injection),
      total: round(load + injection),
      year,
      desiredCommissioningDate: mes,
    },
    powerBreakdown: {
      loadMode: 'MANUAL',
      injectionMode: 'MANUAL',
      load: cloneItems(loadItems, `${reference}-load`),
      injection: cloneItems(injectionItems, `${reference}-inj`),
    },
    targetSubstationId: subId,
  };
}

function assessment({
  status = 'not_started',
  assignedTo = '',
  takenInChargeAt,
  assessedAt,
  capac,
  upstream = {},
  substation = {},
  network = {},
  final = {},
  scenarioProfile = 'central',
  confidence = 'MEDIUM',
  nextAction = null,
} = {}) {
  return {
    status,
    assignedTo,
    takenInChargeAt,
    assessedAt,
    capac: capac || { status: 'NOT_SENT', sentAt: '', receivedAt: '' },
    upstream,
    substation,
    network,
    final,
    scenarioProfile,
    warnings: [],
    confidence,
    nextAction,
  };
}

function req({ id, subId, cust, assess, offer, demo, reservationMonths = 18, notes = '' }) {
  const layerProjectIds = [
    ...(assess?.substation?.conditionedOnProjectIds || []),
    ...(assess?.network?.conditionedOnProjectIds || []),
  ].filter((projectId, index, arr) => projectId && arr.indexOf(projectId) === index);
  return {
    id,
    customer: cust,
    assessment: assess,
    offer,
    demo,
    reservationMonths,
    internalNotes: notes,
    conditionedOnProjectIds: layerProjectIds,
    audit: [],
    changeHistory: [],
    milestones: [],
    targetSubstationId: subId,
  };
}

function offer(status = 'not_applicable', dates = {}, comment = '') {
  return {
    status,
    formulatedAt: dates.formulatedAt,
    expiredAt: dates.expiredAt,
    cancelledAt: dates.cancelledAt,
    acceptedAt: dates.acceptedAt,
    connectedAt: dates.connectedAt,
    comment,
  };
}

const FOISON = {
  industriel: 0.85,
  tertiaire: 0.80,
  ENR: 0.60,
  stockage: 0.75,
  résidentiel: 0.70,
  autre: 0.80,
};

const SUBSTATION_SPECS = [
  {
    id: 'ss-ln',
    short: 'ln',
    name: 'Liege Nord',
    code: '63N_LGE_NORD',
    commune: 'Liege',
    voltageLevel: '63/10 kV',
    voltageUpstream: '63kV',
    transformerPower: 40,
    reverseCapacityRatio: 1.0,
    coordinates: { lat: 50.6820, lng: 5.5710 },
    withdrawal: { maxHistoricLoadBT: 18, maxHistoricLoadMT: 11, minHistoricInjectionBT: 1, minHistoricInjectionMT: 0, growthLoadMaxBT: 0.020, growthLoadMaxMT: 0.020, growthMinInjectionBT: 0, growthMinInjectionMT: 0 },
    injection: { maxHistoricInjectionBT: 2.5, maxHistoricInjectionMT: 0.5, minHistoricLoadBT: 10, minHistoricLoadMT: 5, growthMaxInjectionBT: 0.050, growthMaxInjectionMT: 0.020, growthMinLoadBT: 0.010, growthMinLoadMT: 0.010 },
    notes: 'Poste urbain dense. Jeu de donnees de demo: conditions locales et reseau disponibles.',
  },
  {
    id: 'ss-ser',
    short: 'ser',
    name: 'Seraing Industrie',
    code: '36N_SER_IND',
    commune: 'Seraing',
    voltageLevel: '36/10 kV',
    voltageUpstream: '36kV',
    transformerPower: 25,
    reverseCapacityRatio: 0.9,
    coordinates: { lat: 50.6050, lng: 5.5000 },
    withdrawal: { maxHistoricLoadBT: 13.0, maxHistoricLoadMT: 9.0, minHistoricInjectionBT: 0.8, minHistoricInjectionMT: 0, growthLoadMaxBT: 0.012, growthLoadMaxMT: 0.012, growthMinInjectionBT: 0, growthMinInjectionMT: 0 },
    injection: { maxHistoricInjectionBT: 0.5, maxHistoricInjectionMT: 0.0, minHistoricLoadBT: 5.0, minHistoricLoadMT: 3.5, growthMaxInjectionBT: 0.030, growthMaxInjectionMT: 0, growthMinLoadBT: 0.010, growthMinLoadMT: 0.010 },
    notes: 'Poste industriel proche saturation. Projet T3 local et depart MT de demonstration.',
  },
  {
    id: 'ss-her',
    short: 'her',
    name: 'Herstal Nord',
    code: '63N_HER_NORD',
    commune: 'Herstal',
    voltageLevel: '63/10 kV',
    voltageUpstream: '63kV',
    transformerPower: 40,
    reverseCapacityRatio: 0.85,
    coordinates: { lat: 50.6650, lng: 5.6200 },
    withdrawal: { maxHistoricLoadBT: 11.5, maxHistoricLoadMT: 7.0, minHistoricInjectionBT: 0.5, minHistoricInjectionMT: 0, growthLoadMaxBT: 0.026, growthLoadMaxMT: 0.020, growthMinInjectionBT: 0, growthMinInjectionMT: 0 },
    injection: { maxHistoricInjectionBT: 3.5, maxHistoricInjectionMT: 0.5, minHistoricLoadBT: 4.5, minHistoricLoadMT: 2.0, growthMaxInjectionBT: 0.090, growthMaxInjectionMT: 0.040, growthMinLoadBT: 0.010, growthMinLoadMT: 0.010 },
    notes: 'Poste injection ENR et stockage, utile pour tester les dossiers bidirectionnels.',
  },
  {
    id: 'ss-ver',
    short: 'ver',
    name: 'Verviers Est',
    code: '36N_VER_EST',
    commune: 'Verviers',
    voltageLevel: '36/10 kV',
    voltageUpstream: '36kV',
    transformerPower: 30,
    reverseCapacityRatio: 1.0,
    coordinates: { lat: 50.5900, lng: 5.8700 },
    withdrawal: { maxHistoricLoadBT: 14.0, maxHistoricLoadMT: 10.0, minHistoricInjectionBT: 1.0, minHistoricInjectionMT: 0, growthLoadMaxBT: 0.018, growthLoadMaxMT: 0.018, growthMinInjectionBT: 0, growthMinInjectionMT: 0 },
    injection: { maxHistoricInjectionBT: 1.0, maxHistoricInjectionMT: 0.0, minHistoricLoadBT: 7.0, minHistoricLoadMT: 4.0, growthMaxInjectionBT: 0.030, growthMaxInjectionMT: 0, growthMinLoadBT: 0.010, growthMinLoadMT: 0.010 },
    notes: 'Poste mixte avec dossiers residentiels et clos dans le jeu de demonstration.',
  },
];

const PROJECT_BY_SUB = Object.fromEntries(
  SUBSTATION_SPECS.map(spec => [spec.id, {
    local: `prj-${spec.short}-local`,
    network: `prj-${spec.short}-network`,
  }])
);

export const INITIAL_NETWORK_PROJECTS = SUBSTATION_SPECS.flatMap(spec => [
  {
    id: PROJECT_BY_SUB[spec.id].local,
    name: `Renforcement local ${spec.name}`,
    type: 'renforcement',
    year: spec.id === 'ss-ver' ? 2027 : 2028,
    mesInitiale: spec.id === 'ss-ver' ? 2027 : 2028,
    cost: spec.id === 'ss-ser' ? 1800 : 1200,
    status: spec.id === 'ss-ln' ? 'validé' : 'en_cours',
    notes: `Projet conditionnant utilisable dans la couche Local / sous-station de ${spec.name}.`,
    effects: [{ ssId: spec.id, action: 'modify_tfo', tfoChanges: { remove: [], add: [{ id: 'T3', power: spec.transformerPower, role: 'normal' }], modify: [] } }],
  },
  {
    id: PROJECT_BY_SUB[spec.id].network,
    name: `Renforcement réseau MT ${spec.name}`,
    type: 'renforcement',
    year: spec.id === 'ss-her' ? 2029 : 2030,
    mesInitiale: spec.id === 'ss-her' ? 2029 : 2030,
    cost: spec.id === 'ss-ln' ? 2400 : 1600,
    status: spec.id === 'ss-ser' ? 'validé' : 'planifié',
    notes: `Projet conditionnant utilisable dans la couche Réseau MT abstrait de ${spec.name}.`,
    effects: [{ ssId: spec.id, action: 'modify_tfo', tfoChanges: { remove: [], add: [], modify: [] } }],
  },
]);

const TYPE_PROFILES = [
  {
    type: 'industriel',
    label: 'Industrie Atlas',
    subId: 'ss-ln',
    city: 'Liege',
    baseLat: 50.6750, baseLng: 5.5800,
    load: 6.0,
    injection: 0,
    loadItems: [
      { type: 'process', label: 'Process industriel', powerMva: 4.5, flexible: false },
      { type: 'recharge_VE', label: 'Recharge flotte', powerMva: 1.5, flexible: true },
    ],
    injectionItems: [],
  },
  {
    type: 'résidentiel',
    label: 'Ecoquartier Vesdre',
    subId: 'ss-ver',
    city: 'Verviers',
    baseLat: 50.5950, baseLng: 5.8500,
    load: 1.8,
    injection: 0,
    loadItems: [
      { type: 'tertiaire', label: 'Services communs', powerMva: 0.8, flexible: false },
      { type: 'recharge_VE', label: 'Bornes visiteurs', powerMva: 1.0, flexible: true },
    ],
    injectionItems: [],
  },
  {
    type: 'tertiaire',
    label: 'Campus Services',
    subId: 'ss-ser',
    city: 'Seraing',
    baseLat: 50.6100, baseLng: 5.4900,
    load: 3.2,
    injection: 0,
    loadItems: [
      { type: 'tertiaire', label: 'HVAC et bureaux', powerMva: 2.4, flexible: false },
      { type: 'recharge_VE', label: 'Parking recharge', powerMva: 0.8, flexible: true },
    ],
    injectionItems: [],
  },
  {
    type: 'ENR',
    label: 'Parc solaire Horizon',
    subId: 'ss-her',
    city: 'Herstal',
    baseLat: 50.6500, baseLng: 5.6350,
    load: 0,
    injection: 4.5,
    loadItems: [],
    injectionItems: [
      { source: 'PV', label: 'PV sol', powerMva: 4.5, installedMva: 5.8, curtailable: true },
    ],
  },
  {
    type: 'stockage',
    label: 'BESS FlexNode',
    subId: 'ss-her',
    city: 'Herstal',
    baseLat: 50.6700, baseLng: 5.6100,
    load: 2.8,
    injection: 2.8,
    loadItems: [
      { type: 'batteries', label: 'Charge batterie', powerMva: 2.8, flexible: true },
    ],
    injectionItems: [
      { source: 'stockage', label: 'Décharge batterie', powerMva: 2.8, installedMva: 2.8, curtailable: true },
    ],
  },
  {
    type: 'autre',
    label: 'Site mixte communal',
    subId: 'ss-ln',
    city: 'Liege',
    baseLat: 50.6900, baseLng: 5.5600,
    load: 1.2,
    injection: 0.8,
    loadItems: [
      { type: 'autre', label: 'Ateliers techniques', powerMva: 1.2, flexible: false },
    ],
    injectionItems: [
      { source: 'cogen', label: 'Cogénération appoint', powerMva: 0.8, installedMva: 1.0, curtailable: false },
    ],
  },
];

/** Coordonnées WGS84 d'un site client (partagées entre dossiers du même client). */
function siteCoordinates(baseLat, baseLng) {
  if (baseLat == null || baseLng == null) return null;
  return { lat: baseLat, lng: baseLng, source: 'manual' };
}

export const DEMO_SITUATIONS = [
  { key: 'incomplete', label: 'À compléter', code: 'INC', month: 4, requestYear: 2026, mesYear: 2028 },
  { key: 'ready_study', label: 'Prête pour étude', code: 'PRE', month: 4, requestYear: 2026, mesYear: 2028 },
  { key: 'study_capac', label: 'En étude - CAPAC', code: 'CAP', month: 3, requestYear: 2026, mesYear: 2028 },
  { key: 'study_local', label: 'En étude - local à compléter', code: 'LOC', month: 3, requestYear: 2026, mesYear: 2028 },
  { key: 'study_network', label: 'En étude - réseau MT à compléter', code: 'NET', month: 3, requestYear: 2026, mesYear: 2028 },
  { key: 'studied_ok', label: 'Étudiée acceptable', code: 'OK', month: 2, requestYear: 2026, mesYear: 2028 },
  { key: 'condition_local', label: 'Condition locale', code: 'CLO', month: 2, requestYear: 2026, mesYear: 2028 },
  { key: 'condition_network', label: 'Condition réseau MT', code: 'CNE', month: 2, requestYear: 2026, mesYear: 2029 },
  { key: 'offer_expired', label: 'Offre expirée', code: 'EXP', month: 9, requestYear: 2025, studyYear: 2025, studyMonth: 10, mesYear: 2027 },
  { key: 'offer_accepted', label: 'Offre acceptée', code: 'ACC', month: 10, requestYear: 2025, studyYear: 2025, studyMonth: 11, mesYear: 2027 },
  { key: 'connected', label: 'Raccordée', code: 'RAC', month: 10, requestYear: 2024, studyYear: 2025, studyMonth: 1, mesYear: 2026 },
  { key: 'cancelled', label: 'Annulée / libérée', code: 'ANN', month: 7, requestYear: 2025, studyYear: 2025, studyMonth: 8, mesYear: 2027 },
];

function layerFor(requested, source, mode, options = {}) {
  const layer = {};
  const reason = options.reason || `${source} ${mode}`;
  const ratio = options.ratio ?? 1;
  const confidence = options.confidence || (mode === 'limit' ? 'MEDIUM' : 'HIGH');
  const splitForMode = amount => {
    if (mode === 'pending') return pending(amount, source, reason);
    return split(amount, amount * ratio, source, reason, confidence, options.validUntil);
  };
  if (options.projectIds?.length) layer.conditionedOnProjectIds = options.projectIds;
  if (requested.load > 0) layer.load = splitForMode(requested.load);
  if (requested.injection > 0) layer.injection = splitForMode(requested.injection);
  return layer;
}

function finalFor(requested, mode, options = {}) {
  return {
    ...layerFor(requested, 'FINAL', mode, options),
    limitingConstraint: options.limitingConstraint || 'UNKNOWN',
  };
}

function readyAssessment(requested) {
  return assessment({
    upstream: layerFor(requested, 'UPSTREAM', 'pending', { reason: 'Réponse CAPAC à compléter' }),
    substation: layerFor(requested, 'SUBSTATION', 'pending', { reason: 'Réponse Local / sous-station à compléter' }),
    network: layerFor(requested, 'NETWORK', 'pending', { reason: 'Réponse Réseau MT abstrait à compléter' }),
    final: finalFor(requested, 'pending', { reason: 'Réponse finale à calculer' }),
  });
}

function assessmentFor(profile, situation, typeIndex) {
  const requested = { load: profile.load, injection: profile.injection };
  const localProjectId = PROJECT_BY_SUB[profile.subId].local;
  const networkProjectId = PROJECT_BY_SUB[profile.subId].network;
  const day = 3 + typeIndex * 3;
  const studyYear = situation.studyYear || situation.requestYear || 2026;
  const studyMonth = situation.studyMonth || situation.month;
  const takenInChargeAt = `${studyYear}-${String(studyMonth).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}T09:00:00.000Z`;
  const assessedAt = `${studyYear}-${String(studyMonth).padStart(2, '0')}-${String(day + 8).padStart(2, '0')}T14:30:00.000Z`;

  if (situation.key === 'incomplete') return assessment();
  if (situation.key === 'ready_study') return readyAssessment(requested);
  if (situation.key === 'study_capac') {
    return assessment({
      status: 'under_study',
      assignedTo: 'Cellule CAPAC',
      takenInChargeAt,
      capac: { status: 'SENT', sentAt: date(studyYear, studyMonth, day + 1), receivedAt: '' },
      upstream: layerFor(requested, 'UPSTREAM', 'pending', { reason: 'CAPAC demandé à ELIA' }),
      substation: layerFor(requested, 'SUBSTATION', 'ok', { reason: 'Marge locale pré-analysée' }),
      network: layerFor(requested, 'NETWORK', 'ok', { reason: 'Réseau MT sans blocage identifié' }),
      final: finalFor(requested, 'pending', { reason: 'Réponse manquante: UPSTREAM' }),
      nextAction: ACTION_CODES.DEMANDER_CAPAC,
    });
  }
  if (situation.key === 'study_local') {
    return assessment({
      status: 'under_study',
      assignedTo: 'Cellule études MT',
      takenInChargeAt,
      capac: { status: 'RECEIVED', sentAt: date(studyYear, studyMonth, day), receivedAt: date(studyYear, studyMonth, day + 6) },
      upstream: layerFor(requested, 'UPSTREAM', 'ok', { reason: 'CAPAC reçu favorable' }),
      substation: layerFor(requested, 'SUBSTATION', 'pending', { reason: 'Calcul local / sous-station à compléter' }),
      network: layerFor(requested, 'NETWORK', 'ok', { reason: 'Réseau MT non limitant' }),
      final: finalFor(requested, 'pending', { reason: 'Réponse manquante: SUBSTATION' }),
      nextAction: ACTION_CODES.COMPLETER_DONNEES_POSTE,
    });
  }
  if (situation.key === 'study_network') {
    return assessment({
      status: 'under_study',
      assignedTo: 'Cellule études réseau',
      takenInChargeAt,
      capac: { status: 'RECEIVED', sentAt: date(studyYear, studyMonth, day), receivedAt: date(studyYear, studyMonth, day + 5) },
      upstream: layerFor(requested, 'UPSTREAM', 'ok', { reason: 'CAPAC reçu favorable' }),
      substation: layerFor(requested, 'SUBSTATION', 'ok', { reason: 'Local / sous-station non limitant' }),
      network: layerFor(requested, 'NETWORK', 'pending', { reason: 'Analyse réseau MT abstrait à compléter' }),
      final: finalFor(requested, 'pending', { reason: 'Réponse manquante: NETWORK' }),
      nextAction: ACTION_CODES.FINALISER_ETUDE_RESEAU,
    });
  }
  if (situation.key === 'condition_local') {
    return assessment({
      status: 'studied',
      assignedTo: 'Cellule études MT',
      takenInChargeAt,
      assessedAt,
      capac: { status: 'RECEIVED', sentAt: date(studyYear, studyMonth, day), receivedAt: date(studyYear, studyMonth, day + 5) },
      upstream: layerFor(requested, 'UPSTREAM', 'ok', { reason: 'CAPAC favorable' }),
      substation: layerFor(requested, 'SUBSTATION', 'limit', {
        reason: 'Limitation locale N-1 avant projet poste',
        ratio: 0.58,
        projectIds: [localProjectId],
      }),
      network: layerFor(requested, 'NETWORK', 'ok', { reason: 'Réseau MT non limitant' }),
      final: finalFor(requested, 'limit', {
        reason: 'Minimum des trois couches: Local / sous-station',
        ratio: 0.58,
        limitingConstraint: 'SUBSTATION',
      }),
      confidence: 'MEDIUM',
    });
  }
  if (situation.key === 'condition_network') {
    return assessment({
      status: 'studied',
      assignedTo: 'Cellule études réseau',
      takenInChargeAt,
      assessedAt,
      capac: { status: 'RECEIVED', sentAt: date(studyYear, studyMonth, day), receivedAt: date(studyYear, studyMonth, day + 5) },
      upstream: layerFor(requested, 'UPSTREAM', 'ok', { reason: 'CAPAC favorable' }),
      substation: layerFor(requested, 'SUBSTATION', 'ok', { reason: 'Local / sous-station non limitant' }),
      network: layerFor(requested, 'NETWORK', 'limit', {
        reason: 'Réseau MT limitant avant projet conditionnant',
        ratio: 0.64,
        projectIds: [networkProjectId],
        validUntil: date(2027, 12, 31),
      }),
      final: finalFor(requested, 'limit', {
        reason: 'Minimum des trois couches: Réseau MT',
        ratio: 0.64,
        limitingConstraint: 'NETWORK',
      }),
      confidence: 'MEDIUM',
    });
  }

  return assessment({
    status: 'studied',
    assignedTo: 'Cellule études MT',
    takenInChargeAt,
    assessedAt,
    capac: { status: 'RECEIVED', sentAt: date(studyYear, studyMonth, day), receivedAt: date(studyYear, studyMonth, day + 5) },
    upstream: layerFor(requested, 'UPSTREAM', 'ok', { reason: 'CAPAC favorable' }),
    substation: layerFor(requested, 'SUBSTATION', 'ok', { reason: 'Local / sous-station non limitant' }),
    network: layerFor(requested, 'NETWORK', 'ok', { reason: 'Réseau MT non limitant' }),
    final: finalFor(requested, 'ok', { reason: 'Accord complet' }),
    confidence: 'HIGH',
  });
}

function offerFor(situation, typeIndex) {
  const day = 3 + typeIndex * 3;
  const studyYear = situation.studyYear || situation.requestYear || 2026;
  const studyMonth = situation.studyMonth || situation.month;
  if (situation.key === 'condition_local') {
    return offer('offer_formulated', { formulatedAt: date(studyYear, studyMonth, day + 10) }, 'Offre formulée sous condition locale / sous-station.');
  }
  if (situation.key === 'condition_network') {
    return offer('offer_formulated', { formulatedAt: date(studyYear, studyMonth, day + 10) }, 'Offre formulée sous condition réseau MT.');
  }
  if (situation.key === 'offer_expired') {
    return offer('offer_expired', { formulatedAt: date(2025, 10, day), expiredAt: date(2026, 1, day) }, 'Offre expirée à traiter explicitement.');
  }
  if (situation.key === 'offer_accepted') {
    return offer('offer_accepted', { formulatedAt: date(2026, 1, day), acceptedAt: date(2026, 2, day) }, 'Offre acceptée, raccordement à planifier.');
  }
  if (situation.key === 'connected') {
    return offer('offer_connected', { formulatedAt: date(2025, 1, day), acceptedAt: date(2025, 2, day), connectedAt: date(2026, 2, day) }, 'Raccordement réalisé.');
  }
  if (situation.key === 'cancelled') {
    return offer('offer_cancelled', { formulatedAt: date(2025, 6, day), cancelledAt: date(2025, 9, day) }, 'Projet abandonné par le client.');
  }
  return offer();
}

function demoRequest(profile, situation, typeIndex, situationIndex) {
  const day = 3 + typeIndex * 3;
  const requestYear = situation.requestYear || 2026;
  const requestMonth = situation.month;
  const requestDate = situation.key === 'incomplete'
    ? ''
    : date(requestYear, requestMonth, day);
  const readyForStudyAt = situation.key === 'incomplete'
    ? ''
    : date(requestYear, requestMonth, day + 2);
  const reference = `DEMO-${situation.code}-${String(typeIndex + 1).padStart(2, '0')}`;
  const mes = situation.key === 'incomplete'
    ? ''
    : date(situation.mesYear || (2027 + (situationIndex % 5)), 9, 1);
  const cust = customer({
    subId: profile.subId,
    name: `${profile.label} - ${situation.label}`,
    reference,
    type: profile.type,
    requestDate,
    readyForStudyAt,
    load: profile.load,
    injection: profile.injection,
    year: situation.mesYear || (2027 + (situationIndex % 5)),
    mes,
    city: profile.city,
    loadItems: profile.loadItems,
    injectionItems: profile.injectionItems,
    statusOverride: situation.key === 'cancelled' ? 'cancelled' : undefined,
    coordinates: siteCoordinates(profile.baseLat, profile.baseLng),
  });

  return req({
    id: `req-${situation.key}-${profile.type.replace(/[é]/g, 'e')}`,
    subId: profile.subId,
    cust,
    assess: assessmentFor(profile, situation, typeIndex),
    offer: offerFor(situation, typeIndex),
    demo: {
      type: profile.type,
      situation: situation.key,
      situationLabel: situation.label,
    },
    notes: `Dossier de démonstration ${profile.type} / ${situation.label}.`,
  });
}

function requestsForSubstation(subId) {
  return DEMO_SITUATIONS.flatMap((situation, situationIndex) =>
    TYPE_PROFILES
      .filter(profile => profile.subId === subId)
      .map((profile, typeIndex) => demoRequest(profile, situation, TYPE_PROFILES.indexOf(profile), situationIndex))
  );
}

function substationFromSpec(spec) {
  return {
    id: spec.id,
    name: spec.name,
    code: spec.code,
    commune: spec.commune,
    voltageLevel: spec.voltageLevel,
    voltageUpstream: spec.voltageUpstream,
    status: 'actif',
    transformerConfig: {
      transformers: [{ id: 'T1', power: spec.transformerPower, role: 'normal' }, { id: 'T2', power: spec.transformerPower, role: 'normal' }],
      coeffN: 0.90,
      coeffN1: 1.00,
      mtBackup: { enabled: false, capacity: 0 },
      reverseCapacityRatio: spec.reverseCapacityRatio,
    },
    directionalModel: dm(spec.withdrawal, spec.injection),
    foisonnement: FOISON,
    notes: spec.notes,
    coordinates: spec.coordinates || { lat: null, lng: null, source: 'manual' },
    connectionRequests: requestsForSubstation(spec.id),
  };
}

export const INITIAL_SUBSTATIONS = SUBSTATION_SPECS.map(substationFromSpec);

export const TEST_SUBSTATIONS = INITIAL_SUBSTATIONS;
export const TEST_NETWORK_PROJECTS = INITIAL_NETWORK_PROJECTS;
