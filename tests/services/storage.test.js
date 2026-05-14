import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../../src/constants/index.js';
import { clearState, hydrateInitialAppState, importJSONFile, loadState, saveState } from '../../src/services/storage.js';
import { canonicalSubstation } from '../helpers/canonicalFixtures.js';

describe('storage v12', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sauvegarde et recharge le format courant', () => {
    const sub = canonicalSubstation();

    saveState([sub], [], [{ id: 'log-1' }]);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const state = loadState();

    expect(raw.version).toBe(12);
    expect(state.substations[0].directionalModel).toBeTruthy();
    expect(state.activityLog).toHaveLength(1);
  });

  it('ignore une session de version antérieure', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 11, substations: [] }));

    expect(loadState()).toBeNull();
  });

  it('refuse un import pré-v12', async () => {
    const file = new File([JSON.stringify({ version: 11, substations: [] })], 'old.json', {
      type: 'application/json',
    });

    await new Promise((resolve, reject) => {
      importJSONFile(
        file,
        () => reject(new Error('import pré-v12 accepté')),
        message => {
          expect(message).toContain('pré-v12');
          resolve();
        }
      );
    });
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
