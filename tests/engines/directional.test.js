import { describe, expect, it } from 'vitest';
import {
  getInjectionBaseNet,
  getWithdrawalBaseNet,
  getWithdrawalRigid,
} from '../../src/engines/directionalSubstation.js';
import { canonicalSubstation, connectedRequest } from '../helpers/canonicalFixtures.js';

describe('modele directionnel canonique', () => {
  it('calcule les vues prélèvement et injection depuis directionalModel', () => {
    const sub = canonicalSubstation();

    expect(getWithdrawalBaseNet(sub, 2027)).toBe(13);
    expect(getInjectionBaseNet(sub, 2027)).toBe(-2);
  });

  it('compte les raccordés maintenus dans la charge rigide', () => {
    const sub = canonicalSubstation({
      connectionRequests: [
        connectedRequest({ id: 'kept', offerDates: { connectedAt: '2026-04-01' }, load: 5 }),
      ],
    });

    expect(getWithdrawalRigid(sub, 2027)).toBe(18);
  });

  it('ignore les raccordés dont le maintien est terminé', () => {
    const sub = canonicalSubstation({
      connectionRequests: [
        connectedRequest({
          id: 'ended',
          offerDates: { connectedAt: '2025-01-01' },
          connectedRetentionMonths: 1,
          load: 5,
        }),
      ],
    });

    expect(getWithdrawalRigid(sub, 2027)).toBe(13);
  });

  it('retourne zéro sans modèle directionnel', () => {
    const sub = canonicalSubstation({ directionalModel: null });

    expect(getWithdrawalBaseNet(sub, 2027)).toBe(0);
    expect(getInjectionBaseNet(sub, 2027)).toBe(0);
  });
});
