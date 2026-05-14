import { safeNum } from '../utils/numbers.js';
import {
  CONNECTED_RETENTION_DEFAULT_MONTHS,
  CONNECTED_RETENTION_MAX_MONTHS,
  CONNECTED_RETENTION_MIN_MONTHS,
} from '../constants/index.js';
import { pendingSplit, withRequested } from './capacitySplit.js';

export const isoNow = () => new Date().toISOString();
export const isoToday = () => new Date().toISOString().slice(0, 10);

const CAPAC_STATUSES = new Set(['NOT_SENT', 'SENT', 'RECEIVED']);
const BREAKDOWN_MODES = new Set(['AUTO', 'MANUAL']);
const QUALIFIED_CONSTRAINTS = new Set(['UPSTREAM', 'SUBSTATION', 'NETWORK']);
const CONSTRAINED_FINAL_STATUSES = new Set(['LIMIT', 'FULL_FLEX', 'KO']);

function round(value) {
  return +safeNum(value, 0).toFixed(1);
}

function normalizeRetentionMonths(value) {
  const n = Math.round(safeNum(value, CONNECTED_RETENTION_DEFAULT_MONTHS));
  return Math.max(CONNECTED_RETENTION_MIN_MONTHS, Math.min(CONNECTED_RETENTION_MAX_MONTHS, n));
}

function normalizeProjectIds(ids = []) {
  return Array.isArray(ids)
    ? ids.filter(Boolean).filter((id, index, arr) => arr.indexOf(id) === index)
    : [];
}

function defaultCustomer(targetSubstationId) {
  const now = isoNow();
  return {
    status: 'incomplete',
    source: 'manual',
    createdAt: now,
    updatedAt: now,
    requestDate: '',
    readyForStudyAt: '',
    client: { name: '', reference: '', type: 'industriel' },
    site: {
      label: '',
      commune: '',
      address: {
        street: '',
        number: '',
        postalCode: '',
        city: '',
        country: 'Belgique',
        freeform: '',
      },
      coordinates: { lat: '', lng: '', source: 'manual' },
    },
    requested: {
      total: 0,
      direction: 'LOAD',
      load: 0,
      injection: 0,
      year: new Date().getFullYear() + 1,
      desiredCommissioningDate: '',
    },
    powerBreakdown: {
      loadMode: 'MANUAL',
      injectionMode: 'MANUAL',
      load: [],
      injection: [],
    },
    targetSubstationId,
  };
}

function defaultAssessment() {
  return {
    status: 'not_started',
    assignedTo: '',
    takenInChargeAt: '',
    assessedAt: '',
    capac: { status: 'NOT_SENT', sentAt: '', receivedAt: '' },
    upstream: {},
    substation: {},
    network: {},
    final: {},
    scenarioProfile: 'central',
    warnings: [],
    confidence: 'MEDIUM',
    nextAction: null,
  };
}

function defaultOffer() {
  return {
    status: 'not_applicable',
    formulatedAt: '',
    expiredAt: '',
    cancelledAt: '',
    acceptedAt: '',
    connectedAt: '',
    connectedRetentionMonths: undefined,
    comment: '',
  };
}

export function getCustomer(req = {}) {
  return req.customer || defaultCustomer(req.targetSubstationId);
}

export function getAssessment(req = {}) {
  return req.assessment || defaultAssessment();
}

export function getOffer(req = {}) {
  return req.offer || defaultOffer();
}

export function getRequestedLoad(req = {}) {
  return safeNum(getCustomer(req).requested?.load, 0);
}

export function getRequestedInjection(req = {}) {
  return safeNum(getCustomer(req).requested?.injection, 0);
}

export function getRequestedTotal(req = {}) {
  const customer = getCustomer(req);
  const declared = safeNum(customer.requested?.total, 0);
  return declared || getRequestedLoad(req) + getRequestedInjection(req);
}

export function isQualifiedLimitingConstraint(assessment = {}) {
  const constraint = assessment.final?.limitingConstraint;
  if (!QUALIFIED_CONSTRAINTS.has(constraint)) return false;
  const finalSplits = [assessment.final?.load, assessment.final?.injection].filter(Boolean);
  return finalSplits.some(split => CONSTRAINED_FINAL_STATUSES.has(split.status));
}

export function getRequestDirection(load, injection) {
  if (load > 0 && injection > 0) return 'BOTH';
  if (injection > 0) return 'INJECTION';
  return 'LOAD';
}

function normalizeMode(mode, fallback = 'MANUAL') {
  return BREAKDOWN_MODES.has(mode) ? mode : fallback;
}

function componentId(prefix, index, item = {}) {
  return item.id || `${prefix}-${index + 1}`;
}

function normalizeLoadComponent(item = {}, index = 0) {
  return {
    id: componentId('load', index, item),
    type: item.type || 'process',
    label: item.label || '',
    powerMva: round(item.powerMva),
    flexible: Boolean(item.flexible),
  };
}

function normalizeInjectionComponent(item = {}, index = 0) {
  const powerMva = round(item.powerMva);
  return {
    id: componentId('injection', index, item),
    source: item.source || 'PV',
    label: item.label || '',
    powerMva,
    installedMva: item.installedMva === undefined ? undefined : round(item.installedMva),
    curtailable: Boolean(item.curtailable),
  };
}

function sumComponents(items = []) {
  return round((items || []).reduce((sum, item) => sum + safeNum(item.powerMva, 0), 0));
}

export function normalizePowerBreakdown(powerBreakdown = {}, requested = {}) {
  const load = Array.isArray(powerBreakdown.load) ? powerBreakdown.load.map(normalizeLoadComponent) : [];
  const injection = Array.isArray(powerBreakdown.injection) ? powerBreakdown.injection.map(normalizeInjectionComponent) : [];
  const loadMode = normalizeMode(powerBreakdown.loadMode, load.length ? 'AUTO' : 'MANUAL');
  const injectionMode = normalizeMode(powerBreakdown.injectionMode, injection.length ? 'AUTO' : 'MANUAL');
  return {
    loadMode,
    injectionMode,
    load,
    injection,
    requestedLoad: round(requested.load),
    requestedInjection: round(requested.injection),
  };
}

export function computePowerBreakdownSummary(powerBreakdown = {}, requested = {}) {
  const normalized = normalizePowerBreakdown(powerBreakdown, requested);
  const loadSum = sumComponents(normalized.load);
  const injectionSum = sumComponents(normalized.injection);
  const requestedLoad = normalized.loadMode === 'AUTO' ? loadSum : round(requested.load);
  const requestedInjection = normalized.injectionMode === 'AUTO' ? injectionSum : round(requested.injection);
  return {
    loadSum,
    injectionSum,
    requestedLoad,
    requestedInjection,
    loadDelta: round(requestedLoad - loadSum),
    injectionDelta: round(requestedInjection - injectionSum),
  };
}

export function isUpstreamResponseComplete(upstream = {}, requestedLoad = 0, requestedInjection = 0) {
  const loadOk = requestedLoad <= 0 || (upstream.load && upstream.load.status !== 'PENDING');
  const injectionOk = requestedInjection <= 0 || (upstream.injection && upstream.injection.status !== 'PENDING');
  return Boolean(loadOk && injectionOk);
}

function normalizeDateOnly(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function clampActualDate(value, today = isoToday()) {
  const date = normalizeDateOnly(value);
  if (!date) return '';
  return date > today ? today : date;
}

function latestDate(dates = []) {
  const sorted = dates.map(normalizeDateOnly).filter(Boolean).sort();
  return sorted[sorted.length - 1] || '';
}

function upstreamResponseDates(upstream = {}, requestedLoad = 0, requestedInjection = 0, today = isoToday()) {
  const splits = [
    requestedLoad > 0 ? upstream.load : null,
    requestedInjection > 0 ? upstream.injection : null,
  ].filter(split => split && split.status !== 'PENDING');
  return splits.map(split => clampActualDate(split.answeredAt || split.responseDate || '', today)).filter(Boolean);
}

export function latestUpstreamResponseDate(upstream = {}, requestedLoad = 0, requestedInjection = 0, today = isoToday()) {
  return latestDate(upstreamResponseDates(upstream, requestedLoad, requestedInjection, today));
}

export function normalizeCapacTracking(capac = {}, upstream = {}, requestedLoad = 0, requestedInjection = 0, today = isoToday()) {
  const upstreamComplete = isUpstreamResponseComplete(upstream, requestedLoad, requestedInjection);
  const sentAt = clampActualDate(capac.sentAt, today);
  const splitReceivedAt = upstreamComplete
    ? latestUpstreamResponseDate(upstream, requestedLoad, requestedInjection, today)
    : '';
  let receivedAt = upstreamComplete ? latestDate([clampActualDate(capac.receivedAt, today), splitReceivedAt]) : '';
  if (sentAt && receivedAt && receivedAt < sentAt) receivedAt = sentAt;
  const derivedStatus = receivedAt ? 'RECEIVED' : sentAt ? 'SENT' : 'NOT_SENT';
  let status = CAPAC_STATUSES.has(capac.status) ? capac.status : derivedStatus;
  if (receivedAt) status = 'RECEIVED';
  else if (sentAt && status === 'NOT_SENT') status = 'SENT';
  else if (!upstreamComplete && status === 'RECEIVED') status = sentAt ? 'SENT' : 'NOT_SENT';
  return { status, sentAt, receivedAt };
}

export function updateCapacTrackingForUpstream(capac = {}, upstream = {}, requestedLoad = 0, requestedInjection = 0, today = isoToday()) {
  const normalized = normalizeCapacTracking(capac, upstream, requestedLoad, requestedInjection, today);
  if (isUpstreamResponseComplete(upstream, requestedLoad, requestedInjection)) {
    const splitReceivedAt = latestUpstreamResponseDate(upstream, requestedLoad, requestedInjection, today);
    return {
      ...normalized,
      status: 'RECEIVED',
      receivedAt: latestDate([normalized.receivedAt, splitReceivedAt]) || today,
    };
  }
  if (normalized.status === 'RECEIVED' && !normalized.receivedAt) {
    return { ...normalized, status: normalized.sentAt ? 'SENT' : 'NOT_SENT' };
  }
  return normalized;
}

export function isCustomerComplete(customer = {}) {
  const requested = customer.requested || {};
  const hasPower = safeNum(requested.load, 0) + safeNum(requested.injection, 0) > 0;
  return Boolean(
    customer.client?.name?.trim()
    && customer.targetSubstationId
    && customer.requestDate
    && hasPower
    && (requested.desiredCommissioningDate || requested.year)
  );
}

function normalizeSplit(split, requested, source, fallbackReason) {
  if (requested <= 0) return undefined;
  if (!split) return pendingSplit(requested, source, fallbackReason);
  if (split.status === 'PENDING') return pendingSplit(requested, source, split.reason || fallbackReason);
  return withRequested({
    ...split,
    source,
    reason: split.reason || fallbackReason,
    confidence: split.confidence || 'MEDIUM',
  }, requested);
}

function normalizeLayer(layer = {}, requestedLoad, requestedInjection, source, fallbackReason) {
  return {
    conditionedOnProjectIds: normalizeProjectIds(layer.conditionedOnProjectIds),
    load: normalizeSplit(layer.load, requestedLoad, source, fallbackReason),
    injection: normalizeSplit(layer.injection, requestedInjection, source, fallbackReason),
  };
}

function normalizeAssessment(baseAssessment = {}, customer) {
  const base = { ...defaultAssessment(), ...baseAssessment };
  const load = safeNum(customer.requested?.load, 0);
  const injection = safeNum(customer.requested?.injection, 0);
  const upstream = normalizeLayer(base.upstream, load, injection, 'UPSTREAM', 'Réponse CAPAC à compléter');
  const substation = normalizeLayer(base.substation, load, injection, 'SUBSTATION', 'Réponse local/sous-station à compléter');
  const network = normalizeLayer(base.network, load, injection, 'NETWORK', 'Étude réseau MT à compléter');
  const final = {
    load: normalizeSplit(base.final?.load, load, 'FINAL', 'Réponse finale à calculer'),
    injection: normalizeSplit(base.final?.injection, injection, 'FINAL', 'Réponse finale à calculer'),
    limitingConstraint: base.final?.limitingConstraint || 'UNKNOWN',
  };
  return {
    ...base,
    capac: normalizeCapacTracking(base.capac, upstream, load, injection),
    upstream,
    substation,
    network,
    final,
    scenarioProfile: base.scenarioProfile || 'central',
    warnings: Array.isArray(base.warnings) ? base.warnings : [],
    nextAction: base.nextAction || null,
  };
}

function normalizeOffer(baseOffer = {}) {
  const base = { ...defaultOffer(), ...baseOffer };
  const connectedRetentionMonths = normalizeRetentionMonths(base.connectedRetentionMonths);
  return {
    ...base,
    status: base.status || 'not_applicable',
    connectedRetentionMonths: base.status === 'offer_connected' ? connectedRetentionMonths : base.connectedRetentionMonths,
    comment: base.comment || '',
  };
}

export function normalizeRequest(req = {}, targetSubstationId = req.targetSubstationId) {
  const fallbackCustomer = defaultCustomer(targetSubstationId);
  const rawCustomer = req.customer || {};
  const customer = {
    ...fallbackCustomer,
    ...rawCustomer,
    client: { ...fallbackCustomer.client, ...(rawCustomer.client || {}) },
    site: {
      ...fallbackCustomer.site,
      ...(rawCustomer.site || {}),
      address: {
        ...fallbackCustomer.site.address,
        ...(rawCustomer.site?.address || {}),
      },
      coordinates: {
        ...fallbackCustomer.site.coordinates,
        ...(rawCustomer.site?.coordinates || {}),
      },
    },
    requested: { ...fallbackCustomer.requested, ...(rawCustomer.requested || {}) },
    targetSubstationId: rawCustomer.targetSubstationId || targetSubstationId || fallbackCustomer.targetSubstationId,
  };

  customer.powerBreakdown = normalizePowerBreakdown(rawCustomer.powerBreakdown || fallbackCustomer.powerBreakdown, customer.requested);
  const breakdownSummary = computePowerBreakdownSummary(customer.powerBreakdown, customer.requested);
  customer.requested.load = customer.powerBreakdown.loadMode === 'AUTO'
    ? breakdownSummary.loadSum
    : round(customer.requested.load);
  customer.requested.injection = customer.powerBreakdown.injectionMode === 'AUTO'
    ? breakdownSummary.injectionSum
    : round(customer.requested.injection);
  customer.requested.total = round(customer.requested.load + customer.requested.injection);
  customer.requested.direction = getRequestDirection(customer.requested.load, customer.requested.injection);
  customer.status = customer.status === 'cancelled'
    ? 'cancelled'
    : isCustomerComplete(customer) ? 'ready_for_study' : 'incomplete';
  if (customer.status === 'ready_for_study' && !customer.readyForStudyAt) {
    customer.readyForStudyAt = customer.requestDate || customer.createdAt || isoNow();
  }

  const assessment = normalizeAssessment(req.assessment, customer);
  const offer = normalizeOffer(req.offer);
  const conditionedOnProjectIds = normalizeProjectIds([
    ...(req.conditionedOnProjectIds || []),
    ...(assessment.substation?.conditionedOnProjectIds || []),
    ...(assessment.network?.conditionedOnProjectIds || []),
  ]);

  return {
    id: req.id,
    targetSubstationId: customer.targetSubstationId,
    customer,
    assessment,
    offer,
    demo: req.demo,
    reservationMonths: safeNum(req.reservationMonths, 18),
    internalNotes: req.internalNotes ?? '',
    audit: Array.isArray(req.audit) ? req.audit : [],
    changeHistory: Array.isArray(req.changeHistory) ? req.changeHistory : [],
    milestones: Array.isArray(req.milestones) ? req.milestones : [],
    conditionedOnProjectIds,
  };
}
