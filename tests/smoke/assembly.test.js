import { describe, expect, it } from 'vitest';
import { getAlertLevel } from '../../src/engines/alerts.js';
import { computeCapacityImpact } from '../../src/engines/capacityImpact.js';
import { getWithdrawalBaseNet } from '../../src/engines/directionalSubstation.js';
import { getQueueAnalysis } from '../../src/engines/queue.js';
import { buildQueueCockpitRows } from '../../src/engines/queueCockpit.js';
import { normalizeRequest } from '../../src/engines/requestModel.js';
import { normalizeSubstations } from '../../src/utils/normalize.js';
import { canonicalRequest, canonicalSubstation } from '../helpers/canonicalFixtures.js';

describe('assemblage runtime', () => {
  it('expose les moteurs actifs', () => {
    expect(getAlertLevel).toBeTypeOf('function');
    expect(computeCapacityImpact).toBeTypeOf('function');
    expect(getWithdrawalBaseNet).toBeTypeOf('function');
    expect(getQueueAnalysis).toBeTypeOf('function');
    expect(buildQueueCockpitRows).toBeTypeOf('function');
  });

  it('normalise et calcule une sous-station de bout en bout', () => {
    const sub = canonicalSubstation({ connectionRequests: [canonicalRequest({ id: 'req-a' })] });
    const [normalized] = normalizeSubstations([sub]);
    const queue = getQueueAnalysis(normalized).queue;

    expect(normalizeRequest(sub.connectionRequests[0], sub.id).customer.client.name).toBe(
      'Client Test',
    );
    expect(queue).toHaveLength(1);
    expect(buildQueueCockpitRows([normalized])).toHaveLength(1);
  });
});
