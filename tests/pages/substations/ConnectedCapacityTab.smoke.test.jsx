import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConnectedCapacityTab } from '../../../src/ui/pages/substations/tabs/ConnectedCapacityTab.jsx';
import { canonicalSubstation, connectedRequest } from '../../helpers/canonicalFixtures.js';

const originalConfirm = window.confirm;

afterEach(() => {
  window.confirm = originalConfirm;
  cleanup();
  vi.restoreAllMocks();
});

describe('onglet Raccordés', () => {
  it('affiche les dossiers maintenus et expirés', () => {
    const sub = canonicalSubstation({
      connectionRequests: [
        connectedRequest({
          id: 'kept',
          name: 'Client Maintenu',
          offerDates: { connectedAt: '2026-04-01' },
          load: 5,
        }),
        connectedRequest({
          id: 'ended',
          name: 'Client Expiré',
          offerDates: { connectedAt: '2025-01-01' },
          connectedRetentionMonths: 1,
          load: 4,
        }),
      ],
    });

    render(<ConnectedCapacityTab sub={sub} />);

    expect(screen.getByText('Dossiers raccordés')).toBeTruthy();
    expect(screen.getByText('Client Maintenu')).toBeTruthy();
    expect(screen.getByText('Client Expiré')).toBeTruthy();
    expect(screen.getByText('Maintenu')).toBeTruthy();
    expect(screen.getByText('Expiré automatiquement')).toBeTruthy();
  });

  it('modifie la durée de maintien sur offer', () => {
    const onUpdate = vi.fn();
    const sub = canonicalSubstation({
      connectionRequests: [
        connectedRequest({
          id: 'kept',
          name: 'Client Maintenu',
          offerDates: { connectedAt: '2026-04-01' },
        }),
      ],
    });

    render(<ConnectedCapacityTab sub={sub} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText('Durée maintien Client Maintenu'), {
      target: { value: '9' },
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].connectionRequests[0].offer.connectedRetentionMonths).toBe(9);
  });

  it('libère puis réactive manuellement un raccordé maintenu', () => {
    window.confirm = vi.fn(() => true);
    const onUpdate = vi.fn();
    const sub = canonicalSubstation({
      connectionRequests: [
        connectedRequest({
          id: 'kept',
          name: 'Client Maintenu',
          offerDates: { connectedAt: '2026-04-01' },
        }),
      ],
    });

    const { rerender } = render(<ConnectedCapacityTab sub={sub} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText('Libérer maintenant'));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const releasedSub = onUpdate.mock.calls[0][0];
    expect(releasedSub.connectionRequests[0].offer.connectedReleasedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );

    rerender(<ConnectedCapacityTab sub={releasedSub} onUpdate={onUpdate} />);
    expect(screen.getByText('Libéré manuellement')).toBeTruthy();
    fireEvent.click(screen.getByText('Réactiver'));

    expect(onUpdate.mock.calls[1][0].connectionRequests[0].offer.connectedReleasedAt).toBe('');
  });
});
