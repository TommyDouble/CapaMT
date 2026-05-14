import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RequestCasePage } from '../../../src/ui/pages/requests/RequestCasePage.jsx';
import { canonicalSubstation, studiedRequest } from '../../helpers/canonicalFixtures.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('page dossier canonique', () => {
  it('affiche les données customer, assessment et offer', () => {
    const req = studiedRequest({
      id: 'req-page',
      name: 'Client Page',
      reference: 'REQ-PAGE',
      offerStatus: 'offer_formulated',
      offerDates: { formulatedAt: '2026-02-20' },
    });
    const sub = canonicalSubstation({ connectionRequests: [req] });

    render(
      <RequestCasePage
        sub={sub}
        reqId="req-page"
        projects={[]}
        activityLog={[]}
        onBack={vi.fn()}
        onUpdate={vi.fn()}
        onActivity={vi.fn()}
        onLogDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Client Page')).toBeTruthy();
    expect(screen.getByText('REQ-PAGE')).toBeTruthy();
    expect(screen.getAllByText('Offre formulée').length).toBeGreaterThan(0);
  });
});
