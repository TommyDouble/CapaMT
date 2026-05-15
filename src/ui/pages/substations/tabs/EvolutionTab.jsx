/**
 * EvolutionTab.jsx — v2.0
 * Slim orchestrator: all sub-components extracted.
 * Original: 625 lines → Now: ~70 lines
 */
import React, { useState } from 'react';
import { YEARS } from '../../../../constants/index.js';
import { useProjects } from '../../../App.jsx';
import { SummaryCards } from './components/SummaryCards.jsx';
import { DirectionalChart, ChartLegend } from './components/DirectionalChart.jsx';
import { ComponentDetail } from './components/ComponentDetail.jsx';
import { CapacityCompare } from './components/CapacityCompare.jsx';
import { AnnualTable } from './components/AnnualTable.jsx';

export function EvolutionTab({ sub }) {
  const projects = useProjects();
  const [view, setView] = useState('withdrawal');
  const [mode, setMode] = useState('resultante');
  const [activeYear, setActiveYear] = useState(YEARS[0]);
  const isW = view === 'withdrawal';

  const modeBtn = (active) => ({
    padding: '6px 16px',
    borderRadius: 7,
    border: `1.5px solid ${active ? 'var(--border-accent)' : 'transparent'}`,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    transition: 'all .15s',
  });

  return (
    <div>
      {/* 1. Summary cards */}
      <SummaryCards
        sub={sub}
        projects={projects}
        activeYear={activeYear}
        view={view}
        setView={setView}
      />

      {/* 2. View + mode selectors */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div className="seg-toggle">
          <button
            className={`seg-toggle__btn${view === 'withdrawal' ? ' active-prelev' : ''}`}
            onClick={() => setView('withdrawal')}
          >
            ⬆ Prélèvement
          </button>
          <button
            className={`seg-toggle__btn${view === 'injection' ? ' active-inj' : ''}`}
            onClick={() => setView('injection')}
          >
            ⬇ Injection
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span className="section-label" style={{ marginRight: 4, marginBottom: 0 }}>
            Mode
          </span>
          <button style={modeBtn(mode === 'resultante')} onClick={() => setMode('resultante')}>
            Résultante
          </button>
          <button style={modeBtn(mode === 'composantes')} onClick={() => setMode('composantes')}>
            Composantes
          </button>
        </div>
      </div>

      {/* 3. Year pills */}
      <div className="year-pills" style={{ marginBottom: 8 }}>
        {YEARS.map((y) => (
          <button
            key={y}
            className={`year-pill${activeYear === y ? ' active' : ''}`}
            onClick={() => setActiveYear(y)}
            style={
              activeYear === y
                ? {
                    background: isW ? 'var(--prelev-dim)' : 'var(--inj-dim)',
                    borderColor: isW ? 'var(--prelev-border)' : 'var(--inj-border)',
                    color: isW ? 'var(--prelev)' : 'var(--inj)',
                  }
                : {}
            }
          >
            {y}
          </button>
        ))}
      </div>

      {/* 4. Legend + chart */}
      <ChartLegend view={view} mode={mode} />
      <DirectionalChart
        sub={sub}
        projects={projects}
        view={view}
        mode={mode}
        activeYear={activeYear}
        onSelectYear={setActiveYear}
      />

      {/* 5. Component detail + capacity comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 4 }}>
        <ComponentDetail sub={sub} year={activeYear} view={view} projects={projects} />
        <CapacityCompare sub={sub} year={activeYear} view={view} projects={projects} />
      </div>

      {/* 6. Annual table */}
      <AnnualTable
        sub={sub}
        projects={projects}
        activeYear={activeYear}
        onSelectYear={setActiveYear}
      />
    </div>
  );
}
