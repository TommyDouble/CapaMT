import { describe, expect, it } from 'vitest';
import { computeEffectsFromBlocks } from '../../src/engines/projectEffects.js';
import { canonicalSubstation } from '../helpers/canonicalFixtures.js';

describe('effets projet réseau canoniques', () => {
  it('crée une sous-station avec transformerConfig et directionalModel', () => {
    const [effect] = computeEffectsFromBlocks(
      [
        {
          blockType: 'création',
          _newSsId: 'ss-new-test',
          name: 'Nouveau Poste',
          code: 'NP-001',
          commune: 'Liege',
          voltageUpstream: '36kV',
          tfos: [
            { id: 't1', power: '25', role: 'normal' },
            { id: 't2', power: '25', role: 'normal' },
          ],
          coeffN: '0.90',
          coeffN1: '1.00',
          reverseCapacityRatio: '0.75',
          coordinates: { lat: '50.61', lng: '5.56' },
          initialLoadMva: '12',
          growthRatePct: '2',
        },
      ],
      [],
    );

    expect(effect.action).toBe('create_ss');
    expect(effect.newSS.transformerConfig.reverseCapacityRatio).toBe(0.75);
    expect(effect.newSS.coordinates).toEqual({ lat: 50.61, lng: 5.56, source: 'project' });
    expect(effect.newSS.directionalModel.withdrawalView.maxHistoricLoadBT).toBe(12);
    expect(effect.newSS.directionalModel.withdrawalView.growthLoadMaxBT).toBe(0.02);
  });

  it('calcule une modification transformateur sans champ hors modèle', () => {
    const sub = canonicalSubstation();
    const [effect] = computeEffectsFromBlocks(
      [
        {
          blockType: 'renforcement',
          ssId: sub.id,
          tfos: [...sub.transformerConfig.transformers, { id: 't3', power: '25', role: 'normal' }],
          coeffN: '0.90',
          coeffN1: '1.00',
          mtBackupEnabled: false,
          mtBackupCapacity: '0',
        },
      ],
      [sub],
    );

    expect(effect.action).toBe('modify_tfo');
    expect(effect.tfoChanges.add).toHaveLength(1);
  });
});
