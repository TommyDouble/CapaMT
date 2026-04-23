/**
 * tests/engines/explanation.test.js
 * v6 : teste buildCapacityBreakdown, buildDirectionalBreakdown, buildDecisionExplanation.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCapacityBreakdown,
  buildDirectionalBreakdown,
  buildDecisionExplanation,
} from '../../src/engines/explanation.js';

const DM = {
  referenceYear: 2025,
  withdrawalView: {
    maxHistoricLoadBT: 13.0, maxHistoricLoadMT: 7.0,
    minHistoricInjectionBT: 0.0, minHistoricInjectionMT: 0.0,
    growthLoadMaxBT: 0.020, growthLoadMaxMT: 0.020,
    growthMinInjectionBT: 0.000, growthMinInjectionMT: 0.000,
  },
  injectionView: {
    maxHistoricInjectionBT: 5.0, maxHistoricInjectionMT: 0.0,
    minHistoricLoadBT: 3.0, minHistoricLoadMT: 2.0,
    growthMaxInjectionBT: 0.080, growthMaxInjectionMT: 0.000,
    growthMinLoadBT: 0.010, growthMinLoadMT: 0.010,
  },
};

const BASE_SS = {
  id: 'ss-t', baseLoad2025: 20, organicGrowthRate: 0.02, plannableCapacity: 40,
  chargeHistory: [], foisonnement: {}, connectionRequests: [],
  transformerConfig: {
    transformers: [{ id: 'T1', power: 40, role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }],
    coeffN: 0.90, coeffN1: 1.00, mtBackup: { enabled: false, capacity: 0 },
    reverseCapacityRatio: 0.80,
  },
  directionalModel: DM,
};

const RENFORCEMENT = [{
  id: 'p1', name: 'Renforcement 2028', year: 2028, status: 'planifié',
  effects: [{
    ssId: 'ss-t', action: 'modify_tfo',
    tfoChanges: {
      remove: ['T1', 'T2'],
      add: [{ id: 'T1', power: 63, role: 'normal' }, { id: 'T2', power: 63, role: 'normal' }],
      modify: [],
    },
    coeffN: 0.90, coeffN1: 1.00, mtBackup: { enabled: false, capacity: 0 },
  }],
}];

const mkReq = (id, overrides = {}) => ({
  id, name: `Req ${id}`, refProjet: `T-${id}`, type: 'industriel',
  status: 'étudiée', yearSouhaitee: 2027, dateDepot: '2025-01-01', dateOffre: '2025-06-01',
  client: { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0, detailPrelevement: [], detailInjection: [] },
  grd:    { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0, decisionGRD: 'acceptable', noteDecision: '' },
  ...overrides,
});

const mkForm = (overrides = {}) => ({
  id: 'new', yearSouhaitee: 2027,
  client: { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0, detailPrelevement: [], detailInjection: [] },
  ...overrides,
});

// ── buildCapacityBreakdown ────────────────────────────────────────────────────

describe('buildCapacityBreakdown', () => {
  it('sub null → null', () => expect(buildCapacityBreakdown(null, 2027)).toBeNull());

  it('retourne capN1, capN, capRevN1, capRevN', () => {
    const b = buildCapacityBreakdown(BASE_SS, 2027, []);
    expect(b.capN1).toBeCloseTo(40, 1);
    expect(b.capRevN1).toBeCloseTo(32, 1); // 40 × 0.80
    expect(b).toHaveProperty('capN');
    expect(b).toHaveProperty('capRevN');
    expect(b.reverseCapacityRatio).toBeCloseTo(0.80);
  });

  it('projet non encore actif → capN1 inchangée avant son année', () => {
    const b1 = buildCapacityBreakdown(BASE_SS, 2027, RENFORCEMENT);
    const b2 = buildCapacityBreakdown(BASE_SS, 2027, []);
    expect(b1.capN1).toBeCloseTo(b2.capN1, 1);
  });

  it('projet actif → capN1 augmente', () => {
    const b1 = buildCapacityBreakdown(BASE_SS, 2030, RENFORCEMENT);
    const b2 = buildCapacityBreakdown(BASE_SS, 2030, []);
    expect(b1.capN1).toBeGreaterThan(b2.capN1);
  });

  it('projectContribution = différence avec/sans projets', () => {
    const b = buildCapacityBreakdown(BASE_SS, 2030, RENFORCEMENT);
    expect(b.projectContribution).toBeGreaterThan(0);
  });
});

// ── buildDirectionalBreakdown ─────────────────────────────────────────────────

describe('buildDirectionalBreakdown', () => {
  it('sub null → null', () => expect(buildDirectionalBreakdown(null, 2027)).toBeNull());

  it('retourne les composantes des deux vues', () => {
    const b = buildDirectionalBreakdown(BASE_SS, 2027, []);
    expect(b).toHaveProperty('wLoadBT');
    expect(b).toHaveProperty('wLoadMT');
    expect(b).toHaveProperty('iMaxInjBT');
    expect(b).toHaveProperty('iMinLoadBT');
  });

  it('retourne les résultantes', () => {
    const b = buildDirectionalBreakdown(BASE_SS, 2027, []);
    expect(b).toHaveProperty('withdrawalBase');
    expect(b).toHaveProperty('withdrawalRigid');
    expect(b).toHaveProperty('withdrawalTotal');
    expect(b).toHaveProperty('injectionBase');
    expect(b).toHaveProperty('injectionRigid');
    expect(b).toHaveProperty('injectionTotal');
  });

  it('withdrawalBase = wLoadBT + wLoadMT - wInjBT - wInjMT', () => {
    const b = buildDirectionalBreakdown(BASE_SS, 2025, []);
    const expected = b.wLoadBT + b.wLoadMT - b.wInjBT - b.wInjMT;
    expect(b.withdrawalBase).toBeCloseTo(expected, 2);
  });

  it('avec demandes : engagedCount > 0', () => {
    const ss = { ...BASE_SS, connectionRequests: [mkReq('r1')] };
    const b = buildDirectionalBreakdown(ss, 2027, []);
    expect(b.engagedCount).toBe(1);
    expect(b.totalWFirm).toBeGreaterThan(0);
  });

  it('excludeId exclut la demande', () => {
    const ss = { ...BASE_SS, connectionRequests: [mkReq('r1')] };
    const b = buildDirectionalBreakdown(ss, 2027, [], 'r1');
    expect(b.engagedCount).toBe(0);
  });
});

// ── buildDecisionExplanation ──────────────────────────────────────────────────

describe('buildDecisionExplanation', () => {
  it('sub null → null', () => expect(buildDecisionExplanation(null, mkForm())).toBeNull());
  it('form null → null', () => expect(buildDecisionExplanation(BASE_SS, null)).toBeNull());

  it('retourne verdictKey et recommendation', () => {
    const exp = buildDecisionExplanation(BASE_SS, mkForm(), []);
    expect(exp).not.toBeNull();
    expect(exp).toHaveProperty('verdictKey');
    expect(exp).toHaveProperty('recommendation');
    expect(exp.recommendation).toHaveProperty('ferme');
    expect(exp.recommendation).toHaveProperty('flexible');
  });

  it('capacité suffisante → verdictKey = acceptable', () => {
    const exp = buildDecisionExplanation(BASE_SS, mkForm({ client: { prelevFerme: 2, prelevFlexible: 0, injFerme: 0, injFlexible: 0 } }), []);
    expect(exp.verdictKey).toBe('acceptable');
  });

  it('retourne residualWithdrawal et residualInjection', () => {
    const exp = buildDecisionExplanation(BASE_SS, mkForm(), []);
    expect(exp).toHaveProperty('residualWithdrawal');
    expect(exp).toHaveProperty('residualInjection');
  });

  it('retourne capBreakdown avec capRevN1', () => {
    const exp = buildDecisionExplanation(BASE_SS, mkForm(), []);
    expect(exp.capBreakdown).toHaveProperty('capRevN1');
  });

  it('aucune puissance → null', () => {
    const form = mkForm({ client: { prelevFerme: 0, prelevFlexible: 0, injFerme: 0, injFlexible: 0 } });
    expect(buildDecisionExplanation(BASE_SS, form)).toBeNull();
  });
});
