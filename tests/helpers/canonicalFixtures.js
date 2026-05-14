import { normalizeRequest } from '../../src/engines/requestModel.js';

export function canonicalSubstation(overrides = {}) {
  return {
    id: 'ss-test',
    name: 'Poste Test',
    code: 'PT-001',
    commune: 'Liege',
    voltageLevel: '36/10 kV',
    voltageUpstream: '36kV',
    status: 'actif',
    transformerConfig: {
      transformers: [
        { id: 't1', power: 25, role: 'normal' },
        { id: 't2', power: 25, role: 'normal' },
      ],
      coeffN: 0.9,
      coeffN1: 1,
      mtBackup: { enabled: false, capacity: 0 },
      reverseCapacityRatio: 0.8,
    },
    directionalModel: {
      referenceYear: 2025,
      withdrawalView: {
        maxHistoricLoadBT: 8,
        maxHistoricLoadMT: 6,
        minHistoricInjectionBT: 1,
        minHistoricInjectionMT: 0,
        growthLoadMaxBT: 0,
        growthLoadMaxMT: 0,
        growthMinInjectionBT: 0,
        growthMinInjectionMT: 0,
      },
      injectionView: {
        maxHistoricInjectionBT: 2,
        maxHistoricInjectionMT: 1,
        minHistoricLoadBT: 1,
        minHistoricLoadMT: 0,
        growthMaxInjectionBT: 0,
        growthMaxInjectionMT: 0,
        growthMinLoadBT: 0,
        growthMinLoadMT: 0,
      },
    },
    foisonnement: {
      industriel: 1,
      ENR: 1,
      stockage: 1,
      tertiaire: 1,
      résidentiel: 1,
      autre: 1,
    },
    connectionRequests: [],
    notes: '',
    ...overrides,
  };
}

export function canonicalRequest(options = {}) {
  const {
    id = 'req-test',
    subId = 'ss-test',
    name = 'Client Test',
    reference = 'REQ-001',
    type = 'industriel',
    customerStatus = 'ready_for_study',
    assessmentStatus = 'not_started',
    offerStatus = 'not_applicable',
    requestDate = '2026-01-10',
    readyForStudyAt = requestDate,
    load = 5,
    injection = 0,
    year = 2027,
    commissioning = '2027-06-01',
    loadStatus = assessmentStatus === 'studied' ? 'OK' : 'PENDING',
    injectionStatus = assessmentStatus === 'studied' ? 'OK' : 'PENDING',
    loadPermanent = load,
    loadFlexible = 0,
    injectionPermanent = injection,
    injectionFlexible = 0,
    offerDates = {},
    connectedRetentionMonths,
    conditionedOnProjectIds = [],
    nextActions = [],
  } = options;

  return normalizeRequest({
    id,
    targetSubstationId: subId,
    customer: {
      status: customerStatus,
      source: 'manual',
      createdAt: `${requestDate}T08:00:00.000Z`,
      updatedAt: `${requestDate}T08:00:00.000Z`,
      requestDate,
      readyForStudyAt,
      client: { name, reference, type },
      site: {
        label: name,
        commune: 'Liege',
        address: { street: '', number: '', postalCode: '', city: 'Liege', country: 'Belgique', freeform: 'Liege' },
        coordinates: { lat: '', lng: '', source: 'manual' },
      },
      requested: {
        direction: load > 0 && injection > 0 ? 'BOTH' : injection > 0 ? 'INJECTION' : 'LOAD',
        load,
        injection,
        total: load + injection,
        year,
        desiredCommissioningDate: commissioning,
      },
      powerBreakdown: { loadMode: 'MANUAL', injectionMode: 'MANUAL', load: [], injection: [] },
      targetSubstationId: subId,
    },
    assessment: {
      status: assessmentStatus,
      assignedTo: '',
      takenInChargeAt: assessmentStatus === 'under_study' || assessmentStatus === 'studied' ? '2026-02-01' : '',
      assessedAt: assessmentStatus === 'studied' ? '2026-02-15' : '',
      capac: { status: 'NOT_SENT', sentAt: '', receivedAt: '' },
      upstream: {},
      substation: {},
      network: {},
      final: {
        load: { requested: load, permanent: loadPermanent, flexible: loadFlexible, status: loadStatus, source: 'FINAL' },
        injection: { requested: injection, permanent: injectionPermanent, flexible: injectionFlexible, status: injectionStatus, source: 'FINAL' },
      },
      scenarioProfile: 'central',
      warnings: [],
      confidence: 'HIGH',
      nextActions,
    },
    offer: {
      status: offerStatus,
      formulatedAt: offerDates.formulatedAt,
      expiredAt: offerDates.expiredAt,
      cancelledAt: offerDates.cancelledAt,
      acceptedAt: offerDates.acceptedAt,
      connectedAt: offerDates.connectedAt,
      connectedRetentionMonths,
      comment: '',
    },
    reservationMonths: 18,
    conditionedOnProjectIds,
    internalNotes: '',
    audit: [],
    changeHistory: [],
    milestones: [],
  }, subId);
}

export function studiedRequest(options = {}) {
  return canonicalRequest({
    assessmentStatus: 'studied',
    offerStatus: 'offer_formulated',
    offerDates: { formulatedAt: '2026-02-20', ...options.offerDates },
    ...options,
  });
}

export function connectedRequest(options = {}) {
  return studiedRequest({
    offerStatus: 'offer_connected',
    offerDates: { formulatedAt: '2026-02-20', acceptedAt: '2026-03-01', connectedAt: '2026-04-01', ...options.offerDates },
    connectedRetentionMonths: 6,
    ...options,
  });
}
