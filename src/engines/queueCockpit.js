/**
 * engines/queueCockpit.js
 *
 * Lecture métier pure pour le cockpit global de file d'attente.
 * Ce module agrège le modèle canonique en lignes actionnables et filtrables.
 */

import { safeNum } from '../utils/numbers.js';
import { getQueueAnalysis, getExpiryInfo } from './queue.js';
import { computeCapacityImpact, isActiveCapacityImpact } from './capacityImpact.js';
import { getPrimaryAction } from './workflowRules.js';
import { buildConditionSummary } from './requests.js';
import {
  getAssessment,
  getCustomer,
  getOffer,
  getRequestedInjection,
  getRequestedLoad,
  isUpstreamResponseComplete,
  isQualifiedLimitingConstraint,
} from './requestModel.js';
import { ACTION_CODES, getActionLabel, readNextActions } from '../constants/workflowActions.js';

export const QUEUE_WORKFLOW_STEPS = [
  { key: 'all', label: 'Toutes demandes', shortLabel: 'Toutes', color: '#2563eb' },
  { key: 'to_complete', label: 'À compléter', shortLabel: 'À compléter', color: '#d97706' },
  { key: 'ready_study', label: 'Prêtes pour étude', shortLabel: 'Prêtes étude', color: '#2563eb' },
  { key: 'in_study', label: 'En étude', shortLabel: 'En étude', color: '#0369a1' },
  { key: 'offer_action', label: 'Offres à traiter', shortLabel: 'Offres', color: '#dc2626' },
  { key: 'to_connect', label: 'À raccorder', shortLabel: 'À raccorder', color: '#047857' },
  { key: 'closed', label: 'Clos', shortLabel: 'Clos', color: '#6b7280' },
];

export const DEFAULT_STEP = 'all';

export const ENERGY_DIRECTION_CONFIG = {
  load: { label: 'Prélèvement', shortLabel: 'Prél.', color: 'var(--prelev)' },
  injection: { label: 'Injection', shortLabel: 'Inj.', color: 'var(--inj)' },
  both: { label: 'Bidirectionnel', shortLabel: 'Bi-dir.', color: 'var(--accent)' },
  none: { label: 'Sans puissance', shortLabel: 'N/A', color: 'var(--text-muted)' },
};

export const RESERVATION_STATUS_CONFIG = {
  none: { label: 'Sans réservation', shortLabel: 'Aucune', color: '#6b7280' },
  active: { label: 'Active', shortLabel: 'Active', color: '#166534' },
  soon: { label: 'Expire bientôt', shortLabel: 'Bientôt', color: '#d97706' },
  expired: { label: 'Expirée', shortLabel: 'Expirée', color: '#dc2626' },
  released: { label: 'Libérée', shortLabel: 'Libérée', color: '#6b7280' },
  connected_retained: { label: 'Raccordée maintenue', shortLabel: 'Maintenue', color: '#047857' },
  connected_released: { label: 'Raccordée libérée', shortLabel: 'Libérée', color: '#4c1d95' },
};

export const LIMITING_CONSTRAINT_LABELS = {
  UPSTREAM: 'Amont / CAPAC',
  SUBSTATION: 'Local / sous-station',
  NETWORK: 'Réseau MT',
  UNKNOWN: 'À déterminer',
};

function rowKey(sub, req) {
  return `${sub.id}:${req.id}`;
}

function isFinalClosed({ customer, offer, impact }) {
  return (
    customer.status === 'cancelled' ||
    offer.status === 'offer_cancelled' ||
    impact.status === 'RELEASED' ||
    impact.status === 'CONNECTED_RELEASED'
  );
}

function isSplitExpired(split) {
  const rawDate = split?.validUntil || split?.expiresAt || split?.expiryDate;
  if (!rawDate) return false;
  const ts = new Date(rawDate).getTime();
  if (!Number.isFinite(ts)) return false;
  return ts < Date.now();
}

function isCapacRequired(assessment) {
  const upstream = assessment.upstream || {};
  return (
    readNextActions(assessment).includes(ACTION_CODES.DEMANDER_CAPAC) ||
    upstream.load?.status === 'PENDING' ||
    upstream.injection?.status === 'PENDING' ||
    isSplitExpired(upstream.load) ||
    isSplitExpired(upstream.injection)
  );
}

function hasPendingLayer(assessment, key) {
  const layer = assessment[key] || {};
  return layer.load?.status === 'PENDING' || layer.injection?.status === 'PENDING';
}

function hasPartialUpstreamResponse(assessment, requestedLoad, requestedInjection) {
  const upstream = assessment.upstream || {};
  const applicable = [
    requestedLoad > 0 ? upstream.load : null,
    requestedInjection > 0 ? upstream.injection : null,
  ].filter(Boolean);
  if (applicable.length <= 1) return false;
  const answered = applicable.some((split) => split.status && split.status !== 'PENDING');
  const pending = applicable.some((split) => split.status === 'PENDING');
  return answered && pending;
}

function deriveCapacActionStatus(assessment, requestedLoad, requestedInjection) {
  if (!isCapacRequired(assessment)) return null;
  if (hasPartialUpstreamResponse(assessment, requestedLoad, requestedInjection)) return 'partial';
  if (assessment.capac?.status === 'SENT') return 'sent';
  if (!isUpstreamResponseComplete(assessment.upstream, requestedLoad, requestedInjection))
    return 'not_sent';
  return null;
}

function deriveStudySubStatus(assessment) {
  if (!['under_study', 'blocked'].includes(assessment.status)) return null;
  if (isCapacRequired(assessment)) return 'CAPAC_ELIA_PENDING';
  if (hasPendingLayer(assessment, 'substation')) return 'LOCAL_SUBSTATION_PENDING';
  if (hasPendingLayer(assessment, 'network')) return 'NETWORK_PENDING';
  if (hasPendingLayer(assessment, 'final')) return 'FINAL_PENDING';
  return 'FINALIZABLE';
}

function deriveWorkflowStep({ customer, assessment, offer, impact }) {
  if (isFinalClosed({ customer, offer, impact })) return 'closed';
  if (offer.status === 'offer_accepted') return 'to_connect';
  if (offer.status === 'offer_expired') return 'offer_action';
  if (assessment.status === 'under_study' || assessment.status === 'blocked') return 'in_study';
  if (assessment.status === 'studied' || offer.status === 'offer_formulated') return 'offer_action';
  if (customer.status === 'ready_for_study') return 'ready_study';
  return 'to_complete';
}

function deriveDirection(req) {
  const load = getRequestedLoad(req);
  const injection = getRequestedInjection(req);
  if (load > 0 && injection > 0) return 'both';
  if (injection > 0) return 'injection';
  if (load > 0) return 'load';
  return 'none';
}

function deriveDecision(req, assessment, queueItem) {
  if (queueItem?.decision) return queueItem.decision;
  const statuses = [assessment.final?.load?.status, assessment.final?.injection?.status].filter(
    Boolean,
  );
  if (statuses.includes('PENDING')) return 'en_analyse';
  if (statuses.includes('KO')) return 'liste_attente';
  if (statuses.includes('LIMIT') || statuses.includes('FULL_FLEX')) return 'conditionnel';
  if (statuses.includes('OK')) return 'acceptable';
  return 'en_analyse';
}

function hasTechnicalResult(assessment) {
  if (assessment.status !== 'studied') return false;
  const statuses = [assessment.final?.load?.status, assessment.final?.injection?.status].filter(
    Boolean,
  );
  return statuses.length > 0 && !statuses.includes('PENDING');
}

function deriveConstraint(req, assessment) {
  if (!hasTechnicalResult(assessment)) return 'UNKNOWN';
  const finalConstraint = assessment.final?.limitingConstraint;
  if (isQualifiedLimitingConstraint(assessment)) return finalConstraint;
  return 'UNKNOWN';
}

function deriveDeadline(req, offer, expiry) {
  if (offer.status === 'offer_connected') {
    const impact = computeCapacityImpact(req);
    return impact.retentionUntil || null;
  }
  if (offer.status === 'offer_expired') return offer.expiredAt || expiry?.date || null;
  if (offer.status === 'offer_accepted') {
    return getCustomer(req).requested?.desiredCommissioningDate || expiry?.date || null;
  }
  return expiry?.date || null;
}

function deriveReservationStatus(impact, offer, expiry) {
  if (impact.status === 'CONNECTED_RESERVED') return 'connected_retained';
  if (impact.status === 'CONNECTED_RELEASED') return 'connected_released';
  if (impact.status === 'RELEASED') return 'released';
  if (offer.status === 'offer_expired' || expiry?.status === 'expiré') return 'expired';
  if (expiry?.status === 'bientôt') return 'soon';
  if (isActiveCapacityImpact(impact)) return 'active';
  return 'none';
}

function getReservedMva(impact) {
  return (
    safeNum(impact.reservedLoadPermanent, 0) +
    safeNum(impact.reservedLoadFlexible, 0) +
    safeNum(impact.reservedInjectionPermanent, 0) +
    safeNum(impact.reservedInjectionFlexible, 0)
  );
}

function deriveUrgency({ stepKey, offer, reservationStatus, expiry, action, assessment }) {
  if (offer.status === 'offer_expired' || reservationStatus === 'expired') return 100;
  if (readNextActions(assessment).includes(ACTION_CODES.DEMANDER_CAPAC)) return 92;
  if (reservationStatus === 'soon') return 84;
  if (stepKey === 'offer_action') return 78;
  if (stepKey === 'in_study') return 68;
  if (stepKey === 'ready_study') return 58;
  if (stepKey === 'to_complete') return 38;
  if (action.key && action.key !== 'VIEW') return 30;
  if (expiry?.status === 'ok') return 12;
  return 0;
}

function buildQueueIndex(sub, projects) {
  const index = new Map();
  const { queue, conditionals, cancelled } = getQueueAnalysis(sub, projects);
  [...queue, ...conditionals, ...cancelled].forEach((item) => {
    index.set(item.req.id, item);
  });
  return index;
}

export function buildQueueCockpitRows(substations = [], projects = []) {
  return substations.flatMap((sub) => {
    const queueIndex = buildQueueIndex(sub, projects);
    return (sub.connectionRequests || []).flatMap((req) => {
      const customer = getCustomer(req);
      const assessment = getAssessment(req);
      const offer = getOffer(req);
      if (offer.status === 'offer_connected') return [];
      const impact = computeCapacityImpact(req);
      const queueItem = queueIndex.get(req.id) || null;
      const action = getPrimaryAction(req);
      const expiry = getExpiryInfo(req);
      const stepKey = deriveWorkflowStep({ req, customer, assessment, offer, impact });
      const reservationStatus = deriveReservationStatus(impact, offer, expiry);
      const technicalResult = hasTechnicalResult(assessment);
      const displayReservationStatus = technicalResult ? reservationStatus : null;
      const displayDecision = technicalResult ? deriveDecision(req, assessment, queueItem) : null;
      const deadline = technicalResult ? deriveDeadline(req, offer, expiry) : null;
      const totalReservedMva = getReservedMva(impact);
      const requestedLoad = getRequestedLoad(req);
      const requestedInjection = getRequestedInjection(req);
      const direction = deriveDirection(req);
      const decision = deriveDecision(req, assessment, queueItem);
      const limitingConstraint = deriveConstraint(req, assessment);
      const conditionSummary = buildConditionSummary(
        req,
        projects,
        displayDecision === 'conditionnel',
      );
      const studySubStatus = deriveStudySubStatus(assessment);
      const fifoRank = queueItem?.position ?? null;
      const urgency = deriveUrgency({
        stepKey,
        offer,
        reservationStatus: displayReservationStatus,
        expiry: technicalResult ? expiry : null,
        action,
        assessment,
      });
      const pendingActionCodes = readNextActions(assessment);
      const pendingActionLabels = pendingActionCodes.map((code) =>
        getActionLabel(code, { assessment }),
      );
      const capacActionStatus = deriveCapacActionStatus(
        assessment,
        requestedLoad,
        requestedInjection,
      );
      const customerName = customer.client?.name || '(sans titre)';
      const reference = customer.client?.reference || '';
      const type = customer.client?.type || 'autre';

      return [
        {
          id: rowKey(sub, req),
          req,
          sub,
          substationId: sub.id,
          substationName: sub.name,
          substationCode: sub.code,
          customerName,
          reference,
          type,
          clientSearchText: [
            customerName,
            reference,
            type,
            customer.site?.label,
            sub.name,
            sub.code,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
          stepKey,
          studySubStatus,
          technicalResult,
          action,
          pendingActionCodes,
          pendingActionLabels,
          pendingActionCount: pendingActionCodes.length,
          capacActionStatus,
          direction,
          decision,
          displayDecision,
          limitingConstraint,
          reservationStatus,
          displayReservationStatus,
          urgency,
          deadline,
          expiry,
          position: fifoRank,
          fifoRank,
          fifoRankLabel: fifoRank != null ? `#${fifoRank}` : 'hors file',
          isHeadOfQueue: fifoRank === 1,
          conditionSummary,
          permanentLoad: safeNum(impact.reservedLoadPermanent, 0),
          flexibleLoad: safeNum(impact.reservedLoadFlexible, 0),
          permanentInjection: safeNum(impact.reservedInjectionPermanent, 0),
          flexibleInjection: safeNum(impact.reservedInjectionFlexible, 0),
          requestedLoad,
          requestedInjection,
          displayPowerTotalMva: technicalResult
            ? totalReservedMva
            : requestedLoad + requestedInjection,
          totalReservedMva,
          impactStatus: impact.status,
          offerStatus: offer.status,
          assessmentStatus: assessment.status,
          customerStatus: customer.status,
          isClosed: stepKey === 'closed',
        },
      ];
    });
  });
}

export function buildQueueCockpitStats(rows = []) {
  return rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (!row.isClosed && row.action?.key && row.action.key !== 'VIEW') acc.actionNow += 1;
      if (row.studySubStatus === 'CAPAC_ELIA_PENDING') acc.capacBlocking += 1;
      if (row.offerStatus === 'offer_expired' || row.displayReservationStatus === 'expired')
        acc.expiredOffers += 1;
      if (
        ['QUEUE_RESERVED', 'STUDY_RESERVED', 'ACQUIRED', 'CONNECTED_RESERVED'].includes(
          row.impactStatus,
        )
      ) {
        acc.activeReservedMva += row.totalReservedMva;
      }
      acc.byStep.all = (acc.byStep.all || 0) + 1;
      acc.byStep[row.stepKey] = (acc.byStep[row.stepKey] || 0) + 1;
      return acc;
    },
    {
      total: 0,
      actionNow: 0,
      capacBlocking: 0,
      expiredOffers: 0,
      activeReservedMva: 0,
      byStep: Object.fromEntries(QUEUE_WORKFLOW_STEPS.map((step) => [step.key, 0])),
    },
  );
}

export function getDefaultCockpitStep(rows = []) {
  return rows.length > 0 ? DEFAULT_STEP : QUEUE_WORKFLOW_STEPS[0].key;
}

export function filterQueueCockpitRows(rows = [], stepKey, filters = {}) {
  return rows.filter((row) => {
    if (stepKey && stepKey !== 'all' && row.stepKey !== stepKey) return false;
    if (filters.client?.trim()) {
      const terms = filters.client.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.every((term) => row.clientSearchText.includes(term))) return false;
    }
    if (filters.substations?.length && !filters.substations.includes(row.substationId))
      return false;
    if (filters.fifo?.length) {
      const matchesFifo = filters.fifo.some((value) => {
        if (value === 'in_queue') return row.fifoRank != null;
        if (value === 'head') return row.isHeadOfQueue;
        return false;
      });
      if (!matchesFifo) return false;
    }
    if (filters.directions?.length && !filters.directions.includes(row.direction)) return false;
    if (filters.decisions?.length && !filters.decisions.includes(row.displayDecision)) return false;
    if (
      filters.reservations?.length &&
      !filters.reservations.includes(row.displayReservationStatus)
    )
      return false;
    return true;
  });
}

function toTime(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
}

export function sortQueueCockpitRows(rows = [], sort = { field: 'priority', direction: 'desc' }) {
  const direction = sort.direction === 'asc' ? 1 : -1;
  const valueFor = (row) => {
    if (sort.field === 'deadline') return toTime(row.deadline);
    if (sort.field === 'capacity') return row.displayPowerTotalMva;
    if (sort.field === 'customer') return row.customerName || '';
    if (sort.field === 'fifoRank') return row.fifoRank;
    return row.urgency;
  };
  return rows.slice().sort((a, b) => {
    const av = valueFor(a);
    const bv = valueFor(b);
    if (sort.field === 'fifoRank') {
      const aMissing = av == null;
      const bMissing = bv == null;
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (!aMissing && av !== bv) return (av > bv ? 1 : -1) * direction;
      return (a.customerName || '').localeCompare(b.customerName || '', 'fr');
    }
    if (sort.field === 'customer') {
      const compared = String(av).localeCompare(String(bv), 'fr');
      if (compared !== 0) return compared * direction;
      return (a.reference || '').localeCompare(b.reference || '', 'fr');
    }
    if (av !== bv) return (av > bv ? 1 : -1) * direction;
    return (a.customerName || '').localeCompare(b.customerName || '', 'fr');
  });
}
