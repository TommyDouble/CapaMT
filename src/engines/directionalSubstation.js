/**
 * engines/directionalSubstation.js
 *
 * Moteur de calcul directionnel pour une sous-station.
 * Le calcul s'appuie sur deux vues symétriques :
 *
 *   Vue Prélèvement (withdrawal) :
 *     Base = LoadMaxBT + LoadMaxMT − MinInjBT − MinInjMT
 *     Rigid = Base + FirmWithdrawalReservations
 *     Total = Rigid + FlexWithdrawalReservations
 *     Comparé à la capacité directe N-1
 *
 *   Vue Injection (injection) :
 *     Base = −MaxInjBT − MaxInjMT + MinLoadBT + MinLoadMT
 *     Rigid = Base − FirmInjectionReservations
 *     Total = Rigid − FlexInjectionReservations
 *     Comparé à la capacité inverse N-1 (result negative when injection-constrained)
 *
 * Convention de signe :
 *   − Prélèvements : positifs
 *   − Injections : négatifs
 *
 * Aucune dépendance React.
 */

import { safeNum, safeDiv }       from '../utils/numbers.js';
import { YEARS, REF_YEAR, ALERT_ORDER, getFoisonnement } from '../constants/index.js';
import { getCapacityAtYear, getCapacityNAtYear } from './capacity.js';
import {
  getEffectiveRigidReservation, getEffectivePilotableReservation,
  getEffectiveInjRigide, getEffectiveInjPilot,
} from './requests.js';
import { computeCapacityImpact, isActiveCapacityImpact } from './capacityImpact.js';
import { getCustomer } from './requestModel.js';

// ── Helpers internes ───────────────────────────────────────────────────────

/** Requêtes actives pour une SS et une année cible. */
function _activeRequests(sub, year) {
  return (sub.connectionRequests || []).filter(r => {
    const impact = computeCapacityImpact(r);
    if (!isActiveCapacityImpact(impact)) return false;
    const reqYear = getCustomer(r).requested?.year || 2026;
    return reqYear <= year;
  });
}

// ── Projection d'une composante ────────────────────────────────────────────

/**
 * Projette une composante historique à une année cible.
 * Formula : baseValue × (1 + growthRate)^(targetYear − referenceYear)
 *
 * @param {number} baseValue      Valeur de référence (positive)
 * @param {number} growthRate     Taux annuel (ex: 0.025 = 2.5 %)
 * @param {number} referenceYear  Année de référence
 * @param {number} targetYear     Année cible
 * @returns {number}
 */
export function projectDirectionalComponent(baseValue, growthRate, referenceYear, targetYear) {
  const base = safeNum(baseValue, 0);
  const rate = safeNum(growthRate, 0);
  if (targetYear <= referenceYear) return base;
  return base * Math.pow(1 + rate, targetYear - referenceYear);
}

// ── Capacités directe et inverse ──────────────────────────────────────────

/** Capacité directe N-1 (sens prélèvement). Identique à getCapacityAtYear. */
export function getDirectCapacityN1AtYear(sub, year, projects = []) {
  return getCapacityAtYear(sub, year, projects);
}

/** Capacité directe N. */
export function getDirectCapacityNAtYear(sub, year, projects = []) {
  return getCapacityNAtYear(sub, year, projects);
}

/**
 * Capacité inverse N-1 (sens injection).
 * = DirectN1 × reverseCapacityRatio
 */
export function getReverseCapacityN1AtYear(sub, year, projects = []) {
  const ratio = safeNum(sub.transformerConfig?.reverseCapacityRatio, 1.0);
  return getCapacityAtYear(sub, year, projects) * ratio;
}

/**
 * Capacité inverse N.
 * = DirectN × reverseCapacityRatio  (null si pas de config tfo)
 */
export function getReverseCapacityNAtYear(sub, year, projects = []) {
  const capN = getCapacityNAtYear(sub, year, projects);
  if (capN === null) return null;
  const ratio = safeNum(sub.transformerConfig?.reverseCapacityRatio, 1.0);
  return capN * ratio;
}

// ── Vue Prélèvement ────────────────────────────────────────────────────────

/**
 * Charge nette de base en sens prélèvement pour une année donnée.
 * = LoadMaxBT(y) + LoadMaxMT(y) − MinInjBT(y) − MinInjMT(y) + load_transfers
 * Résultat positif.
 */
export function getWithdrawalBaseNet(sub, year, projects = []) {
  const m = sub.directionalModel;
  if (!m?.withdrawalView) return 0;

  const v      = m.withdrawalView;
  const refY   = safeNum(m.referenceYear, REF_YEAR);

  const loadBT = projectDirectionalComponent(v.maxHistoricLoadBT,      v.growthLoadMaxBT,      refY, year);
  const loadMT = projectDirectionalComponent(v.maxHistoricLoadMT,      v.growthLoadMaxMT,      refY, year);
  const injBT  = projectDirectionalComponent(v.minHistoricInjectionBT, v.growthMinInjectionBT, refY, year);
  const injMT  = projectDirectionalComponent(v.minHistoricInjectionMT, v.growthMinInjectionMT, refY, year);

  // Load transfers grow at BT rate
  let loadTransfer = 0;
  const growthBT = safeNum(v.growthLoadMaxBT, 0);
  (projects || []).forEach(proj => {
    if (proj.status === 'annulé') return;
    (proj.effects || []).forEach(eff => {
      if (eff.ssId === sub.id && eff.action === 'load_transfer' && proj.year <= year) {
        const delta = safeNum(eff.loadDelta, 0);
        loadTransfer += delta * Math.pow(1 + growthBT, year - proj.year);
      }
    });
  });

  return loadBT + loadMT - injBT - injMT + loadTransfer;
}

/** Réservation ferme (rigide) en sens prélèvement, avec foisonnement. */
export function getWithdrawalFirmReservation(sub, year, inclCond = false) {
  return _activeRequests(sub, year, inclCond)
    .reduce((s, r) => s + getEffectiveRigidReservation(r) * getFoisonnement(r, sub), 0);
}

/** Réservation flexible (pilotable) en sens prélèvement, avec foisonnement. */
export function getWithdrawalFlexibleReservation(sub, year, inclCond = false) {
  return _activeRequests(sub, year, inclCond)
    .reduce((s, r) => s + getEffectivePilotableReservation(r) * getFoisonnement(r, sub), 0);
}

/**
 * Charge nette rigide en sens prélèvement (y compris réservations fermes).
 * = WithdrawalBaseNet + WithdrawalFirmReservation
 */
export function getWithdrawalRigid(sub, year, inclCond = false, projects = []) {
  return getWithdrawalBaseNet(sub, year, projects)
       + getWithdrawalFirmReservation(sub, year, inclCond);
}

/**
 * Charge nette totale en sens prélèvement (y compris flexibles).
 * = WithdrawalRigid + WithdrawalFlexibleReservation
 */
export function getWithdrawalTotal(sub, year, inclCond = false, projects = []) {
  return getWithdrawalRigid(sub, year, inclCond, projects)
       + getWithdrawalFlexibleReservation(sub, year, inclCond);
}

// ── Vue Injection ──────────────────────────────────────────────────────────

/**
 * Charge nette de base en sens injection pour une année donnée.
 * = −MaxInjBT(y) − MaxInjMT(y) + MinLoadBT(y) + MinLoadMT(y)
 * Résultat négatif si l'injection domine.
 */
export function getInjectionBaseNet(sub, year, projects = []) {
  const m = sub.directionalModel;
  if (!m?.injectionView) return 0; // Pas de contrainte injection

  const v    = m.injectionView;
  const refY = safeNum(m.referenceYear, REF_YEAR);

  const maxInjBT  = projectDirectionalComponent(v.maxHistoricInjectionBT, v.growthMaxInjectionBT, refY, year);
  const maxInjMT  = projectDirectionalComponent(v.maxHistoricInjectionMT, v.growthMaxInjectionMT, refY, year);
  const minLoadBT = projectDirectionalComponent(v.minHistoricLoadBT,      v.growthMinLoadBT,      refY, year);
  const minLoadMT = projectDirectionalComponent(v.minHistoricLoadMT,      v.growthMinLoadMT,      refY, year);

  // Load transfers : add to the load side (reduces injection dominance)
  const growthMinLoad = safeNum(v.growthMinLoadBT, 0);
  let loadTransfer = 0;
  (projects || []).forEach(proj => {
    if (proj.status === 'annulé') return;
    (proj.effects || []).forEach(eff => {
      if (eff.ssId === sub.id && eff.action === 'load_transfer' && proj.year <= year) {
        const delta = safeNum(eff.loadDelta, 0);
        loadTransfer += delta * Math.pow(1 + growthMinLoad, year - proj.year);
      }
    });
  });

  return -maxInjBT - maxInjMT + minLoadBT + minLoadMT + loadTransfer;
}

/** Réservation ferme (rigide) en sens injection, avec foisonnement. */
export function getInjectionFirmReservation(sub, year, inclCond = false) {
  return _activeRequests(sub, year, inclCond)
    .reduce((s, r) => s + getEffectiveInjRigide(r) * getFoisonnement(r, sub), 0);
}

/** Réservation flexible (pilotable) en sens injection, avec foisonnement. */
export function getInjectionFlexibleReservation(sub, year, inclCond = false) {
  return _activeRequests(sub, year, inclCond)
    .reduce((s, r) => s + getEffectiveInjPilot(r) * getFoisonnement(r, sub), 0);
}

/**
 * Charge nette rigide en sens injection.
 * = InjectionBaseNet − InjectionFirmReservation
 * Plus négatif = plus de contrainte injection.
 */
export function getInjectionRigid(sub, year, inclCond = false, projects = []) {
  return getInjectionBaseNet(sub, year, projects)
       - getInjectionFirmReservation(sub, year, inclCond);
}

/**
 * Charge nette totale en sens injection.
 * = InjectionRigid − InjectionFlexibleReservation
 */
export function getInjectionTotal(sub, year, inclCond = false, projects = []) {
  return getInjectionRigid(sub, year, inclCond, projects)
       - getInjectionFlexibleReservation(sub, year, inclCond);
}

// ── Résiduels ──────────────────────────────────────────────────────────────

/** Résiduel rigide en sens prélèvement. Positif = marge disponible. */
export function getResidualWithdrawalRigid(sub, year, projects = []) {
  return getDirectCapacityN1AtYear(sub, year, projects)
       - getWithdrawalRigid(sub, year, false, projects);
}

/** Résiduel total en sens prélèvement. */
export function getResidualWithdrawalTotal(sub, year, projects = []) {
  return getDirectCapacityN1AtYear(sub, year, projects)
       - getWithdrawalTotal(sub, year, false, projects);
}

/**
 * Résiduel rigide en sens injection.
 * Positif = marge disponible (inverse capacity − |injectionRigid|).
 * Calculé uniquement si injectionRigid < 0 (injection dominante).
 */
export function getResidualInjectionRigid(sub, year, projects = []) {
  const injRigid = getInjectionRigid(sub, year, false, projects);
  const capRev   = getReverseCapacityN1AtYear(sub, year, projects);
  return injRigid < 0 ? capRev - Math.abs(injRigid) : capRev;
}

/** Résiduel total en sens injection. */
export function getResidualInjectionTotal(sub, year, projects = []) {
  const injTotal = getInjectionTotal(sub, year, false, projects);
  const capRev   = getReverseCapacityN1AtYear(sub, year, projects);
  return injTotal < 0 ? capRev - Math.abs(injTotal) : capRev;
}

// ── Taux d'utilisation ─────────────────────────────────────────────────────

/** Taux d'utilisation rigide en sens prélèvement (vs capacité directe N-1). */
export function getUtilizationWithdrawalRigid(sub, year, projects = []) {
  const cap = getDirectCapacityN1AtYear(sub, year, projects);
  return safeDiv(getWithdrawalRigid(sub, year, false, projects), cap, cap <= 0 ? 1 : 0);
}

/** Taux d'utilisation total en sens prélèvement. */
export function getUtilizationWithdrawalTotal(sub, year, projects = []) {
  const cap = getDirectCapacityN1AtYear(sub, year, projects);
  return safeDiv(getWithdrawalTotal(sub, year, false, projects), cap, cap <= 0 ? 1 : 0);
}

/**
 * Taux d'utilisation rigide en sens injection (vs capacité inverse N-1).
 * Retourne 0 si l'injection ne domine pas (pas de contrainte).
 */
export function getUtilizationInjectionRigid(sub, year, projects = []) {
  const injRigid = getInjectionRigid(sub, year, false, projects);
  if (injRigid >= 0) return 0;
  const capRev = getReverseCapacityN1AtYear(sub, year, projects);
  return safeDiv(Math.abs(injRigid), capRev, capRev <= 0 ? 1 : 0);
}

/** Taux d'utilisation total en sens injection. */
export function getUtilizationInjectionTotal(sub, year, projects = []) {
  const injTotal = getInjectionTotal(sub, year, false, projects);
  if (injTotal >= 0) return 0;
  const capRev = getReverseCapacityN1AtYear(sub, year, projects);
  return safeDiv(Math.abs(injTotal), capRev, capRev <= 0 ? 1 : 0);
}

// ── Alertes ─────────────────────────────────────────────────────────────────

/**
 * État d'alerte directionnel complet pour une SS, une année et un mode donné.
 * Retourne les taux, flags, niveaux d'alerte et valeurs brutes pour les deux vues.
 */
export function getDirectionalAlertState(sub, year, inclCond = false, projects = []) {
  const capDirN1 = getDirectCapacityN1AtYear(sub, year, projects);
  const capDirN  = getDirectCapacityNAtYear(sub, year, projects);
  const capRevN1 = getReverseCapacityN1AtYear(sub, year, projects);
  const capRevN  = getReverseCapacityNAtYear(sub, year, projects);

  const wRigid   = getWithdrawalRigid(sub, year, inclCond, projects);
  const wTotal   = getWithdrawalTotal(sub, year, inclCond, projects);
  const injRigid = getInjectionRigid(sub, year, inclCond, projects);
  const injTotal = getInjectionTotal(sub, year, inclCond, projects);

  // Withdrawal utilizations
  const uWRvsN1 = safeDiv(wRigid, capDirN1, capDirN1 <= 0 ? 1 : 0);
  const uWTvsN1 = safeDiv(wTotal, capDirN1, capDirN1 <= 0 ? 1 : 0);
  const uWRvsN  = capDirN ? safeDiv(wRigid, capDirN) : null;

  // Injection utilizations (only meaningful when injection dominates)
  const uIRvsN1 = injRigid < 0 ? safeDiv(Math.abs(injRigid), capRevN1, capRevN1 <= 0 ? 1 : 0) : 0;
  const uITvsN1 = injTotal < 0 ? safeDiv(Math.abs(injTotal), capRevN1, capRevN1 <= 0 ? 1 : 0) : 0;
  const uIRvsN  = (injRigid < 0 && capRevN) ? safeDiv(Math.abs(injRigid), capRevN) : null;

  // Withdrawal alert level
  const wW_RigidN  = uWRvsN  !== null && uWRvsN  >= 1.0;
  const wW_RigidN1 = uWRvsN1 >= 1.0;
  const wW_TotalN1 = uWTvsN1 >= 1.0;
  let worstWithdrawal = 'ok';
  if      (wW_RigidN)                          worstWithdrawal = 'rigid_n';
  else if (wW_RigidN1)                         worstWithdrawal = 'critical';
  else if (wW_TotalN1)                         worstWithdrawal = 'pilot_n1';
  else if (uWRvsN1 >= 0.85)                    worstWithdrawal = 'warning';
  else if (uWRvsN1 >= 0.70)                    worstWithdrawal = 'caution';

  // Injection alert level
  const wI_RigidN  = uIRvsN  !== null && uIRvsN  >= 1.0;
  const wI_RigidN1 = uIRvsN1 >= 1.0;
  const wI_TotalN1 = uITvsN1 >= 1.0;
  let worstInjection = 'ok';
  if      (wI_RigidN)                          worstInjection = 'rigid_n';
  else if (wI_RigidN1)                         worstInjection = 'critical';
  else if (wI_TotalN1)                         worstInjection = 'pilot_n1';
  else if (uIRvsN1 >= 0.85)                    worstInjection = 'warning';
  else if (uIRvsN1 >= 0.70)                    worstInjection = 'caution';

  const worstLevel =
    ALERT_ORDER.indexOf(worstWithdrawal) >= ALERT_ORDER.indexOf(worstInjection)
      ? worstWithdrawal : worstInjection;

  return {
    // Utilizations
    uWRvsN1, uWTvsN1, uWRvsN,
    uIRvsN1, uITvsN1, uIRvsN,
    // Flags
    wW_RigidN1, wW_RigidN, wW_TotalN1,
    wI_RigidN1, wI_RigidN, wI_TotalN1,
    // Worst levels by view and global
    worstWithdrawal, worstInjection, worstLevel,
    // Raw values (MVA)
    wRigid, wTotal, injRigid, injTotal,
    // Capacities
    capDirN1, capDirN, capRevN1, capRevN,
    // Residuals
    residualWRigid: capDirN1 - wRigid,
    residualWTotal: capDirN1 - wTotal,
    residualIRigid: injRigid < 0 ? capRevN1 - Math.abs(injRigid) : capRevN1,
    residualITotal: injTotal < 0 ? capRevN1 - Math.abs(injTotal) : capRevN1,
  };
}

/** Pire niveau d'alerte directionnelle sur tout l'horizon (2026–2035). */
export function getWorstDirectionalAlertOverHorizon(sub, projects = []) {
  let worst = 'ok';
  for (const y of YEARS) {
    const state = getDirectionalAlertState(sub, y, false, projects);
    if (ALERT_ORDER.indexOf(state.worstLevel) > ALERT_ORDER.indexOf(worst)) {
      worst = state.worstLevel;
    }
  }
  return worst;
}

/** Première année de saturation en sens prélèvement (utilisation rigide ≥ 100%). */
export function getFirstWithdrawalSaturationYear(sub, projects = []) {
  return YEARS.find(y => getUtilizationWithdrawalRigid(sub, y, projects) >= 1.0) ?? null;
}

/** Première année de saturation en sens injection (utilisation rigide ≥ 100%). */
export function getFirstInjectionSaturationYear(sub, projects = []) {
  return YEARS.find(y => getUtilizationInjectionRigid(sub, y, projects) >= 1.0) ?? null;
}

/**
 * Retourne true si la sous-station dépend d'un projet non encore validé
 * pour ne pas saturer (équivalent directionnel de isSubstationAtRisk).
 */
export function isSubstationAtRiskDirectional(sub, projects = []) {
  const ACTIVE = new Set(['planifié', 'en_cours', 'validé']);
  const risky = (projects || []).filter(p =>
    ACTIVE.has(p.status) &&
    (p.effects || []).some(e =>
      e.ssId === sub.id && ['modify_tfo', 'create_ss'].includes(e.action)
    )
  );
  if (!risky.length) return false;
  const without    = (projects || []).filter(p => !risky.find(r => r.id === p.id));
  const satWith    = getFirstWithdrawalSaturationYear(sub, projects);
  const satWithout = getFirstWithdrawalSaturationYear(sub, without);
  return (!satWith && !!satWithout) ||
         (satWith && satWithout && satWithout < satWith);
}

// ── Snapshot pour buildAssumptionsSnapshot (directionnel) ──────────────────

/**
 * Résumé structuré des hypothèses directionnelles actives pour une SS.
 * Consommé par AssumptionsBanner (SubstationDetail) et les blocs d'explication.
 */
export function buildDirectionalSnapshot(sub, year, activeView = 'withdrawal', projects = []) {
  if (!sub) return null;
  const m = sub.directionalModel;
  const capDirN1 = getDirectCapacityN1AtYear(sub, year, projects);
  const capDirN  = getDirectCapacityNAtYear(sub, year, projects);
  const capRevN1 = getReverseCapacityN1AtYear(sub, year, projects);
  const capRevN  = getReverseCapacityNAtYear(sub, year, projects);

  const activeStatuses = new Set(['planifié', 'en_cours', 'validé']);
  const projectsIncluded = (projects || []).filter(p =>
    activeStatuses.has(p.status) && p.year <= year
  );
  const projectsExcluded = (projects || []).filter(p =>
    p.status === 'annulé' || (activeStatuses.has(p.status) && p.year > year)
  );

  const wv = m?.withdrawalView  || {};
  const iv = m?.injectionView   || {};

  return {
    // Identity
    subId:      sub.id,
    referenceYear: safeNum(m?.referenceYear, REF_YEAR),
    targetYear: year,
    activeView,
    reverseCapacityRatio: safeNum(sub.transformerConfig?.reverseCapacityRatio, 1.0),
    // Direct/reverse capacities
    capDirN1, capDirN, capRevN1, capRevN,
    // Withdrawal view parameters
    withdrawalView: {
      maxHistoricLoadBT:      safeNum(wv.maxHistoricLoadBT, 0),
      maxHistoricLoadMT:      safeNum(wv.maxHistoricLoadMT, 0),
      minHistoricInjectionBT: safeNum(wv.minHistoricInjectionBT, 0),
      minHistoricInjectionMT: safeNum(wv.minHistoricInjectionMT, 0),
      growthLoadMaxBT:    safeNum(wv.growthLoadMaxBT, 0),
      growthLoadMaxMT:    safeNum(wv.growthLoadMaxMT, 0),
      growthMinInjectionBT: safeNum(wv.growthMinInjectionBT, 0),
      growthMinInjectionMT: safeNum(wv.growthMinInjectionMT, 0),
    },
    // Injection view parameters
    injectionView: {
      maxHistoricInjectionBT: safeNum(iv.maxHistoricInjectionBT, 0),
      maxHistoricInjectionMT: safeNum(iv.maxHistoricInjectionMT, 0),
      minHistoricLoadBT:      safeNum(iv.minHistoricLoadBT, 0),
      minHistoricLoadMT:      safeNum(iv.minHistoricLoadMT, 0),
      growthMaxInjectionBT: safeNum(iv.growthMaxInjectionBT, 0),
      growthMaxInjectionMT: safeNum(iv.growthMaxInjectionMT, 0),
      growthMinLoadBT:      safeNum(iv.growthMinLoadBT, 0),
      growthMinLoadMT:      safeNum(iv.growthMinLoadMT, 0),
    },
    // Projects
    projectsIncluded: projectsIncluded.map(p => ({ id: p.id, name: p.name, year: p.year, status: p.status })),
    projectsExcluded: projectsExcluded.map(p => ({
      id: p.id, name: p.name, year: p.year, status: p.status,
      reason: p.status === 'annulé' ? 'annulé' : 'après horizon',
    })),
  };
}
