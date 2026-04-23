/**
 * tests/services/storage.test.js
 * v6 : tests de persistance sans scenario.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { hydrateInitialAppState, saveState, loadState } from '../../src/services/storage.js';
import { STORAGE_KEY } from '../../src/constants/index.js';
import { INITIAL_SUBSTATIONS, INITIAL_NETWORK_PROJECTS } from '../../src/data/initial.js';

beforeEach(() => { localStorage.clear(); });

function writeStorage(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const MIN_SS = {
  id: 'test-ss', baseLoad2025: 20, organicGrowthRate: 0.02, plannableCapacity: 40,
  chargeHistory: [], foisonnement: {}, connectionRequests: [], investments: [],
  transformerConfig: {
    transformers: [{ id: 'T1', power: 40, role: 'normal' }],
    coeffN: 0.90, coeffN1: 1.00, mtBackup: { enabled: false, capacity: 0 },
    reverseCapacityRatio: 1.0,
  },
  directionalModel: {
    referenceYear: 2025,
    withdrawalView: { maxHistoricLoadBT:13, maxHistoricLoadMT:7, minHistoricInjectionBT:0, minHistoricInjectionMT:0, growthLoadMaxBT:0.02, growthLoadMaxMT:0.02, growthMinInjectionBT:0, growthMinInjectionMT:0 },
    injectionView: { maxHistoricInjectionBT:0, maxHistoricInjectionMT:0, minHistoricLoadBT:0, minHistoricLoadMT:0, growthMaxInjectionBT:0, growthMaxInjectionMT:0, growthMinLoadBT:0, growthMinLoadMT:0 },
  },
};

describe('hydrateInitialAppState — sans session', () => {
  it('retourne les données initiales par défaut', () => {
    const state = hydrateInitialAppState();
    expect(state.substations).toBe(INITIAL_SUBSTATIONS);
    expect(state.networkProjects).toBe(INITIAL_NETWORK_PROJECTS);
    expect(state.activityLog).toEqual([]);
    expect(state.savedAt).toBeNull();
  });

  it('hasSession = false sans localStorage', () =>
    expect(hydrateInitialAppState().hasSession).toBe(false));

  it('pas de propriété scenario (modèle directionnel)', () => {
    const state = hydrateInitialAppState();
    expect(state).not.toHaveProperty('scenario');
  });
});

describe('hydrateInitialAppState — avec session valide v6', () => {
  it('retourne les données persistées', () => {
    writeStorage({ version: 6, savedAt: '2025-06-01T10:00:00.000Z',
      substations: [MIN_SS], networkProjects: [], activityLog: [{ id: 'log-1' }] });
    const state = hydrateInitialAppState();
    expect(state.substations[0].id).toBe('test-ss');
    expect(state.activityLog).toHaveLength(1);
    expect(state.hasSession).toBe(true);
  });

  it('savedAt est transmis', () => {
    writeStorage({ version: 6, savedAt: '2025-06-01T10:00:00.000Z',
      substations: [], networkProjects: [], activityLog: [] });
    const state = hydrateInitialAppState();
    expect(state.savedAt).toBe('2025-06-01T10:00:00.000Z');
  });
});

describe('loadState', () => {
  it('localStorage vide → null', () =>
    expect(loadState()).toBeNull());

  it('version v6 valide → données', () => {
    writeStorage({ version: 6, savedAt: '2025-01-01T00:00:00.000Z',
      substations: [MIN_SS], networkProjects: [], activityLog: [] });
    const d = loadState();
    expect(d).not.toBeNull();
    expect(d.substations[0].id).toBe('test-ss');
  });

  it('version v5 (old key) → migration automatique', () => {
    localStorage.setItem('resa_planif_v5', JSON.stringify({
      version: 5, savedAt: '2025-01-01T00:00:00.000Z', scenario: 'central',
      substations: [{ id: 'legacy', baseLoad2025: 15, organicGrowthRate: 0.02,
        plannableCapacity: 25, chargeHistory: [], foisonnement: {}, connectionRequests: [], investments: [],
        transformerConfig: { transformers: [], coeffN: 0.9, coeffN1: 1.0, mtBackup: { enabled: false, capacity: 0 } } }],
      networkProjects: [], activityLog: [],
    }));
    const d = loadState();
    expect(d).not.toBeNull();
    expect(d.substations[0].directionalModel).toBeTruthy();
    expect(d.substations[0]._directionalMigrated).toBe(true);
    // Old key should be removed
    expect(localStorage.getItem('resa_planif_v5')).toBeNull();
  });

  it('normalise les connectionRequests', () => {
    writeStorage({ version: 6, savedAt: '2025-01-01T00:00:00.000Z',
      substations: [{ ...MIN_SS, connectionRequests: [
        { id: 'r1', status: 'Raccordé', yearSouhaitee: 2026, type: 'industriel', raccordementDate: null,
          client: { prelevFerme: 5, prelevFlexible: 0, injFerme: 0, injFlexible: 0 }, grd: null }
      ]}], networkProjects: [], activityLog: [] });
    const d = loadState();
    expect(d.substations[0].connectionRequests[0].status).toBe('raccordée');
  });
});

describe('saveState / loadState round-trip', () => {
  it('sauvegarde et relit les données', () => {
    saveState([MIN_SS], [{ id: 'p1', name: 'Test', type: 'renforcement', year: 2028, status: 'planifié', effects: [] }], []);
    const d = loadState();
    expect(d.substations[0].id).toBe('test-ss');
    expect(d.networkProjects[0].id).toBe('p1');
    expect(d.activityLog).toHaveLength(0);
  });

  it('directionalModel est persisté et relu', () => {
    saveState([MIN_SS], [], []);
    const d = loadState();
    expect(d.substations[0].directionalModel).toBeTruthy();
    expect(d.substations[0].directionalModel.withdrawalView.maxHistoricLoadBT).toBeCloseTo(13);
  });
});
