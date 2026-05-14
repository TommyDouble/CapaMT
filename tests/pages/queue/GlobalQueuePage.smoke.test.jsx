import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProjectsCtx } from '../../../src/ui/App.jsx';
import { GlobalQueuePage } from '../../../src/ui/pages/queue/GlobalQueuePage.jsx';
import { canonicalRequest, canonicalSubstation } from '../../helpers/canonicalFixtures.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('cockpit file globale', () => {
  it('affiche une demande canonique prête pour étude', () => {
    const sub = canonicalSubstation({
      connectionRequests: [
        canonicalRequest({ id: 'queue-page', name: 'Client File', reference: 'REQ-FILE' }),
      ],
    });

    render(
      <ProjectsCtx.Provider value={[]}>
        <GlobalQueuePage
          substations={[sub]}
          onNavigate={vi.fn()}
          onNavigateToRequest={vi.fn()}
          onAdd={vi.fn()}
        />
      </ProjectsCtx.Provider>
    );

    expect(screen.getByText('Client File')).toBeTruthy();
    expect(screen.getByText('REQ-FILE')).toBeTruthy();
    expect(screen.getByText('Prêtes étude')).toBeTruthy();
  });
});
