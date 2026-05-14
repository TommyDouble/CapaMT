/**
 * GlobalQueuePage.jsx
 * Cockpit actionnable de la file réseau globale.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { DECISION_CONFIG } from '../../../constants/index.js';
import { f1 } from '../../../utils/format.js';
import {
  buildQueueCockpitRows,
  buildQueueCockpitStats,
  ENERGY_DIRECTION_CONFIG,
  filterQueueCockpitRows,
  getDefaultCockpitStep,
  QUEUE_WORKFLOW_STEPS,
  RESERVATION_STATUS_CONFIG,
  sortQueueCockpitRows,
} from '../../../engines/queueCockpit.js';
import { useProjects } from '../../App.jsx';
import { QueueCockpitTable } from './components/QueueCockpitTable.jsx';

const STEP_BY_KEY = Object.fromEntries(QUEUE_WORKFLOW_STEPS.map(step => [step.key, step]));

function PillButton({ label, count, active, color, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      minHeight: 38,
      padding: '8px 13px',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 800,
      cursor: 'pointer',
      border: active ? `1px solid ${color}` : '1px solid var(--border)',
      fontFamily: 'inherit',
      background: active ? color : 'var(--bg-raised)',
      color: active ? '#fff' : 'var(--text-secondary)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      boxShadow: active ? '0 8px 22px rgba(15,23,42,.10)' : 'none',
    }}>
      {label}
      <span style={{
        minWidth: 22,
        textAlign: 'center',
        borderRadius: 999,
        padding: '1px 7px',
        fontSize: 10,
        background: active ? 'rgba(255,255,255,.22)' : 'var(--bg-muted)',
        color: active ? '#fff' : 'var(--text-muted)',
      }}>
        {count}
      </span>
    </button>
  );
}

function MetricCard({ label, value, suffix, color = 'var(--text-primary)', subtitle }) {
  return (
    <div className="metric-box" style={{ minHeight: 82, borderTop: `3px solid ${color}`, paddingTop: 9 }}>
      <div className="metric-box__label">{label}</div>
      <div className="metric-box__value" style={{ color, fontSize: 20 }}>
        {value}
        {suffix && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 4 }}>{suffix}</span>}
      </div>
      {subtitle && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</div>}
    </div>
  );
}

function FloatingMenu({
  menu, filters, optionsByKey, sort, onToggleFilter, onClearFilter, onClientChange, onSort,
}) {
  if (!menu) return null;
  const x = Math.min(menu.x, Math.max(12, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 300));
  const style = {
    position: 'fixed',
    zIndex: 2000,
    top: menu.y + 6,
    left: x,
    minWidth: menu.kind === 'client' ? 280 : 230,
    maxWidth: 300,
    padding: 10,
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: '0 18px 40px rgba(15,23,42,.18)',
  };

  if (menu.kind === 'sort') {
    return (
      <div data-filter-menu="true" style={style}>
        <SortButton active={sort.field === menu.key && sort.direction === 'asc'} onClick={() => onSort(menu.key, 'asc')}>
          Tri ascendant
        </SortButton>
        <SortButton active={sort.field === menu.key && sort.direction === 'desc'} onClick={() => onSort(menu.key, 'desc')}>
          Tri descendant
        </SortButton>
      </div>
    );
  }

  if (menu.kind === 'filterSort') {
    const options = optionsByKey[menu.key] || [];
    const selected = filters[menu.key] || [];
    const sortField = menu.sortField || menu.key;
    return (
      <div data-filter-menu="true" style={style}>
        <div style={menuTitleStyle}>
          <p style={menuTitleTextStyle}>{menu.label}</p>
          <button type="button" onClick={() => onClearFilter(menu.key)} style={clearButtonStyle}>Effacer</button>
        </div>
        <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
          {options.map(opt => (
            <label key={opt.value} style={optionStyle}>
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => onToggleFilter(menu.key, opt.value)}
              />
              <span style={{ fontWeight: 700 }}>{opt.label}</span>
            </label>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <SortButton active={sort.field === sortField && sort.direction === 'asc'} onClick={() => onSort(sortField, 'asc')}>
            Rang croissant
          </SortButton>
          <SortButton active={sort.field === sortField && sort.direction === 'desc'} onClick={() => onSort(sortField, 'desc')}>
            Rang décroissant
          </SortButton>
        </div>
      </div>
    );
  }

  if (menu.kind === 'client') {
    return (
      <div data-filter-menu="true" style={style}>
        <div style={menuTitleStyle}>
          <p style={menuTitleTextStyle}>Demandeur</p>
          <button type="button" onClick={() => onClientChange('')} style={clearButtonStyle}>Effacer</button>
        </div>
        <input
          autoFocus
          className="input-field"
          value={filters.client}
          onChange={e => onClientChange(e.target.value)}
          placeholder="Client, référence, type"
          style={{ height: 32, fontSize: 12, marginBottom: 8 }}
        />
        <SortButton active={sort.field === 'customer' && sort.direction === 'asc'} onClick={() => onSort('customer', 'asc')}>
          Trier A → Z
        </SortButton>
        <SortButton active={sort.field === 'customer' && sort.direction === 'desc'} onClick={() => onSort('customer', 'desc')}>
          Trier Z → A
        </SortButton>
      </div>
    );
  }

  const options = optionsByKey[menu.key] || [];
  const selected = filters[menu.key] || [];
  return (
    <div data-filter-menu="true" style={style}>
      <div style={menuTitleStyle}>
        <p style={menuTitleTextStyle}>{menu.label}</p>
        <button type="button" onClick={() => onClearFilter(menu.key)} style={clearButtonStyle}>Effacer</button>
      </div>
      {menu.searchable && (
        <input
          className="input-field"
          value={menu.query}
          onChange={e => menu.setQuery(e.target.value)}
          placeholder="Rechercher"
          style={{ height: 30, fontSize: 12, marginBottom: 8 }}
        />
      )}
      <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {options
          .filter(opt => {
            const q = menu.query?.trim().toLowerCase();
            if (!q) return true;
            return opt.label.toLowerCase().includes(q) || String(opt.hint || '').toLowerCase().includes(q);
          })
          .map(opt => (
            <label key={opt.value} style={optionStyle}>
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => onToggleFilter(menu.key, opt.value)}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700 }}>{opt.label}</span>
                {opt.hint && <span style={{ color: 'var(--text-muted)' }}> · {opt.hint}</span>}
              </span>
            </label>
          ))}
      </div>
    </div>
  );
}

function SortButton({ active, children, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'block',
      width: '100%',
      textAlign: 'left',
      border: 'none',
      background: active ? 'var(--bg-muted)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--text-secondary)',
      borderRadius: 6,
      padding: '7px 8px',
      fontSize: 12,
      fontWeight: 800,
      cursor: 'pointer',
      fontFamily: 'inherit',
    }}>
      {children}
    </button>
  );
}

function FilterChips({ chips, onRemove, onClear }) {
  if (!chips.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
      {chips.map(chip => (
        <button type="button" key={`${chip.group}:${chip.value}`} onClick={() => onRemove(chip.group, chip.value)} style={{
          border: '1px solid var(--border)',
          background: 'var(--bg-raised)',
          color: 'var(--text-secondary)',
          borderRadius: 999,
          padding: '4px 9px',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
        }}>
          {chip.label} ×
        </button>
      ))}
      <button type="button" onClick={onClear} style={clearButtonStyle}>Effacer tout</button>
    </div>
  );
}

function buildFilterChips(filters, lookups) {
  const chips = Object.entries(filters)
    .filter(([group]) => group !== 'client')
    .flatMap(([group, values]) =>
      values.map(value => ({
        group,
        value,
        label: lookups[group]?.[value] || value,
      }))
    );
  if (filters.client?.trim()) {
    chips.push({ group: 'client', value: filters.client, label: `Client: ${filters.client.trim()}` });
  }
  return chips;
}

const menuTitleStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 };
const menuTitleTextStyle = { fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' };
const optionStyle = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  fontSize: 12,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
};
const clearButtonStyle = {
  border: 'none',
  background: 'transparent',
  color: 'var(--accent)',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit',
};

function toggleListValue(values, value) {
  return values.includes(value)
    ? values.filter(v => v !== value)
    : [...values, value];
}

export function GlobalQueuePage({ substations, onNavigate, onNavigateToRequest, onAdd }) {
  const projects = useProjects();
  const rows = useMemo(() => buildQueueCockpitRows(substations, projects), [substations, projects]);
  const stats = useMemo(() => buildQueueCockpitStats(rows), [rows]);
  const defaultStep = useMemo(() => getDefaultCockpitStep(rows), [rows]);
  const [activeStep, setActiveStep] = useState(null);
  const [menu, setMenu] = useState(null);
  const [substationQuery, setSubstationQuery] = useState('');
  const [filters, setFilters] = useState({
    client: '',
    fifo: [],
    substations: [],
    directions: [],
    decisions: [],
    reservations: [],
  });
  const [sort, setSort] = useState({ field: 'priority', direction: 'desc' });

  const currentStep = activeStep || defaultStep;
  const stepRows = useMemo(() => filterQueueCockpitRows(rows, currentStep, {}), [rows, currentStep]);
  const displayedRows = useMemo(() => {
    const filtered = filterQueueCockpitRows(rows, currentStep, filters);
    return sortQueueCockpitRows(filtered, sort);
  }, [rows, currentStep, filters, sort]);

  const activeFilterCount = Object.entries(filters).reduce((sum, [key, value]) => {
    if (key === 'client') return sum + (value.trim() ? 1 : 0);
    return sum + value.length;
  }, 0);
  const activeStepConfig = STEP_BY_KEY[currentStep] || STEP_BY_KEY.all;

  useEffect(() => {
    if (!menu) return undefined;
    const onPointerDown = event => {
      if (event.target.closest?.('[data-filter-menu="true"]') || event.target.closest?.('[data-header-menu-button="true"]')) return;
      setMenu(null);
    };
    const onKey = event => {
      if (event.key === 'Escape') setMenu(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const substationOptions = substations.map(sub => ({ value: sub.id, label: sub.name, hint: sub.code }));
  const directionOptions = Object.entries(ENERGY_DIRECTION_CONFIG)
    .filter(([key]) => key !== 'none')
    .map(([value, cfg]) => ({ value, label: cfg.label }));
  const fifoOptions = [
    { value: 'in_queue', label: 'En file uniquement' },
    { value: 'head', label: 'Tête de file' },
  ];
  const decisionOptions = Object.keys(DECISION_CONFIG)
    .filter(value => rows.some(row => row.displayDecision === value))
    .map(value => ({ value, label: DECISION_CONFIG[value]?.label || value }));
  const reservationOptions = Object.entries(RESERVATION_STATUS_CONFIG)
    .filter(([value]) => rows.some(row => row.displayReservationStatus === value))
    .map(([value, cfg]) => ({ value, label: cfg.label }));

  const optionsByKey = {
    fifo: fifoOptions,
    substations: substationOptions,
    directions: directionOptions,
    decisions: decisionOptions,
    reservations: reservationOptions,
  };
  const lookups = {
    fifo: Object.fromEntries(fifoOptions.map(opt => [opt.value, opt.label])),
    substations: Object.fromEntries(substationOptions.map(opt => [opt.value, opt.label])),
    directions: Object.fromEntries(directionOptions.map(opt => [opt.value, opt.label])),
    decisions: Object.fromEntries(decisionOptions.map(opt => [opt.value, opt.label])),
    reservations: Object.fromEntries(reservationOptions.map(opt => [opt.value, opt.label])),
  };
  const filterChips = buildFilterChips(filters, lookups);

  const openHeaderMenu = (key, event, kind) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const labels = {
      substations: 'Sous-station',
      fifo: 'Rang FIFO',
      directions: 'Sens énergie',
      reservations: 'Réservation',
      decisions: 'Décision',
    };
    setMenu(prev => prev?.key === key ? null : {
      key,
      kind,
      label: labels[key] || key,
      x: rect.left,
      y: rect.bottom,
      searchable: key === 'substations',
      query: key === 'substations' ? substationQuery : '',
      setQuery: key === 'substations' ? setSubstationQuery : () => {},
      sortField: key === 'fifo' ? 'fifoRank' : key,
    });
  };
  const toggleFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: toggleListValue(prev[key] || [], value) }));
  };
  const clearFilter = key => setFilters(prev => ({ ...prev, [key]: [] }));
  const clearAllFilters = () => setFilters({ client: '', fifo: [], substations: [], directions: [], decisions: [], reservations: [] });
  const removeFilter = (group, value) => {
    if (group === 'client') setFilters(prev => ({ ...prev, client: '' }));
    else setFilters(prev => ({ ...prev, [group]: (prev[group] || []).filter(v => v !== value) }));
  };
  const changeSort = (field, direction) => {
    setSort({ field, direction });
    setMenu(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="fade-in">
      <FloatingMenu
        menu={menu?.key === 'substations' ? { ...menu, query: substationQuery } : menu}
        filters={filters}
        optionsByKey={optionsByKey}
        sort={sort}
        onToggleFilter={toggleFilter}
        onClearFilter={clearFilter}
        onClientChange={value => setFilters(prev => ({ ...prev, client: value }))}
        onSort={changeSort}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 className="page-title">File d'attente réseau</h2>
          <p className="page-subtitle">
            {displayedRows.length}/{stepRows.length} demande(s) dans {activeStepConfig.label}
            {' · '}
            {activeFilterCount} filtre(s) colonne actif(s)
          </p>
        </div>
        {onAdd && (
          <button className="btn-primary" style={{ flexShrink: 0, padding: '8px 18px', fontSize: 13 }} onClick={onAdd}>
            + Nouvelle demande
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        <MetricCard label="À traiter maintenant" value={stats.actionNow} color="var(--accent)" subtitle="action disponible" />
        <MetricCard label="CAPAC bloquants" value={stats.capacBlocking} color="#ea580c" subtitle="en attente ELIA" />
        <MetricCard label="Offres expirées" value={stats.expiredOffers} color="var(--red)" subtitle="réservées à traiter" />
        <MetricCard label="MVA réservés actifs" value={f1(stats.activeReservedMva)} suffix="MVA" color="var(--prelev)" subtitle="prélèvement + injection" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {QUEUE_WORKFLOW_STEPS.map(step => (
          <PillButton
            key={step.key}
            label={step.label}
            count={stats.byStep[step.key] || 0}
            color={step.color}
            active={currentStep === step.key}
            onClick={() => setActiveStep(step.key)}
          />
        ))}
      </div>

      <FilterChips chips={filterChips} onRemove={removeFilter} onClear={clearAllFilters} />

      <QueueCockpitTable
        displayedRows={displayedRows}
        filters={filters}
        sort={sort}
        activeStepConfig={activeStepConfig}
        onOpenMenu={openHeaderMenu}
        onNavigate={onNavigate}
        onNavigateToRequest={onNavigateToRequest}
      />
    </div>
  );
}
