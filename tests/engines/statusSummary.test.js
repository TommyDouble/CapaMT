import { describe, expect, it } from 'vitest';
import { buildQueuePhaseSummary, buildRequestStatusSummary } from '../../src/engines/statusSummary.js';
import { canonicalRequest, connectedRequest, studiedRequest } from '../helpers/canonicalFixtures.js';

describe('résumé de statut canonique', () => {
  it('qualifie une demande prête comme déposée', () => {
    const summary = buildRequestStatusSummary(canonicalRequest());

    expect(summary.phaseKey).toBe('deposee');
    expect(summary.capacityImpact).toBe('QUEUE_RESERVED');
  });

  it('qualifie une étude limitée comme conditionnelle', () => {
    const summary = buildRequestStatusSummary(studiedRequest({ loadStatus: 'LIMIT', loadPermanent: 3, loadFlexible: 2 }));

    expect(summary.phaseKey).toBe('conditionnelle');
    expect(summary.capacityImpact).toBe('STUDY_RESERVED');
  });

  it('qualifie un raccordé maintenu puis libéré', () => {
    const kept = buildRequestStatusSummary(connectedRequest({ offerDates: { connectedAt: '2026-04-01' } }));
    const ended = buildRequestStatusSummary(connectedRequest({
      offerDates: { connectedAt: '2025-01-01' },
      connectedRetentionMonths: 1,
    }));

    expect(kept.phaseKey).toBe('raccordee');
    expect(ended.phaseKey).toBe('liberee');
  });

  it('agrège les phases de plusieurs demandes', () => {
    const summary = buildQueuePhaseSummary([
      canonicalRequest({ id: 'a' }),
      studiedRequest({ id: 'b' }),
    ]);

    expect(summary.total).toBe(2);
    expect(summary.byPhase.deposee).toBe(1);
    expect(summary.byPhase.acceptable).toBe(1);
  });
});
