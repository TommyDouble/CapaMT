/**
 * CaseTimeline — Calendrier chronologique du dossier.
 * Les jalons automatiques viennent du modèle dossier canonique; les jalons manuels restent
 * éditables par l'agent pour les événements non structurés.
 */
import React, { useState } from 'react';
import { fmtShortDate, uid } from '../../../../utils/format.js';
import { getExpiryInfo } from '../../../../engines/queue.js';
import { getAssessment, getCustomer, getOffer } from '../../../../engines/requestModel.js';

const TODAY = () => new Date().toISOString().slice(0, 10);

const STEP_ORDER = {
  request: 10,
  ready: 20,
  'study-start': 30,
  'capac-sent': 40,
  'capac-received': 50,
  'study-done': 60,
  'offer-formulated': 70,
  'offer-accepted': 80,
  'offer-expired': 85,
  'offer-cancelled': 85,
  'reservation-expiry': 90,
  'mes-desired': 100,
  connected: 110,
};

function dateOnly(value) {
  if (!value) return '';
  if (typeof value === 'number') return `${value}-01-01`;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value);
  if (/^\d{4}$/.test(str)) return `${str}-01-01`;
  return str.slice(0, 10);
}

function hasTime(value) {
  return typeof value === 'string' && /T|\d{2}:\d{2}/.test(value);
}

function timeStamp(value) {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
}

function displayDate(step) {
  if (step.displayDate) return step.displayDate;
  if (step.hasPreciseTime && step.date) {
    return new Date(step.originalDate).toLocaleString('fr-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return fmtShortDate(step.date);
}

function statusForDate(date, done = true) {
  if (!date) return 'pending';
  if (done) return 'done';
  return date <= TODAY() ? 'active' : 'future';
}

function addStep(steps, step) {
  if (!step.date && !step.keepWithoutDate) return;
  const normalizedDate = dateOnly(step.date);
  const invalidFuture = Boolean(step.actual && normalizedDate && normalizedDate > TODAY());
  const effectiveSortDate = invalidFuture ? TODAY() : normalizedDate;
  steps.push({
    status: 'done',
    color: '#2563eb',
    fixed: true,
    ...step,
    date: normalizedDate,
    originalDate: step.date,
    sortDate: effectiveSortDate,
    sortTime: hasTime(step.date) && !invalidFuture ? timeStamp(step.date) : Number.POSITIVE_INFINITY,
    hasPreciseTime: hasTime(step.date),
    invalidFuture,
    status: invalidFuture ? 'warn' : step.status || 'done',
    order: step.order ?? STEP_ORDER[step.id] ?? 999,
  });
}

function desiredCommissioning(req, customer) {
  return customer.requested?.desiredCommissioningDate
    || customer.requested?.year
    || '';
}

function buildMilestones(req) {
  const customer = getCustomer(req);
  const assessment = getAssessment(req);
  const offer = getOffer(req);
  const expiry = getExpiryInfo(req);
  const steps = [];

  addStep(steps, {
    id: 'request',
    label: 'Date de demande',
    date: customer.requestDate,
    status: customer.requestDate ? 'done' : 'pending',
    keepWithoutDate: true,
    actual: true,
    color: '#1d4ed8',
  });

  addStep(steps, {
    id: 'ready',
    label: 'Complétude / priorité FIFO',
    date: customer.readyForStudyAt,
    actual: true,
    color: '#2563eb',
  });

  addStep(steps, {
    id: 'study-start',
    label: 'Prise en charge étude',
    date: assessment.takenInChargeAt,
    actual: true,
    color: '#0369a1',
  });

  addStep(steps, {
    id: 'capac-sent',
    label: 'CAPAC demandé',
    date: assessment.capac?.sentAt,
    actual: true,
    color: '#d97706',
  });

  addStep(steps, {
    id: 'capac-received',
    label: 'CAPAC reçu',
    date: assessment.capac?.receivedAt,
    actual: true,
    color: '#0f766e',
  });

  addStep(steps, {
    id: 'study-done',
    label: 'Étude finalisée',
    date: assessment.assessedAt,
    actual: true,
    color: '#047857',
  });

  addStep(steps, {
    id: 'offer-formulated',
    label: 'Offre formulée',
    date: offer.formulatedAt,
    actual: true,
    color: '#0369a1',
  });

  if (offer.status === 'offer_expired') {
    addStep(steps, {
      id: 'offer-expired',
      label: 'Offre expirée',
      date: offer.expiredAt || expiry?.date,
      status: 'danger',
      actual: true,
      color: '#dc2626',
    });
  } else if (offer.status === 'offer_cancelled') {
    addStep(steps, {
      id: 'offer-cancelled',
      label: 'Offre annulée',
      date: offer.cancelledAt,
      status: 'danger',
      actual: true,
      color: '#6b7280',
    });
  } else if (offer.status === 'offer_accepted' || offer.status === 'offer_connected') {
    addStep(steps, {
      id: 'offer-accepted',
      label: 'Offre acceptée',
      date: offer.acceptedAt,
      actual: true,
      color: '#059669',
    });
  }

  if (offer.status !== 'offer_expired' && expiry?.date && ['bientôt', 'expiré'].includes(expiry.status)) {
    addStep(steps, {
      id: 'reservation-expiry',
      label: 'Expiration réservation',
      date: expiry.date,
      status: expiry.status === 'expiré' ? 'danger' : 'warn',
      color: expiry.status === 'expiré' ? '#dc2626' : '#d97706',
    });
  }

  const desiredMes = desiredCommissioning(req, customer);
  addStep(steps, {
    id: 'mes-desired',
    label: 'MES souhaitée',
    date: desiredMes,
    displayDate: /^\d{4}$/.test(String(desiredMes)) ? String(desiredMes) : undefined,
    status: offer.connectedAt ? 'done' : statusForDate(dateOnly(desiredMes), false),
    color: '#7c3aed',
  });

  if (offer.connectedAt) {
    addStep(steps, {
      id: 'connected',
      label: 'Raccordement réalisé',
      date: offer.connectedAt,
      actual: true,
      color: '#059669',
    });
  }

  (req.milestones || []).forEach(m => {
    addStep(steps, {
      id: m.id || uid(),
      label: m.label,
      date: m.date,
      status: m.date && dateOnly(m.date) <= TODAY() ? 'done' : 'future',
      color: '#6d28d9',
      note: m.notes,
      fixed: false,
    });
  });

  return steps.sort((a, b) => {
    if (!a.sortDate) return 1;
    if (!b.sortDate) return -1;
    const byDate = a.sortDate.localeCompare(b.sortDate);
    if (byDate) return byDate;
    if (a.sortTime !== b.sortTime && Number.isFinite(a.sortTime) && Number.isFinite(b.sortTime)) {
      return a.sortTime - b.sortTime;
    }
    if (a.order !== b.order) return a.order - b.order;
    return String(a.label).localeCompare(String(b.label), 'fr');
  });
}

function MilestoneNode({ step }) {
  const dotColor = step.status === 'danger' ? '#dc2626'
    : step.status === 'warn' ? '#d97706'
    : step.status === 'pending' ? 'var(--border-strong)'
    : step.color;
  const dotBg = step.status === 'done' ? step.color
    : step.status === 'danger' ? '#fef2f2'
    : step.status === 'warn' ? '#fffbeb'
    : 'var(--bg-surface)';
  const textColor = step.status === 'future' ? 'var(--text-muted)' : step.color;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', minWidth: 104, maxWidth: 130 }}>
      <div style={{ fontSize: 10, fontWeight: 800, textAlign: 'center', color: textColor, marginBottom: 6, lineHeight: 1.25 }}>
        {step.label}
      </div>
      <div style={{
        width: 13,
        height: 13,
        borderRadius: '50%',
        background: dotBg,
        border: `2px solid ${dotColor}`,
        boxShadow: step.status === 'active' ? `0 0 0 3px ${dotColor}30` : 'none',
      }}>
        {step.status === 'done' && (
          <svg width="9" height="9" viewBox="0 0 9 9" style={{ display: 'block' }}>
            <polyline points="1,4.5 3.4,7 8,1.5" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 5, textAlign: 'center' }}>
        {displayDate(step)}
      </div>
      {step.invalidFuture && (
        <div style={{ fontSize: 9, color: 'var(--orange)', textAlign: 'center', marginTop: 2, maxWidth: 120, lineHeight: 1.25 }}>
          Date future à corriger
        </div>
      )}
      {step.note && (
        <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', marginTop: 2, maxWidth: 120, lineHeight: 1.3, fontStyle: 'italic' }}>
          {step.note}
        </div>
      )}
    </div>
  );
}

export function CaseTimeline({ req, sub, onUpdate }) {
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ label: '', date: '', notes: '' });
  const milestones = buildMilestones(req);

  const handleAddMilestone = () => {
    if (!newMilestone.label.trim()) return;
    const updated = {
      ...req,
      milestones: [...(req.milestones || []), { id: uid(), ...newMilestone, label: newMilestone.label.trim() }],
    };
    const reqs = sub.connectionRequests.map(r => r.id === req.id ? updated : r);
    onUpdate({ ...sub, connectionRequests: reqs });
    setShowAddMilestone(false);
    setNewMilestone({ label: '', date: '', notes: '' });
  };

  const handleRemoveMilestone = milestoneId => {
    const updated = {
      ...req,
      milestones: (req.milestones || []).filter(m => m.id !== milestoneId),
    };
    const reqs = sub.connectionRequests.map(r => r.id === req.id ? updated : r);
    onUpdate({ ...sub, connectionRequests: reqs });
  };

  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--accent)' }}>
            Calendrier du dossier
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            Dates clés réelles, échéances et jalons manuels.
          </p>
        </div>
        <button type="button" onClick={() => setShowAddMilestone(s => !s)}
          style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px dashed var(--accent)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Ajouter un jalon manuel
        </button>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, minWidth: Math.max(1, milestones.length) * 118 }}>
          {milestones.map((step, i) => (
            <React.Fragment key={step.id}>
              <div style={{ position: 'relative' }}>
                <MilestoneNode step={step} />
                {!step.fixed && (
                  <button type="button" onClick={() => handleRemoveMilestone(step.id)}
                    style={{ position: 'absolute', top: -2, right: -4, fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                    title="Supprimer ce jalon">
                    ×
                  </button>
                )}
              </div>
              {i < milestones.length - 1 && (
                <div style={{ flex: 1, height: 2, background: 'var(--border)', alignSelf: 'center', marginTop: -18, minWidth: 20, opacity: 0.65 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {showAddMilestone && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--slate)', borderRadius: 8, border: '1px dashed var(--border)' }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>Nouveau jalon manuel</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
            <input
              placeholder="Libellé *"
              value={newMilestone.label}
              onChange={e => setNewMilestone(m => ({ ...m, label: e.target.value }))}
              className="input-field"
              style={{ fontSize: 12 }}
            />
            <input
              type="date"
              value={newMilestone.date}
              onChange={e => setNewMilestone(m => ({ ...m, date: e.target.value }))}
              className="input-field"
              style={{ fontSize: 12 }}
            />
            <input
              placeholder="Note (optionnel)"
              value={newMilestone.notes}
              onChange={e => setNewMilestone(m => ({ ...m, notes: e.target.value }))}
              className="input-field"
              style={{ fontSize: 12 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={handleAddMilestone} className="btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}>
              Ajouter
            </button>
            <button type="button" onClick={() => setShowAddMilestone(false)} className="btn-secondary" style={{ fontSize: 11, padding: '4px 12px' }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
