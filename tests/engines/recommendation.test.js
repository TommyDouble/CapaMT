/**
 * tests/engines/recommendation.test.js
 * v6 : teste computeRecommendation avec le modèle directionnel.
 */

import { describe, it, expect } from 'vitest';
import { computeRecommendation } from '../../src/engines/recommendation.js';

const DM = {
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
};

const BASE_SS = {
  id: 'ss-t', baseLoad2025: 20, organicGrowthRate: 0.02, plannableCapacity: 40,
  chargeHistory: [], foisonnement: {}, connectionRequests: [],
  transformerConfig: {
    transformers: [{ id: 'T1', power: 40, role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }],
    coeffN: 0.90, coeffN1: 1.00, mtBackup: { enabled: false, capacity: 0 },
    reverseCapacityRatio: 1.0,
  },
  directionalModel: DM,
};

const mkReq = (id, overrides = {}) => ({
  id, status: 'étudiée', yearSouhaitee: 2026, type: 'industriel',
  client: { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0, detailPrelevement: [], detailInjection: [] },
  grd: { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0, decisionGRD: 'acceptable', noteDecision: '' },
  ...overrides,
});

const mkForm = (overrides = {}) => ({
  id: 'new', yearSouhaitee: 2026,
  client: { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0, detailPrelevement: [], detailInjection: [] },
  ...overrides,
});

describe('computeRecommendation — entrées invalides', () => {
  it('sub null → null', () => expect(computeRecommendation(null, mkForm())).toBeNull());
  it('form null → null', () => expect(computeRecommendation(BASE_SS, null)).toBeNull());
  it('aucune puissance → null', () => expect(computeRecommendation(BASE_SS, mkForm({ client: { prelevFerme: 0, prelevFlexible: 0, injFerme: 0, injFlexible: 0 } }))).toBeNull());
});

describe('computeRecommendation — résiduel et recommandation', () => {
  it('SS vide : résiduel = cap − base nette', () => {
    const rec = computeRecommendation(BASE_SS, mkForm(), []);
    expect(rec).not.toBeNull();
    expect(rec.capDirN1).toBeCloseTo(40, 1);
    expect(rec.withdrawalBase).toBeCloseTo(20, 0);
    expect(rec.residualWithdrawal).toBeCloseTo(20, 0);
  });

  it('capacité suffisante → canFullFerme = true', () => {
    const rec = computeRecommendation(BASE_SS, mkForm({ client: { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0 } }), []);
    expect(rec.canFullFerme).toBe(true);
    expect(rec.recFerme).toBe(5);
    expect(rec.recFlex).toBe(0);
  });

  it('demande client > résiduel → canPartial = true, recFerme < clientFerme', () => {
    // SS très chargée : charge = 38 MVA, résiduel = 2 MVA, client veut 5 ferme
    const ssCharged = { ...BASE_SS, directionalModel: {
      referenceYear: 2025,
      withdrawalView: { maxHistoricLoadBT: 38, maxHistoricLoadMT: 0, minHistoricInjectionBT: 0, minHistoricInjectionMT: 0, growthLoadMaxBT: 0, growthLoadMaxMT: 0, growthMinInjectionBT: 0, growthMinInjectionMT: 0 },
      injectionView: DM.injectionView,
    }};
    const rec = computeRecommendation(ssCharged, mkForm({ client: { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0 } }), []);
    expect(rec.canPartial).toBe(true);
    expect(rec.recFerme).toBeLessThan(5);
    expect(rec.recFlex).toBeGreaterThan(0);
  });

  it('SS saturée → noRigid = true, recFerme = 0', () => {
    const ssSat = { ...BASE_SS, directionalModel: {
      referenceYear: 2025,
      withdrawalView: { maxHistoricLoadBT: 42, maxHistoricLoadMT: 0, minHistoricInjectionBT: 0, minHistoricInjectionMT: 0, growthLoadMaxBT: 0, growthLoadMaxMT: 0, growthMinInjectionBT: 0, growthMinInjectionMT: 0 },
      injectionView: DM.injectionView,
    }};
    const rec = computeRecommendation(ssSat, mkForm(), []);
    expect(rec.noRigid).toBe(true);
    expect(rec.recFerme).toBe(0);
  });

  it('réservations existantes réduisent le résiduel', () => {
    const existing = mkReq('existing', { yearSouhaitee: 2026, grd: { prelevFerme: 10, prelevFlexible: 0, injFerme: 0, injFlexible: 0, decisionGRD: 'acceptable', noteDecision: '' } });
    const sub = { ...BASE_SS, connectionRequests: [existing] };
    const recWithout = computeRecommendation(BASE_SS, mkForm(), []);
    const recWith    = computeRecommendation(sub, mkForm(), []);
    expect(recWith.residualWithdrawal).toBeLessThan(recWithout.residualWithdrawal);
  });

  it('retourne residualWithdrawal et residualInjection', () => {
    const rec = computeRecommendation(BASE_SS, mkForm(), []);
    expect(rec).toHaveProperty('residualWithdrawal');
    expect(rec).toHaveProperty('residualInjection');
  });
});
