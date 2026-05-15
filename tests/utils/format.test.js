import { afterEach, describe, expect, it, vi } from 'vitest';
import { uid } from '../../src/utils/format.js';

describe('uid', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('utilise crypto.randomUUID quand disponible', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(uid()).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('conserve un fallback si crypto.randomUUID est indisponible', () => {
    vi.stubGlobal('crypto', {});
    vi.spyOn(Date, 'now').mockReturnValue(1234567890);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(uid()).toBe('id-1234567890-i');
  });
});
