import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../../src/constants/index.js';
import { clearState, hydrateInitialAppState, loadState, saveState } from '../../src/services/storage.js';
import { canonicalSubstation } from '../helpers/canonicalFixtures.js';

describe('storage v11', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sauvegarde et recharge le format courant', () => {
    const sub = canonicalSubstation();

    saveState([sub], [], [{ id: 'log-1' }]);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const state = loadState();

    expect(raw.version).toBe(11);
    expect(state.substations[0].directionalModel).toBeTruthy();
    expect(state.activityLog).toHaveLength(1);
  });

  it('ignore une session de version antérieure', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 10, substations: [] }));

    expect(loadState()).toBeNull();
  });

  it('hydrate les données initiales quand aucune session courante n’existe', () => {
    const state = hydrateInitialAppState();

    expect(state.hasSession).toBe(false);
    expect(state.substations.length).toBeGreaterThan(0);
    expect(state.networkProjects.length).toBeGreaterThan(0);
  });

  it('efface uniquement la clé active de persistance', () => {
    saveState([canonicalSubstation()], [], []);

    clearState();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
