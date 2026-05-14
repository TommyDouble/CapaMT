import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { computeEffectsFromBlocks } from '../../../src/engines/projectEffects.js';
import { ProjectWizard } from '../../../src/ui/pages/projects/components/ProjectWizard.jsx';

afterEach(cleanup);

describe('ProjectWizard création SS', () => {
  it('recharge les coordonnées d’une sous-station créée par projet', () => {
    const [effect] = computeEffectsFromBlocks([{
      blockType: 'création',
      _newSsId: 'ss-new-wizard',
      name: 'SS Wizard',
      code: 'WIZ',
      commune: 'Liege',
      coordinates: { lat: '50.61', lng: '5.56' },
      voltageUpstream: '36kV',
      tfos: [{ id: 't1', power: '25', role: 'normal' }],
      coeffN: '0.90',
      coeffN1: '1.00',
      initialLoadMva: '0',
      growthRatePct: '0',
    }], []);

    render(
      <ProjectWizard
        project={{
          id: 'proj-wizard',
          name: 'Projet wizard',
          year: 2028,
          status: 'planifié',
          effects: [effect],
        }}
        substations={[]}
        allSubstations={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('2. Travaux & effets réseau'));

    expect(screen.getByDisplayValue('50.61')).toBeTruthy();
    expect(screen.getByDisplayValue('5.56')).toBeTruthy();
  });
});
