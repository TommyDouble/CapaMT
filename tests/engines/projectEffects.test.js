import { describe, it, expect } from 'vitest';
import { computeEffectsFromBlocks } from '../../src/engines/projectEffects.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SS_BASE = {
  id: 'ss-1',
  transformerConfig: {
    transformers: [
      { id: 'T1', power: 40, role: 'normal' },
      { id: 'T2', power: 40, role: 'normal' },
    ],
    coeffN: 0.90, coeffN1: 1.00,
    mtBackup: { enabled: false, capacity: 0 },
  },
};

// Note: String(0.90)='0.9', String(1.00)='1' in JS — use these to avoid spurious coeffN diffs
const mkRenfBlock = (overrides = {}) => ({
  blockType: 'renforcement',
  ssId: 'ss-1',
  tfos: [{ id: 'T1', power: 40, role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }],
  coeffN:   '0.9',
  coeffN1:  '1',
  mtBackupEnabled:  false,
  mtBackupCapacity: '',
  loadDelta: '',
  ...overrides,
});

// ── renforcement ───────────────────────────────────────────────────────────────

describe('renforcement — sans changement → aucun effet', () => {
  it('tfos identiques, coeffs identiques → []', () => {
    const effects = computeEffectsFromBlocks([mkRenfBlock()], [SS_BASE]);
    expect(effects).toHaveLength(0);
  });

  it('load_transfer vide → aucun effet loadDelta', () => {
    const effects = computeEffectsFromBlocks([mkRenfBlock({ loadDelta: '' })], [SS_BASE]);
    expect(effects.filter(e => e.action === 'load_transfer')).toHaveLength(0);
  });
});

describe('renforcement — ajout de transformateur', () => {
  it('ajoute T3 → effect modify_tfo avec T3 dans add', () => {
    const block = mkRenfBlock({
      tfos: [
        { id: 'T1', power: 40, role: 'normal' },
        { id: 'T2', power: 40, role: 'normal' },
        { id: 'T3', power: 63, role: 'normal' },
      ],
    });
    const effects = computeEffectsFromBlocks([block], [SS_BASE]);
    expect(effects).toHaveLength(1);
    expect(effects[0].action).toBe('modify_tfo');
    expect(effects[0].tfoChanges.add).toHaveLength(1);
    expect(effects[0].tfoChanges.add[0].id).toBe('T3');
    expect(effects[0].tfoChanges.remove).toHaveLength(0);
    expect(effects[0].tfoChanges.modify).toHaveLength(0);
  });
});

describe('renforcement — suppression de transformateur', () => {
  it('retire T2 → effect modify_tfo avec T2 dans remove', () => {
    const block = mkRenfBlock({
      tfos: [{ id: 'T1', power: 40, role: 'normal' }],
    });
    const effects = computeEffectsFromBlocks([block], [SS_BASE]);
    expect(effects).toHaveLength(1);
    expect(effects[0].tfoChanges.remove).toContain('T2');
    expect(effects[0].tfoChanges.add).toHaveLength(0);
  });
});

describe('renforcement — modification de puissance', () => {
  it('T1 passe de 40 à 63 MVA → dans modify', () => {
    const block = mkRenfBlock({
      tfos: [
        { id: 'T1', power: 63, role: 'normal' },
        { id: 'T2', power: 40, role: 'normal' },
      ],
    });
    const effects = computeEffectsFromBlocks([block], [SS_BASE]);
    expect(effects).toHaveLength(1);
    expect(effects[0].tfoChanges.modify).toHaveLength(1);
    expect(effects[0].tfoChanges.modify[0].id).toBe('T1');
    expect(effects[0].tfoChanges.modify[0].power).toBe(63);
  });
});

describe('renforcement — changement de coefficients', () => {
  it('coeffN change → effect modify_tfo', () => {
    const effects = computeEffectsFromBlocks([mkRenfBlock({ coeffN: '0.80' })], [SS_BASE]);
    expect(effects).toHaveLength(1);
    expect(effects[0].coeffN).toBeCloseTo(0.80);
  });

  it('coeffN1 change → effect modify_tfo', () => {
    const effects = computeEffectsFromBlocks([mkRenfBlock({ coeffN1: '0.95' })], [SS_BASE]);
    expect(effects).toHaveLength(1);
    expect(effects[0].coeffN1).toBeCloseTo(0.95);
  });

  it('effet contient les deux coefficients cibles', () => {
    const effects = computeEffectsFromBlocks(
      [mkRenfBlock({ coeffN: '0.85', coeffN1: '0.95' })], [SS_BASE]
    );
    expect(effects[0].coeffN).toBeCloseTo(0.85);
    expect(effects[0].coeffN1).toBeCloseTo(0.95);
  });
});

describe('renforcement — changement mtBackup', () => {
  it('activation mtBackup → effect modify_tfo', () => {
    const effects = computeEffectsFromBlocks(
      [mkRenfBlock({ mtBackupEnabled: true, mtBackupCapacity: '10' })], [SS_BASE]
    );
    expect(effects).toHaveLength(1);
    expect(effects[0].mtBackup.enabled).toBe(true);
    expect(effects[0].mtBackup.capacity).toBeCloseTo(10);
  });
});

describe('renforcement — load_transfer', () => {
  it('loadDelta = 5 → effet load_transfer séparé', () => {
    const effects = computeEffectsFromBlocks([mkRenfBlock({ loadDelta: '5' })], [SS_BASE]);
    const lt = effects.filter(e => e.action === 'load_transfer');
    expect(lt).toHaveLength(1);
    expect(lt[0].loadDelta).toBeCloseTo(5);
  });

  it('loadDelta = 0 → pas d\'effet load_transfer', () => {
    const effects = computeEffectsFromBlocks([mkRenfBlock({ loadDelta: '0' })], [SS_BASE]);
    expect(effects.filter(e => e.action === 'load_transfer')).toHaveLength(0);
  });

  it('loadDelta négatif → load_transfer avec delta négatif', () => {
    const effects = computeEffectsFromBlocks([mkRenfBlock({ loadDelta: '-3' })], [SS_BASE]);
    const lt = effects.filter(e => e.action === 'load_transfer');
    expect(lt).toHaveLength(1);
    expect(lt[0].loadDelta).toBeCloseTo(-3);
  });
});

// ── création ───────────────────────────────────────────────────────────────────

describe('création de sous-station', () => {
  const mkCreation = (overrides = {}) => ({
    blockType: 'création',
    name: 'SS Test',
    code: 'TEST',
    commune: 'Liège',
    voltageUpstream: '63kV',
    tfos: [{ id: 'T1', power: 40, role: 'normal' }],
    coeffN: '0.90', coeffN1: '1.00',
    baseLoadInitial: '5',
    organicGrowthRate: '2.0',
    loadDelta: '',
    ...overrides,
  });

  it('crée un effet create_ss', () => {
    const effects = computeEffectsFromBlocks([mkCreation()], []);
    expect(effects).toHaveLength(1);
    expect(effects[0].action).toBe('create_ss');
  });

  it('newSS a les bons champs', () => {
    const effects = computeEffectsFromBlocks([mkCreation()], []);
    const { newSS } = effects[0];
    expect(newSS.name).toBe('SS Test');
    expect(newSS.voltageUpstream).toBe('63kV');
    expect(newSS.voltageLevel).toBe('63kV/10 kV');
    expect(newSS.baseLoadInitial).toBeCloseTo(5);
    expect(newSS.organicGrowthRate).toBeCloseTo(0.02);
  });

  it('ssId de l\'effet correspond à newSS.id', () => {
    const effects = computeEffectsFromBlocks([mkCreation()], []);
    expect(effects[0].ssId).toBe(effects[0].newSS.id);
  });

  it('_newSsId respecté si fourni', () => {
    const effects = computeEffectsFromBlocks([mkCreation({ _newSsId: 'ss-fixed-id' })], []);
    expect(effects[0].newSS.id).toBe('ss-fixed-id');
  });

  it('load_transfer ajouté si loadDelta non nul', () => {
    const effects = computeEffectsFromBlocks([mkCreation({ loadDelta: '8' })], []);
    expect(effects).toHaveLength(2);
    expect(effects[1].action).toBe('load_transfer');
    expect(effects[1].loadDelta).toBeCloseTo(8);
  });

  it('tfo sans puissance ignoré', () => {
    const effects = computeEffectsFromBlocks(
      [mkCreation({ tfos: [{ id: 'T1', power: 0, role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }] })],
      []
    );
    expect(effects[0].newSS.transformerConfig.transformers).toHaveLength(1);
    expect(effects[0].newSS.transformerConfig.transformers[0].id).toBe('T2');
  });
});

// ── suppression / decommission ─────────────────────────────────────────────────

describe('suppression de sous-station', () => {
  const mkSuppression = (overrides = {}) => ({
    blockType: 'suppression',
    ssId: 'ss-1',
    loadDelta: '',
    ...overrides,
  });

  it('produit un effet decommission', () => {
    const effects = computeEffectsFromBlocks([mkSuppression()], []);
    const decom = effects.filter(e => e.action === 'decommission');
    expect(decom).toHaveLength(1);
    expect(decom[0].ssId).toBe('ss-1');
  });

  it('load_transfer avant decommission si loadDelta non nul', () => {
    const effects = computeEffectsFromBlocks([mkSuppression({ loadDelta: '-10' })], []);
    expect(effects).toHaveLength(2);
    expect(effects[0].action).toBe('load_transfer');
    expect(effects[0].loadDelta).toBeCloseTo(-10);
    expect(effects[1].action).toBe('decommission');
  });
});

// ── robustesse ─────────────────────────────────────────────────────────────────

describe('robustesse et cas limites', () => {
  it('liste vide → []', () => {
    expect(computeEffectsFromBlocks([], [])).toHaveLength(0);
  });

  it('blockType inconnu → aucun effet (pas d\'exception)', () => {
    expect(() => computeEffectsFromBlocks([{ blockType: 'inconnu', ssId: 'ss-1' }], [])).not.toThrow();
    expect(computeEffectsFromBlocks([{ blockType: 'inconnu', ssId: 'ss-1' }], [])).toHaveLength(0);
  });

  it('bloc sans ssId → pas d\'exception', () => {
    expect(() => computeEffectsFromBlocks([{ blockType: 'suppression', loadDelta: '' }], [])).not.toThrow();
  });

  it('tfos avec puissance string → parsé correctement', () => {
    const block = mkRenfBlock({
      tfos: [
        { id: 'T1', power: '63', role: 'normal' },
        { id: 'T2', power: '40', role: 'normal' },
      ],
    });
    const effects = computeEffectsFromBlocks([block], [SS_BASE]);
    // T1 power changed from 40 to 63
    expect(effects[0].tfoChanges.modify[0].power).toBe(63);
  });

  it('tfos avec power NaN → tfo ignoré (filtré)', () => {
    const creation = {
      blockType: 'création', name: 'SS X', code: 'X', commune: '', voltageUpstream: '36kV',
      tfos: [{ id: 'T1', power: 'abc', role: 'normal' }],
      coeffN: '0.90', coeffN1: '1.00', baseLoadInitial: '0', organicGrowthRate: '2', loadDelta: '',
    };
    expect(() => computeEffectsFromBlocks([creation], [])).not.toThrow();
    const effects = computeEffectsFromBlocks([creation], []);
    // tfo with power=NaN filtered → 0 transformers but effect still created
    expect(effects[0].newSS.transformerConfig.transformers).toHaveLength(0);
  });

  it('plusieurs blocs → effets cumulés', () => {
    const remp = mkRenfBlock({ tfos: [{ id: 'T1', power: 63, role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }] });
    const lt   = mkRenfBlock({ ssId: 'ss-1', loadDelta: '5' });
    const effects = computeEffectsFromBlocks([remp, lt], [SS_BASE]);
    expect(effects.filter(e => e.action === 'modify_tfo')).toHaveLength(1);
    expect(effects.filter(e => e.action === 'load_transfer')).toHaveLength(1);
  });
});
