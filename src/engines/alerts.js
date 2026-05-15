import { ALERT_ORDER, YEARS } from '../constants/index.js';
import {
  getDirectionalAlertState,
  getFirstWithdrawalSaturationYear,
  isSubstationAtRiskDirectional,
} from './directionalSubstation.js';

export const getAlertLevel = (rate) =>
  rate >= 1.0 ? 'critical' : rate >= 0.85 ? 'warning' : rate >= 0.7 ? 'caution' : 'ok';

export function getWorstWithdrawalAlert(
  sub,
  y1 = YEARS[0],
  y2 = YEARS[YEARS.length - 1],
  projects = [],
) {
  let worst = 'ok';
  for (let y = y1; y <= y2; y += 1) {
    const state = getDirectionalAlertState(sub, y, false, projects);
    if (ALERT_ORDER.indexOf(state.worstLevel) > ALERT_ORDER.indexOf(worst))
      worst = state.worstLevel;
  }
  return worst;
}

export function getFirstCriticalNormalYear(sub, projects = []) {
  for (const y of YEARS) {
    const state = getDirectionalAlertState(sub, y, false, projects);
    if (state.wW_RigidN) return y;
  }
  return null;
}

export const getFirstWithdrawalSaturation = getFirstWithdrawalSaturationYear;
export const isSubstationAtRisk = isSubstationAtRiskDirectional;
