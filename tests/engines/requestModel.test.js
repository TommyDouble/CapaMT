import { describe, expect, it } from 'vitest';
import { getCustomer, getOffer, getRequestedLoad, normalizeRequest } from '../../src/engines/requestModel.js';
import { canonicalRequest } from '../helpers/canonicalFixtures.js';

describe('requestModel canonique', () => {
  it('normalise une demande autour de customer, assessment et offer', () => {
    const req = normalizeRequest(canonicalRequest({ name: 'Client Canon', load: 7 }), 'ss-test');

    expect(getCustomer(req).client.name).toBe('Client Canon');
    expect(getRequestedLoad(req)).toBe(7);
    expect(req.assessment).toBeTruthy();
    expect(getOffer(req).status).toBe('not_applicable');
  });

  it('conserve seulement les données applicatives attendues', () => {
    const req = normalizeRequest({ ...canonicalRequest(), extraScratch: true }, 'ss-test');

    expect(req.extraScratch).toBeUndefined();
    expect(req.customer.targetSubstationId).toBe('ss-test');
  });
});
