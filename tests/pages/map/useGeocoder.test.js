import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress } from '../../../src/ui/pages/map/useGeocoder.js';

describe('geocodeAddress', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renvoie lat/lng/source au format attendu pour une adresse trouvée', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '50.6320', lon: '5.5797' }],
    });
    const result = await geocodeAddress({
      street: 'Place Saint-Lambert', number: '1', postalCode: '4000', city: 'Liège',
    });
    expect(result).toEqual({ lat: 50.6320, lng: 5.5797, source: 'geocoded' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const url = globalThis.fetch.mock.calls[0][0];
    expect(url).toContain('countrycodes=be');
    expect(url).toContain('format=json');
    expect(url).toContain('Belgique');
  });

  it('utilise freeform si les champs structurés sont absents', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '50.5', lon: '5.5' }],
    });
    await geocodeAddress({ freeform: 'Boulevard de la Sauvenière 1' });
    const url = globalThis.fetch.mock.calls[0][0];
    expect(decodeURIComponent(url)).toContain('Boulevard de la Sauvenière 1');
  });

  it('lève une erreur explicite si l\'adresse est vide', async () => {
    await expect(geocodeAddress({})).rejects.toThrow('Adresse vide');
  });

  it('lève une erreur si Nominatim renvoie 0 résultat', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    await expect(geocodeAddress({ city: 'NowhereTown' })).rejects.toThrow('Adresse introuvable');
  });

  it('lève une erreur si Nominatim renvoie un statut non-OK', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(geocodeAddress({ city: 'Liège' })).rejects.toThrow('Nominatim indisponible');
  });
});
