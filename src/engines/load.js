/**
 * engines/load.js
 * Compatibilité : délègue au moteur directionnel v6.
 *
 * Les fonctions historiques (getOrganicLoad, getNetRigidLoad, etc.) sont
 * conservées pour les composants qui n'ont pas encore migré, mais elles
 * utilisent maintenant le modèle directionnel en interne.
 *
 * NOUVEAU CODE : utiliser directement les fonctions de directionalSubstation.js.
 */

import { YEARS, ALERT_ORDER, getFoisonnement } from '../constants/index.js';
import { safeNum, safeDiv }                    from '../utils/numbers.js';
import { getCapacityAtYear, getCapacityNAtYear } from './capacity.js';
import {
  getWithdrawalBaseNet,
  getWithdrawalRigid, getWithdrawalTotal,
  getInjectionRigid, getInjectionTotal,
  getDirectCapacityN1AtYear, getReverseCapacityN1AtYear,
  getUtilizationWithdrawalRigid, getUtilizationWithdrawalTotal,
  getUtilizationInjectionRigid,
  getDirectionalAlertState, getWorstDirectionalAlertOverHorizon,
  getFirstWithdrawalSaturationYear, getFirstInjectionSaturationYear,
  isSubstationAtRiskDirectional,
} from './directionalSubstation.js';
import {
  getEffectiveRigidReservation, getEffectivePilotableReservation,
  getEffectiveInjRigide, getEffectiveInjPilot,
} from './requests.js';

// ── Wrapper legacy ──────────────────────────────────────────────────────────
// Ces fonctions délèguent au modèle directionnel.
// Le paramètre scenarioMult est ignoré (modèle sans scénario).

export const getOrganicLoad = (sub, year, _scenarioMult = 1.0, projects = []) =>
  getWithdrawalBaseNet(sub, year, projects);

export const getNetRigidLoad = (sub, year, _mult = 1.0, inclCond = false, projects = []) =>
  Math.max(0, getWithdrawalRigid(sub, year, inclCond, projects));

export const getNetTotalLoad = (sub, year, _mult = 1.0, inclCond = false, projects = []) =>
  Math.max(0, getWithdrawalTotal(sub, year, inclCond, projects));

export const getResidualRigid = (sub, year, _mult = 1.0, projects = []) =>
  getDirectCapacityN1AtYear(sub, year, projects) - getWithdrawalRigid(sub, year, false, projects);

export const getResidualTotal = (sub, year, _mult = 1.0, projects = []) =>
  getDirectCapacityN1AtYear(sub, year, projects) - getWithdrawalTotal(sub, year, false, projects);

export const getUtilizationRigid = (sub, year, _mult = 1.0, projects = []) =>
  getUtilizationWithdrawalRigid(sub, year, projects);

export const getUtilizationTotal = (sub, year, _mult = 1.0, projects = []) =>
  getUtilizationWithdrawalTotal(sub, year, projects);

// ── getLoadComponents (utilisé par DemandesQueueTab) ───────────────────────
export function getLoadComponents(sub, year, inclCond = false) {
  const INACTIVE = new Set(['annulée', 'annulé', 'raccordée', 'raccordé']);
  const active = (sub.connectionRequests || []).filter(r => {
    if (INACTIVE.has(r.status)) return false;
    if (!inclCond && r.status === 'conditionnel') return false;
    return (r.yearSouhaitee || r.year || 2026) <= year;
  });

  const rigidPrelev = active.reduce((s, r) => s + getEffectiveRigidReservation(r)    * getFoisonnement(r, sub), 0);
  const pilotPrelev = active.reduce((s, r) => s + getEffectivePilotableReservation(r) * getFoisonnement(r, sub), 0);
  const rigidInj    = active.reduce((s, r) => s + getEffectiveInjRigide(r)           * getFoisonnement(r, sub), 0);
  const pilotInj    = active.reduce((s, r) => s + getEffectiveInjPilot(r)            * getFoisonnement(r, sub), 0);
  const rigidPrelevBrut = active.reduce((s, r) => s + getEffectiveRigidReservation(r), 0);
  const pilotPrelevBrut = active.reduce((s, r) => s + getEffectivePilotableReservation(r), 0);
  const rigidInjBrut    = active.reduce((s, r) => s + getEffectiveInjRigide(r), 0);
  const pilotInjBrut    = active.reduce((s, r) => s + getEffectiveInjPilot(r), 0);

  return { rigidPrelev, pilotPrelev, rigidInj, pilotInj, rigidPrelevBrut, pilotPrelevBrut, rigidInjBrut, pilotInjBrut };
}

// ── Alertes ─────────────────────────────────────────────────────────────────
export const getAlertLevel = rate =>
  rate >= 1.00 ? 'critical' : rate >= 0.85 ? 'warning' : rate >= 0.70 ? 'caution' : 'ok';

export function getFullAlertState(sub, year, _mult = 1.0, projects = []) {
  return getDirectionalAlertState(sub, year, false, projects);
}

export const getWorstAlertRigid = (sub, y1, y2, _mult = 1.0, projects = []) => {
  let worst = 'ok';
  for (let y = y1; y <= y2; y++) {
    const state = getDirectionalAlertState(sub, y, false, projects);
    if (ALERT_ORDER.indexOf(state.worstLevel) > ALERT_ORDER.indexOf(worst)) worst = state.worstLevel;
  }
  return worst;
};

export const getFirstSatYearRigid = (sub, _mult = 1.0, projects = []) =>
  getFirstWithdrawalSaturationYear(sub, projects);

export const getFirstSatYearTotal = (sub, _mult = 1.0, projects = []) =>
  YEARS.find(y => getUtilizationWithdrawalTotal(sub, y, projects) >= 1.0) ?? null;

export const getFirstCritNYearRigid = (sub, _mult = 1.0, projects = []) => {
  for (const y of YEARS) {
    const state = getDirectionalAlertState(sub, y, false, projects);
    if (state.wW_RigidN) return y;
  }
  return null;
};

export const isSubstationAtRisk = isSubstationAtRiskDirectional;

// Re-export directional functions for consumers that import from here
export {
  getWithdrawalBaseNet, getWithdrawalRigid, getWithdrawalTotal,
  getInjectionBaseNet, getInjectionRigid, getInjectionTotal,
  getDirectCapacityN1AtYear, getReverseCapacityN1AtYear,
  getUtilizationWithdrawalRigid, getUtilizationWithdrawalTotal,
  getUtilizationInjectionRigid,
  getDirectionalAlertState, getWorstDirectionalAlertOverHorizon,
  getFirstWithdrawalSaturationYear, getFirstInjectionSaturationYear,
} from './directionalSubstation.js';
