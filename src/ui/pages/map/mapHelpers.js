import { getDirectionalAlertState } from '../../../engines/directionalSubstation.js';

export function hasCoords(coords) {
  if (!coords) return false;
  const lat = parseFloat(coords.lat);
  const lng = parseFloat(coords.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
}

export function alertForSub(sub, year, viewMode, projects = []) {
  const state = getDirectionalAlertState(sub, year, false, projects);
  const level = viewMode === 'withdrawal' ? state.worstWithdrawal
    : viewMode === 'injection' ? state.worstInjection
    : state.worstLevel;
  return { level, state };
}
