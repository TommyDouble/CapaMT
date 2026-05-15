import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/ui/App.jsx';
import { STORAGE_KEY } from '../../src/constants/index.js';
import { canonicalSubstation } from '../helpers/canonicalFixtures.js';

describe('App reset confirmation', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('désactive la réinitialisation tant que la confirmation forte est absente', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 12,
        savedAt: '2026-05-16T00:00:00.000Z',
        substations: [canonicalSubstation()],
        networkProjects: [],
        activityLog: [],
      }),
    );

    render(<App />);

    fireEvent.click(screen.getByText("Repartir des données d'exemple"));

    const confirmButton = screen.getByRole('button', { name: 'Réinitialiser' });
    const input = screen.getByLabelText(/Saisissez REINITIALISER/);

    expect(confirmButton.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'RESET' } });
    expect(confirmButton.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'REINITIALISER' } });
    expect(confirmButton.disabled).toBe(false);
  });

  it('affiche une alerte exportable quand la sauvegarde locale dépasse le quota', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === STORAGE_KEY) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    render(<App />);

    expect(
      await screen.findByText(
        'Sauvegarde locale impossible : le stockage du navigateur est plein.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Exporter JSON')).toBeTruthy();
  });
});
