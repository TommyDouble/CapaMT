/**
 * ProjectBudgetChart.jsx — Budget stacked bar chart by year.
 * Extracted from NetworkProjectsPage.
 */
import React, { useRef, useEffect } from 'react';
import { YEARS } from '../../../../constants/index.js';
import { getChartTheme } from '../../../shared/chartTheme.js';

export function ProjectBudgetChart({ projects }) {
  const chartRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const t = getChartTheme();
    const STATUS_COLORS = {
      validé:   'rgba(5,150,105,.85)',
      en_cours: 'rgba(124,58,237,.75)',
      planifié: 'rgba(124,58,237,.30)',
      annulé:   'rgba(148,163,184,.20)',
    };
    const byYear = {};
    YEARS.forEach(y => {
      byYear[y] = { validé: 0, en_cours: 0, planifié: 0, annulé: 0, projects: [] };
    });
    projects.forEach(p => {
      if (YEARS.includes(p.year)) {
        const st = ['validé', 'en_cours', 'planifié', 'annulé'].includes(p.status) ? p.status : 'planifié';
        byYear[p.year][st] += (p.cost || 0);
        byYear[p.year].projects.push(p);
      }
    });

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'bar',
      data: {
        labels: YEARS.map(String),
        datasets: [
          { label: 'Validé',   data: YEARS.map(y => byYear[y].validé),   backgroundColor: STATUS_COLORS.validé,   stack: 'b' },
          { label: 'En cours', data: YEARS.map(y => byYear[y].en_cours), backgroundColor: STATUS_COLORS.en_cours, stack: 'b' },
          { label: 'Planifié', data: YEARS.map(y => byYear[y].planifié), backgroundColor: STATUS_COLORS.planifié, stack: 'b' },
          { label: 'Annulé',   data: YEARS.map(y => byYear[y].annulé),   backgroundColor: STATUS_COLORS.annulé,   stack: 'b' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { stacked: true, grid: { color: t.grid }, ticks: { font: { family: 'JetBrains Mono', size: 11 }, color: t.text } },
          y: {
            stacked: true,
            title: { display: true, text: 'k€', font: { size: 11 }, color: t.text },
            grid: { color: t.grid },
            ticks: {
              font: { family: 'JetBrains Mono', size: 11 }, color: t.text,
              callback: v => v >= 1000 ? `${(v / 1000).toFixed(1)}M€` : `${v}k€`,
            },
          },
        },
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11, family: 'Outfit' }, boxWidth: 14, padding: 14, color: t.text } },
          tooltip: {
            backgroundColor: t.bgRaised,
            borderColor: t.border,
            borderWidth: 1,
            titleColor: t.textPrimary,
            bodyColor: t.textPrimary,
            callbacks: {
              title: items => `Budget ${items[0].label}`,
              label: item => item.parsed.y > 0
                ? ` ${item.dataset.label}: ${item.parsed.y.toLocaleString('fr')} k€`
                : null,
              afterBody: items => {
                const y = parseInt(items[0].label);
                const total = Object.values(byYear[y]).filter(v => typeof v === 'number').reduce((s, v) => s + v, 0);
                const activeProjects = byYear[y].projects.filter(p => p.status !== 'annulé');
                const lines = [];
                if (total > 0) lines.push(`Total: ${total.toLocaleString('fr')} k€`);
                if (activeProjects.length) {
                  lines.push('─────────────────');
                  activeProjects.forEach(p => {
                    const cost = p.cost ? `${p.cost.toLocaleString('fr')} k€` : 'coût n/d';
                    lines.push(`· ${p.name}  ${cost}`);
                  });
                }
                return lines;
              },
            },
            titleFont: { family: 'JetBrains Mono', size: 12 },
            bodyFont: { family: 'Outfit', size: 11 },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [projects]);

  return <div style={{ position: 'relative', height: 220 }}><canvas ref={canvasRef} /></div>;
}
