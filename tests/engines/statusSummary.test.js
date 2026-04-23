import { describe, it, expect } from 'vitest';
import {
  buildRequestStatusSummary,
  buildQueuePhaseSummary,
  REQUEST_PHASES,
} from '../../src/engines/statusSummary.js';

const mkReq = (status, grd = null, extra = {}) => ({
  id: 'r1', name: 'Test', refProjet: 'T-001', type: 'industriel',
  yearSouhaitee: 2027, dateDepot: '2025-01-01',
  status, grd, ...extra,
});

describe('buildRequestStatusSummary — entrées invalides', () => {
  it('req null → null', () => expect(buildRequestStatusSummary(null)).toBeNull());
  it('statut inconnu → phase deposee (fallback)', () => {
    const s = buildRequestStatusSummary(mkReq('statut_inconnu'));
    expect(s.phaseKey).toBe('deposee');
  });
});

describe('buildRequestStatusSummary — mapping statuts → phases', () => {
  const cases = [
    ['en_étude', null,                                      'deposee'],
    ['étudiée',  null,                                      'analysee'],
    ['étudiée',  { decisionGRD: 'acceptable' },             'acceptable'],
    ['étudiée',  { decisionGRD: 'liste_attente' },          'analysee'],
    ['étudiée',  { decisionGRD: 'conditionnel' },           'analysee'],
    ['conditionnel', null,                                  'conditionnelle'],
    ['raccordée', null,                                     'raccordee'],
    ['raccordé',  null,                                     'raccordee'],
    ['annulée',   null,                                     'annulee'],
    ['annulé',    null,                                     'annulee'],
  ];

  cases.forEach(([status, grd, expectedPhase]) => {
    it(`${status} ${grd?.decisionGRD ?? ''} → ${expectedPhase}`, () => {
      const s = buildRequestStatusSummary(mkReq(status, grd));
      expect(s.phaseKey).toBe(expectedPhase);
    });
  });
});

describe('buildRequestStatusSummary — structure retournée', () => {
  it('contient statusTechnique, phaseKey, phaseLabel, description, nextStep', () => {
    const s = buildRequestStatusSummary(mkReq('en_étude'));
    expect(s).toHaveProperty('statusTechnique');
    expect(s).toHaveProperty('phaseKey');
    expect(s).toHaveProperty('phaseLabel');
    expect(s).toHaveProperty('description');
    expect(s).toHaveProperty('nextStep');
  });

  it('phaseLabel est une chaîne non vide', () => {
    const s = buildRequestStatusSummary(mkReq('en_étude'));
    expect(typeof s.phaseLabel).toBe('string');
    expect(s.phaseLabel.length).toBeGreaterThan(0);
  });

  it('description est une chaîne non vide pour tous les statuts', () => {
    ['en_étude', 'étudiée', 'conditionnel', 'raccordée', 'annulée'].forEach(status => {
      const s = buildRequestStatusSummary(mkReq(status));
      expect(typeof s.description).toBe('string');
      expect(s.description.length).toBeGreaterThan(0);
    });
  });

  it('strike = true pour les demandes annulées', () => {
    expect(buildRequestStatusSummary(mkReq('annulée')).strike).toBe(true);
    expect(buildRequestStatusSummary(mkReq('en_étude')).strike).toBe(false);
  });

  it('hasGrd = false sans grd, true avec grd', () => {
    expect(buildRequestStatusSummary(mkReq('en_étude', null)).hasGrd).toBe(false);
    expect(buildRequestStatusSummary(mkReq('étudiée', { decisionGRD: 'acceptable' })).hasGrd).toBe(true);
  });

  it('phaseOrder permet un tri croissant du cycle de vie', () => {
    const phases = ['en_étude', 'étudiée', 'raccordée']
      .map(s => buildRequestStatusSummary(mkReq(s)));
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i].phaseOrder).toBeGreaterThanOrEqual(phases[i-1].phaseOrder);
    }
  });
});

describe('buildRequestStatusSummary — nextStep', () => {
  it('annulée → nextStep null', () => expect(buildRequestStatusSummary(mkReq('annulée')).nextStep).toBeNull());
  it('raccordée → nextStep décrit l\'intégration en base', () => {
    const s = buildRequestStatusSummary(mkReq('raccordée'));
    expect(typeof s.nextStep).toBe('string');
  });
  it('en_étude → nextStep décrit le lancement d\'étude', () => {
    const s = buildRequestStatusSummary(mkReq('en_étude'));
    expect(typeof s.nextStep).toBe('string');
    expect(s.nextStep?.length).toBeGreaterThan(0);
  });
});

describe('buildQueuePhaseSummary', () => {
  it('liste vide → total 0, byPhase tous à 0', () => {
    const r = buildQueuePhaseSummary([]);
    expect(r.total).toBe(0);
    Object.values(r.byPhase).forEach(v => expect(v).toBe(0));
  });

  it('compte correctement par phase', () => {
    const reqs = [
      mkReq('en_étude'),
      mkReq('en_étude'),
      mkReq('étudiée', { decisionGRD: 'acceptable' }),
      mkReq('annulée'),
    ];
    const r = buildQueuePhaseSummary(reqs);
    expect(r.total).toBe(4);
    expect(r.byPhase.deposee).toBe(2);
    expect(r.byPhase.acceptable).toBe(1);
    expect(r.byPhase.annulee).toBe(1);
  });
});

describe('REQUEST_PHASES', () => {
  it('contient au moins 5 phases', () => {
    expect(Object.keys(REQUEST_PHASES).length).toBeGreaterThanOrEqual(5);
  });

  it('chaque phase a label, color, bg, border, order', () => {
    Object.values(REQUEST_PHASES).forEach(p => {
      expect(p).toHaveProperty('label');
      expect(p).toHaveProperty('color');
      expect(p).toHaveProperty('bg');
      expect(p).toHaveProperty('order');
    });
  });
});
