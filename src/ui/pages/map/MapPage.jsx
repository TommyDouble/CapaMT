import React, { useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { YEARS, ALERT_CONFIG } from '../../../constants/index.js';
import {
  getFirstWithdrawalSaturationYear,
  getFirstInjectionSaturationYear,
} from '../../../engines/directionalSubstation.js';
import { getCustomer } from '../../../engines/requestModel.js';
import { buildQueueCockpitRows, QUEUE_WORKFLOW_STEPS } from '../../../engines/queueCockpit.js';
import { isActiveCapacityImpact } from '../../../engines/capacityImpact.js';
import { f1, pct } from '../../../utils/format.js';
import { geocodeAddress } from './useGeocoder.js';
import { hasCoords, alertForSub } from './mapHelpers.js';
import { useProjects } from '../../App.jsx';

const LIEGE_CENTER = [50.635, 5.685];
const LIEGE_ZOOM = 10;

/** Étapes du cockpit indexées par clé, sans la pseudo-étape "all". */
const QUEUE_STEP_BY_KEY = Object.fromEntries(
  QUEUE_WORKFLOW_STEPS.filter(s => s.key !== 'all').map(s => [s.key, s])
);

/** Priorité d'actionabilité d'une étape (la plus urgente en premier). */
const STEP_PRIORITY = [
  'offer_action', 'in_study', 'ready_study', 'to_complete', 'to_connect', 'closed',
];

function pickPrimaryStep(rows) {
  for (const key of STEP_PRIORITY) {
    if (rows.some(r => r.stepKey === key)) return key;
  }
  return rows[0]?.stepKey || 'to_complete';
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
  ok:       'Utilisation < 70 % de la capacité N-1. Marge confortable.',
  caution:  '70–85 % de la capacité N-1. Surveillance recommandée.',
  warning:  '85–100 % de la capacité N-1. Alerte : marge réduite, risque à court terme.',
  critical: '≥ 100 % de la capacité N-1. Charge rigide dépasse le secours, saturation effective.',
  rigid_n:  'Charge rigide dépasse même la capacité N. Situation critique sans solution flexible.',
  pilot_n1: 'La capacité totale dépasse N-1 mais reste sous N : pilotage indispensable.',
  pilot_n:  'Pilotage requis en permanence (charge flexible dépasse N).',
};

/** Badge identique à QueueCockpitTable.StepBadge (queue page). */
function StepBadge({ stepKey }) {
  const step = QUEUE_STEP_BY_KEY[stepKey] || QUEUE_STEP_BY_KEY.to_complete;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '2px 7px',
      fontSize: 10, fontWeight: 800,
      background: `${step.color}16`, color: step.color, border: `1px solid ${step.color}35`,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {step.shortLabel}
    </span>
  );
}

/** Affichage de la puissance contextuelle (réservée si étudiée, sinon demandée). */
function PowerCompact({ row }) {
  const { permanentLoad, flexibleLoad, permanentInjection, flexibleInjection, requestedLoad, requestedInjection, technicalResult } = row;
  if (technicalResult) {
    const lines = [];
    if (permanentLoad + flexibleLoad > 0) {
      lines.push(<span key="p" style={{ color: 'var(--prelev, #b91c1c)' }}>P {f1(permanentLoad)}/{f1(flexibleLoad)}</span>);
    }
    if (permanentInjection + flexibleInjection > 0) {
      lines.push(<span key="i" style={{ color: 'var(--inj, #047857)' }}>I {f1(permanentInjection)}/{f1(flexibleInjection)}</span>);
    }
    return <>{lines.map((el, i) => <span key={i}>{i > 0 ? ' · ' : ''}{el}</span>)}</>;
  }
  const parts = [];
  if (requestedLoad > 0) parts.push(<span key="p" style={{ color: 'var(--prelev, #b91c1c)' }}>P {f1(requestedLoad)}</span>);
  if (requestedInjection > 0) parts.push(<span key="i" style={{ color: 'var(--inj, #047857)' }}>I {f1(requestedInjection)}</span>);
  return <>{parts.map((el, i) => <span key={i}>{i > 0 ? ' · ' : ''}{el}</span>)}</>;
}

function DemandGroupPopover({ title, subline, rows }) {
  return (
    <div style={{ minWidth: 280, maxWidth: 360, fontFamily: 'sans-serif' }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{subline}</div>
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 4, maxHeight: 280, overflowY: 'auto' }}>
        {rows.map(row => {
          const step = QUEUE_STEP_BY_KEY[row.stepKey] || QUEUE_STEP_BY_KEY.to_complete;
          return (
            <div key={row.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: 6, fontSize: 11, padding: '5px 0', borderBottom: '1px dotted #f1f5f9' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: step.color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, color: '#475569', fontWeight: 700, opacity: row.isClosed ? 0.55 : 1 }}>
                {row.reference || row.req.id}
              </span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <PowerCompact row={row} /> <span style={{ color: '#94a3b8', fontWeight: 500 }}>MVA</span>
              </span>
              <StepBadge stepKey={row.stepKey} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClickHandler({ onMapClick }) {
  useMapEvents({ click: e => onMapClick(e.latlng) });
  return null;
}

export function MapPage({ substations, onUpdate }) {
  const projects = useProjects();
  const [year, setYear] = useState(YEARS[0]);
  const [viewMode, setViewMode] = useState('worst');
  const [showRequests, setShowRequests] = useState(false);
  const [placingFor, setPlacingFor] = useState(null);
  const [geocodingId, setGeocodingId] = useState(null);

  const positioned = substations.filter(s => hasCoords(s.coordinates));
  const unpositioned = substations.filter(s => !hasCoords(s.coordinates));

  /** Lignes du cockpit file d'attente — source de vérité partagée avec la page File d'attente. */
  const allRows = useMemo(() => {
    if (!showRequests) return [];
    return buildQueueCockpitRows(substations, projects);
  }, [showRequests, substations, projects]);

  /** Ne garder que les demandes avec impact capacité actif (filtre les RELEASED/CONNECTED_RELEASED/NONE). */
  const activeRows = useMemo(
    () => allRows.filter(row => isActiveCapacityImpact({ status: row.impactStatus })),
    [allRows]
  );

  const positionedRows = activeRows.filter(row => hasCoords(getCustomer(row.req).site?.coordinates));
  const unpositionedRows = activeRows.filter(row => !hasCoords(getCustomer(row.req).site?.coordinates));

  /** Groupes par (SS, coordonnées exactes) → un marqueur par site client. */
  const requestGroups = useMemo(() => {
    const groups = new Map();
    for (const row of positionedRows) {
      const coords = getCustomer(row.req).site.coordinates;
      const lat = parseFloat(coords.lat);
      const lng = parseFloat(coords.lng);
      const key = `${row.sub.id}|${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (!groups.has(key)) groups.set(key, { lat, lng, sub: row.sub, rows: [] });
      groups.get(key).rows.push(row);
    }
    return [...groups.values()];
  }, [positionedRows]);

  const handleMapClick = useCallback(latlng => {
    if (!placingFor) return;
    const { subId, reqId } = placingFor;
    const sub = substations.find(s => s.id === subId);
    if (!sub) return;
    const updatedRequests = sub.connectionRequests.map(r =>
      r.id === reqId
        ? { ...r, customer: { ...r.customer, site: { ...r.customer.site, coordinates: { lat: latlng.lat, lng: latlng.lng, source: 'map_click' } } } }
        : r
    );
    onUpdate({ ...sub, connectionRequests: updatedRequests });
    setPlacingFor(null);
  }, [placingFor, substations, onUpdate]);

  const handleGeocode = async (subId, reqId, address) => {
    setGeocodingId(reqId);
    try {
      const coords = await geocodeAddress(address);
      const sub = substations.find(s => s.id === subId);
      if (!sub) return;
      const updatedRequests = sub.connectionRequests.map(r =>
        r.id === reqId
          ? { ...r, customer: { ...r.customer, site: { ...r.customer.site, coordinates: coords } } }
          : r
      );
      onUpdate({ ...sub, connectionRequests: updatedRequests });
    } catch (err) {
      alert(`Géocodage impossible : ${err.message}`);
    } finally {
      setGeocodingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
        {/* Year */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>Année</span>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* View mode */}
        <div style={{ display: 'flex', gap: 3 }}>
          {[['worst', 'Pire'], ['withdrawal', 'Prélèvement'], ['injection', 'Injection']].map(([v, label]) => (
            <button key={v} onClick={() => setViewMode(v)}
              style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                background: viewMode === v ? 'var(--accent)' : 'var(--surface)',
                color: viewMode === v ? '#fff' : 'var(--text-primary)' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Requests toggle */}
        <button onClick={() => setShowRequests(r => !r)}
          style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            background: showRequests ? '#0891b2' : 'var(--surface)',
            color: showRequests ? '#fff' : 'var(--text-primary)' }}>
          {showRequests ? 'Masquer demandes' : 'Afficher demandes'}
        </button>

        {/* Placement mode indicator */}
        {placingFor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '4px 12px' }}>
            Cliquez sur la carte pour positionner
            <button onClick={() => setPlacingFor(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontWeight: 900, fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
          </div>
        )}

        {/* Legend with tooltips */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {Object.entries(ALERT_CONFIG).map(([level, cfg]) => (
            <span key={level}
              title={ALERT_DESCRIPTIONS[level] || cfg.label}
              style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)', cursor: 'help', borderBottom: '1px dotted var(--border)', paddingBottom: 1 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: cfg.bar, display: 'inline-block', flexShrink: 0 }} />
              {cfg.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Map ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', cursor: placingFor ? 'crosshair' : 'default' }}>
        <MapContainer center={LIEGE_CENTER} zoom={LIEGE_ZOOM}
          style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <ClickHandler onMapClick={handleMapClick} />

          {/* Request groups: one marker per (SS, coords) */}
          {requestGroups.map(group => {
            const { lat, lng, sub, rows } = group;
            const isGroup = rows.length > 1;
            const primaryStepKey = pickPrimaryStep(rows);
            const primaryStep = QUEUE_STEP_BY_KEY[primaryStepKey] || QUEUE_STEP_BY_KEY.to_complete;
            const color = primaryStep.color;
            const totalPower = rows.reduce((s, r) => s + (r.displayPowerTotalMva || 0), 0);
            const baseName = getBaseClientName(rows[0].customerName || '');
            const allSameBase = rows.every(r => getBaseClientName(r.customerName || '') === baseName);

            return (
              <React.Fragment key={`${sub.id}-${lat}-${lng}`}>
                {hasCoords(sub.coordinates) && (
                  <>
                    <Polyline
                      positions={[[lat, lng], [parseFloat(sub.coordinates.lat), parseFloat(sub.coordinates.lng)]]}
                      pathOptions={{ color: '#fff', weight: 5, opacity: 0.85 }}
                    />
                    <Polyline
                      positions={[[lat, lng], [parseFloat(sub.coordinates.lat), parseFloat(sub.coordinates.lng)]]}
                      pathOptions={{ color, weight: 2.5, dashArray: '6 4', opacity: 1 }}
                    />
                  </>
                )}
                {isGroup ? (
                  <Marker position={[lat, lng]} icon={buildGroupIcon(color, rows.length)}>
                    <Popup maxWidth={380}>
                      <DemandGroupPopover
                        title={allSameBase ? baseName : `${rows.length} clients`}
                        subline={`${rows[0].sub.name} · ${rows.length} dossier${rows.length > 1 ? 's' : ''} · ${f1(totalPower)} MVA actifs`}
                        rows={rows}
                      />
                    </Popup>
                  </Marker>
                ) : (
                  (() => {
                    const row = rows[0];
                    const step = QUEUE_STEP_BY_KEY[row.stepKey] || QUEUE_STEP_BY_KEY.to_complete;
                    return (
                      <CircleMarker
                        center={[lat, lng]}
                        radius={6}
                        pathOptions={{ fillColor: step.color, color: '#fff', weight: 1.5, fillOpacity: 0.9 }}>
                        <Popup maxWidth={320}>
                          <DemandGroupPopover
                            title={row.customerName || '—'}
                            subline={`${row.sub.name} · 1 dossier · ${f1(row.displayPowerTotalMva)} MVA`}
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
          {positioned.map(sub => {
            const { level, state } = alertForSub(sub, year, viewMode, projects);
            const color = ALERT_CONFIG[level]?.bar || ALERT_CONFIG.ok.bar;
            const capN1 = state.capDirN1 || 0;
            const radius = Math.max(8, Math.min(22, 8 + capN1 / 8));
            const satW = getFirstWithdrawalSaturationYear(sub, projects);
            const satI = getFirstInjectionSaturationYear(sub, projects);
            const reqCount = (sub.connectionRequests || []).length;
            return (
              <CircleMarker
                key={sub.id}
                center={[parseFloat(sub.coordinates.lat), parseFloat(sub.coordinates.lng)]}
                radius={radius}
                pathOptions={{ fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.9 }}>
                <Popup>
                  <div style={{ minWidth: 230, fontFamily: 'monospace' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{sub.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{sub.commune}</div>
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
                            <td style={{ color: '#64748b', paddingRight: 10, paddingBottom: 2 }}>{k}</td>
                            <td style={{ fontWeight: 700 }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#64748b' }}>
                      {reqCount} demande{reqCount !== 1 ? 's' : ''}
                      {' · Alerte : '}
                      <span style={{ fontWeight: 700, color }}>{ALERT_CONFIG[level]?.label || level}</span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* ── Banner: SS sans coordonnées ───────────────────────────────── */}
      {unpositioned.length > 0 && (
        <div style={{ padding: '6px 16px', background: 'var(--slate)', borderTop: '1px solid var(--border)', fontSize: 11, flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{unpositioned.length} SS sans coordonnées :</span>
          {' '}
          <span style={{ color: 'var(--text-muted)' }}>{unpositioned.map(s => s.name).join(', ')}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>— Ajoutez lat/lng dans la fiche SS (section Localisation)</span>
        </div>
      )}

      {/* ── Banner: demandes sans position ───────────────────────────── */}
      {showRequests && unpositionedRows.length > 0 && (
        <div style={{ padding: '6px 16px', background: '#fef3c7', borderTop: '1px solid #fde68a', fontSize: 11, flexShrink: 0, maxHeight: 72, overflowY: 'auto' }}>
          <span style={{ fontWeight: 700, color: '#92400e' }}>{unpositionedRows.length} demande(s) non positionnée(s) :</span>
          {' '}
          {unpositionedRows.map(row => {
            const customer = getCustomer(row.req);
            const name = row.customerName || row.req.id;
            const addr = customer.site?.address;
            const hasAddr = addr?.city || addr?.freeform || customer.site?.commune;
            return (
              <span key={row.id} style={{ marginRight: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#78350f' }}>{name}</span>
                {hasAddr && (
                  <button onClick={() => handleGeocode(row.sub.id, row.req.id, addr || { city: customer.site?.commune })}
                    disabled={geocodingId === row.req.id}
                    style={{ fontSize: 10, padding: '1px 6px', border: '1px solid #fcd34d', borderRadius: 4, background: '#fefce8', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {geocodingId === row.req.id ? '…' : 'Géocoder'}
                  </button>
                )}
                <button onClick={() => setPlacingFor({ subId: row.sub.id, reqId: row.req.id })}
                  style={{ fontSize: 10, padding: '1px 6px', border: '1px solid #fcd34d', borderRadius: 4, background: '#fefce8', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Placer
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
