/**
 * EditRequestPanel.jsx — v2.0
 * Slimmed: DecisionExplanationBlock + GrdResponseSection extracted.
 * Original: 589 lines → Now: ~310 lines
 */
import React, { useState, useMemo } from 'react';
import { REQ_TYPES, REQ_STATUSES } from '../../../constants/index.js';
import { safeNum } from '../../../utils/numbers.js';
import { useProjects } from '../../App.jsx';
import { f1, statusLabel, uid } from '../../../utils/format.js';
import { FormRow, Section, DetailInjEditor, DetailPrevEditor } from '../../shared/forms.jsx';
import { ModalShell } from '../../shared/ModalShell.jsx';
import { GrdResponseSection } from './components/GrdResponseSection.jsx';

const REQ_DEFAULTS_NEW = {
  name: '', refProjet: '', type: 'industriel', status: 'en_étude',
  yearSouhaitee: new Date().getFullYear() + 2,
  dateDepot: new Date().toISOString().slice(0, 10),
  dateOffre: null, reservationMonths: 18, dateMES: '', raccordementDate: '',
  client: { prelevFerme: '', prelevFlexible: '', injFerme: '', injFlexible: '',
    detailInjection: [], detailPrelevement: [] },
  grd: null, decisionGRD: '', noteDecision: '',
};

export function EditRequestPanel({ item, subName, sub, onSave, onClose, onArchive }) {
  const isNew = !item?.id;
  const projects = useProjects();

  const initial = useMemo(() => {
    if (!item) return { ...REQ_DEFAULTS_NEW, dateDepot: new Date().toISOString().slice(0, 10) };
    const base = { ...item };
    if (!base.client) {
      base.client = {
        prelevFerme: base.powerRigid || 0, prelevFlexible: base.powerPilotable || 0,
        injFerme: base.injectionRigide || 0, injFlexible: base.injectionPilotable || 0,
        detailInjection: [], detailPrelevement: [],
      };
    }
    if (!base.yearSouhaitee) base.yearSouhaitee = base.year || 2026;
    return base;
  }, [item]);

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setClient = (k, v) => setForm(f => ({ ...f, client: { ...f.client, [k]: v } }));

  const [hasGrd, setHasGrd] = useState(!!initial.grd);
  const [grdForm, setGrdForm] = useState(initial.grd || {
    prelevFerme: '', prelevFlexible: '', injFerme: '', injFlexible: '',
    decisionGRD: 'acceptable', noteDecision: '',
  });
  const setGrd = (k, v) => setGrdForm(g => ({ ...g, [k]: v }));

  // Validation
  const clientPrelevTotal = (parseFloat(form.client?.prelevFerme) || 0) + (parseFloat(form.client?.prelevFlexible) || 0);
  const clientInjTotal    = (parseFloat(form.client?.injFerme) || 0) + (parseFloat(form.client?.injFlexible) || 0);
  const grdPrelevTotal    = (parseFloat(grdForm.prelevFerme) || 0) + (parseFloat(grdForm.prelevFlexible) || 0);
  const grdInjTotal       = (parseFloat(grdForm.injFerme) || 0) + (parseFloat(grdForm.injFlexible) || 0);
  const grdPrelevDelta    = +(grdPrelevTotal - clientPrelevTotal).toFixed(2);
  const grdInjDelta       = +(grdInjTotal - clientInjTotal).toFixed(2);
  const grdPrelevOk       = Math.abs(grdPrelevDelta) < 0.05 && (parseFloat(grdForm.prelevFerme) || 0) <= (parseFloat(form.client?.prelevFerme) || 0) + 0.01;
  const grdInjOk          = Math.abs(grdInjDelta) < 0.05;

  const enableGrd = () => {
    if (!hasGrd) {
      setGrdForm(g => ({
        ...g,
        prelevFerme: form.client?.prelevFerme || 0,
        prelevFlexible: form.client?.prelevFlexible || 0,
        injFerme: form.client?.injFerme || 0,
        injFlexible: form.client?.injFlexible || 0,
      }));
      if (!form.dateOffre) set('dateOffre', new Date().toISOString().slice(0, 10));
    }
    setHasGrd(h => !h);
  };

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = 'Champ requis';
    const pF = parseFloat(form.client?.prelevFerme) || 0, pP = parseFloat(form.client?.prelevFlexible) || 0;
    const iF = parseFloat(form.client?.injFerme) || 0, iP = parseFloat(form.client?.injFlexible) || 0;
    if (pF + pP + iF + iP === 0) e.power = 'Au moins un champ de puissance doit être renseigné';
    if (hasGrd) {
      if (!grdPrelevOk) e.grdPrelev = `Total GRD (${grdPrelevTotal.toFixed(1)}) ≠ total client (${clientPrelevTotal.toFixed(1)}) ou ferme GRD > ferme client`;
      if (clientInjTotal > 0 && !grdInjOk) e.grdInj = `Total injection GRD (${grdInjTotal.toFixed(1)}) ≠ total client (${clientInjTotal.toFixed(1)})`;
    }
    return e;
  };

  const handleSave = () => {
    const e = validate(); setErrors(e);
    if (Object.keys(e).length > 0) return;
    const savedGrd = hasGrd ? {
      prelevFerme: parseFloat(grdForm.prelevFerme) || 0, prelevFlexible: parseFloat(grdForm.prelevFlexible) || 0,
      injFerme: parseFloat(grdForm.injFerme) || 0, injFlexible: parseFloat(grdForm.injFlexible) || 0,
      decisionGRD: grdForm.decisionGRD, noteDecision: grdForm.noteDecision || '',
    } : null;
    const newStatus = hasGrd && !form.grd ? 'étudiée' : form.status;
    const newDateOffre = hasGrd && !form.grd && !form.dateOffre ? new Date().toISOString().slice(0, 10) : form.dateOffre;
    onSave({
      ...form, yearSouhaitee: parseInt(form.yearSouhaitee) || new Date().getFullYear() + 2,
      year: parseInt(form.yearSouhaitee) || new Date().getFullYear() + 2,
      client: {
        ...form.client, prelevFerme: parseFloat(form.client?.prelevFerme) || 0,
        prelevFlexible: parseFloat(form.client?.prelevFlexible) || 0,
        injFerme: parseFloat(form.client?.injFerme) || 0, injFlexible: parseFloat(form.client?.injFlexible) || 0,
      },
      grd: savedGrd, status: newStatus, dateOffre: newDateOffre,
      dateMES: form.dateMES || null, raccordementDate: form.raccordementDate || null,
    });
  };

  return (
    <ModalShell
      title={isNew ? 'Nouvelle demande' : 'Modifier la demande'}
      subtitle={`${subName}${form.refProjet ? ` · ${form.refProjet}` : ''}`}
      onClose={onClose} wide
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" onClick={handleSave}>{isNew ? '+ Créer' : '✓ Enregistrer'}</button>
      </>}
    >
      {/* Section 1: Identification */}
      <Section title="Identification" color="var(--navy)">
        <div className="space-y-3">
          <FormRow label="Intitulé du projet" error={errors.name}>
            <input value={form.name || ''} onChange={e => set('name', e.target.value)}
              placeholder="Ex : Parc logistique Bierset Ph.3" className="input-field" />
          </FormRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormRow label="Référence (AMT / CRM)">
              <input value={form.refProjet || ''} onChange={e => set('refProjet', e.target.value)}
                placeholder="AMT-2026-0XXX" className="input-field" />
            </FormRow>
            <FormRow label="Type de client">
              <select value={form.type || 'industriel'} onChange={e => set('type', e.target.value)} className="input-field">
                {REQ_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FormRow>
            <FormRow label="Statut">
              <select value={form.status || 'en_étude'} onChange={e => set('status', e.target.value)} className="input-field">
                {REQ_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </FormRow>
            <FormRow label="Année de raccordement souhaitée">
              <select value={form.yearSouhaitee || 2026} onChange={e => set('yearSouhaitee', parseInt(e.target.value))} className="input-field">
                {Array.from({ length: 12 }, (_, i) => 2025 + i).map(y => <option key={y}>{y}</option>)}
              </select>
            </FormRow>
          </div>
        </div>
      </Section>

      {/* Section 2: Client request */}
      <Section title="Demande client" badge={errors.power ? '⚠ Puissance requise' : null} color="#1e40af">
        <div className="space-y-4">
          {errors.power && <p className="form-error">{errors.power}</p>}
          {/* Withdrawals */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#dc2626', marginBottom: 8 }}>
              Prélèvements (charge réseau ↓)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ borderLeft: '3px solid #dc2626', paddingLeft: 10 }}>
                <FormRow label="Ferme / Permanent (MVA)">
                  <input type="number" step=".1" min="0" value={form.client?.prelevFerme || ''}
                    onChange={e => setClient('prelevFerme', e.target.value)} className="input-field" placeholder="0.0" />
                </FormRow>
              </div>
              <div style={{ borderLeft: '3px solid #f97316', paddingLeft: 10 }}>
                <FormRow label="Flexible / Pilotable (MVA)">
                  <input type="number" step=".1" min="0" value={form.client?.prelevFlexible || ''}
                    onChange={e => setClient('prelevFlexible', e.target.value)} className="input-field" placeholder="0.0" />
                </FormRow>
              </div>
            </div>
            <div style={{ marginTop: 10, padding: 10, background: 'var(--slate)', borderRadius: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Détail par usage (somme = total prélèvement)
              </p>
              <DetailPrevEditor items={form.client?.detailPrelevement || []} onChange={v => setClient('detailPrelevement', v)} />
            </div>
          </div>
          {/* Injections */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#059669', marginBottom: 8 }}>
              Injections (production réseau ↑)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ borderLeft: '3px solid #10b981', paddingLeft: 10 }}>
                <FormRow label="Garanti / Ferme (MVA)">
                  <input type="number" step=".1" min="0" value={form.client?.injFerme || ''}
                    onChange={e => setClient('injFerme', e.target.value)} className="input-field" placeholder="0.0" />
                </FormRow>
              </div>
              <div style={{ borderLeft: '3px solid #34d399', paddingLeft: 10 }}>
                <FormRow label="Curtailable / Pilotable (MVA)">
                  <input type="number" step=".1" min="0" value={form.client?.injFlexible || ''}
                    onChange={e => setClient('injFlexible', e.target.value)} className="input-field" placeholder="0.0" />
                </FormRow>
              </div>
            </div>
            <div style={{ marginTop: 10, padding: 10, background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Détail par source (PV, éolien, cogen…)
              </p>
              <DetailInjEditor items={form.client?.detailInjection || []} onChange={v => setClient('detailInjection', v)} />
            </div>
          </div>
          {/* Coherence check */}
          {(() => {
            const sumPrevDetail = (form.client?.detailPrelevement || []).reduce((s, d) => s + (parseFloat(d.puissance) || 0), 0);
            const sumInjDetail = (form.client?.detailInjection || []).reduce((s, d) => s + (parseFloat(d.puissanceContractuelle) || 0), 0);
            const ecartPrelev = Math.abs(sumPrevDetail - clientPrelevTotal);
            const ecartInj = Math.abs(sumInjDetail - clientInjTotal);
            const hasDetail = (form.client?.detailPrelevement || []).length > 0 || (form.client?.detailInjection || []).length > 0;
            if (!hasDetail || (ecartPrelev < 0.1 && ecartInj < 0.1)) return null;
            return (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 8, padding: '10px 14px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>⚠ Incohérence détail / totaux</p>
                {ecartPrelev >= 0.1 && <p style={{ fontSize: 11, color: '#7f1d1d' }}>Prélèvements : somme détail = {f1(sumPrevDetail)} MVA ≠ total = {f1(clientPrelevTotal)} MVA</p>}
                {ecartInj >= 0.1 && <p style={{ fontSize: 11, color: '#7f1d1d' }}>Injections : somme détail = {f1(sumInjDetail)} MVA ≠ total = {f1(clientInjTotal)} MVA</p>}
              </div>
            );
          })()}
          {/* Client summary */}
          {(clientPrelevTotal > 0 || clientInjTotal > 0) && (
            <div style={{ background: 'var(--navy-10)', border: '1px solid var(--navy-20)', borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--accent)', marginBottom: 6 }}>Bilan demande client</p>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
                {clientPrelevTotal > 0 && <>
                  <span>Prélèvement total : <strong className="mono">{clientPrelevTotal.toFixed(1)} MVA</strong></span>
                </>}
                {clientInjTotal > 0 && <>
                  <span style={{ color: '#059669' }}>Injection totale : <strong className="mono">{clientInjTotal.toFixed(1)} MVA</strong></span>
                </>}
                {clientPrelevTotal > 0 && clientInjTotal > 0 && (
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                    Impact net : <span className="mono">{(clientPrelevTotal - clientInjTotal).toFixed(1)} MVA</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Section 3: GRD Response */}
      <GrdResponseSection
        sub={sub} form={form} projects={projects}
        hasGrd={hasGrd} grdForm={grdForm} setGrd={(k, v) => setGrd(k, v)}
        enableGrd={enableGrd} set={set}
        clientPrelevTotal={clientPrelevTotal} clientInjTotal={clientInjTotal}
        grdPrelevTotal={grdPrelevTotal} grdInjTotal={grdInjTotal}
        grdPrelevOk={grdPrelevOk} grdInjOk={grdInjOk}
        grdPrelevDelta={grdPrelevDelta} grdInjDelta={grdInjDelta}
        errors={errors}
      />

      {/* Section 4: Queue & Reservation */}
      <Section title="File d'attente & Réservation" color="#7c3aed" defaultOpen={true}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormRow label="Date de dépôt">
            <input type="date" value={form.dateDepot || ''} onChange={e => set('dateDepot', e.target.value)} className="input-field" />
          </FormRow>
          {hasGrd && (
            <FormRow label="Date de l'offre GRD" hint="Auto-remplie à la 1ère étude, modifiable">
              <input type="date" value={form.dateOffre || ''} onChange={e => set('dateOffre', e.target.value)} className="input-field" />
            </FormRow>
          )}
          <FormRow label="Durée de réservation (mois)" hint="Délai de validité de l'offre">
            <input type="number" min="1" max="60" value={form.reservationMonths || 18}
              onChange={e => set('reservationMonths', parseInt(e.target.value) || 18)} className="input-field" />
          </FormRow>
          <FormRow label="Date MES promise">
            <input type="date" value={form.dateMES || ''} onChange={e => set('dateMES', e.target.value)} className="input-field" />
          </FormRow>
          {(form.status === 'raccordée' || form.status === 'raccordé') && (
            <FormRow label="Date de raccordement effective">
              <input type="date" value={form.raccordementDate || ''} onChange={e => set('raccordementDate', e.target.value)} className="input-field" />
            </FormRow>
          )}
        </div>
      </Section>

      {/* Archive buttons */}
      {!isNew && (form.status === 'étudiée') && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 0' }}>
          <button type="button" onClick={() => onArchive && onArchive('raccordée', form)}
            style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1.5px solid #a7f3d0', background: '#f0fdf4', color: '#065f46', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✓ Raccorder & Archiver
          </button>
          <button type="button" onClick={() => onArchive && onArchive('annulée', form)}
            style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ Annuler & Archiver
          </button>
        </div>
      )}
    </ModalShell>
  );
}
