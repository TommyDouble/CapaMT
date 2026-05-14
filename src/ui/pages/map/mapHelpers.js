import { getDirectionalAlertState } from '../../../engines/directionalSubstation.js';
import { computeCapacityImpact, isActiveCapacityImpact } from '../../../engines/capacityImpact.js';
import { buildRequestStatusSummary } from '../../../engines/statusSummary.js';
import { getCustomer, getOffer } from '../../../engines/requestModel.js';
import { hasValidCoordinates } from '../../../utils/coordinates.js';
import { safeNum } from '../../../utils/numbers.js';

export function hasCoords(coords) {
  return hasValidCoordinates(coords);
}

export function alertForSub(sub, year, viewMode, projects = []) {
  const state = getDirectionalAlertState(sub, year, false, projects);
  const level = viewMode === 'withdrawal' ? state.worstWithdrawal
    : viewMode === 'injection' ? state.worstInjection
    : state.worstLevel;
  return { level, state };
}

export function impactTotalMva(impact) {
  return safeNum(impact.reservedLoadPermanent, 0)
    + safeNum(impact.reservedLoadFlexible, 0)
    + safeNum(impact.reservedInjectionPermanent, 0)
    + safeNum(impact.reservedInjectionFlexible, 0);
}

export function buildCapacityMapRows(substations = []) {
  return substations.flatMap(sub => (sub.connectionRequests || [])
    .map(req => {
      const impact = computeCapacityImpact(req);
      if (!isActiveCapacityImpact(impact)) return null;
      const customer = getCustomer(req);
      const offer = getOffer(req);
      const summary = buildRequestStatusSummary(req);
      return {
        id: `${sub.id}:${req.id}`,
        req,
        sub,
        customer,
        offer,
        summary,
        customerName: customer.client?.name || '(sans titre)',
        reference: customer.client?.reference || req.id,
        type: customer.client?.type || 'autre',
        coordinates: customer.site?.coordinates,
        impact,
        impactStatus: impact.status,
        permanentLoad: safeNum(impact.reservedLoadPermanent, 0),
        flexibleLoad: safeNum(impact.reservedLoadFlexible, 0),
        permanentInjection: safeNum(impact.reservedInjectionPermanent, 0),
        flexibleInjection: safeNum(impact.reservedInjectionFlexible, 0),
        displayPowerTotalMva: impactTotalMva(impact),
      };
    })
    .filter(Boolean));
}

export function buildCapacityMapStats(displaySubstations = [], rows = []) {
  return {
    substations: {
      total: displaySubstations.length,
      positioned: displaySubstations.filter(sub => hasCoords(sub.coordinates)).length,
    },
    activeRequests: {
      total: rows.length,
      positioned: rows.filter(row => hasCoords(row.coordinates)).length,
      unpositioned: rows.filter(row => !hasCoords(row.coordinates)).length,
    },
    projectedSubstations: displaySubstations.filter(sub => String(sub.id || '').startsWith('ss-new-')).length,
  };
}

export function applyRequestCoordinatesToSubstation(sub, reqId, coordinates) {
  return {
    ...sub,
    connectionRequests: (sub.connectionRequests || []).map(req =>
      req.id === reqId
        ? {
            ...req,
            customer: {
              ...req.customer,
              site: {
                ...req.customer?.site,
                coordinates,
              },
            },
          }
        : req
    ),
  };
}
