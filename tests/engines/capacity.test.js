import { describe, it, expect } from 'vitest';
import {
  calcCapacityN,
  calcCapacityN1,
  getCapacityAtYear,
  getCapacityNAtYear,
} from '../../src/engines/capacity.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const TWO_TFO = {
  transformers: [{ id: 'T1', power: 40, role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }],
  coeffN: 0.90, coeffN1: 1.00, mtBackup: { enabled: false, capacity: 0 },
};
const ONE_TFO = {
  transformers: [{ id: 'T1', power: 40, role: 'normal' }],
  coeffN: 0.90, coeffN1: 1.00, mtBackup: { enabled: false, capacity: 0 },
};
const ONE_TFO_MT = {
  ...ONE_TFO, mtBackup: { enabled: true, capacity: 10 },
};
const BASE_SS = {
  id: 'ss-t', baseLoad2025: 20, organicGrowthRate: 0.02, plannableCapacity: 40,
  chargeHistory: [], foisonnement: {}, connectionRequests: [],
  transformerConfig: TWO_TFO,
};
const RENFORCEMENT = [{
  id: 'p1', year: 2028, status: 'planifié',
  effects: [{
    ssId: 'ss-t', action: 'modify_tfo',
    tfoChanges: { remove: ['T1', 'T2'], add: [{ id: 'T1', power: 63, role: 'normal' }, { id: 'T2', power: 63, role: 'normal' }], modify: [] },
    coeffN: 0.90, coeffN1: 1.00, mtBackup: { enabled: false, capacity: 0 },
  }],
}];

// ── calcCapacityN ─────────────────────────────────────────────────────────────
describe('calcCapacityN', () => {
  it('2×40 MVA × 0.90 = 72', () => expect(calcCapacityN(TWO_TFO)).toBeCloseTo(72));
  it('1×40 MVA × 0.90 = 36', () => expect(calcCapacityN(ONE_TFO)).toBeCloseTo(36));
  it('config null → null',    () => expect(calcCapacityN(null)).toBeNull());
  it('tfo vide → null',         () => expect(calcCapacityN({ transformers: [], coeffN: 1 })).toBeNull());
  it('power NaN → pas de NaN',() => {
    const bad = { ...TWO_TFO, transformers: [{ id: 'T1', power: 'abc', role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }] };
    expect(isFinite(calcCapacityN(bad))).toBe(true);
  });
});

// ── calcCapacityN1 ────────────────────────────────────────────────────────────
describe('calcCapacityN1', () => {
  it('2×40 MVA → (80-40)×1.00 = 40', () => expect(calcCapacityN1(TWO_TFO)).toBeCloseTo(40));
  it('1×40 MVA sans secours = 0',     () => expect(calcCapacityN1(ONE_TFO)).toBeCloseTo(0));
  it('1×40 MVA + MT 10 MVA = 10',     () => expect(calcCapacityN1(ONE_TFO_MT)).toBeCloseTo(10));
  it('config null → null',            () => expect(calcCapacityN1(null)).toBeNull());
  it('tfo vide → null',               () => expect(calcCapacityN1({ transformers: [], coeffN1: 1, mtBackup: { enabled: false, capacity: 0 } })).toBeNull());
  it('power NaN → pas de NaN',        () => {
    const bad = { ...TWO_TFO, transformers: [{ id: 'T1', power: NaN, role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }] };
    expect(isFinite(calcCapacityN1(bad))).toBe(true);
  });
});

// ── getCapacityAtYear ─────────────────────────────────────────────────────────
describe('getCapacityAtYear', () => {
  it('sans projet : 40 MVA constant', () => {
    expect(getCapacityAtYear(BASE_SS, 2026, [])).toBeCloseTo(40);
    expect(getCapacityAtYear(BASE_SS, 2030, [])).toBeCloseTo(40);
  });
  it('avant MES du renforcement (2027) : 40 MVA',  () => expect(getCapacityAtYear(BASE_SS, 2027, RENFORCEMENT)).toBeCloseTo(40));
  it('à la MES du renforcement (2028) : 63 MVA',   () => expect(getCapacityAtYear(BASE_SS, 2028, RENFORCEMENT)).toBeCloseTo(63));
  it('après MES du renforcement (2030) : 63 MVA',  () => expect(getCapacityAtYear(BASE_SS, 2030, RENFORCEMENT)).toBeCloseTo(63));
  it('projet annulé : capacité inchangée',          () => {
    const cancelled = [{ ...RENFORCEMENT[0], status: 'annulé' }];
    expect(getCapacityAtYear(BASE_SS, 2030, cancelled)).toBeCloseTo(40);
  });
  it('résultat toujours ≥ 0', () => {
    const zero = { ...BASE_SS, plannableCapacity: 0, transformerConfig: { transformers: [], coeffN: 1, coeffN1: 1, mtBackup: { enabled: false, capacity: 0 } } };
    expect(getCapacityAtYear(zero, 2026, [])).toBeGreaterThanOrEqual(0);
  });
  it('sans transformerConfig → fallback plannableCapacity', () => {
    const noTfo = { ...BASE_SS, transformerConfig: null };
    expect(getCapacityAtYear(noTfo, 2026, [])).toBeCloseTo(40);
  });
});
