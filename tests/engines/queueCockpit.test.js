import { describe, expect, it } from 'vitest';
import {
  buildQueueCockpitRows,
  buildQueueCockpitStats,
  filterQueueCockpitRows,
  sortQueueCockpitRows,
} from '../../src/engines/queueCockpit.js';
import { canonicalRequest, canonicalSubstation, studiedRequest } from '../helpers/canonicalFixtures.js';

describe('cockpit global canonique', () => {
  it('produit des lignes actionnables depuis customer, assessment et offer', () => {
    const sub = canonicalSubstation({
      connectionRequests: [
        canonicalRequest({ id: 'ready', name: 'Client A', requestDate: '2026-01-01' }),
        studiedRequest({ id: 'done', name: 'Client B', load: 3 }),
      ],
    });

    const rows = buildQueueCockpitRows([sub]);

    expect(rows).toHaveLength(2);
    expect(rows[0].customerName).toBe('Client A');
    expect(rows.map(row => row.impactStatus)).toEqual(['QUEUE_RESERVED', 'STUDY_RESERVED']);
  });

  it('filtre et trie les lignes sans adapter de données', () => {
    const sub = canonicalSubstation({
      connectionRequests: [
        canonicalRequest({ id: 'b', name: 'Beta', requestDate: '2026-02-01' }),
        canonicalRequest({ id: 'a', name: 'Alpha', requestDate: '2026-01-01' }),
      ],
    });
    const rows = buildQueueCockpitRows([sub]);

    expect(filterQueueCockpitRows(rows, 'ready_study')).toHaveLength(2);
    expect(sortQueueCockpitRows(rows, { field: 'customer', direction: 'asc' })[0].customerName).toBe('Alpha');
  });

  it('agrège les réservations actives', () => {
    const sub = canonicalSubstation({
      connectionRequests: [
        canonicalRequest({ id: 'ready', load: 5 }),
        studiedRequest({ id: 'done', load: 3 }),
      ],
    });

    const stats = buildQueueCockpitStats(buildQueueCockpitRows([sub]));

    expect(stats.total).toBe(2);
    expect(stats.activeReservedMva).toBe(8);
  });
});
