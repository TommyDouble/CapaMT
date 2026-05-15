import { describe, expect, it } from 'vitest';
import {
  calcCapacityN,
  calcCapacityN1,
  getCapacityAtYear,
  getCapacityNAtYear,
} from '../../src/engines/capacity.js';
import { canonicalSubstation } from '../helpers/canonicalFixtures.js';

describe('capacités transformateur canoniques', () => {
  it('calcule N et N-1 depuis transformerConfig', () => {
    const config = canonicalSubstation().transformerConfig;

    expect(calcCapacityN(config)).toBe(45);
    expect(calcCapacityN1(config)).toBe(25);
  });

  it('retourne zéro sans configuration transformateur', () => {
    const sub = canonicalSubstation({ transformerConfig: null });

    expect(getCapacityAtYear(sub, 2027)).toBe(0);
    expect(getCapacityNAtYear(sub, 2027)).toBeNull();
  });

  it('applique les projets de modification transformateur', () => {
    const sub = canonicalSubstation();
    const project = {
      id: 'proj-1',
      status: 'validé',
      year: 2027,
      effects: [
        {
          ssId: sub.id,
          action: 'modify_tfo',
          tfoChanges: { remove: [], add: [{ id: 't3', power: 25, role: 'normal' }], modify: [] },
          coeffN: 0.9,
          coeffN1: 1,
          mtBackup: { enabled: false, capacity: 0 },
        },
      ],
    };

    expect(getCapacityAtYear(sub, 2027, [project])).toBe(50);
  });
});
