/**
 * tests/smoke/assembly.test.js
 * v6 : détecte les erreurs grossières d'assemblage.
 * Vérifie que tous les modules s'importent et que les fonctions clés
 * s'exécutent sans exception avec le modèle directionnel.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ── Engines ───────────────────────────────────────────────────────────────────
import { calcCapacityN1, getCapacityAtYear, getEffectiveSubstations } from '../../src/engines/capacity.js';
import { getOrganicLoad, getNetRigidLoad, getFullAlertState } from '../../src/engines/load.js';
import { getQueueAnalysis, getGlobalQueueStats } from '../../src/engines/queue.js';
import { computeRecommendation } from '../../src/engines/recommendation.js';
import { computeEffectsFromBlocks } from '../../src/engines/projectEffects.js';
import {
  getWithdrawalBaseNet, getWithdrawalRigid,
  getInjectionBaseNet, getInjectionRigid,
  getDirectCapacityN1AtYear, getReverseCapacityN1AtYear,
  getDirectionalAlertState, getWorstDirectionalAlertOverHorizon,
  getFirstWithdrawalSaturationYear, getFirstInjectionSaturationYear,
  projectDirectionalComponent,
} from '../../src/engines/directionalSubstation.js';

// ── Services ──────────────────────────────────────────────────────────────────
import { hydrateInitialAppState, saveState, loadState } from '../../src/services/storage.js';

// ── Constants & Data ─────────────────────────────────────────────────────────
import { YEARS, ALERT_CONFIG, ALERT_ORDER } from '../../src/constants/index.js';
import { INITIAL_SUBSTATIONS, INITIAL_NETWORK_PROJECTS } from '../../src/data/initial.js';

// ── Utils ─────────────────────────────────────────────────────────────────────
import { safeNum, safeDiv } from '../../src/utils/numbers.js';
import { normalizeSubstations, normalizeProjects } from '../../src/utils/normalize.js';
import { f1, uid, statusLabel } from '../../src/utils/format.js';

beforeEach(() => { localStorage.clear(); });

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

const MIN_SS = {
  id: 'ss-smoke', baseLoad2025: 20, organicGrowthRate: 0.02, plannableCapacity: 40,
  chargeHistory: [], foisonnement: {}, connectionRequests: [],
  transformerConfig: {
    transformers: [{ id: 'T1', power: 40, role: 'normal' }, { id: 'T2', power: 40, role: 'normal' }],
    coeffN: 0.90, coeffN1: 1.00, mtBackup: { enabled: false, capacity: 0 },
    reverseCapacityRatio: 1.0,
  },
  directionalModel: DM,
};

// ── Module imports ────────────────────────────────────────────────────────────
describe('smoke — tous les modules s\'importent', () => {
  it('engines: fonctions exportées non undefined', () => {
    expect(calcCapacityN1).toBeTypeOf('function');
    expect(getOrganicLoad).toBeTypeOf('function');
    expect(getQueueAnalysis).toBeTypeOf('function');
    expect(computeRecommendation).toBeTypeOf('function');
    expect(computeEffectsFromBlocks).toBeTypeOf('function');
    expect(getWithdrawalBaseNet).toBeTypeOf('function');
    expect(getDirectionalAlertState).toBeTypeOf('function');
    expect(projectDirectionalComponent).toBeTypeOf('function');
  });

  it('services: fonctions exportées non undefined', () => {
    expect(hydrateInitialAppState).toBeTypeOf('function');
    expect(saveState).toBeTypeOf('function');
    expect(loadState).toBeTypeOf('function');
  });

  it('constants: YEARS, ALERT_CONFIG, ALERT_ORDER non vides', () => {
    expect(YEARS.length).toBeGreaterThan(0);
    expect(Object.keys(ALERT_CONFIG).length).toBeGreaterThan(0);
    expect(ALERT_ORDER.length).toBeGreaterThan(0);
  });

  it('SCENARIO_CONFIG n\'est plus exporté (modèle directionnel)', async () => {
    const mod = await import('../../src/constants/index.js');
    expect(mod.SCENARIO_CONFIG).toBeUndefined();
  });

  it('data: INITIAL_SUBSTATIONS et INITIAL_NETWORK_PROJECTS définis', () => {
    expect(Array.isArray(INITIAL_SUBSTATIONS)).toBe(true);
    expect(INITIAL_SUBSTATIONS.length).toBeGreaterThan(0);
    expect(Array.isArray(INITIAL_NETWORK_PROJECTS)).toBe(true);
  });

  it('utils: safeNum, uid, f1, statusLabel fonctionnent', () => {
    expect(safeNum('abc', 42)).toBe(42);
    expect(f1(3.141)).toBe('3.1');
    expect(uid()).toBeTruthy();
    expect(statusLabel('étudiée')).toBeTruthy();
  });
});

// ── Données initiales — directionalModel ─────────────────────────────────────
describe('smoke — données initiales v6', () => {
  it('chaque SS initiale a un directionalModel', () => {
    INITIAL_SUBSTATIONS.forEach(ss => {
      expect(ss.directionalModel).toBeTruthy();
      expect(ss.directionalModel.withdrawalView).toBeTruthy();
      expect(ss.directionalModel.injectionView).toBeTruthy();
    });
  });

  it('chaque SS initiale a reverseCapacityRatio dans transformerConfig', () => {
    INITIAL_SUBSTATIONS.forEach(ss => {
      expect(typeof ss.transformerConfig.reverseCapacityRatio).toBe('number');
    });
  });

  it('base nette prélèvement ≈ baseLoad2025 pour chaque SS', () => {
    INITIAL_SUBSTATIONS.forEach(ss => {
      const base = getWithdrawalBaseNet(ss, 2025, []);
      const diff = Math.abs(base - ss.baseLoad2025);
      expect(diff).toBeLessThan(1.0); // tolérance 1 MVA
    });
  });
});

// ── Directional engine smoke ──────────────────────────────────────────────────
describe('smoke — moteur directionnel', () => {
  it('projectDirectionalComponent ne plante pas', () =>
    expect(() => projectDirectionalComponent(20, 0.02, 2025, 2030)).not.toThrow());

  it('getWithdrawalBaseNet ne plante pas', () =>
    expect(() => getWithdrawalBaseNet(MIN_SS, 2030, [])).not.toThrow());

  it('getInjectionBaseNet ne plante pas', () =>
    expect(() => getInjectionBaseNet(MIN_SS, 2030, [])).not.toThrow());

  it('getDirectionalAlertState retourne un objet complet', () => {
    const state = getDirectionalAlertState(MIN_SS, 2028, false, []);
    expect(state).toHaveProperty('worstLevel');
    expect(state).toHaveProperty('worstWithdrawal');
    expect(state).toHaveProperty('worstInjection');
    expect(state).toHaveProperty('uWRvsN1');
    expect(state).toHaveProperty('uIRvsN1');
  });

  it('getWorstDirectionalAlertOverHorizon ne plante pas', () =>
    expect(() => getWorstDirectionalAlertOverHorizon(MIN_SS, [])).not.toThrow());

  it('getQueueAnalysis avec SS minimale', () => {
    const { queue } = getQueueAnalysis(MIN_SS, []);
    expect(Array.isArray(queue)).toBe(true);
  });
});

// ── Storage v6 ────────────────────────────────────────────────────────────────
describe('smoke — storage v6', () => {
  it('hydrateInitialAppState retourne substations sans session', () => {
    const s = hydrateInitialAppState();
    expect(s.substations).toBeTruthy();
    expect(s.hasSession).toBe(false);
    expect(s).not.toHaveProperty('scenario'); // scenario supprimé
  });

  it('saveState / loadState round-trip', () => {
    saveState([MIN_SS], [], []);
    const loaded = loadState();
    expect(loaded).not.toBeNull();
    expect(loaded.substations[0].id).toBe('ss-smoke');
    expect(loaded).not.toHaveProperty('scenario');
  });

  it('migration v5 → v6 : accepte l\'ancienne clé avec scenario', () => {
    // Simule une session v5
    localStorage.setItem('resa_planif_v5', JSON.stringify({
      version: 5,
      savedAt: '2025-01-01T00:00:00.000Z',
      scenario: 'haut',
      substations: [{ ...MIN_SS, directionalModel: undefined }],
      networkProjects: [],
      activityLog: [],
    }));
    const loaded = loadState();
    expect(loaded).not.toBeNull();
    // directionalModel doit avoir été créé par normalizeSubstations
    expect(loaded.substations[0].directionalModel).toBeTruthy();
    expect(loaded.substations[0]._directionalMigrated).toBe(true);
  });
});

// ── normalizeSubstations ──────────────────────────────────────────────────────
describe('smoke — normalisation', () => {
  it('SS sans directionalModel → migration automatique', () => {
    const legacy = [{ id: 'x', baseLoad2025: 25, organicGrowthRate: 0.02, plannableCapacity: 30, chargeHistory: [], connectionRequests: [], investments: [], foisonnement: {}, transformerConfig: { transformers: [], coeffN: 0.9, coeffN1: 1.0, mtBackup: { enabled: false, capacity: 0 } } }];
    const normalized = normalizeSubstations(legacy);
    expect(normalized[0].directionalModel).toBeTruthy();
    expect(normalized[0]._directionalMigrated).toBe(true);
    expect(normalized[0].directionalModel.withdrawalView.maxHistoricLoadBT).toBe(25);
  });

  it('SS avec directionalModel → normalisée sans flag migration', () => {
    const withDM = [{ ...MIN_SS }];
    const normalized = normalizeSubstations(withDM);
    expect(normalized[0]._directionalMigrated).toBeUndefined();
    expect(normalized[0].directionalModel).toBeTruthy();
  });
});
