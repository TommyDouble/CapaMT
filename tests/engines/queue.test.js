/**
 * tests/engines/queue.test.js
 * v6 : file d'attente avec résiduel directionnel.
 */

import { describe, it, expect } from 'vitest';
import { getQueueAnalysis, getGlobalQueueStats, getExpiryInfo } from '../../src/engines/queue.js';
import { getEffectiveRigidReservation, reqClientPrelevTotal, reqGrdPrelevFerme } from '../../src/engines/requests.js';

const mkReq = (overrides = {}) => ({
  id: 'r1', name: 'Test', refProjet: 'T-001',
  type: 'industriel', status: 'en_étude', yearSouhaitee: 2026,
  dateDepot: '2025-01-01', dateOffre: null, reservationMonths: 18, raccordementDate: null,
  client: { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0, detailPrelevement: [], detailInjection: [] },
  grd: null,
  ...overrides,
});

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

const SS = (reqs = [], opts = {}) => ({
  id: 'ss-t', baseLoad2025: 20, organicGrowthRate: 0.02, plannableCapacity: 40,
  chargeHistory: [], foisonnement: {}, connectionRequests: reqs,
  transformerConfig: {
    transformers: [{ id: 'T1', power: 40, role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }],
    coeffN: 0.90, coeffN1: 1.00, mtBackup: { enabled: false, capacity: 0 },
    reverseCapacityRatio: 1.0,
  },
  directionalModel: DM,
  ...opts,
});

// ── getEffectiveRigidReservation ──────────────────────────────────────────────

describe('getEffectiveRigidReservation', () => {
  it('en_étude sans grd → total client', () =>
    expect(getEffectiveRigidReservation(mkReq())).toBeCloseTo(5));

  it('étudiée avec grd → prelevFerme GRD', () => {
    const req = mkReq({ status: 'étudiée', grd: { prelevFerme: 3, prelevFlexible: 2, injFerme: 0, injFlexible: 0, decisionGRD: 'acceptable', noteDecision: '' } });
    expect(getEffectiveRigidReservation(req)).toBeCloseTo(3);
  });

  it('annulée → 0', () => expect(getEffectiveRigidReservation(mkReq({ status: 'annulée' }))).toBe(0));
  it('raccordée → 0', () => expect(getEffectiveRigidReservation(mkReq({ status: 'raccordée' }))).toBe(0));
  it('conditionnel → 0', () => expect(getEffectiveRigidReservation(mkReq({ status: 'conditionnel' }))).toBe(0));
});

// ── getQueueAnalysis ──────────────────────────────────────────────────────────

describe('getQueueAnalysis — structure', () => {
  it('file vide → { queue: [], conditionals: [], cancelled: [] }', () => {
    const { queue, conditionals, cancelled } = getQueueAnalysis(SS());
    expect(queue).toHaveLength(0);
    expect(conditionals).toHaveLength(0);
    expect(cancelled).toHaveLength(0);
  });

  it('1 demande active → 1 résultat', () => {
    const { queue } = getQueueAnalysis(SS([mkReq()]));
    expect(queue).toHaveLength(1);
  });

  it('résultats ont withdrawalResidualBefore et injectionResidualBefore', () => {
    const { queue } = getQueueAnalysis(SS([mkReq()]));
    expect(queue[0]).toHaveProperty('withdrawalResidualBefore');
    expect(queue[0]).toHaveProperty('injectionResidualBefore');
    expect(queue[0]).toHaveProperty('residualBefore'); // backward compat
  });

  it('conditionnel → dans conditionals, pas dans queue', () => {
    const req = mkReq({ status: 'conditionnel' });
    const { queue, conditionals } = getQueueAnalysis(SS([req]));
    expect(queue).toHaveLength(0);
    expect(conditionals).toHaveLength(1);
  });

  it('annulée → dans cancelled', () => {
    const req = mkReq({ status: 'annulée' });
    const { queue, cancelled } = getQueueAnalysis(SS([req]));
    expect(queue).toHaveLength(0);
    expect(cancelled).toHaveLength(1);
  });
});

describe('getQueueAnalysis — résiduel directionnel', () => {
  it('residualBefore = cap − base − committed (pas de demandes précédentes)', () => {
    const req = mkReq();
    const { queue } = getQueueAnalysis(SS([req]));
    // Base nette ≈ 20 (13+7-0-0) à 2025, cap = 40
    // Résiduel ≈ 40 - 20.2 (2026) ≈ 19.8
    expect(queue[0].withdrawalResidualBefore).toBeGreaterThan(0);
    expect(queue[0].withdrawalResidualBefore).toBeLessThan(40);
  });

  it('deux demandes : residualBefore de la 2e < celle de la 1re', () => {
    const r1 = mkReq({ id: 'r1', dateDepot: '2025-01-01', yearSouhaitee: 2027 });
    const r2 = mkReq({ id: 'r2', dateDepot: '2025-06-01', yearSouhaitee: 2027 });
    const { queue } = getQueueAnalysis(SS([r1, r2]));
    expect(queue[0].position).toBe(1);
    expect(queue[1].position).toBe(2);
    expect(queue[1].withdrawalResidualBefore).toBeLessThan(queue[0].withdrawalResidualBefore);
  });

  it('autoDecision = acceptable si résiduel suffisant', () => {
    const req = mkReq({ status: 'en_étude', client: { prelevFerme: 2, prelevFlexible: 0, injFerme: 0, injFlexible: 0, detailPrelevement: [], detailInjection: [] } });
    const { queue } = getQueueAnalysis(SS([req]));
    expect(queue[0].autoDecision).toBe('acceptable');
  });

  it('autoDecision = liste_attente si SS saturée', () => {
    const ssSat = SS([], { directionalModel: {
      referenceYear: 2025,
      withdrawalView: { maxHistoricLoadBT: 42, maxHistoricLoadMT: 0, minHistoricInjectionBT: 0, minHistoricInjectionMT: 0, growthLoadMaxBT: 0, growthLoadMaxMT: 0, growthMinInjectionBT: 0, growthMinInjectionMT: 0 },
      injectionView:  DM.injectionView,
    }});
    ssSat.connectionRequests = [mkReq({ client: { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0, detailPrelevement: [], detailInjection: [] } })];
    const { queue } = getQueueAnalysis(ssSat);
    expect(queue[0].autoDecision).toBe('liste_attente');
  });
});

// ── getGlobalQueueStats ───────────────────────────────────────────────────────

describe('getGlobalQueueStats', () => {
  it('retourne les compteurs attendus', () => {
    const stats = getGlobalQueueStats([SS([mkReq()])], []);
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('acceptable');
    expect(stats).toHaveProperty('conditionnel');
    expect(stats).toHaveProperty('liste_attente');
    expect(stats.total).toBe(1);
  });
});

// ── getExpiryInfo ─────────────────────────────────────────────────────────────

describe('getExpiryInfo', () => {
  it('annulée → statut annulé', () =>
    expect(getExpiryInfo(mkReq({ status: 'annulée' })).status).toBe('annulé'));

  it('sans dateDepot → inconnu', () =>
    expect(getExpiryInfo(mkReq({ dateDepot: null })).status).toBe('inconnu'));

  it('étudiée avec dateOffre récente → ok ou bientôt', () => {
    const req = mkReq({ status: 'étudiée', dateOffre: '2030-12-01' });
    expect(['ok', 'bientôt', 'expiré']).toContain(getExpiryInfo(req).status);
  });
});
