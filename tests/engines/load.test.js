/**
 * tests/engines/load.test.js
 * v6 : teste les wrappers legacy de load.js qui délèguent au modèle directionnel.
 */

import { describe, it, expect } from 'vitest';
import {
  getOrganicLoad, getNetRigidLoad, getNetTotalLoad,
  getResidualRigid, getFullAlertState,
} from '../../src/engines/load.js';

const DM_ZERO = {
  referenceYear: 2025,
  withdrawalView: { maxHistoricLoadBT:0, maxHistoricLoadMT:0, minHistoricInjectionBT:0, minHistoricInjectionMT:0, growthLoadMaxBT:0, growthLoadMaxMT:0, growthMinInjectionBT:0, growthMinInjectionMT:0 },
  injectionView:  { maxHistoricInjectionBT:0, maxHistoricInjectionMT:0, minHistoricLoadBT:0, minHistoricLoadMT:0, growthMaxInjectionBT:0, growthMaxInjectionMT:0, growthMinLoadBT:0, growthMinLoadMT:0 },
};

const BASE_SS = {
  id: 'ss-t', baseLoad2025: 20, organicGrowthRate: 0.02, plannableCapacity: 40,
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

// ── getOrganicLoad (wrapper → getWithdrawalBaseNet) ──────────────────────────

describe('getOrganicLoad (legacy wrapper)', () => {
  it('2025 = loadBT + loadMT = 13 + 7 = 20', () =>
    expect(getOrganicLoad(BASE_SS, 2025, 1.0, [])).toBeCloseTo(20, 1));

  it('2026 > 2025 (croissance 2%)', () => {
    const v25 = getOrganicLoad(BASE_SS, 2025, 1.0, []);
    const v26 = getOrganicLoad(BASE_SS, 2026, 1.0, []);
    expect(v26).toBeGreaterThan(v25);
  });

  it('scenarioMult ignoré — pas de scénario dans le modèle directionnel', () => {
    const v1 = getOrganicLoad(BASE_SS, 2028, 0.6, []);
    const v2 = getOrganicLoad(BASE_SS, 2028, 1.0, []);
    const v3 = getOrganicLoad(BASE_SS, 2028, 1.7, []);
    expect(v1).toBeCloseTo(v2, 3);
    expect(v2).toBeCloseTo(v3, 3);
  });
});

// ── getNetRigidLoad ────────────────────────────────────────────────────────────

describe('getNetRigidLoad (legacy wrapper)', () => {
  it('sans demandes = getOrganicLoad', () => {
    const v = getNetRigidLoad(BASE_SS, 2027, 1.0, false, []);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeCloseTo(getOrganicLoad(BASE_SS, 2027, 1.0, []), 2);
  });

  it('avec demande ferme : augmente la charge rigide', () => {
    const req = {
      id: 'r1', status: 'étudiée', yearSouhaitee: 2027, type: 'industriel',
      client: { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0, detailPrelevement: [], detailInjection: [] },
      grd:    { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0, decisionGRD: 'acceptable', noteDecision: '' },
    };
    const ss = { ...BASE_SS, connectionRequests: [req] };
    const withReq = getNetRigidLoad(ss, 2027, 1.0, false, []);
    const withoutReq = getNetRigidLoad(BASE_SS, 2027, 1.0, false, []);
    expect(withReq).toBeGreaterThan(withoutReq);
  });
});

// ── getResidualRigid ───────────────────────────────────────────────────────────

describe('getResidualRigid (legacy wrapper)', () => {
  it('résiduel positif pour une SS non saturée', () => {
    const res = getResidualRigid(BASE_SS, 2026, 1.0, []);
    expect(res).toBeGreaterThan(0);
  });
});

// ── getFullAlertState (délègue à getDirectionalAlertState) ────────────────────

describe('getFullAlertState (legacy wrapper)', () => {
  it('retourne worstLevel', () => {
    const state = getFullAlertState(BASE_SS, 2026, 1.0, []);
    expect(state).toHaveProperty('worstLevel');
    expect(['ok', 'caution', 'warning', 'critical', 'rigid_n', 'pilot_n1', 'pilot_n']).toContain(state.worstLevel);
  });

  it('SS vide → ok', () => {
    const ss = { ...BASE_SS, directionalModel: { referenceYear: 2025, withdrawalView: { maxHistoricLoadBT:0, maxHistoricLoadMT:0, minHistoricInjectionBT:0, minHistoricInjectionMT:0, growthLoadMaxBT:0, growthLoadMaxMT:0, growthMinInjectionBT:0, growthMinInjectionMT:0 }, injectionView: { maxHistoricInjectionBT:0, maxHistoricInjectionMT:0, minHistoricLoadBT:0, minHistoricLoadMT:0, growthMaxInjectionBT:0, growthMaxInjectionMT:0, growthMinLoadBT:0, growthMinLoadMT:0 } } };
    const state = getFullAlertState(ss, 2026, 1.0, []);
    expect(state.worstLevel).toBe('ok');
  });
});
