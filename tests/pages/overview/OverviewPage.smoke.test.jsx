import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../../../src/ui/styles/components.css';
import { INITIAL_NETWORK_PROJECTS, INITIAL_SUBSTATIONS } from '../../../src/data/initial.js';
import { ProjectsCtx } from '../../../src/ui/App.jsx';
import { Overview } from '../../../src/ui/pages/overview/OverviewPage.jsx';

afterEach(cleanup);

function renderPage() {
  return render(
    <ProjectsCtx.Provider value={INITIAL_NETWORK_PROJECTS}>
      <Overview substations={INITIAL_SUBSTATIONS} onNavigate={() => {}} />
    </ProjectsCtx.Provider>,
  );
}

describe('Overview saturation matrix', () => {
  it('affiche le tooltip de saturation en portal non clippé', () => {
    renderPage();

    const matrix = screen.getByText('Matrice de saturation N-1').closest('.card');
    expect(matrix).toBeTruthy();
    const firstPercentage = Array.from(matrix.querySelectorAll('tbody td span')).find((el) =>
      /%$/.test(el.textContent.trim()),
    );
    const firstCell = firstPercentage.closest('td');
    fireEvent.mouseEnter(firstCell);

    const tooltip = document.body.querySelector('.sat-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain('Liege Nord · 2026');
    expect(tooltip.textContent).toContain('Cap. dir. N-1');
    expect(tooltip.closest('table')).toBeNull();
    expect(getComputedStyle(tooltip).position).toBe('fixed');
  });
});
