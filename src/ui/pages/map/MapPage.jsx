import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Polyline,
  Popup,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  YEARS,
  ALERT_CONFIG,
  CAPACITY_IMPACT_CONFIG,
  OFFER_STATUS_CONFIG,
} from '../../../constants/index.js';
import {
  getFirstWithdrawalSaturationYear,
  getFirstInjectionSaturationYear,
} from '../../../engines/directionalSubstation.js';
import { f1, pct } from '../../../utils/format.js';
import {
  hasCoords,
  alertForSub,
  applyRequestCoordinatesToSubstation,
  buildCapacityMapRows,
  buildCapacityMapStats,
} from './mapHelpers.js';

const LIEGE_CENTER = [50.635, 5.685];
const LIEGE_ZOOM = 10;

const IMPACT_PRIORITY = ['CONNECTED_RESERVED', 'ACQUIRED', 'STUDY_RESERVED', 'QUEUE_RESERVED'];

function pickPrimaryImpact(rows) {
  for (const status of IMPACT_PRIORITY) {
    if (rows.some((r) => r.impactStatus === status)) return status;
  }
  return rows[0]?.impactStatus || 'QUEUE_RESERVED';
}

function getBaseClientName(name = '') {
  const idx = name.indexOf(' - ');
  return idx > 0 ? name.slice(0, idx) : name;
}

function buildGroupIcon(color, count) {
  return L.divIcon({
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;font-family:system-ui,sans-serif;">${count}</div>`,
    className: 'req-group-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

const ALERT_DESCRIPTIONS = {
  ok: 'Utilisation < 70 % de la capacité N-1. Marge confortable.',
  caution: '70–85 % de la capacité N-1. Surveillance recommandée.',
  warning: '85–100 % de la capacité N-1. Alerte : marge réduite, risque à court terme.',
  critical: '≥ 100 % de la capacité N-1. Charge rigide dépasse le secours, saturation effective.',
  rigid_n: 'Charge rigide dépasse même la capacité N. Situation critique sans solution flexible.',
  pilot_n1: 'La capacité totale dépasse N-1 mais reste sous N : pilotage indispensable.',
  pilot_n: 'Pilotage requis en permanence (charge flexible dépasse N).',
};

function ImpactBadge({ status }) {
  const cfg = CAPACITY_IMPACT_CONFIG[status] || CAPACITY_IMPACT_CONFIG.NONE;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '2px 7px',
        fontSize: 10,
        fontWeight: 800,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  );
}

function PowerCompact({ row }) {
  const { permanentLoad, flexibleLoad, permanentInjection, flexibleInjection } = row;
  const lines = [];
  if (permanentLoad + flexibleLoad > 0) {
    lines.push(
      <span key="p" style={{ color: 'var(--prelev, #b91c1c)' }}>
        P {f1(permanentLoad)}
        {flexibleLoad > 0 ? `/${f1(flexibleLoad)}` : ''}
      </span>,
    );
  }
  if (permanentInjection + flexibleInjection > 0) {
    lines.push(
      <span key="i" style={{ color: 'var(--inj, #047857)' }}>
        I {f1(permanentInjection)}
        {flexibleInjection > 0 ? `/${f1(flexibleInjection)}` : ''}
      </span>,
    );
  }
  return (
    <>
      {lines.map((el, i) => (
        <span key={i}>
          {i > 0 ? ' · ' : ''}
          {el}
        </span>
      ))}
    </>
  );
}

function DemandGroupPopover({ title, subline, rows }) {
  return (
    <div style={{ minWidth: 280, maxWidth: 360, fontFamily: 'sans-serif' }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{subline}</div>
      <div
        style={{ borderTop: '1px solid #e2e8f0', paddingTop: 4, maxHeight: 280, overflowY: 'auto' }}
      >
        {rows.map((row) => {
          const impactCfg = CAPACITY_IMPACT_CONFIG[row.impactStatus] || CAPACITY_IMPACT_CONFIG.NONE;
          const offerLabel = OFFER_STATUS_CONFIG[row.offer.status]?.label || row.offer.status;
          return (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                padding: '6px 0',
                borderBottom: '1px dotted #f1f5f9',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: impactCfg.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 10,
                    color: '#475569',
                    fontWeight: 700,
                  }}
                >
                  {row.reference || row.req.id}
                </span>
                <span style={{ display: 'block', color: '#64748b', fontSize: 10 }}>
                  {row.summary?.phaseLabel || '—'} · {offerLabel}
                </span>
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 10,
                  fontWeight: 700,
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                }}
              >
                <PowerCompact row={row} />{' '}
                <span style={{ color: '#94a3b8', fontWeight: 500 }}>MVA</span>
              </span>
              <span style={{ gridColumn: '2 / span 2' }}>
                <ImpactBadge status={row.impactStatus} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

function MapLegendItem({ level, cfg }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const description = ALERT_DESCRIPTIONS[level] || cfg.label;
  const tooltipId = `map-legend-tooltip-${level}`;

  const updateTooltipPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const gap = 8;
    const width = Math.min(280, window.innerWidth - margin * 2);
    const estimatedHeight = 86;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, margin),
      window.innerWidth - width - margin,
    );
    const below = rect.bottom + gap;
    const top =
      below + estimatedHeight <= window.innerHeight
        ? below
        : Math.max(margin, rect.top - estimatedHeight - gap);

    setPosition({ left, top, width });
  }, []);

  const showTooltip = useCallback(() => {
    updateTooltipPosition();
    setOpen(true);
  }, [updateTooltipPosition]);

  useEffect(() => {
    if (!open) return undefined;

    updateTooltipPosition();
    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('scroll', updateTooltipPosition, true);

    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
    };
  }, [open, updateTooltipPosition]);

  return (
    <span
      ref={triggerRef}
      tabIndex={0}
      aria-describedby={open ? tooltipId : undefined}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setOpen(false)}
      onFocus={showTooltip}
      onBlur={() => setOpen(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 10,
        color: 'var(--text-muted)',
        cursor: 'help',
        borderBottom: '1px dotted var(--border)',
        paddingBottom: 1,
        outline: open ? '1px solid var(--accent)' : 'none',
        outlineOffset: 2,
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: cfg.bar,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {cfg.label}
      {open &&
        position &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            style={{
              position: 'fixed',
              left: position.left,
              top: position.top,
              zIndex: 4000,
              width: position.width,
              padding: '8px 10px',
              borderRadius: 6,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1.35,
              textTransform: 'none',
              pointerEvents: 'none',
              whiteSpace: 'normal',
            }}
          >
            <span
              style={{
                display: 'block',
                marginBottom: 2,
                color: cfg.bar,
                fontWeight: 900,
              }}
            >
              {cfg.label}
            </span>
            {description}
          </span>,
          document.body,
        )}
    </span>
  );
}

export function MapPage({
  baseSubstations = [],
  displaySubstations = [],
  projects = [],
  onUpdateSubstation,
}) {
  const [year, setYear] = useState(YEARS[0]);
  const [viewMode, setViewMode] = useState('worst');
  const [showRequests, setShowRequests] = useState(false);
  const [placingFor, setPlacingFor] = useState(null);

  const persistableSubIds = useMemo(
    () => new Set((baseSubstations || []).map((sub) => sub.id)),
    [baseSubstations],
  );
  const positioned = displaySubstations.filter((s) => hasCoords(s.coordinates));
  const unpositioned = displaySubstations.filter((s) => !hasCoords(s.coordinates));

  const activeRows = useMemo(() => buildCapacityMapRows(displaySubstations), [displaySubstations]);
  const mapStats = useMemo(
    () => buildCapacityMapStats(displaySubstations, activeRows),
    [displaySubstations, activeRows],
  );
  const projectedSubstationCount = displaySubstations.filter(
    (sub) => !persistableSubIds.has(sub.id),
  ).length;

  const positionedRows = activeRows.filter((row) => hasCoords(row.coordinates));
  const unpositionedRows = activeRows.filter((row) => !hasCoords(row.coordinates));

  /** Groupes par (SS, coordonnées exactes) → un marqueur par site client. */
  const requestGroups = useMemo(() => {
    const groups = new Map();
    for (const row of positionedRows) {
      const coords = row.coordinates;
      const lat = parseFloat(coords.lat);
      const lng = parseFloat(coords.lng);
      const key = `${row.sub.id}|${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (!groups.has(key)) groups.set(key, { lat, lng, sub: row.sub, rows: [] });
      groups.get(key).rows.push(row);
    }
    return [...groups.values()];
  }, [positionedRows]);

  const handleMapClick = useCallback(
    (latlng) => {
      if (!placingFor) return;
      const { subId, reqId } = placingFor;
      const sub = (baseSubstations || []).find((s) => s.id === subId);
      if (!sub || !onUpdateSubstation) return;
      onUpdateSubstation(
        applyRequestCoordinatesToSubstation(sub, reqId, {
          lat: latlng.lat,
          lng: latlng.lng,
          source: 'map_click',
        }),
      );
      setPlacingFor(null);
    },
    [placingFor, baseSubstations, onUpdateSubstation],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        {/* Year */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.05em',
              color: 'var(--text-muted)',
            }}
          >
            Année
          </span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* View mode */}
        <div style={{ display: 'flex', gap: 3 }}>
          {[
            ['worst', 'Pire'],
            ['withdrawal', 'Prélèvement'],
            ['injection', 'Injection'],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 600,
                background: viewMode === v ? 'var(--accent)' : 'var(--bg-surface)',
                color: viewMode === v ? '#fff' : 'var(--text-primary)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Requests toggle */}
        <button
          onClick={() => setShowRequests((r) => !r)}
          style={{
            fontSize: 11,
            padding: '4px 10px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 600,
            background: showRequests ? '#0891b2' : 'var(--bg-surface)',
            color: showRequests ? '#fff' : 'var(--text-primary)',
          }}
        >
          {showRequests ? 'Masquer demandes' : 'Afficher demandes'}
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>Diagnostic</span>
          <span>
            SS {mapStats.substations.positioned}/{mapStats.substations.total}
          </span>
          <span>
            Demandes impact {mapStats.activeRequests.positioned}/{mapStats.activeRequests.total}
          </span>
          {mapStats.activeRequests.unpositioned > 0 && (
            <span style={{ color: 'var(--amber)', fontWeight: 800 }}>
              {mapStats.activeRequests.unpositioned} à positionner
            </span>
          )}
          {projectedSubstationCount > 0 && <span>{projectedSubstationCount} SS projetée(s)</span>}
        </div>

        {/* Placement mode indicator */}
        {placingFor && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginLeft: 8,
              fontSize: 12,
              fontWeight: 700,
              color: '#92400e',
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: 6,
              padding: '4px 12px',
            }}
          >
            Cliquez sur la carte pour positionner
            <button
              onClick={() => setPlacingFor(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#92400e',
                fontWeight: 900,
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Legend with tooltips */}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            SS
          </span>
          {Object.entries(ALERT_CONFIG).map(([level, cfg]) => (
            <MapLegendItem key={level} level={level} cfg={cfg} />
          ))}
          {showRequests && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Demandes : couleur = impact capacité actif
            </span>
          )}
        </div>
      </div>

      {/* ── Map ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', cursor: placingFor ? 'crosshair' : 'default' }}>
        <MapContainer
          center={LIEGE_CENTER}
          zoom={LIEGE_ZOOM}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <ClickHandler onMapClick={handleMapClick} />

          {/* Request groups: one marker per (SS, coords) */}
          {showRequests &&
            requestGroups.map((group) => {
              const { lat, lng, sub, rows } = group;
              const isGroup = rows.length > 1;
              const primaryImpact = pickPrimaryImpact(rows);
              const primaryImpactCfg =
                CAPACITY_IMPACT_CONFIG[primaryImpact] || CAPACITY_IMPACT_CONFIG.QUEUE_RESERVED;
              const color = primaryImpactCfg.color;
              const totalPower = rows.reduce((s, r) => s + (r.displayPowerTotalMva || 0), 0);
              const baseName = getBaseClientName(rows[0].customerName || '');
              const allSameBase = rows.every(
                (r) => getBaseClientName(r.customerName || '') === baseName,
              );

              return (
                <React.Fragment key={`${sub.id}-${lat}-${lng}`}>
                  {hasCoords(sub.coordinates) && (
                    <>
                      <Polyline
                        positions={[
                          [lat, lng],
                          [parseFloat(sub.coordinates.lat), parseFloat(sub.coordinates.lng)],
                        ]}
                        pathOptions={{ color: '#fff', weight: 5, opacity: 0.85 }}
                      />
                      <Polyline
                        positions={[
                          [lat, lng],
                          [parseFloat(sub.coordinates.lat), parseFloat(sub.coordinates.lng)],
                        ]}
                        pathOptions={{ color, weight: 2.5, dashArray: '6 4', opacity: 1 }}
                      />
                    </>
                  )}
                  {isGroup ? (
                    <Marker position={[lat, lng]} icon={buildGroupIcon(color, rows.length)}>
                      <Popup maxWidth={380}>
                        <DemandGroupPopover
                          title={allSameBase ? baseName : `${rows.length} clients`}
                          subline={`${rows[0].sub.name} · ${rows.length} impact${rows.length > 1 ? 's' : ''} actif${rows.length > 1 ? 's' : ''} · ${f1(totalPower)} MVA`}
                          rows={rows}
                        />
                      </Popup>
                    </Marker>
                  ) : (
                    (() => {
                      const row = rows[0];
                      const impactCfg =
                        CAPACITY_IMPACT_CONFIG[row.impactStatus] ||
                        CAPACITY_IMPACT_CONFIG.QUEUE_RESERVED;
                      return (
                        <CircleMarker
                          center={[lat, lng]}
                          radius={6}
                          pathOptions={{
                            fillColor: impactCfg.color,
                            color: '#fff',
                            weight: 1.5,
                            fillOpacity: 0.9,
                          }}
                        >
                          <Popup maxWidth={320}>
                            <DemandGroupPopover
                              title={row.customerName || '—'}
                              subline={`${row.sub.name} · 1 impact actif · ${f1(row.displayPowerTotalMva)} MVA`}
                              rows={[row]}
                            />
                          </Popup>
                        </CircleMarker>
                      );
                    })()
                  )}
                </React.Fragment>
              );
            })}

          {/* Substation markers */}
          {positioned.map((sub) => {
            const { level, state } = alertForSub(sub, year, viewMode, projects);
            const color = ALERT_CONFIG[level]?.bar || ALERT_CONFIG.ok.bar;
            const capN1 = state.capDirN1 || 0;
            const radius = Math.max(8, Math.min(22, 8 + capN1 / 8));
            const satW = getFirstWithdrawalSaturationYear(sub, projects);
            const satI = getFirstInjectionSaturationYear(sub, projects);
            const reqCount = (sub.connectionRequests || []).length;
            const isPersistable = persistableSubIds.has(sub.id);
            return (
              <CircleMarker
                key={sub.id}
                center={[parseFloat(sub.coordinates.lat), parseFloat(sub.coordinates.lng)]}
                radius={radius}
                pathOptions={{ fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.9 }}
              >
                <Popup>
                  <div style={{ minWidth: 230, fontFamily: 'monospace' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{sub.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                      {sub.commune} ·{' '}
                      {isPersistable ? 'Sous-station base' : 'Sous-station projetée'}
                    </div>
                    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                      <tbody>
                        {[
                          ['Cap. N-1', `${f1(state.capDirN1)} MVA`],
                          ['Util. rigide', pct(state.uWRvsN1 ?? 0)],
                          ['Util. totale', pct(state.uWTvsN1 ?? 0)],
                          ['Résiduel', `${f1(state.residualWRigid)} MVA`],
                          ...(satW ? [['Sat. prélt.', String(satW)]] : []),
                          ...(satI ? [['Sat. inj.', String(satI)]] : []),
                        ].map(([k, v]) => (
                          <tr key={k}>
                            <td style={{ color: '#64748b', paddingRight: 10, paddingBottom: 2 }}>
                              {k}
                            </td>
                            <td style={{ fontWeight: 700 }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div
                      style={{
                        marginTop: 6,
                        paddingTop: 6,
                        borderTop: '1px solid #e2e8f0',
                        fontSize: 11,
                        color: '#64748b',
                      }}
                    >
                      {reqCount} demande{reqCount !== 1 ? 's' : ''}
                      {' · Alerte : '}
                      <span style={{ fontWeight: 700, color }}>
                        {ALERT_CONFIG[level]?.label || level}
                      </span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {showRequests && unpositionedRows.length > 0 && (
          <div
            style={{
              position: 'absolute',
              right: 12,
              top: 12,
              zIndex: 500,
              width: 'min(360px, calc(100% - 24px))',
              maxHeight: 'calc(100% - 24px)',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 12px 30px rgba(15,23,42,.18)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Demandes non positionnées
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {unpositionedRows.length} impact{unpositionedRows.length > 1 ? 's' : ''} actif
                  {unpositionedRows.length > 1 ? 's' : ''}
                </div>
              </div>
              <button
                onClick={() => setShowRequests(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontWeight: 900,
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                x
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '4px 0' }}>
              {unpositionedRows.map((row) => {
                const canPlace = persistableSubIds.has(row.sub.id);
                return (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 8,
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {row.customerName || row.req.id}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          display: 'flex',
                          gap: 6,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>{row.sub.name}</span>
                        <span>·</span>
                        <span>{f1(row.displayPowerTotalMva || 0)} MVA</span>
                        <ImpactBadge status={row.impactStatus} />
                        <span>{row.summary?.phaseLabel || '—'}</span>
                      </div>
                    </div>
                    {canPlace ? (
                      <button
                        onClick={() => setPlacingFor({ subId: row.sub.id, reqId: row.req.id })}
                        style={{
                          fontSize: 10,
                          padding: '4px 8px',
                          border: '1px solid #fcd34d',
                          borderRadius: 5,
                          background: '#fefce8',
                          color: '#78350f',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontWeight: 800,
                        }}
                      >
                        Placer
                      </button>
                    ) : (
                      <span
                        title="Coordonnées modifiables depuis le projet réseau"
                        style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                          borderRadius: 5,
                          padding: '4px 8px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Projet
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Banner: SS sans coordonnées ───────────────────────────────── */}
      {unpositioned.length > 0 && (
        <div
          style={{
            padding: '6px 16px',
            background: 'var(--slate)',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
            {unpositioned.length} SS sans coordonnées :
          </span>{' '}
          <span style={{ color: 'var(--text-muted)' }}>
            {unpositioned.map((s) => s.name).join(', ')}
          </span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
            — Ajoutez lat/lng dans la fiche SS ou dans le projet réseau de création
          </span>
        </div>
      )}
    </div>
  );
}
