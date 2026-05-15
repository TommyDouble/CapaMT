import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../../src/constants/index.js';
import {
  buildCSV,
  clearState,
  escapeCSVValue,
  hydrateInitialAppState,
  importJSONFile,
  loadState,
  saveState,
} from '../../src/services/storage.js';
import { canonicalSubstation } from '../helpers/canonicalFixtures.js';

describe('storage v12', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sauvegarde et recharge le format courant', () => {
    const sub = canonicalSubstation();

    const result = saveState([sub], [], [{ id: 'log-1' }]);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const state = loadState();

    expect(result).toEqual({ ok: true });
    expect(raw.version).toBe(12);
    expect(state.substations[0].directionalModel).toBeTruthy();
    expect(state.activityLog).toHaveLength(1);
  });

  it('signale explicitement un quota navigateur dépassé', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const result = saveState([canonicalSubstation()], [], []);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('quota');
  });

  it('signale une erreur de sauvegarde inconnue sans lancer d’exception', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const result = saveState([canonicalSubstation()], [], []);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unknown');
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
        (message) => {
          expect(message).toContain('pré-v12');
          resolve();
        },
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

  it('échappe les cellules CSV avec séparateurs, guillemets et retours ligne', () => {
    expect(escapeCSVValue('Poste; "Nord"\nLiège')).toBe('"Poste; ""Nord""\nLiège"');
  });

  it('neutralise les formules Excel dans les champs texte utilisateur exportés', () => {
    const sub = canonicalSubstation({
      name: '=SUM(1,2)',
      code: '+PT-001',
      commune: '@Liege',
    });

    const row = buildCSV([sub], []).split('\n')[1];

    expect(row.startsWith("'=SUM(1,2);'+PT-001;'@Liege;")).toBe(true);
  });
});
