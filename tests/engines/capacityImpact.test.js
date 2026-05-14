import { describe, expect, it } from 'vitest';
import { computeCapacityImpact } from '../../src/engines/capacityImpact.js';
import { normalizeRequest } from '../../src/engines/requestModel.js';
import { canonicalRequest, connectedRequest, studiedRequest } from '../helpers/canonicalFixtures.js';

describe('capacity impact canonique', () => {
  it('compte une demande client prête comme réservation de file', () => {
    const impact = computeCapacityImpact(canonicalRequest({ load: 4, injection: 2 }));

    expect(impact.status).toBe('QUEUE_RESERVED');
    expect(impact.reservedLoadPermanent).toBe(4);
    expect(impact.reservedInjectionPermanent).toBe(2);
  });

  it('compte la réponse technique finale tant que le dossier reste actif', () => {
    const impact = computeCapacityImpact(studiedRequest({ load: 6, loadStatus: 'LIMIT', loadPermanent: 3, loadFlexible: 3 }));

    expect(impact.status).toBe('STUDY_RESERVED');
    expect(impact.reservedLoadPermanent).toBe(3);
    expect(impact.reservedLoadFlexible).toBe(3);
  });

  it('maintient un dossier raccordé dans la durée par défaut', () => {
    const req = connectedRequest({ offerDates: { connectedAt: '2026-01-01' }, load: 5 });
    const impact = computeCapacityImpact(req, new Date('2026-06-30T00:00:00Z'));

    expect(impact.status).toBe('CONNECTED_RESERVED');
    expect(impact.retentionMonths).toBe(6);
    expect(impact.retentionUntil).toBe('2026-07-01');
    expect(impact.reservedLoadPermanent).toBe(5);
  });

  it('libère un dossier raccordé après la période de maintien', () => {
    const req = connectedRequest({ offerDates: { connectedAt: '2026-01-01' }, load: 5 });
    const impact = computeCapacityImpact(req, new Date('2026-08-02T00:00:00Z'));

    expect(impact.status).toBe('CONNECTED_RELEASED');
    expect(impact.reservedLoadPermanent).toBe(0);
    expect(impact.connectedReleaseMode).toBe('automatic');
  });

  it('libère manuellement un dossier raccordé avant échéance', () => {
    const req = connectedRequest({
      offerDates: { connectedAt: '2026-01-01', connectedReleasedAt: '2026-03-01' },
      connectedReleaseComment: 'Pointe historique mise à jour',
      load: 5,
    });
    const impact = computeCapacityImpact(req, new Date('2026-03-02T00:00:00Z'));

    expect(impact.status).toBe('CONNECTED_RELEASED');
    expect(impact.source).toBe('CONNECTED_MANUAL_RELEASE');
    expect(impact.connectedReleasedAt).toBe('2026-03-01');
    expect(impact.connectedReleaseMode).toBe('manual');
    expect(impact.reservedLoadPermanent).toBe(0);
  });

  it('réactive le maintien si la libération manuelle est retirée', () => {
    const req = connectedRequest({
      offerDates: { connectedAt: '2026-01-01' },
      load: 5,
    });

    expect(computeCapacityImpact(req, new Date('2026-03-02T00:00:00Z')).status).toBe('CONNECTED_RESERVED');
  });

  it('respecte une durée personnalisée par dossier', () => {
    const req = connectedRequest({
      offerDates: { connectedAt: '2026-01-01' },
      connectedRetentionMonths: 12,
      load: 5,
    });

    expect(computeCapacityImpact(req, new Date('2026-08-02T00:00:00Z')).status).toBe('CONNECTED_RESERVED');
  });

  it('initialise la durée à six mois au passage raccordé', () => {
    const req = normalizeRequest({
      ...studiedRequest({ offerStatus: 'offer_connected', offerDates: { connectedAt: '2026-04-01' } }),
      offer: {
        status: 'offer_connected',
        connectedAt: '2026-04-01',
      },
    }, 'ss-test');

    expect(req.offer.connectedRetentionMonths).toBe(6);
  });
});
