/**
 * DirectionalChart.jsx — Chart.js chart + custom legend.
 * Extracted from EvolutionTab.
 */
import React, { useRef, useEffect } from 'react';
import Chart from 'chart.js/auto';
import { YEARS } from '../../../../../constants/index.js';
import { f1, pct } from '../../../../../utils/format.js';
import {
  getDirectCapacityN1AtYear,
  getDirectCapacityNAtYear,
  getReverseCapacityN1AtYear,
  getReverseCapacityNAtYear,
  getWithdrawalBaseNet,
  getWithdrawalFirmReservation,
  getWithdrawalFlexibleReservation,
  getWithdrawalRigid,
  getWithdrawalTotal,
  getInjectionBaseNet,
  getInjectionFirmReservation,
  getInjectionFlexibleReservation,
  getInjectionRigid,
  getInjectionTotal,
  getUtilizationWithdrawalRigid,
  getUtilizationInjectionRigid,
  projectDirectionalComponent,
} from '../../../../../engines/directionalSubstation.js';
import { getChartTheme } from '../../../../shared/chartTheme.js';

const ALERT_LEVEL = (r) =>
  r >= 1.0 ? 'critical' : r >= 0.85 ? 'warning' : r >= 0.7 ? 'caution' : 'ok';

export function buildDirectionalTooltipOptions(t) {
  return {
    backgroundColor: t.bgRaised,
    titleColor: t.textPrimary,
    bodyColor: t.textSecondary || t.textPrimary,
    footerColor: t.textMuted,
    borderColor: t.border,
    borderWidth: 1,
    padding: 12,
    boxPadding: 4,
    cornerRadius: 10,
    caretPadding: 8,
    titleFont: { family: t.fontMono, weight: '700', size: 12 },
    bodyFont: { family: t.fontMono, size: 11 },
    callbacks: {
      labelTextColor: () => t.textPrimary,
    },
  };
}

export function ChartLegend({ view, mode }) {
  const isW = view === 'withdrawal';
  if (mode !== 'resultante') return null;
  const items = [
    { color: isW ? 'rgba(99,102,241,.55)' : 'rgba(5,150,105,.50)', label: 'Base nette', bar: true },
    { color: isW ? 'rgba(220,38,38,.70)' : 'rgba(5,150,105,.78)', label: 'Ferme', bar: true },
    { color: isW ? 'rgba(217,119,6,.55)' : 'rgba(5,150,105,.38)', label: 'Flexible', bar: true },
    { color: isW ? '#dc2626' : '#059669', label: 'Résultante rigide', bar: false },
    { color: '#1a1230', label: 'Cap. N-1', bar: false },
  ];
  return (
    <div className="chart-legend">
      {items.map((it) => (
        <span key={it.label} className="chart-legend__item">
          <span
            className={it.bar ? 'chart-legend__swatch' : 'chart-legend__swatch--line'}
            style={{ background: it.color }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{it.label}</span>
        </span>
      ))}
    </div>
  );
}

export function DirectionalChart({ sub, projects, view, mode, activeYear, onSelectYear }) {
  const chartRef = useRef(null);
  const canvasRef = useRef(null);
  const isW = view === 'withdrawal';

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    const ctx = canvasRef.current.getContext('2d');
    const t = getChartTheme();

    const m = sub.directionalModel;
    const wv = m?.withdrawalView || {};
    const iv = m?.injectionView || {};
    const refY = m?.referenceYear || 2025;
    const pc = (base, rate, y) => projectDirectionalComponent(base, rate, refY, y);

    const capN1Data = YEARS.map(
      (y) =>
        +(
          isW
            ? getDirectCapacityN1AtYear(sub, y, projects)
            : getReverseCapacityN1AtYear(sub, y, projects)
        ).toFixed(2),
    );
    const capNRaw = YEARS.map((y) =>
      isW
        ? getDirectCapacityNAtYear(sub, y, projects)
        : getReverseCapacityNAtYear(sub, y, projects),
    );
    const hasCapN = capNRaw.some((v) => v !== null);
    const capNData = hasCapN ? capNRaw.map((v) => (v != null ? +v.toFixed(2) : null)) : null;

    let barDatasets = [];
    let lineDatasets = [];

    if (mode === 'resultante') {
      const baseData = YEARS.map(
        (y) =>
          +(
            isW
              ? getWithdrawalBaseNet(sub, y, projects)
              : Math.abs(getInjectionBaseNet(sub, y, projects))
          ).toFixed(2),
      );
      const firmData = YEARS.map(
        (y) =>
          +(
            isW ? getWithdrawalFirmReservation(sub, y) : getInjectionFirmReservation(sub, y)
          ).toFixed(2),
      );
      const flexData = YEARS.map(
        (y) =>
          +(
            isW ? getWithdrawalFlexibleReservation(sub, y) : getInjectionFlexibleReservation(sub, y)
          ).toFixed(2),
      );
      const rigidLine = YEARS.map(
        (y) =>
          +(
            isW
              ? getWithdrawalRigid(sub, y, false, projects)
              : Math.abs(getInjectionRigid(sub, y, false, projects))
          ).toFixed(2),
      );
      const totalLine = YEARS.map(
        (y) =>
          +(
            isW
              ? getWithdrawalTotal(sub, y, false, projects)
              : Math.abs(getInjectionTotal(sub, y, false, projects))
          ).toFixed(2),
      );
      const lc = isW ? '#dc2626' : '#059669';

      barDatasets = [
        {
          type: 'bar',
          label: 'Base nette',
          data: baseData,
          backgroundColor: isW ? 'rgba(99,102,241,.55)' : 'rgba(5,150,105,.50)',
          stack: 'load',
          yAxisID: 'y',
        },
        {
          type: 'bar',
          label: 'Réserv. ferme',
          data: firmData,
          backgroundColor: isW ? 'rgba(220,38,38,.70)' : 'rgba(5,150,105,.78)',
          stack: 'load',
          yAxisID: 'y',
        },
        {
          type: 'bar',
          label: 'Réserv. flexible',
          data: flexData,
          backgroundColor: isW ? 'rgba(217,119,6,.55)' : 'rgba(5,150,105,.38)',
          stack: 'load',
          yAxisID: 'y',
        },
      ];
      lineDatasets = [
        {
          type: 'line',
          label: 'Résultante rigide',
          data: rigidLine,
          borderColor: lc,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: YEARS.map((y) => (y === activeYear ? 6 : 3)),
          pointBackgroundColor: lc,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          tension: 0.3,
          yAxisID: 'y1',
        },
        {
          type: 'line',
          label: 'Résultante totale',
          data: totalLine,
          borderColor: `${lc}88`,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: YEARS.map((y) => (y === activeYear ? 4 : 2)),
          tension: 0.3,
          yAxisID: 'y1',
        },
        {
          type: 'line',
          label: 'Cap. N-1',
          data: capN1Data,
          borderColor: '#1a1230',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          yAxisID: 'y1',
        },
        ...(hasCapN && capNData
          ? [
              {
                type: 'line',
                label: 'Cap. N',
                data: capNData,
                borderColor: '#9ca3af',
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderDash: [8, 5],
                pointRadius: 0,
                yAxisID: 'y1',
              },
            ]
          : []),
      ];
    } else {
      if (isW) {
        barDatasets = [
          {
            type: 'bar',
            label: '+ Load max BT',
            data: YEARS.map((y) => +pc(wv.maxHistoricLoadBT, wv.growthLoadMaxBT, y).toFixed(2)),
            backgroundColor: 'rgba(79,70,229,.65)',
            stack: 's',
            yAxisID: 'y',
          },
          {
            type: 'bar',
            label: '+ Load max MT',
            data: YEARS.map((y) => +pc(wv.maxHistoricLoadMT, wv.growthLoadMaxMT, y).toFixed(2)),
            backgroundColor: 'rgba(99,102,241,.50)',
            stack: 's',
            yAxisID: 'y',
          },
          {
            type: 'bar',
            label: '− Inj. min BT',
            data: YEARS.map(
              (y) => -pc(wv.minHistoricInjectionBT, wv.growthMinInjectionBT, y).toFixed(2),
            ),
            backgroundColor: 'rgba(5,150,105,.45)',
            stack: 's',
            yAxisID: 'y',
          },
          {
            type: 'bar',
            label: '− Inj. min MT',
            data: YEARS.map(
              (y) => -pc(wv.minHistoricInjectionMT, wv.growthMinInjectionMT, y).toFixed(2),
            ),
            backgroundColor: 'rgba(5,150,105,.30)',
            stack: 's',
            yAxisID: 'y',
          },
          {
            type: 'bar',
            label: '+ Rés. ferme',
            data: YEARS.map((y) => +getWithdrawalFirmReservation(sub, y).toFixed(2)),
            backgroundColor: 'rgba(220,38,38,.68)',
            stack: 's',
            yAxisID: 'y',
          },
          {
            type: 'bar',
            label: '+ Rés. flexible',
            data: YEARS.map((y) => +getWithdrawalFlexibleReservation(sub, y).toFixed(2)),
            backgroundColor: 'rgba(217,119,6,.55)',
            stack: 's',
            yAxisID: 'y',
          },
        ];
        lineDatasets = [
          {
            type: 'line',
            label: 'Résultante rigide',
            data: YEARS.map((y) => +getWithdrawalRigid(sub, y, false, projects).toFixed(2)),
            borderColor: '#dc2626',
            borderWidth: 2.5,
            pointRadius: 4,
            tension: 0.3,
            yAxisID: 'y1',
          },
          {
            type: 'line',
            label: 'Cap. N-1',
            data: capN1Data,
            borderColor: '#1a1230',
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 0,
            yAxisID: 'y1',
          },
        ];
      } else {
        barDatasets = [
          {
            type: 'bar',
            label: '− Inj. max BT',
            data: YEARS.map(
              (y) => -pc(iv.maxHistoricInjectionBT, iv.growthMaxInjectionBT, y).toFixed(2),
            ),
            backgroundColor: 'rgba(5,150,105,.72)',
            stack: 's',
            yAxisID: 'y',
          },
          {
            type: 'bar',
            label: '− Inj. max MT',
            data: YEARS.map(
              (y) => -pc(iv.maxHistoricInjectionMT, iv.growthMaxInjectionMT, y).toFixed(2),
            ),
            backgroundColor: 'rgba(5,150,105,.52)',
            stack: 's',
            yAxisID: 'y',
          },
          {
            type: 'bar',
            label: '+ Load min BT',
            data: YEARS.map((y) => +pc(iv.minHistoricLoadBT, iv.growthMinLoadBT, y).toFixed(2)),
            backgroundColor: 'rgba(99,102,241,.60)',
            stack: 's',
            yAxisID: 'y',
          },
          {
            type: 'bar',
            label: '+ Load min MT',
            data: YEARS.map((y) => +pc(iv.minHistoricLoadMT, iv.growthMinLoadMT, y).toFixed(2)),
            backgroundColor: 'rgba(99,102,241,.40)',
            stack: 's',
            yAxisID: 'y',
          },
          {
            type: 'bar',
            label: '− Rés. ferme',
            data: YEARS.map((y) => -getInjectionFirmReservation(sub, y).toFixed(2)),
            backgroundColor: 'rgba(220,38,38,.65)',
            stack: 's',
            yAxisID: 'y',
          },
          {
            type: 'bar',
            label: '− Rés. flexible',
            data: YEARS.map((y) => -getInjectionFlexibleReservation(sub, y).toFixed(2)),
            backgroundColor: 'rgba(217,119,6,.50)',
            stack: 's',
            yAxisID: 'y',
          },
        ];
        lineDatasets = [
          {
            type: 'line',
            label: 'Résultante rigide',
            data: YEARS.map((y) => +getInjectionRigid(sub, y, false, projects).toFixed(2)),
            borderColor: '#059669',
            borderWidth: 2.5,
            pointRadius: 4,
            tension: 0.3,
            yAxisID: 'y1',
          },
          {
            type: 'line',
            label: '− Cap. inverse N-1',
            data: capN1Data.map((v) => -v),
            borderColor: '#1a1230',
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 0,
            yAxisID: 'y1',
          },
        ];
      }
    }

    const allBarTotals = YEARS.map((_, i) =>
      barDatasets.reduce((s, ds) => s + (ds.data[i] || 0), 0),
    );
    const allLineVals = lineDatasets.flatMap((ds) => ds.data.filter((v) => v != null));
    const allVals = [...allBarTotals, ...allLineVals, 0];
    const rawMax = Math.max(...allVals),
      rawMin = Math.min(...allVals, 0);
    const yPad = (rawMax - rawMin) * 0.14 || 8;
    const yMax = rawMax + yPad,
      yMin = rawMin < 0 ? rawMin - yPad : 0;
    const isW_outer = isW,
      activeYear_outer = activeYear;
    const tooltipOptions = buildDirectionalTooltipOptions(t);

    try {
      chartRef.current = new Chart(ctx, {
        type: 'bar',
        data: { labels: YEARS, datasets: [...barDatasets, ...lineDatasets] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          onClick: (_, elements) => {
            if (elements.length) onSelectYear(YEARS[elements[0].index]);
          },
          scales: {
            x: {
              stacked: true,
              grid: { color: t.grid, drawBorder: false },
              ticks: {
                color: (ctx) =>
                  YEARS[ctx.index] === activeYear_outer
                    ? isW_outer
                      ? '#dc2626'
                      : '#059669'
                    : t.text,
                font: (ctx) => ({
                  family: 'JetBrains Mono, monospace',
                  size: 10,
                  weight: YEARS[ctx.index] === activeYear_outer ? '800' : '400',
                }),
              },
            },
            y: {
              stacked: true,
              min: yMin,
              max: yMax,
              display: true,
              grid: { color: t.grid, drawBorder: false },
              ticks: {
                color: t.text,
                font: { family: 'JetBrains Mono, monospace', size: 10 },
                callback: (v) => f1(v),
              },
            },
            y1: {
              stacked: false,
              display: false,
              min: yMin,
              max: yMax,
              grid: { drawOnChartArea: false },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipOptions,
              callbacks: {
                ...tooltipOptions.callbacks,
                title: ([item]) =>
                  `${YEARS[item.dataIndex]} · ${isW_outer ? '⬆ Prélèvement' : '⬇ Injection'}`,
                label: (ctx) => {
                  const v = ctx.parsed.y;
                  if (v === 0 && ctx.dataset.label.includes('Rés.') && Math.abs(v) < 0.05)
                    return null;
                  return ` ${ctx.dataset.label}: ${f1(v)} MVA`;
                },
                afterBody: ([item]) => {
                  const y = YEARS[item.dataIndex];
                  const capN1 = isW_outer
                    ? getDirectCapacityN1AtYear(sub, y, projects)
                    : getReverseCapacityN1AtYear(sub, y, projects);
                  const rigid = isW_outer
                    ? getWithdrawalRigid(sub, y, false, projects)
                    : Math.abs(getInjectionRigid(sub, y, false, projects));
                  const util = isW_outer
                    ? getUtilizationWithdrawalRigid(sub, y, projects)
                    : getUtilizationInjectionRigid(sub, y, projects);
                  const resid = capN1 - rigid;
                  const level = ALERT_LEVEL(util);
                  const labels = {
                    ok: '✓ OK',
                    caution: '⚠ Tension',
                    warning: '⚠ Alerte N-1',
                    critical: '✕ Saturé N-1',
                  };
                  return [
                    '─────────────────────',
                    ` Résiduel : ${f1(resid)} MVA`,
                    ` Util. N-1 : ${pct(util)}`,
                    ` Statut : ${labels[level] || level}`,
                  ];
                },
              },
            },
          },
          animation: { duration: 350, easing: 'easeOutQuart' },
        },
      });
    } catch (_) {}

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [sub, projects, view, mode, activeYear]);

  return (
    <div style={{ position: 'relative', height: 280, marginTop: 4 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
