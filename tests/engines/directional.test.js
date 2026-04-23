/**
 * tests/engines/directional.test.js
 * Suite complète pour le moteur directionnel v6.
 * Valide le modèle décrit dans la spécification, notamment l'exemple §22.
 */

import { describe, it, expect } from 'vitest';
import {
  projectDirectionalComponent,
  getDirectCapacityN1AtYear, getDirectCapacityNAtYear,
  getReverseCapacityN1AtYear, getReverseCapacityNAtYear,
  getWithdrawalBaseNet, getWithdrawalFirmReservation, getWithdrawalFlexibleReservation,
  getWithdrawalRigid, getWithdrawalTotal,
  getInjectionBaseNet, getInjectionFirmReservation, getInjectionFlexibleReservation,
  getInjectionRigid, getInjectionTotal,
  getResidualWithdrawalRigid, getResidualWithdrawalTotal,
  getResidualInjectionRigid, getResidualInjectionTotal,
  getUtilizationWithdrawalRigid, getUtilizationWithdrawalTotal,
  getUtilizationInjectionRigid, getUtilizationInjectionTotal,
  getDirectionalAlertState, getWorstDirectionalAlertOverHorizon,
  getFirstWithdrawalSaturationYear, getFirstInjectionSaturationYear,
  isSubstationAtRiskDirectional,
  buildDirectionalSnapshot,
} from '../../src/engines/directionalSubstation.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_SS = {
  id: 'ss-t',
  baseLoad2025: 20,
  organicGrowthRate: 0.02,
  plannableCapacity: 40,
  chargeHistory: [], foisonnement: {}, connectionRequests: [],
  transformerConfig: {
    transformers: [{ id: 'T1', power: 40, role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }],
    coeffN: 0.90, coeffN1: 1.00, mtBackup: { enabled: false, capacity: 0 },
    reverseCapacityRatio: 1.0,
  },
  directionalModel: {
    referenceYear: 2025,
    withdrawalView: {
      maxHistoricLoadBT: 13.0, maxHistoricLoadMT: 7.0,
      minHistoricInjectionBT: 0.0, minHistoricInjectionMT: 0.0,
      growthLoadMaxBT: 0.020, growthLoadMaxMT: 0.020,
      growthMinInjectionBT: 0.000, growthMinInjectionMT: 0.000,
    },
    injectionView: {
      maxHistoricInjectionBT: 0.0, maxHistoricInjectionMT: 0.0,
      minHistoricLoadBT: 0.0, minHistoricLoadMT: 0.0,
      growthMaxInjectionBT: 0.000, growthMaxInjectionMT: 0.000,
      growthMinLoadBT: 0.000, growthMinLoadMT: 0.000,
    },
  },
};

/** SS de l'exemple §22 de la spécification — valeurs 2025, projections 2030. */
const SPEC_SS = {
  id: 'ss-spec',
  baseLoad2025: 29.0, organicGrowthRate: 0.02,
  plannableCapacity: 40, chargeHistory: [], foisonnement: {}, connectionRequests: [],
  transformerConfig: {
    transformers: [{ id: 'T1', power: 40, role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }],
    coeffN: 0.90, coeffN1: 1.00, mtBackup: { enabled: false, capacity: 0 },
    reverseCapacityRatio: 0.60,  // revN1 = 40 × 0.60 = 24
  },
  directionalModel: {
    referenceYear: 2025,
    withdrawalView: {
      // Croissance 0% pour simplifier la vérification — les valeurs 2030 = valeurs 2025
      maxHistoricLoadBT: 20.3, maxHistoricLoadMT: 11.2,
      minHistoricInjectionBT: 1.9, minHistoricInjectionMT: 0.6,
      growthLoadMaxBT: 0.000, growthLoadMaxMT: 0.000,
      growthMinInjectionBT: 0.000, growthMinInjectionMT: 0.000,
    },
    injectionView: {
      maxHistoricInjectionBT: 19.8, maxHistoricInjectionMT: 7.3,
      minHistoricLoadBT: 4.6, minHistoricLoadMT: 2.3,
      growthMaxInjectionBT: 0.000, growthMaxInjectionMT: 0.000,
      growthMinLoadBT: 0.000, growthMinLoadMT: 0.000,
    },
  },
};

/** Requests pour l'exemple §22 */
const SPEC_REQS_W = [
  { id: 'r-w1', status: 'étudiée', yearSouhaitee: 2030, type: 'industriel',
    client: { prelevFerme: 4.5, prelevFlexible: 1.5, injFerme: 0, injFlexible: 0, detailPrelevement: [], detailInjection: [] },
    grd:    { prelevFerme: 4.5, prelevFlexible: 1.5, injFerme: 0, injFlexible: 0, decisionGRD: 'acceptable', noteDecision: '' } },
];

const SPEC_SS_WITH_REQS = { ...SPEC_SS, connectionRequests: SPEC_REQS_W, foisonnement: { industriel: 1.0 } };

const mkReq = (overrides = {}) => ({
  id: 'r1', name: 'Test', refProjet: 'T-001',
  type: 'industriel', status: 'en_étude', yearSouhaitee: 2027,
  dateDepot: '2025-01-01', dateOffre: null, reservationMonths: 18, raccordementDate: null,
  client: { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0, detailPrelevement: [], detailInjection: [] },
  grd: null,
  ...overrides,
});

const SS = (reqs = [], extra = {}) => ({
  ...BASE_SS,
  connectionRequests: reqs,
  ...extra,
});

// ── projectDirectionalComponent ───────────────────────────────────────────────

describe('projectDirectionalComponent', () => {
  it('targetYear == referenceYear → baseValue exacte', () =>
    expect(projectDirectionalComponent(20, 0.02, 2025, 2025)).toBeCloseTo(20));

  it('targetYear < referenceYear → baseValue exacte (clamp)', () =>
    expect(projectDirectionalComponent(20, 0.02, 2025, 2020)).toBeCloseTo(20));

  it('1 an à 2% → 20.4', () =>
    expect(projectDirectionalComponent(20, 0.02, 2025, 2026)).toBeCloseTo(20.4, 2));

  it('5 ans à 0% → valeur constante', () =>
    expect(projectDirectionalComponent(15, 0.00, 2025, 2030)).toBeCloseTo(15));

  it('base 0 → toujours 0', () =>
    expect(projectDirectionalComponent(0, 0.05, 2025, 2035)).toBeCloseTo(0));

  it('taux négatif → décroissance', () => {
    const v = projectDirectionalComponent(100, -0.05, 2025, 2026);
    expect(v).toBeLessThan(100);
    expect(v).toBeCloseTo(95, 1);
  });
});

// ── Capacités ─────────────────────────────────────────────────────────────────

describe('getDirectCapacityN1AtYear', () => {
  it('2 tfo 40 MVA N-1 = 40', () =>
    expect(getDirectCapacityN1AtYear(BASE_SS, 2026, [])).toBeCloseTo(40));
});

describe('getReverseCapacityN1AtYear', () => {
  it('ratio 1.0 → même que direct', () =>
    expect(getReverseCapacityN1AtYear(BASE_SS, 2026, [])).toBeCloseTo(40));

  it('ratio 0.60 → 24 MVA', () =>
    expect(getReverseCapacityN1AtYear(SPEC_SS, 2030, [])).toBeCloseTo(24, 1));

  it('ratio absent → fallback 1.0', () => {
    const ss = { ...BASE_SS, transformerConfig: { ...BASE_SS.transformerConfig, reverseCapacityRatio: undefined } };
    expect(getReverseCapacityN1AtYear(ss, 2026, [])).toBeCloseTo(40);
  });
});

// ── Vue Prélèvement ────────────────────────────────────────────────────────────

describe('getWithdrawalBaseNet', () => {
  it('2025 = loadBT + loadMT - injBT - injMT', () =>
    expect(getWithdrawalBaseNet(BASE_SS, 2025, [])).toBeCloseTo(20, 1)); // 13+7-0-0=20

  it('croissance : 2026 > 2025', () =>
    expect(getWithdrawalBaseNet(BASE_SS, 2026, [])).toBeGreaterThan(20));

  it('fallback legacy : pas de directionalModel → baseLoad2025 × (1+rate)^n', () => {
    const legacy = { ...BASE_SS, directionalModel: undefined };
    expect(getWithdrawalBaseNet(legacy, 2025, [])).toBeCloseTo(20, 1);
    expect(getWithdrawalBaseNet(legacy, 2026, [])).toBeCloseTo(20.4, 1);
  });

  it('spec §22 : 2030, croissance 0% → 20.3+11.2-1.9-0.6 = 29.0', () =>
    expect(getWithdrawalBaseNet(SPEC_SS, 2030, [])).toBeCloseTo(29.0, 1));
});

describe('getWithdrawalFirmReservation', () => {
  it('0 sans demandes', () =>
    expect(getWithdrawalFirmReservation(SS(), 2027)).toBeCloseTo(0));

  it('en_étude : total client (conservatif)', () => {
    const req = mkReq({ status: 'en_étude' });
    // foisonnement industriel = 0.85 par défaut
    expect(getWithdrawalFirmReservation(SS([req]), 2027)).toBeCloseTo(5 * 0.85, 1);
  });

  it('étudiée avec grd → prelevFerme GRD × foison', () => {
    const req = mkReq({ status: 'étudiée', grd: { prelevFerme: 3, prelevFlexible: 2, injFerme: 0, injFlexible: 0, decisionGRD: 'acceptable', noteDecision: '' } });
    expect(getWithdrawalFirmReservation(SS([req]), 2027)).toBeCloseTo(3 * 0.85, 1);
  });

  it('annulée → 0', () =>
    expect(getWithdrawalFirmReservation(SS([mkReq({ status: 'annulée' })]), 2027)).toBeCloseTo(0));

  it('conditionnel exclu par défaut', () =>
    expect(getWithdrawalFirmReservation(SS([mkReq({ status: 'conditionnel' })]), 2027)).toBeCloseTo(0));
});

describe('getWithdrawalRigid', () => {
  it('spec §22 : base 29.0 + ferme 4.5 = 33.5 (foisonnement=1)', () => {
    expect(getWithdrawalRigid(SPEC_SS_WITH_REQS, 2030, false, [])).toBeCloseTo(33.5, 1);
  });

  it('WithdrawalTotal = Rigid + flex → 33.5 + 1.5 = 35.0', () => {
    expect(getWithdrawalTotal(SPEC_SS_WITH_REQS, 2030, false, [])).toBeCloseTo(35.0, 1);
  });
});

// ── Vue Injection ──────────────────────────────────────────────────────────────

describe('getInjectionBaseNet', () => {
  it('aucun modèle injection → 0', () => {
    const ss = { ...BASE_SS, directionalModel: { ...BASE_SS.directionalModel, injectionView: undefined } };
    expect(getInjectionBaseNet(ss, 2030, [])).toBeCloseTo(0);
  });

  it('spec §22 : -19.8-7.3+4.6+2.3 = -20.2', () =>
    expect(getInjectionBaseNet(SPEC_SS, 2030, [])).toBeCloseTo(-20.2, 1));
});

describe('getInjectionRigid', () => {
  it('spec §22 : base -20.2 − firm 3.8 = -24.0 (foisonnement=1)', () => {
    const ssInj = {
      ...SPEC_SS,
      foisonnement: { industriel: 1.0 },
      connectionRequests: [
        { id: 'r-i1', status: 'étudiée', yearSouhaitee: 2030, type: 'industriel',
          client: { prelevFerme: 0, prelevFlexible: 0, injFerme: 3.8, injFlexible: 1.2, detailPrelevement: [], detailInjection: [] },
          grd:    { prelevFerme: 0, prelevFlexible: 0, injFerme: 3.8, injFlexible: 1.2, decisionGRD: 'acceptable', noteDecision: '' } },
      ],
    };
    expect(getInjectionRigid(ssInj, 2030, false, [])).toBeCloseTo(-24.0, 1);
    expect(getInjectionTotal(ssInj, 2030, false, [])).toBeCloseTo(-25.2, 1);
  });
});

// ── Taux d'utilisation ────────────────────────────────────────────────────────

describe('getUtilizationWithdrawalRigid', () => {
  it('spec §22 : 33.5 / 40 = 83.75%', () =>
    expect(getUtilizationWithdrawalRigid(SPEC_SS_WITH_REQS, 2030, [])).toBeCloseTo(0.8375, 3));

  it('pas de charge → 0', () => {
    const ss = { ...BASE_SS, directionalModel: {
      referenceYear: 2025,
      withdrawalView: { maxHistoricLoadBT:0, maxHistoricLoadMT:0, minHistoricInjectionBT:0, minHistoricInjectionMT:0, growthLoadMaxBT:0, growthLoadMaxMT:0, growthMinInjectionBT:0, growthMinInjectionMT:0 },
      injectionView:  { maxHistoricInjectionBT:0, maxHistoricInjectionMT:0, minHistoricLoadBT:0, minHistoricLoadMT:0, growthMaxInjectionBT:0, growthMaxInjectionMT:0, growthMinLoadBT:0, growthMinLoadMT:0 },
    }};
    expect(getUtilizationWithdrawalRigid(ss, 2030, [])).toBeCloseTo(0);
  });
});

describe('getUtilizationInjectionRigid', () => {
  it('injection non dominante → 0 pour SS sans injection', () => {
    // BASE_SS has zero injection view values → no injection dominance
    expect(getUtilizationInjectionRigid(BASE_SS, 2025, [])).toBeCloseTo(0);
  });

  it('spec §22 injection : |−24| / 24 = 100%', () => {
    const ssInj = {
      ...SPEC_SS,
      foisonnement: { industriel: 1.0 },
      connectionRequests: [
        { id: 'r-i1', status: 'étudiée', yearSouhaitee: 2030, type: 'industriel',
          client: { prelevFerme: 0, prelevFlexible: 0, injFerme: 3.8, injFlexible: 1.2, detailPrelevement: [], detailInjection: [] },
          grd:    { prelevFerme: 0, prelevFlexible: 0, injFerme: 3.8, injFlexible: 1.2, decisionGRD: 'acceptable', noteDecision: '' } },
      ],
    };
    expect(getUtilizationInjectionRigid(ssInj, 2030, [])).toBeCloseTo(1.00, 3);
    expect(getUtilizationInjectionTotal(ssInj, 2030, [])).toBeCloseTo(1.05, 3);
  });
});

// ── Résiduels ─────────────────────────────────────────────────────────────────

describe('getResidualWithdrawalRigid', () => {
  it('spec §22 : 40 − 33.5 = 6.5', () =>
    expect(getResidualWithdrawalRigid(SPEC_SS_WITH_REQS, 2030, [])).toBeCloseTo(6.5, 1));
});

// ── Alertes ───────────────────────────────────────────────────────────────────

describe('getDirectionalAlertState', () => {
  it('utilisation 0 → worstLevel = ok', () => {
    const ss = { ...BASE_SS, directionalModel: {
      referenceYear: 2025,
      withdrawalView: { maxHistoricLoadBT:0, maxHistoricLoadMT:0, minHistoricInjectionBT:0, minHistoricInjectionMT:0, growthLoadMaxBT:0, growthLoadMaxMT:0, growthMinInjectionBT:0, growthMinInjectionMT:0 },
      injectionView:  { maxHistoricInjectionBT:0, maxHistoricInjectionMT:0, minHistoricLoadBT:0, minHistoricLoadMT:0, growthMaxInjectionBT:0, growthMaxInjectionMT:0, growthMinLoadBT:0, growthMinLoadMT:0 },
    }};
    const state = getDirectionalAlertState(ss, 2030, false, []);
    expect(state.worstLevel).toBe('ok');
  });

  it('spec §22 : withdrawal 83.75% → warning, injection 100% → critical, worst = critical', () => {
    const ssInj = {
      ...SPEC_SS,
      foisonnement: { industriel: 1.0 },
      connectionRequests: [
        { id: 'r-w1', status: 'étudiée', yearSouhaitee: 2030, type: 'industriel',
          client: { prelevFerme: 4.5, prelevFlexible: 1.5, injFerme: 3.8, injFlexible: 1.2, detailPrelevement: [], detailInjection: [] },
          grd:    { prelevFerme: 4.5, prelevFlexible: 1.5, injFerme: 3.8, injFlexible: 1.2, decisionGRD: 'acceptable', noteDecision: '' } },
      ],
    };
    const state = getDirectionalAlertState(ssInj, 2030, false, []);
    expect(state.worstWithdrawal).toBe('caution'); // 83.75% is between 70-85% → caution
    expect(state.worstInjection).toBe('critical');
    expect(state.worstLevel).toBe('critical');
  });

  it('retourne les valeurs brutes et capacités', () => {
    const state = getDirectionalAlertState(BASE_SS, 2026, false, []);
    expect(state).toHaveProperty('wRigid');
    expect(state).toHaveProperty('injRigid');
    expect(state).toHaveProperty('capDirN1');
    expect(state).toHaveProperty('capRevN1');
    expect(state).toHaveProperty('residualWRigid');
    expect(state).toHaveProperty('residualIRigid');
  });
});

describe('getWorstDirectionalAlertOverHorizon', () => {
  it('SS vide sans charge → ok', () => {
    const ss = { ...BASE_SS, directionalModel: {
      referenceYear: 2025,
      withdrawalView: { maxHistoricLoadBT:0, maxHistoricLoadMT:0, minHistoricInjectionBT:0, minHistoricInjectionMT:0, growthLoadMaxBT:0, growthLoadMaxMT:0, growthMinInjectionBT:0, growthMinInjectionMT:0 },
      injectionView:  { maxHistoricInjectionBT:0, maxHistoricInjectionMT:0, minHistoricLoadBT:0, minHistoricLoadMT:0, growthMaxInjectionBT:0, growthMaxInjectionMT:0, growthMinLoadBT:0, growthMinLoadMT:0 },
    }};
    expect(getWorstDirectionalAlertOverHorizon(ss, [])).toBe('ok');
  });

  it('charge croissante → pire alerte après 2025', () => {
    const worst = getWorstDirectionalAlertOverHorizon(BASE_SS, []);
    expect(['ok', 'caution', 'warning', 'critical', 'rigid_n']).toContain(worst);
  });
});

describe('getFirstWithdrawalSaturationYear', () => {
  it('SS confortable → null', () => {
    const ss = { ...BASE_SS, directionalModel: {
      referenceYear: 2025,
      withdrawalView: { maxHistoricLoadBT:5, maxHistoricLoadMT:3, minHistoricInjectionBT:0, minHistoricInjectionMT:0, growthLoadMaxBT:0.01, growthLoadMaxMT:0.01, growthMinInjectionBT:0, growthMinInjectionMT:0 },
      injectionView:  { maxHistoricInjectionBT:0, maxHistoricInjectionMT:0, minHistoricLoadBT:0, minHistoricLoadMT:0, growthMaxInjectionBT:0, growthMaxInjectionMT:0, growthMinLoadBT:0, growthMinLoadMT:0 },
    }};
    expect(getFirstWithdrawalSaturationYear(ss, [])).toBeNull();
  });

  it('déjà saturée → premier YEARS', () => {
    const ss = { ...BASE_SS, directionalModel: {
      referenceYear: 2025,
      withdrawalView: { maxHistoricLoadBT:42, maxHistoricLoadMT:0, minHistoricInjectionBT:0, minHistoricInjectionMT:0, growthLoadMaxBT:0, growthLoadMaxMT:0, growthMinInjectionBT:0, growthMinInjectionMT:0 },
      injectionView:  { maxHistoricInjectionBT:0, maxHistoricInjectionMT:0, minHistoricLoadBT:0, minHistoricLoadMT:0, growthMaxInjectionBT:0, growthMaxInjectionMT:0, growthMinLoadBT:0, growthMinLoadMT:0 },
    }};
    expect(getFirstWithdrawalSaturationYear(ss, [])).toBe(2026);
  });
});

// ── buildDirectionalSnapshot ──────────────────────────────────────────────────

describe('buildDirectionalSnapshot', () => {
  it('structure complète retournée', () => {
    const snap = buildDirectionalSnapshot(BASE_SS, 2028, 'withdrawal', []);
    expect(snap).toHaveProperty('subId', 'ss-t');
    expect(snap).toHaveProperty('withdrawalView');
    expect(snap).toHaveProperty('injectionView');
    expect(snap).toHaveProperty('capDirN1');
    expect(snap).toHaveProperty('capRevN1');
    expect(snap).toHaveProperty('projectsIncluded');
    expect(snap).toHaveProperty('projectsExcluded');
  });

  it('SS sans directionalModel → isMigrated = true', () => {
    const legacy = { ...BASE_SS, directionalModel: undefined, _directionalMigrated: true };
    const snap = buildDirectionalSnapshot(legacy, 2027, 'withdrawal', []);
    expect(snap.isMigrated).toBe(true);
  });
});

// ── Migration legacy ──────────────────────────────────────────────────────────

describe('Fallback legacy (sans directionalModel)', () => {
  const legacy = { ...BASE_SS, directionalModel: undefined };

  it('getWithdrawalBaseNet 2025 ≈ baseLoad2025', () =>
    expect(getWithdrawalBaseNet(legacy, 2025, [])).toBeCloseTo(20, 1));

  it('getWithdrawalBaseNet 2026 ≈ 20.4 (taux 2%)', () =>
    expect(getWithdrawalBaseNet(legacy, 2026, [])).toBeCloseTo(20.4, 1));

  it('getInjectionBaseNet = 0 (pas de vue injection)', () =>
    expect(getInjectionBaseNet(legacy, 2030, [])).toBeCloseTo(0));
});

// ── isSubstationAtRiskDirectional ─────────────────────────────────────────────

describe('isSubstationAtRiskDirectional', () => {
  it('sans projet → false', () =>
    expect(isSubstationAtRiskDirectional(BASE_SS, [])).toBe(false));

  it('SS presque saturée avec renforcement planifié → true', () => {
    const ss = { ...BASE_SS, directionalModel: {
      referenceYear: 2025,
      withdrawalView: { maxHistoricLoadBT:38, maxHistoricLoadMT:0, minHistoricInjectionBT:0, minHistoricInjectionMT:0, growthLoadMaxBT:0.01, growthLoadMaxMT:0, growthMinInjectionBT:0, growthMinInjectionMT:0 },
      injectionView:  { maxHistoricInjectionBT:0, maxHistoricInjectionMT:0, minHistoricLoadBT:0, minHistoricLoadMT:0, growthMaxInjectionBT:0, growthMaxInjectionMT:0, growthMinLoadBT:0, growthMinLoadMT:0 },
    }};
    const proj = {
      id: 'p1', year: 2028, status: 'planifié',
      effects: [{ ssId: 'ss-t', action: 'modify_tfo',
        tfoChanges: { remove:['T1','T2'], add:[{id:'T1b',power:63,role:'normal'},{id:'T2b',power:63,role:'normal'}], modify:[] } }],
    };
    expect(isSubstationAtRiskDirectional(ss, [proj])).toBe(true);
  });
});
