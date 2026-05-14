import { getToday } from '../utils/dates.js';
import { safeNum } from '../utils/numbers.js';
import { getFoisonnement } from '../constants/index.js';
import {
  getWithdrawalBaseNet,
  getInjectionBaseNet,
  getDirectCapacityN1AtYear,
  getReverseCapacityN1AtYear,
} from './directionalSubstation.js';
import {
  reqClientPrelevTotal,
  reqClientInjTotal,
  reqGrdInjFerme,
  getEffectiveRigidReservation,
  getEffectiveInjRigide,
} from './requests.js';
import { computeCapacityImpact, isActiveCapacityImpact } from './capacityImpact.js';
import { sortQueueRequests } from './queueOrdering.js';
import { filterSecuredProjects } from './capacityEvaluation.js';
import { getAssessment, getCustomer, getOffer } from './requestModel.js';

const FIFO_IMPACT_STATUS = 'QUEUE_RESERVED';
const COMMITTED_IMPACT_STATUSES = new Set(['STUDY_RESERVED', 'ACQUIRED', 'CONNECTED_RESERVED']);
const DAY_MS = 24 * 60 * 60 * 1000;

export {
  reqClientPrelevFerme,
  reqClientPrelevFlexible,
  reqClientInjFerme,
  reqClientInjFlexible,
  reqClientPrelevTotal,
  reqClientInjTotal,
  reqGrdPrelevFerme,
  reqGrdPrelevFlexible,
  reqGrdInjFerme,
  reqGrdInjFlexible,
  reqNetRigid,
  reqNetTotal,
  reqHasPilot,
  getEffectiveRigidReservation,
  getEffectivePilotableReservation,
  getEffectiveInjRigide,
  getEffectiveInjPilot,
  getCapacityImpact,
} from './requests.js';

function capacityImpact(req) {
  return computeCapacityImpact(req);
}

function isFifoCandidate(req) {
  return capacityImpact(req).status === FIFO_IMPACT_STATUS;
}

function isActiveReservation(req) {
  return isActiveCapacityImpact(capacityImpact(req));
}

function isCommittedReservation(req) {
  return COMMITTED_IMPACT_STATUSES.has(capacityImpact(req).status);
}

function requestYear(req) {
  return getCustomer(req).requested?.year || 2026;
}

function addMonths(dateValue, months) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (!Number.isFinite(date.getTime())) return null;
  date.setMonth(date.getMonth() + months);
  return date;
}

export function getExpiryInfo(req) {
  const today = getToday();
  const customer = getCustomer(req);
  const offer = getOffer(req);
  if (customer.status === 'cancelled' || offer.status === 'offer_cancelled') {
    return { status: 'annulé', date: offer.cancelledAt || null, daysLeft: null };
  }
  if (offer.status === 'offer_connected') {
    return { status: 'raccordé', date: offer.connectedAt || null, daysLeft: null };
  }
  if (offer.status === 'offer_expired') {
    return { status: 'expiré', date: offer.expiredAt || null, daysLeft: null };
  }

  const refDate = offer.formulatedAt || customer.readyForStudyAt || customer.requestDate;
  const expiry = offer.expiredAt ? new Date(offer.expiredAt) : addMonths(refDate, safeNum(req.reservationMonths, 18));
  if (!expiry || !Number.isFinite(expiry.getTime())) return { status: 'inconnu', date: null, daysLeft: null };
  const daysLeft = Math.ceil((expiry - today) / DAY_MS);
  if (daysLeft < 0) return { status: 'expiré', date: expiry, daysLeft };
  if (daysLeft < 90) return { status: 'bientôt', date: expiry, daysLeft };
  return { status: 'ok', date: expiry, daysLeft };
}

function deriveDecision(req, autoDecision) {
  const assessment = getAssessment(req);
  const statuses = [assessment.final?.load?.status, assessment.final?.injection?.status].filter(Boolean);
  if (statuses.includes('KO')) return 'liste_attente';
  if (statuses.includes('LIMIT') || statuses.includes('FULL_FLEX')) return 'conditionnel';
  if (statuses.includes('OK')) return 'acceptable';
  return autoDecision;
}

export function getQueueAnalysis(sub, projects = []) {
  const securedProjects = filterSecuredProjects(projects);
  const requests = sub.connectionRequests || [];
  const committedReservations = requests.filter(isCommittedReservation);
  const orderedQueue = sortQueueRequests(requests.filter(isFifoCandidate));
  const fifoAlerts = [];
  const results = [];

  for (let i = 0; i < orderedQueue.length; i += 1) {
    const req = orderedQueue[i];
    const reqYear = requestYear(req);
    const capDirN1 = getDirectCapacityN1AtYear(sub, reqYear, securedProjects);
    const capRevN1 = getReverseCapacityN1AtYear(sub, reqYear, securedProjects);
    const withdrawalBase = getWithdrawalBaseNet(sub, reqYear, securedProjects);
    const injectionBase = getInjectionBaseNet(sub, reqYear, securedProjects);

    const committedWFirm = committedReservations
      .filter(r => requestYear(r) <= reqYear)
      .reduce((sum, r) => sum + getEffectiveRigidReservation(r) * getFoisonnement(r, sub), 0)
      + results
        .filter(r => requestYear(r.req) <= reqYear)
        .reduce((sum, r) => sum + getEffectiveRigidReservation(r.req) * getFoisonnement(r.req, sub), 0);

    const committedIFirm = committedReservations
      .filter(r => requestYear(r) <= reqYear)
      .reduce((sum, r) => sum + getEffectiveInjRigide(r) * getFoisonnement(r, sub), 0)
      + results
        .filter(r => requestYear(r.req) <= reqYear)
        .reduce((sum, r) => sum + getEffectiveInjRigide(r.req) * getFoisonnement(r.req, sub), 0);

    const withdrawalResidualBefore = capDirN1 - withdrawalBase - committedWFirm;
    const injectionMagnitude = Math.abs(injectionBase - committedIFirm);
    const injectionResidualBefore = (injectionBase - committedIFirm) < 0
      ? capRevN1 - injectionMagnitude
      : capRevN1;

    const powerWithdrawalNeeded = getEffectiveRigidReservation(req) * getFoisonnement(req, sub);
    const powerInjectionNeeded = getEffectiveInjRigide(req) * getFoisonnement(req, sub);
    const totalClientPrelev = reqClientPrelevTotal(req);
    const capDirN1NoProject = getDirectCapacityN1AtYear(sub, reqYear, []);
    const withdrawalResidualNoProject = capDirN1NoProject - withdrawalBase - committedWFirm;

    let autoDecision;
    if (powerWithdrawalNeeded === 0 && totalClientPrelev === 0 && powerInjectionNeeded === 0) {
      autoDecision = 'acceptable';
    } else if (totalClientPrelev > 0) {
      if (withdrawalResidualBefore >= powerWithdrawalNeeded) {
        autoDecision = withdrawalResidualNoProject >= powerWithdrawalNeeded ? 'acceptable' : 'conditionnel';
      } else {
        autoDecision = 'liste_attente';
      }
    } else if (injectionResidualBefore >= powerInjectionNeeded) {
      autoDecision = 'acceptable';
    } else {
      autoDecision = 'liste_attente';
    }

    results.push({
      req,
      position: i + 1,
      withdrawalResidualBefore: +withdrawalResidualBefore.toFixed(1),
      withdrawalResidualAfter: +(withdrawalResidualBefore - powerWithdrawalNeeded).toFixed(1),
      injectionResidualBefore: +injectionResidualBefore.toFixed(1),
      injectionResidualAfter: +(injectionResidualBefore - powerInjectionNeeded).toFixed(1),
      capAtYear: +capDirN1.toFixed(1),
      capRevAtYear: +capRevN1.toFixed(1),
      autoDecision,
      decision: deriveDecision(req, autoDecision),
      expiry: getExpiryInfo(req),
      recommendedFerme: +Math.max(0, Math.min(totalClientPrelev, withdrawalResidualBefore)).toFixed(1),
      recommendedFlexible: +Math.max(0, totalClientPrelev - Math.min(totalClientPrelev, withdrawalResidualBefore)).toFixed(1),
      hasFifoAlert: fifoAlerts.some(alert => alert.req.id === req.id),
    });
  }

  const baseItem = req => ({
    req,
    position: null,
    withdrawalResidualBefore: null,
    withdrawalResidualAfter: null,
    injectionResidualBefore: null,
    injectionResidualAfter: null,
    expiry: getExpiryInfo(req),
    recommendedFerme: null,
    recommendedFlexible: null,
    hasFifoAlert: false,
  });

  const conditionals = requests
    .filter(req => !isActiveReservation(req)
      && (req.conditionedOnProjectIds || []).length > 0
      && getCustomer(req).status !== 'cancelled'
      && getOffer(req).status !== 'offer_cancelled')
    .map(req => ({ ...baseItem(req), autoDecision: 'conditionnel', decision: 'conditionnel' }));

  const cancelled = requests
    .filter(req => getCustomer(req).status === 'cancelled' || getOffer(req).status === 'offer_cancelled')
    .map(req => ({ ...baseItem(req), autoDecision: 'annulé', decision: 'annulé' }));

  return { queue: results, conditionals, cancelled, fifoAlerts };
}

export function getGlobalQueueStats(substations, projects = []) {
  let total = 0;
  let acceptable = 0;
  let conditionnel = 0;
  let liste_attente = 0;
  let en_analyse = 0;
  let expired = 0;
  let expiringSoon = 0;
  let totalMWReserved = 0;

  substations.forEach(sub => {
    const { queue } = getQueueAnalysis(sub, projects);
    const countedIds = new Set();
    const countItem = item => {
      total += 1;
      countedIds.add(item.req.id);
      totalMWReserved += getEffectiveRigidReservation(item.req) + reqGrdInjFerme(item.req);
      const decision = item.decision;
      if (decision === 'acceptable') acceptable += 1;
      else if (decision === 'conditionnel') conditionnel += 1;
      else if (decision === 'liste_attente') liste_attente += 1;
      else en_analyse += 1;
      if (item.expiry.status === 'expiré') expired += 1;
      if (item.expiry.status === 'bientôt') expiringSoon += 1;
    };

    queue.forEach(countItem);
    (sub.connectionRequests || [])
      .filter(req => isActiveReservation(req) && !countedIds.has(req.id))
      .forEach(req => countItem({
        req,
        decision: deriveDecision(req, 'en_analyse'),
        expiry: getExpiryInfo(req),
      }));
  });

  return { total, acceptable, conditionnel, liste_attente, en_analyse, expired, expiringSoon, totalMWReserved };
}
