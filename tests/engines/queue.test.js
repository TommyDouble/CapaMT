import { describe, expect, it } from 'vitest';
import { getGlobalQueueStats, getQueueAnalysis } from '../../src/engines/queue.js';
import { canonicalRequest, canonicalSubstation, studiedRequest } from '../helpers/canonicalFixtures.js';

describe('queue canonique par sous-station', () => {
  it('classe les demandes prêtes selon la date client', () => {
    const first = canonicalRequest({ id: 'first', requestDate: '2026-01-01', name: 'Premier' });
    const second = canonicalRequest({ id: 'second', requestDate: '2026-03-01', name: 'Second' });
    const sub = canonicalSubstation({ connectionRequests: [second, first] });

    const { queue } = getQueueAnalysis(sub);

    expect(queue.map(item => item.req.id)).toEqual(['first', 'second']);
    expect(queue[0].position).toBe(1);
    expect(queue[1].withdrawalResidualBefore).toBeLessThan(queue[0].withdrawalResidualBefore);
  });

  it('déduit les engagements acquis avant de calculer la marge de file', () => {
    const acquired = studiedRequest({
      id: 'acquired',
      offerStatus: 'offer_accepted',
      offerDates: { formulatedAt: '2026-02-01', acceptedAt: '2026-02-10' },
      load: 4,
    });
    const queued = canonicalRequest({ id: 'queued', requestDate: '2026-03-01', load: 5 });
    const sub = canonicalSubstation({ connectionRequests: [queued, acquired] });

    const { queue } = getQueueAnalysis(sub);

    expect(queue).toHaveLength(1);
    expect(queue[0].withdrawalResidualBefore).toBe(8);
    expect(queue[0].recommendedFerme).toBe(5);
  });

  it('intègre les réservations actives dans les stats globales', () => {
    const sub = canonicalSubstation({
      connectionRequests: [
        canonicalRequest({ id: 'queue-a', load: 5 }),
        studiedRequest({ id: 'study-a', load: 3 }),
      ],
    });

    const stats = getGlobalQueueStats([sub]);

    expect(stats.total).toBe(2);
    expect(stats.totalMWReserved).toBe(8);
  });
});
