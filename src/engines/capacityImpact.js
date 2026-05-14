/**
 * engines/capacityImpact.js
 *
 * Impact capacitaire dérivé. Aucun utilisateur ne doit éditer cet objet.
 */

import { safeNum } from '../utils/numbers.js';
import {
  CONNECTED_RETENTION_DEFAULT_MONTHS,
  CONNECTED_RETENTION_MAX_MONTHS,
  CONNECTED_RETENTION_MIN_MONTHS,
} from '../constants/index.js';
import {
  getAssessment,
  getCustomer,
  getOffer,
  getRequestedInjection,
  getRequestedLoad,
} from './requestModel.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).slice(0, 10);
  const ts = Date.parse(`${raw}T00:00:00Z`);
  return Number.isFinite(ts) ? raw : null;
}

function utcDate(value) {
  const iso = dateOnly(value);
  return iso ? new Date(`${iso}T00:00:00Z`) : null;
}

function addMonthsIso(value, months) {
  const start = utcDate(value);
  if (!start) return null;
  const day = start.getUTCDate();
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function normalizeConnectedRetentionMonths(value) {
  const n = Math.round(safeNum(value, CONNECTED_RETENTION_DEFAULT_MONTHS));
  return Math.max(CONNECTED_RETENTION_MIN_MONTHS, Math.min(CONNECTED_RETENTION_MAX_MONTHS, n));
}

export function getConnectedRetentionInfo(req, asOf = new Date()) {
  const offer = getOffer(req);
  const months = normalizeConnectedRetentionMonths(
    offer.connectedRetentionMonths
  );
  const connectedAt = dateOnly(offer.connectedAt);
  const asOfIso = dateOnly(asOf) || dateOnly(new Date());

  if (!connectedAt) {
    return {
      connectedAt: null,
      months,
      retentionUntil: null,
      daysLeft: null,
      active: true,
      expired: false,
      missingConnectedAt: true,
    };
  }

  const retentionUntil = addMonthsIso(connectedAt, months);
  const daysLeft = retentionUntil && asOfIso
    ? Math.ceil((utcDate(retentionUntil) - utcDate(asOfIso)) / DAY_MS)
    : null;

  return {
    connectedAt,
    months,
    retentionUntil,
    daysLeft,
    active: daysLeft == null || daysLeft >= 0,
    expired: daysLeft != null && daysLeft < 0,
    missingConnectedAt: false,
  };
}

export function emptyImpact(status = 'NONE', source = 'NONE') {
  return {
    status,
    reservedLoadPermanent: 0,
    reservedLoadFlexible: 0,
    reservedInjectionPermanent: 0,
    reservedInjectionFlexible: 0,
    source,
    computedAt: new Date().toISOString(),
  };
}

function impactFromFinal(req, status, source) {
  const assessment = getAssessment(req);
  const finalLoad = assessment.final?.load;
  const finalInjection = assessment.final?.injection;
  return {
    status,
    reservedLoadPermanent: safeNum(finalLoad?.permanent, 0),
    reservedLoadFlexible: safeNum(finalLoad?.flexible, 0),
    reservedInjectionPermanent: safeNum(finalInjection?.permanent, 0),
    reservedInjectionFlexible: safeNum(finalInjection?.flexible, 0),
    source,
    computedAt: new Date().toISOString(),
  };
}

export function computeCapacityImpact(req, asOf = new Date()) {
  const customer = getCustomer(req);
  const assessment = getAssessment(req);
  const offer = getOffer(req);
  const finalAvailable = hasFinalResponse(req, assessment);

  const finalStatuses = [assessment.final?.load?.status, assessment.final?.injection?.status].filter(Boolean);
  if (offer.status === 'offer_cancelled' || customer.status === 'cancelled' || finalStatuses.includes('KO')) {
    return emptyImpact('RELEASED', 'CUSTOMER_CANCELLATION');
  }
  if (offer.status === 'offer_connected') {
    const retention = getConnectedRetentionInfo(req, asOf);
    const connectedReleasedAt = dateOnly(offer.connectedReleasedAt);
    const manuallyReleased = Boolean(connectedReleasedAt);
    const impact = manuallyReleased
      ? emptyImpact('CONNECTED_RELEASED', 'CONNECTED_MANUAL_RELEASE')
      : retention.expired
      ? emptyImpact('CONNECTED_RELEASED', 'RETENTION_ENDED')
      : impactFromFinal(req, 'CONNECTED_RESERVED', 'CONNECTED_RETENTION');
    return {
      ...impact,
      connectedRetention: retention,
      connectedReleasedAt,
      connectedReleaseComment: offer.connectedReleaseComment || '',
      connectedReleaseMode: manuallyReleased ? 'manual' : retention.expired ? 'automatic' : null,
      retentionMonths: retention.months,
      retentionUntil: retention.retentionUntil,
      retentionDaysLeft: retention.daysLeft,
      retentionExpired: retention.expired,
      warnings: retention.missingConnectedAt ? ['CONNECTED_DATE_MISSING'] : [],
    };
  }
  if (offer.status === 'offer_accepted') {
    return impactFromFinal(req, 'ACQUIRED', 'OFFER_ACCEPTED');
  }
  if ((assessment.status === 'studied' || offer.status === 'offer_formulated' || offer.status === 'offer_expired') && finalAvailable) {
    return impactFromFinal(req, 'STUDY_RESERVED', 'TECHNICAL_RESPONSE');
  }
  if (customer.status === 'ready_for_study') {
    return {
      status: 'QUEUE_RESERVED',
      reservedLoadPermanent: getRequestedLoad(req),
      reservedLoadFlexible: 0,
      reservedInjectionPermanent: getRequestedInjection(req),
      reservedInjectionFlexible: 0,
      source: 'CUSTOMER_REQUEST',
      computedAt: new Date().toISOString(),
    };
  }
  return emptyImpact('NONE', 'NONE');
}

function hasFinalResponse(req, assessment) {
  const load = getRequestedLoad(req);
  const injection = getRequestedInjection(req);
  const loadOk = load <= 0 || (assessment.final?.load && assessment.final.load.status !== 'PENDING');
  const injectionOk = injection <= 0 || (assessment.final?.injection && assessment.final.injection.status !== 'PENDING');
  return loadOk && injectionOk;
}

export function isActiveCapacityImpact(impactOrReq) {
  const impact = impactOrReq?.status ? impactOrReq : computeCapacityImpact(impactOrReq);
  return ['QUEUE_RESERVED', 'STUDY_RESERVED', 'ACQUIRED', 'CONNECTED_RESERVED'].includes(impact.status);
}

export function isStudyReservedImpact(impactOrReq) {
  const impact = impactOrReq?.status ? impactOrReq : computeCapacityImpact(impactOrReq);
  return ['STUDY_RESERVED', 'ACQUIRED', 'CONNECTED_RESERVED'].includes(impact.status);
}
