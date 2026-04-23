/**
 * engines/queue.js
 * Analyse de la file d'attente — modèle directionnel v6.
 *
 * La logique FIFO est conservée.
 * Le résiduel est maintenant calculé séparément pour les deux vues :
 *   − Vue prélèvement : résiduel de la capacité directe
 *   − Vue injection   : résiduel de la capacité inverse
 */

import { getToday }              from '../utils/dates.js';
import { safeNum }               from '../utils/numbers.js';
import { getFoisonnement }       from '../constants/index.js';
import { getCapacityAtYear }     from './capacity.js';
import {
  getWithdrawalBaseNet, getWithdrawalRigid,
  getInjectionBaseNet, getInjectionRigid,
  getDirectCapacityN1AtYear, getReverseCapacityN1AtYear,
} from './directionalSubstation.js';
import {
  reqClientPrelevTotal,
  reqGrdPrelevFerme, reqGrdPrelevFlexible, reqGrdInjFerme, reqGrdInjFlexible,
  reqClientInjFerme, reqClientInjFlexible,
  getEffectiveRigidReservation, getEffectiveInjRigide,
} from './requests.js';

// Re-exports for backward compatibility
export {
  reqClientPrelevFerme, reqClientPrelevFlexible,
  reqClientInjFerme, reqClientInjFlexible,
  reqClientPrelevTotal, reqClientInjTotal,
  reqGrdPrelevFerme, reqGrdPrelevFlexible, reqGrdInjFerme, reqGrdInjFlexible,
  reqNetRigid, reqNetTotal, reqHasPilot,
  getEffectiveRigidReservation, getEffectivePilotableReservation,
  getEffectiveInjRigide, getEffectiveInjPilot,
} from './requests.js';

// ── Péremption ──────────────────────────────────────────────────────────────

export function getExpiryInfo(req) {
  const TODAY = getToday();
  if (req.status === 'annulée' || req.status === 'annulé')
    return { status: 'annulé', date: null, daysLeft: null };

  if (req.status === 'raccordée' || req.status === 'raccordé') {
    if (!req.raccordementDate) return { status: 'signé', date: null, daysLeft: null };
    const raccoDate = new Date(req.raccordementDate);
    const expiry12m = new Date(raccoDate);
    expiry12m.setMonth(expiry12m.getMonth() + 12);
    const daysLeft = Math.ceil((expiry12m - TODAY) / (1000 * 60 * 60 * 24));
    return daysLeft > 0
      ? { status: 'ok', date: expiry12m, daysLeft }
      : { status: 'intégré', date: expiry12m, daysLeft };
  }

  if (!req.dateDepot) return { status: 'inconnu', date: null, daysLeft: null };

  const refDate = (req.status === 'étudiée' && req.dateOffre)
    ? new Date(req.dateOffre) : new Date(req.dateDepot);
  const months  = req.reservationMonths || 12;
  const expiry  = new Date(refDate);
  expiry.setMonth(expiry.getMonth() + months);
  const daysLeft = Math.ceil((expiry - TODAY) / (1000 * 60 * 60 * 24));

  if (req.status === 'étudiée' && req.dateOffre) {
    if (daysLeft < 0)  return { status: 'expiré',  date: expiry, daysLeft };
    if (daysLeft < 60) return { status: 'bientôt', date: expiry, daysLeft };
    return               { status: 'ok',      date: expiry, daysLeft };
  }
  if (daysLeft < 0)  return { status: 'expiré',  date: expiry, daysLeft };
  if (daysLeft < 90) return { status: 'bientôt', date: expiry, daysLeft };
  return               { status: 'ok',      date: expiry, daysLeft };
}

// ── Analyse FIFO ─────────────────────────────────────────────────────────────

export function getQueueAnalysis(sub, projects = []) {
  const isActive = r =>
    r.status !== 'conditionnel' && r.status !== 'annulée' && r.status !== 'annulé'
    && r.status !== 'raccordée' && r.status !== 'raccordé';

  const queue = (sub.connectionRequests || [])
    .filter(isActive)
    .slice()
    .sort((a, b) => {
      const da = a.dateDepot ? new Date(a.dateDepot) : getToday();
      const db = b.dateDepot ? new Date(b.dateDepot) : getToday();
      return da - db || (a.yearSouhaitee || a.year || 2026) - (b.yearSouhaitee || b.year || 2026);
    });

  // Détection FIFO
  const fifoAlerts = [];
  queue.forEach((req, i) => {
    if (req.status === 'étudiée' && req.grd) {
      const earlier = queue.slice(0, i).filter(r => r.status === 'en_étude');
      if (earlier.length > 0) fifoAlerts.push({ req, blockedBy: earlier });
    }
  });

  const results = [];
  for (let i = 0; i < queue.length; i++) {
    const req     = queue[i];
    const reqYear = req.yearSouhaitee || req.year || 2026;

    // Capacités à l'année de la demande
    const capDirN1 = getDirectCapacityN1AtYear(sub, reqYear, projects);
    const capRevN1 = getReverseCapacityN1AtYear(sub, reqYear, projects);

    // Base nets directionnelles
    const withdrawalBase = getWithdrawalBaseNet(sub, reqYear, projects);
    const injectionBase  = getInjectionBaseNet(sub, reqYear, projects);

    // Cumul des réservations des demandes déjà positionnées (index < i)
    const committedWFirm = results
      .filter(r => (r.req.yearSouhaitee || r.req.year || 2026) <= reqYear)
      .reduce((s, r) => s + getEffectiveRigidReservation(r.req) * getFoisonnement(r.req, sub), 0);

    const committedIFirm = results
      .filter(r => (r.req.yearSouhaitee || r.req.year || 2026) <= reqYear)
      .reduce((s, r) => s + getEffectiveInjRigide(r.req) * getFoisonnement(r.req, sub), 0);

    // Résiduels avant la demande en cours
    const withdrawalResidualBefore = capDirN1 - withdrawalBase - committedWFirm;
    const injectionMagnitude = Math.abs(injectionBase - committedIFirm);
    const injectionResidualBefore = (injectionBase - committedIFirm) < 0
      ? capRevN1 - injectionMagnitude
      : capRevN1;

    // Puissance de la demande en cours
    const powerWithdrawalNeeded  = getEffectiveRigidReservation(req) * getFoisonnement(req, sub);
    const powerInjectionNeeded   = getEffectiveInjRigide(req)        * getFoisonnement(req, sub);
    const totalClientPrelev      = reqClientPrelevTotal(req);

    // Auto-décision directionnelle
    const capDirN1NoInv = getDirectCapacityN1AtYear(sub, reqYear, []);
    const withdrawalResidualNoInv = capDirN1NoInv - withdrawalBase - committedWFirm;

    let autoDecision;
    if (powerWithdrawalNeeded === 0 && totalClientPrelev === 0 && powerInjectionNeeded === 0) {
      autoDecision = 'acceptable';
    } else if (totalClientPrelev > 0) {
      // Withdrawal-driven request
      if (withdrawalResidualBefore >= powerWithdrawalNeeded) {
        autoDecision = withdrawalResidualNoInv >= powerWithdrawalNeeded
          ? 'acceptable' : 'conditionnel';
      } else {
        autoDecision = 'liste_attente';
      }
    } else {
      // Injection-only request
      if (injectionResidualBefore >= powerInjectionNeeded) {
        autoDecision = 'acceptable';
      } else {
        autoDecision = 'liste_attente';
      }
    }

    // Recommendation for display
    const recommendedFerme    = +Math.max(0, Math.min(totalClientPrelev, withdrawalResidualBefore)).toFixed(1);
    const recommendedFlexible = +Math.max(0, totalClientPrelev - recommendedFerme).toFixed(1);

    results.push({
      req,
      position:         i + 1,
      // Withdrawal residuals
      residualBefore:       +withdrawalResidualBefore.toFixed(1),  // primary (backward compat display)
      residualAfter:        +(withdrawalResidualBefore - powerWithdrawalNeeded).toFixed(1),
      withdrawalResidualBefore: +withdrawalResidualBefore.toFixed(1),
      withdrawalResidualAfter:  +(withdrawalResidualBefore - powerWithdrawalNeeded).toFixed(1),
      // Injection residuals
      injectionResidualBefore: +injectionResidualBefore.toFixed(1),
      injectionResidualAfter:  +(injectionResidualBefore - powerInjectionNeeded).toFixed(1),
      // Capacities
      capAtYear:        +capDirN1.toFixed(1),
      capRevAtYear:     +capRevN1.toFixed(1),
      // Decision
      autoDecision,
      decision:         req.grd?.decisionGRD || req.decisionGRD || autoDecision,
      expiry:           getExpiryInfo(req),
      recommendedFerme,
      recommendedFlexible,
      hasFifoAlert:     fifoAlerts.some(a => a.req.id === req.id),
    });
  }

  const conditionals = (sub.connectionRequests || [])
    .filter(r => r.status === 'conditionnel')
    .map(req => ({
      req, position: null, residualBefore: null, residualAfter: null,
      withdrawalResidualBefore: null, withdrawalResidualAfter: null,
      injectionResidualBefore: null, injectionResidualAfter: null,
      autoDecision: 'conditionnel',
      decision: req.grd?.decisionGRD || req.decisionGRD || 'conditionnel',
      expiry: getExpiryInfo(req),
      recommendedFerme: null, recommendedFlexible: null, hasFifoAlert: false,
    }));

  const cancelled = (sub.connectionRequests || [])
    .filter(r => r.status === 'annulée' || r.status === 'annulé')
    .map(req => ({
      req, position: null, residualBefore: null, residualAfter: null,
      withdrawalResidualBefore: null, withdrawalResidualAfter: null,
      injectionResidualBefore: null, injectionResidualAfter: null,
      autoDecision: 'annulé', decision: 'annulé',
      expiry: getExpiryInfo(req),
      recommendedFerme: null, recommendedFlexible: null, hasFifoAlert: false,
    }));

  return { queue: results, conditionals, cancelled, fifoAlerts };
}

// ── Stats globales ───────────────────────────────────────────────────────────

export function getGlobalQueueStats(substations, projects = []) {
  let total = 0, acceptable = 0, conditionnel = 0, liste_attente = 0, en_analyse = 0;
  let expired = 0, expiringSoon = 0, totalMWReserved = 0;

  substations.forEach(sub => {
    const { queue } = getQueueAnalysis(sub, projects);
    queue.forEach(item => {
      total++;
      totalMWReserved += getEffectiveRigidReservation(item.req);
      const d = item.decision;
      if      (d === 'acceptable')    acceptable++;
      else if (d === 'conditionnel')  conditionnel++;
      else if (d === 'liste_attente') liste_attente++;
      else if (d === 'en_analyse')    en_analyse++;
      if (item.expiry.status === 'expiré')  expired++;
      if (item.expiry.status === 'bientôt') expiringSoon++;
    });
  });

  return { total, acceptable, conditionnel, liste_attente, en_analyse, expired, expiringSoon, totalMWReserved };
}
