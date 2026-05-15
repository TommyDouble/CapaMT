import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { f1, fmtShortDate } from '../../../../utils/format.js';
import {
  ENERGY_DIRECTION_CONFIG,
  LIMITING_CONSTRAINT_LABELS,
  QUEUE_WORKFLOW_STEPS,
  RESERVATION_STATUS_CONFIG,
} from '../../../../engines/queueCockpit.js';
import { DecisionBadge, ExpiryChip, Tag } from '../../../shared/badges.jsx';

const STEP_BY_KEY = Object.fromEntries(QUEUE_WORKFLOW_STEPS.map((step) => [step.key, step]));

const CAPAC_ACTION_STATUS = {
  not_sent: {
    label: 'CAPAC non envoyée',
    color: '#9a3412',
    detail: 'La demande CAPAC doit être envoyée à ELIA avant de pouvoir encoder le retour amont.',
  },
  sent: {
    label: 'Retour ELIA attendu',
    color: '#92400e',
    detail: 'La demande CAPAC a été envoyée à ELIA. Le retour amont doit encore être encodé.',
  },
  partial: {
    label: 'Retour CAPAC partiel',
    color: '#92400e',
    detail:
      'Un retour CAPAC a été encodé pour un sens, mais tous les sens applicables ne sont pas encore répondus.',
  },
};

function HeaderButton({ children, active, sort, onClick, align = 'left' }) {
  return (
    <button
      type="button"
      data-header-menu-button="true"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent:
          align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        gap: 5,
        width: '100%',
        border: 'none',
        background: 'transparent',
        padding: 0,
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        cursor: 'pointer',
        font: 'inherit',
        textTransform: 'uppercase',
        letterSpacing: '.08em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      <span style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--border-strong)' }}>
        {sort || '▾'}
      </span>
    </button>
  );
}

function TableHeader({ filters, sort, onOpenMenu }) {
  const filterActive = (key) =>
    key === 'client' ? !!filters.client?.trim() : (filters[key] || []).length > 0;
  const sortMark = (field) =>
    sort.field === field ? (sort.direction === 'asc' ? '↑' : '↓') : null;

  const cellStyle = (align, width) => ({
    padding: '9px 10px',
    textAlign: align || 'left',
    width,
    fontSize: 9,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    background: 'var(--bg-muted)',
  });

  return (
    <thead>
      <tr>
        <th style={cellStyle('center', 72)}>
          <HeaderButton
            active={sort.field === 'priority'}
            sort={sortMark('priority')}
            align="center"
            onClick={(e) => onOpenMenu('priority', e, 'sort')}
          >
            Priorité
          </HeaderButton>
        </th>
        <th style={cellStyle('center', 104)}>
          <HeaderButton
            active={filterActive('fifo') || sort.field === 'fifoRank'}
            sort={sortMark('fifoRank')}
            align="center"
            onClick={(e) => onOpenMenu('fifo', e, 'filterSort')}
          >
            Rang FIFO
          </HeaderButton>
        </th>
        <th style={cellStyle('left', 170)}>
          <HeaderButton
            active={filterActive('substations')}
            onClick={(e) => onOpenMenu('substations', e, 'filter')}
          >
            Sous-station
          </HeaderButton>
        </th>
        <th style={cellStyle('left', 230)}>
          <HeaderButton
            active={filterActive('client') || sort.field === 'customer'}
            sort={sortMark('customer')}
            onClick={(e) => onOpenMenu('client', e, 'client')}
          >
            Demandeur
          </HeaderButton>
        </th>
        <th style={cellStyle('center', 132)}>Étape</th>
        <th style={cellStyle('left', 146)}>Action</th>
        <th style={cellStyle('center', 104)}>
          <HeaderButton
            active={filterActive('directions')}
            onClick={(e) => onOpenMenu('directions', e, 'filter')}
            align="center"
          >
            Sens
          </HeaderButton>
        </th>
        <th style={cellStyle('right', 164)}>
          <HeaderButton
            active={sort.field === 'capacity'}
            sort={sortMark('capacity')}
            align="right"
            onClick={(e) => onOpenMenu('capacity', e, 'sort')}
          >
            Puissance
          </HeaderButton>
        </th>
        <th style={cellStyle('center', 164)}>Contrainte / condition</th>
        <th style={cellStyle('center', 128)}>
          <HeaderButton
            active={filterActive('reservations')}
            onClick={(e) => onOpenMenu('reservations', e, 'filter')}
            align="center"
          >
            Réservation
          </HeaderButton>
        </th>
        <th style={cellStyle('center', 128)}>
          <HeaderButton
            active={filterActive('decisions')}
            onClick={(e) => onOpenMenu('decisions', e, 'filter')}
            align="center"
          >
            Décision
          </HeaderButton>
        </th>
        <th style={cellStyle('center', 120)}>
          <HeaderButton
            active={sort.field === 'deadline'}
            sort={sortMark('deadline')}
            align="center"
            onClick={(e) => onOpenMenu('deadline', e, 'sort')}
          >
            Échéance
          </HeaderButton>
        </th>
        <th style={cellStyle('right', 96)}>Dossier</th>
      </tr>
    </thead>
  );
}

function StepBadge({ row }) {
  const step = STEP_BY_KEY[row.stepKey] || STEP_BY_KEY.to_complete;
  return (
    <span style={{ display: 'inline-grid', justifyItems: 'center', gap: 3 }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 999,
          padding: '3px 8px',
          fontSize: 10,
          fontWeight: 800,
          background: `${step.color}16`,
          color: step.color,
          border: `1px solid ${step.color}35`,
          whiteSpace: 'nowrap',
        }}
      >
        {step.shortLabel}
      </span>
    </span>
  );
}

function DirectionChip({ direction }) {
  const cfg = ENERGY_DIRECTION_CONFIG[direction] || ENERGY_DIRECTION_CONFIG.none;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        minWidth: 64,
        padding: '3px 7px',
        fontSize: 10,
        fontWeight: 800,
        color: cfg.color,
        border: '1px solid var(--border)',
        background: 'var(--bg-raised)',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.shortLabel}
    </span>
  );
}

function ReservationBadge({ status }) {
  const cfg = RESERVATION_STATUS_CONFIG[status] || RESERVATION_STATUS_CONFIG.none;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        padding: '3px 8px',
        fontSize: 10,
        fontWeight: 800,
        color: cfg.color,
        background: `${cfg.color}12`,
        border: `1px solid ${cfg.color}35`,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.shortLabel}
    </span>
  );
}

function ConstraintBadge({ value }) {
  const label = LIMITING_CONSTRAINT_LABELS[value] || LIMITING_CONSTRAINT_LABELS.UNKNOWN;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: value === 'UNKNOWN' ? 'var(--text-muted)' : 'var(--text-secondary)',
      }}
    >
      {label}
    </span>
  );
}

function FifoRankCell({ row }) {
  const inQueue = row.fifoRank != null;
  const color = row.isHeadOfQueue
    ? 'var(--accent)'
    : inQueue
      ? 'var(--text-secondary)'
      : 'var(--text-muted)';
  return (
    <td style={{ textAlign: 'center', padding: '11px 8px' }}>
      <span
        style={{
          display: 'inline-flex',
          minWidth: inQueue ? 36 : 58,
          justifyContent: 'center',
          borderRadius: 999,
          padding: '3px 8px',
          background: inQueue ? `${color}12` : 'var(--bg-muted)',
          color,
          border: `1px solid ${inQueue ? `${color}35` : 'var(--border)'}`,
          fontSize: 10,
          fontWeight: 900,
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
        }}
      >
        {row.fifoRankLabel}
      </span>
      {row.isHeadOfQueue && (
        <div
          style={{
            fontSize: 8,
            color: 'var(--accent)',
            fontWeight: 800,
            marginTop: 2,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
          }}
        >
          tête
        </div>
      )}
    </td>
  );
}

function ConstraintConditionCell({ row }) {
  const summary = row.conditionSummary;
  const hasConstraint =
    row.technicalResult && row.limitingConstraint && row.limitingConstraint !== 'UNKNOWN';
  return (
    <td style={{ textAlign: 'center', padding: '11px 8px' }}>
      {row.technicalResult ? <ConstraintBadge value={row.limitingConstraint} /> : <EmptyValue />}
      {summary && (
        <div
          style={{
            marginTop: hasConstraint ? 3 : 0,
            fontSize: 9,
            color: summary.warning ? 'var(--amber)' : 'var(--text-secondary)',
            fontWeight: 800,
            lineHeight: 1.35,
          }}
        >
          Cond. {summary.label}
        </div>
      )}
    </td>
  );
}

function PriorityCell({ row }) {
  const color =
    row.urgency >= 95
      ? 'var(--red)'
      : row.urgency >= 85
        ? '#ea580c'
        : row.urgency >= 70
          ? 'var(--amber)'
          : row.urgency >= 55
            ? 'var(--accent)'
            : 'var(--text-muted)';
  const label =
    row.urgency >= 95
      ? 'P0'
      : row.urgency >= 85
        ? 'P1'
        : row.urgency >= 70
          ? 'P2'
          : row.urgency >= 55
            ? 'P3'
            : 'P4';
  return (
    <td style={{ textAlign: 'center', padding: '11px 8px' }}>
      <span
        style={{
          display: 'inline-flex',
          minWidth: 34,
          justifyContent: 'center',
          borderRadius: 999,
          padding: '3px 8px',
          background: `${color}14`,
          color,
          border: `1px solid ${color}40`,
          fontSize: 10,
          fontWeight: 900,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {label}
      </span>
    </td>
  );
}

function SubstationCell({ row, onNavigate }) {
  return (
    <td style={{ padding: '11px 10px' }}>
      <button
        type="button"
        onClick={() => onNavigate(row.sub.id, 'demandes')}
        style={{
          color: 'var(--accent)',
          fontSize: 12,
          fontWeight: 800,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: 0,
          textAlign: 'left',
        }}
      >
        {row.substationName}
      </button>
      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
        {row.substationCode}
      </div>
    </td>
  );
}

function PowerCell({ row }) {
  const hasTechnicalLoad = row.permanentLoad + row.flexibleLoad > 0;
  const hasTechnicalInjection = row.permanentInjection + row.flexibleInjection > 0;
  const hasRequestedLoad = row.requestedLoad > 0;
  const hasRequestedInjection = row.requestedInjection > 0;
  if (!row.technicalResult) {
    if (!hasRequestedLoad && !hasRequestedInjection) {
      return (
        <td
          style={{
            textAlign: 'right',
            padding: '11px 10px',
            color: 'var(--text-muted)',
            fontSize: 11,
          }}
        >
          —
        </td>
      );
    }
    return (
      <td style={{ textAlign: 'right', padding: '11px 10px' }}>
        {hasRequestedLoad && (
          <div className="mono" style={{ fontSize: 11, color: 'var(--prelev)', fontWeight: 800 }}>
            P {f1(row.requestedLoad)}{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>MVA demandé</span>
          </div>
        )}
        {hasRequestedInjection && (
          <div className="mono" style={{ fontSize: 11, color: 'var(--inj)', fontWeight: 800 }}>
            I {f1(row.requestedInjection)}{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>MVA demandé</span>
          </div>
        )}
      </td>
    );
  }
  if (!hasTechnicalLoad && !hasTechnicalInjection) {
    return (
      <td
        style={{
          textAlign: 'right',
          padding: '11px 10px',
          color: 'var(--text-muted)',
          fontSize: 11,
        }}
      >
        —
      </td>
    );
  }
  return (
    <td style={{ textAlign: 'right', padding: '11px 10px' }}>
      {hasTechnicalLoad && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--prelev)', fontWeight: 800 }}>
          P {f1(row.permanentLoad)} / {f1(row.flexibleLoad)}{' '}
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>MVA</span>
        </div>
      )}
      {hasTechnicalInjection && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--inj)', fontWeight: 800 }}>
          I {f1(row.permanentInjection)} / {f1(row.flexibleInjection)}{' '}
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>MVA</span>
        </div>
      )}
    </td>
  );
}

function EmptyValue() {
  return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>;
}

function ReservationCell({ row }) {
  return (
    <td style={{ textAlign: 'center', padding: '11px 8px' }}>
      {row.displayReservationStatus ? (
        <>
          <ReservationBadge status={row.displayReservationStatus} />
          {row.expiry?.status === 'bientôt' && (
            <div style={{ marginTop: 3 }}>
              <ExpiryChip expiry={row.expiry} />
            </div>
          )}
        </>
      ) : (
        <EmptyValue />
      )}
    </td>
  );
}

function DecisionCell({ row }) {
  return (
    <td style={{ textAlign: 'center', padding: '11px 8px' }}>
      {row.displayDecision ? (
        <DecisionBadge decision={row.displayDecision} size="xs" />
      ) : (
        <EmptyValue />
      )}
    </td>
  );
}

function DeadlineCell({ row }) {
  return (
    <td
      style={{
        textAlign: 'center',
        padding: '11px 8px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: row.displayReservationStatus === 'expired' ? 'var(--red)' : 'var(--text-muted)',
      }}
    >
      {row.deadline ? fmtShortDate(row.deadline) : <EmptyValue />}
    </td>
  );
}

function actionLabel(row) {
  if (row.stepKey === 'ready_study') return 'Étudier';
  if (row.offerStatus === 'offer_expired' || row.displayReservationStatus === 'expired')
    return 'Traiter expiration';
  if (row.stepKey === 'to_connect') return 'Raccorder';
  if (row.stepKey === 'offer_action' && row.offerStatus === 'not_applicable')
    return 'Formuler offre';
  if (row.action?.key === 'VIEW') return 'Ouvrir';
  return row.action?.label || 'Ouvrir';
}

function actionColor(row) {
  const label = actionLabel(row);
  if (label === 'Traiter expiration') return 'var(--red)';
  if (row.stepKey === 'ready_study' || row.stepKey === 'to_connect') return 'var(--accent)';
  return 'var(--text-secondary)';
}

function ActionCell({ row }) {
  const pendingActionLabels = [...new Set(row.pendingActionLabels || [])];
  const count = pendingActionLabels.length;
  const capacStatus = CAPAC_ACTION_STATUS[row.capacActionStatus] || null;
  const hasDetails = count > 0 || capacStatus;
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const showTooltip = (event) => {
    if (!hasDetails || typeof window === 'undefined') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const estimatedWidth = 300;
    const estimatedHeight = 150;
    const margin = 12;
    const left = Math.min(
      Math.max(rect.left, margin),
      Math.max(margin, window.innerWidth - estimatedWidth - margin),
    );
    const hasRoomBelow = rect.bottom + estimatedHeight + margin < window.innerHeight;
    setTooltipPosition({
      left,
      top: hasRoomBelow ? rect.bottom + 8 : rect.top - 8,
      placement: hasRoomBelow ? 'below' : 'above',
    });
  };
  const hideTooltip = () => setTooltipPosition(null);
  return (
    <span
      className="queue-action"
      tabIndex={hasDetails ? 0 : undefined}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        flexDirection: 'column',
        gap: 3,
        fontSize: 12,
        fontWeight: 800,
        color: actionColor(row),
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {actionLabel(row)}
        {count > 0 && (
          <span
            aria-label={`${count} action${count > 1 ? 's' : ''} en attente`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 18,
              padding: '2px 7px',
              borderRadius: 999,
              background: 'var(--bg-muted)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              fontSize: 9,
              fontWeight: 800,
              lineHeight: 1,
              cursor: hasDetails ? 'help' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            {count} action{count > 1 ? 's' : ''}
          </span>
        )}
      </span>
      {capacStatus && (
        <span style={{ fontSize: 9, fontWeight: 900, color: capacStatus.color, lineHeight: 1.25 }}>
          {capacStatus.label}
        </span>
      )}
      {tooltipPosition &&
        createPortal(
          <ActionTooltip
            position={tooltipPosition}
            labels={pendingActionLabels}
            capacDetail={capacStatus?.detail}
          />,
          document.body,
        )}
    </span>
  );
}

function ActionTooltip({ position, labels, capacDetail }) {
  return (
    <span
      className="queue-action-tooltip"
      role="tooltip"
      style={{
        left: position.left,
        top: position.top,
        transform: position.placement === 'above' ? 'translateY(-100%)' : 'none',
      }}
    >
      <span className="queue-action-tooltip__title">Actions à réaliser</span>
      {labels.length > 0 && (
        <span className="queue-action-tooltip__list">
          {labels.map((label) => (
            <span key={label}>• {label}</span>
          ))}
        </span>
      )}
      {capacDetail && <span className="queue-action-tooltip__note">{capacDetail}</span>}
    </span>
  );
}

function DossierButton({ row, onNavigateToRequest }) {
  const disabled = !onNavigateToRequest;
  return (
    <td style={{ textAlign: 'right', padding: '11px 12px 11px 8px' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onNavigateToRequest?.(row.sub.id, row.req.id)}
        style={{
          color: disabled ? 'var(--text-muted)' : 'var(--accent)',
          fontSize: 11,
          fontWeight: 800,
          background: 'none',
          border: 'none',
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        {actionLabel(row)} →
      </button>
    </td>
  );
}

function EmptyRow({ label }) {
  return (
    <tr>
      <td
        colSpan={13}
        style={{ textAlign: 'center', padding: 42, color: 'var(--text-muted)', fontSize: 13 }}
      >
        {label}
      </td>
    </tr>
  );
}

function sortLabel(sort) {
  if (sort.field === 'deadline') return 'échéance';
  if (sort.field === 'capacity') return 'puissance';
  if (sort.field === 'customer') return 'demandeur';
  if (sort.field === 'fifoRank') return 'rang FIFO';
  return 'priorité';
}

export function QueueCockpitTable({
  displayedRows,
  filters,
  sort,
  activeStepConfig,
  onOpenMenu,
  onNavigate,
  onNavigateToRequest,
}) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{ width: 9, height: 9, borderRadius: 999, background: activeStepConfig.color }}
        />
        <p style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>
          {activeStepConfig.label}
        </p>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Tri {sortLabel(sort)} {sort.direction === 'asc' ? 'ascendant' : 'descendant'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          {displayedRows.length} ligne(s)
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1380 }}>
          <TableHeader filters={filters} sort={sort} onOpenMenu={onOpenMenu} />
          <tbody>
            {displayedRows.length === 0 && (
              <EmptyRow label="Aucune demande ne correspond à cette vue." />
            )}
            {displayedRows.map((row, i) => {
              const step = STEP_BY_KEY[row.stepKey] || STEP_BY_KEY.to_complete;
              return (
                <tr
                  key={row.id}
                  className="data-row stagger-item"
                  style={{
                    animationDelay: `${i * 10}ms`,
                    boxShadow: `inset 3px 0 0 ${step.color}`,
                    opacity: row.isClosed ? 0.62 : 1,
                  }}
                >
                  <PriorityCell row={row} />
                  <FifoRankCell row={row} />
                  <SubstationCell row={row} onNavigate={onNavigate} />
                  <td style={{ padding: '11px 10px' }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 12,
                          color: row.isClosed ? 'var(--text-muted)' : 'var(--text-primary)',
                        }}
                      >
                        {row.customerName}
                      </span>
                      <Tag v={row.type} />
                    </div>
                    {row.reference && (
                      <div
                        style={{
                          fontSize: 9,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                          marginTop: 2,
                        }}
                      >
                        {row.reference}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', padding: '11px 8px' }}>
                    <StepBadge row={row} />
                  </td>
                  <td style={{ padding: '11px 10px' }}>
                    <ActionCell row={row} />
                  </td>
                  <td style={{ textAlign: 'center', padding: '11px 8px' }}>
                    <DirectionChip direction={row.direction} />
                  </td>
                  <PowerCell row={row} />
                  <ConstraintConditionCell row={row} />
                  <ReservationCell row={row} />
                  <DecisionCell row={row} />
                  <DeadlineCell row={row} />
                  <DossierButton row={row} onNavigateToRequest={onNavigateToRequest} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
