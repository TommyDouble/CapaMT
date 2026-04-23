/**
 * tests/engines/assumptions.test.js
 * v6 : teste buildAssumptionsSnapshot (délègue à buildDirectionalSnapshot).
 */

import { describe, it, expect } from 'vitest';
import { buildAssumptionsSnapshot } from '../../src/engines/assumptions.js';

const BASE_SS = {
  id: 'ss-t',
  baseLoad2025: 20, organicGrowthRate: 0.02, plannableCapacity: 40,
  chargeHistory: [], foisonnement: {}, connectionRequests: [],
  transformerConfig: {
    transformers: [{ id: 'T1', power: 40, role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }],
    coeffN: 0.90, coeffN1: 1.00, mtBackup: { enabled: false, capacity: 0 },
    reverseCapacityRatio: 0.80,
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
      maxHistoricInjectionBT: 5.0, maxHistoricInjectionMT: 0.0,
      minHistoricLoadBT: 3.0, minHistoricLoadMT: 2.0,
      growthMaxInjectionBT: 0.080, growthMaxInjectionMT: 0.000,
      growthMinLoadBT: 0.010, growthMinLoadMT: 0.010,
    },
  },
};

const PROJ_ACTIVE = { id: 'p1', name: 'Renforcement', year: 2027, status: 'planifié', effects: [] };
const PROJ_FUTUR  = { id: 'p3', name: 'Futur 2031',   year: 2031, status: 'planifié', effects: [] };

describe('buildAssumptionsSnapshot', () => {
  it('sub null → null', () =>
    expect(buildAssumptionsSnapshot(null, 2027, 'withdrawal')).toBeNull());

  it('structure de base complète', () => {
    const s = buildAssumptionsSnapshot(BASE_SS, 2027, 'withdrawal', []);
    expect(s.subId).toBe('ss-t');
    expect(s.activeView).toBe('withdrawal');
    expect(s.targetYear).toBe(2027);
    expect(s.referenceYear).toBe(2025);
    expect(s).toHaveProperty('withdrawalView');
    expect(s).toHaveProperty('injectionView');
    expect(s).toHaveProperty('capDirN1');
    expect(s).toHaveProperty('capRevN1');
    expect(s).toHaveProperty('reverseCapacityRatio');
  });

  it('reverseCapacityRatio correctement transmis', () => {
    const s = buildAssumptionsSnapshot(BASE_SS, 2027, 'withdrawal', []);
    expect(s.reverseCapacityRatio).toBeCloseTo(0.80);
  });

  it('activeView = injection possible', () => {
    const s = buildAssumptionsSnapshot(BASE_SS, 2028, 'injection', []);
    expect(s.activeView).toBe('injection');
  });

  it('projet inclus dans projectsIncluded si year <= targetYear', () => {
    const s = buildAssumptionsSnapshot(BASE_SS, 2028, 'withdrawal', [PROJ_ACTIVE]);
    expect(s.projectsIncluded.some(p => p.id === 'p1')).toBe(true);
  });

  it('projet futur dans projectsExcluded', () => {
    const s = buildAssumptionsSnapshot(BASE_SS, 2028, 'withdrawal', [PROJ_FUTUR]);
    expect(s.projectsExcluded.some(p => p.id === 'p3')).toBe(true);
  });

  it('capRevN1 = capDirN1 × reverseCapacityRatio', () => {
    const s = buildAssumptionsSnapshot(BASE_SS, 2027, 'withdrawal', []);
    expect(s.capRevN1).toBeCloseTo(s.capDirN1 * 0.80, 1);
  });
});
