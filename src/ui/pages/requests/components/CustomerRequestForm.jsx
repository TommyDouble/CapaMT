import React, { useState } from 'react';
import { INJ_SOURCES, PREV_USAGES, REQ_TYPES } from '../../../../constants/index.js';
import { f1, uid } from '../../../../utils/format.js';
import { safeNum } from '../../../../utils/numbers.js';
import {
  computePowerBreakdownSummary,
  normalizeRequest,
  getCustomer,
  normalizePowerBreakdown,
} from '../../../../engines/requestModel.js';
import { FormRow, Section } from '../../../shared/forms.jsx';
import { ModalShell } from '../../../shared/ModalShell.jsx';

export function CustomerRequestForm({ req, sub, onSave, onClose }) {
  const customer = getCustomer(req || { targetSubstationId: sub.id });
  const requested = customer.requested || {};
  const initialPowerBreakdown = normalizePowerBreakdown(customer.powerBreakdown, requested);
  const [form, setForm] = useState({
    name: customer.client?.name || '',
    reference: customer.client?.reference || '',
    type: customer.client?.type || 'industriel',
    siteLabel: customer.site?.label || '',
    requestDate: customer.requestDate || '',
    readyForStudyAt: customer.readyForStudyAt || '',
    load: requested.load || '',
    injection: requested.injection || '',
    year: requested.year || 2027,
    desiredCommissioningDate: requested.desiredCommissioningDate || '',
    address: {
      street: customer.site?.address?.street || '',
      number: customer.site?.address?.number || '',
      postalCode: customer.site?.address?.postalCode || '',
      city: customer.site?.address?.city || customer.site?.commune || '',
      country: customer.site?.address?.country || 'Belgique',
      freeform: customer.site?.address?.freeform || '',
    },
    coordinates: {
      lat: customer.site?.coordinates?.lat || '',
      lng: customer.site?.coordinates?.lng || '',
      source: customer.site?.coordinates?.source || 'manual',
    },
    powerBreakdown: initialPowerBreakdown,
  });
  const [errors, setErrors] = useState({});
  const [addressWizardOpen, setAddressWizardOpen] = useState(false);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const setAddress = (key, value) => setForm(prev => ({ ...prev, address: { ...prev.address, [key]: value } }));
  const setCoordinates = (key, value) => setForm(prev => ({ ...prev, coordinates: { ...prev.coordinates, [key]: value } }));
  const setPowerBreakdown = patch => setForm(prev => ({
    ...prev,
    powerBreakdown: typeof patch === 'function' ? patch(prev.powerBreakdown) : { ...prev.powerBreakdown, ...patch },
  }));

  const summary = computePowerBreakdownSummary(form.powerBreakdown, form);
  const effectiveLoad = form.powerBreakdown.loadMode === 'AUTO' ? summary.loadSum : safeNum(form.load, 0);
  const effectiveInjection = form.powerBreakdown.injectionMode === 'AUTO' ? summary.injectionSum : safeNum(form.injection, 0);

  const handleSave = () => {
    const powerBreakdown = normalizePowerBreakdown(form.powerBreakdown, form);
    const saveSummary = computePowerBreakdownSummary(powerBreakdown, form);
    const load = powerBreakdown.loadMode === 'AUTO' ? saveSummary.loadSum : safeNum(form.load, 0);
    const injection = powerBreakdown.injectionMode === 'AUTO' ? saveSummary.injectionSum : safeNum(form.injection, 0);
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Champ requis';
    if (!form.requestDate) nextErrors.requestDate = 'Date de demande requise';
    if (load + injection <= 0) nextErrors.power = 'Au moins une puissance est requise';
    if (!form.desiredCommissioningDate && !form.year) nextErrors.date = 'Date ou année requise';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const completeAfterSave = Boolean(form.name.trim() && form.requestDate && sub.id && load + injection > 0 && (form.desiredCommissioningDate || form.year));
    const readyForStudyAt = form.readyForStudyAt || (completeAfterSave ? form.requestDate : customer.readyForStudyAt);
    const updated = normalizeRequest({
      ...(req || {}),
      id: req?.id || uid(),
      customer: {
        ...customer,
        requestDate: form.requestDate,
        readyForStudyAt,
        client: {
          name: form.name.trim(),
          reference: form.reference.trim(),
          type: form.type,
        },
        site: {
          ...customer.site,
          label: form.siteLabel.trim(),
          commune: form.address.city.trim(),
          address: {
            ...form.address,
            street: form.address.street.trim(),
            number: form.address.number.trim(),
            postalCode: form.address.postalCode.trim(),
            city: form.address.city.trim(),
            country: form.address.country.trim() || 'Belgique',
            freeform: form.address.freeform.trim(),
          },
          coordinates: {
            lat: form.coordinates.lat,
            lng: form.coordinates.lng,
            source: form.coordinates.lat || form.coordinates.lng ? 'manual' : form.coordinates.source,
          },
        },
        requested: {
          ...requested,
          load,
          injection,
          total: load + injection,
          year: parseInt(form.year, 10) || 2027,
          desiredCommissioningDate: form.desiredCommissioningDate,
        },
        powerBreakdown,
        targetSubstationId: sub.id,
      },
    }, sub.id);
    onSave(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Section title="Identification" color="var(--accent)" defaultOpen>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormRow label="Client / projet" error={errors.name}>
            <input className="input-field" value={form.name} onChange={e => set('name', e.target.value)} />
          </FormRow>
          <FormRow label="Référence">
            <input className="input-field" value={form.reference} onChange={e => set('reference', e.target.value)} />
          </FormRow>
          <FormRow label="Type">
            <select className="input-field" value={form.type} onChange={e => set('type', e.target.value)}>
              {REQ_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </FormRow>
          <FormRow label="Site">
            <input className="input-field" value={form.siteLabel} onChange={e => set('siteLabel', e.target.value)} />
          </FormRow>
        </div>
      </Section>

      <Section title="Dates et priorité" color="var(--accent)" defaultOpen>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormRow label="Date de demande" error={errors.requestDate} hint="Date audit de réception de la demande client.">
            <input className="input-field" type="date" value={form.requestDate || ''} onChange={e => set('requestDate', e.target.value)} />
          </FormRow>
          <FormRow label="Date de complétude / recevabilité" hint="Détermine la position FIFO; auto-remplie si vide.">
            <input className="input-field" type="date" value={form.readyForStudyAt?.slice?.(0, 10) || ''} onChange={e => set('readyForStudyAt', e.target.value)} />
          </FormRow>
          <FormRow label="Année souhaitée" error={errors.date}>
            <input className="input-field" type="number" min="2025" max="2040" value={form.year} onChange={e => set('year', e.target.value)} />
          </FormRow>
          <FormRow label="Date MES souhaitée">
            <input className="input-field" type="date" value={form.desiredCommissioningDate || ''} onChange={e => set('desiredCommissioningDate', e.target.value)} />
          </FormRow>
        </div>
      </Section>

      <Section title="Site / adresse" color="var(--green)" defaultOpen={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Adresse structurée locale, sans géocodage externe.
          </p>
          <button className="btn-secondary" type="button" onClick={() => setAddressWizardOpen(true)} style={{ fontSize: 11, padding: '5px 10px' }}>
            Wizard adresse
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr .6fr .7fr 1fr', gap: 10 }}>
          <FormRow label="Rue">
            <input className="input-field" value={form.address.street} onChange={e => setAddress('street', e.target.value)} />
          </FormRow>
          <FormRow label="N°">
            <input className="input-field" value={form.address.number} onChange={e => setAddress('number', e.target.value)} />
          </FormRow>
          <FormRow label="CP">
            <input className="input-field" value={form.address.postalCode} onChange={e => setAddress('postalCode', e.target.value)} />
          </FormRow>
          <FormRow label="Commune">
            <input className="input-field" value={form.address.city} onChange={e => setAddress('city', e.target.value)} />
          </FormRow>
          <FormRow label="Pays">
            <input className="input-field" value={form.address.country} onChange={e => setAddress('country', e.target.value)} />
          </FormRow>
          <FormRow label="Latitude">
            <input className="input-field" inputMode="decimal" value={form.coordinates.lat} onChange={e => setCoordinates('lat', e.target.value)} />
          </FormRow>
          <FormRow label="Longitude">
            <input className="input-field" inputMode="decimal" value={form.coordinates.lng} onChange={e => setCoordinates('lng', e.target.value)} />
          </FormRow>
          <FormRow label="Adresse libre">
            <input className="input-field" value={form.address.freeform} onChange={e => setAddress('freeform', e.target.value)} />
          </FormRow>
        </div>
      </Section>

      <Section title="Puissances demandées" badge={errors.power ? 'Puissance requise' : null} color="var(--prelev)" defaultOpen>
        {errors.power && <p className="form-error" style={{ marginBottom: 10 }}>⚠ {errors.power}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <PowerBreakdownEditor
            title="Prélèvement"
            kind="load"
            mode={form.powerBreakdown.loadMode}
            items={form.powerBreakdown.load}
            total={effectiveLoad}
            sum={summary.loadSum}
            delta={summary.loadDelta}
            onModeChange={mode => setPowerBreakdown(prev => ({ ...prev, loadMode: mode }))}
            onTotalChange={value => set('load', value)}
            onItemsChange={items => setPowerBreakdown(prev => ({ ...prev, load: items }))}
          />
          <PowerBreakdownEditor
            title="Injection"
            kind="injection"
            mode={form.powerBreakdown.injectionMode}
            items={form.powerBreakdown.injection}
            total={effectiveInjection}
            sum={summary.injectionSum}
            delta={summary.injectionDelta}
            onModeChange={mode => setPowerBreakdown(prev => ({ ...prev, injectionMode: mode }))}
            onTotalChange={value => set('injection', value)}
            onItemsChange={items => setPowerBreakdown(prev => ({ ...prev, injection: items }))}
          />
        </div>
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
            Résumé raccordement demandé
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
            <span>Prélèvement demandé : <strong className="mono">{f1(effectiveLoad)} MVA</strong></span>
            <span>Injection demandée : <strong className="mono">{f1(effectiveInjection)} MVA</strong></span>
            <span>Total contractuel : <strong className="mono">{f1(effectiveLoad + effectiveInjection)} MVA</strong></span>
          </div>
        </div>
      </Section>

      {addressWizardOpen && (
        <AddressWizardModal
          initialAddress={form.address}
          onClose={() => setAddressWizardOpen(false)}
          onApply={address => {
            setForm(prev => ({ ...prev, address: { ...prev.address, ...address } }));
            setAddressWizardOpen(false);
          }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" onClick={handleSave}>Enregistrer la demande</button>
      </div>
    </div>
  );
}

function PowerBreakdownEditor({ title, kind, mode, items, total, sum, delta, onModeChange, onTotalChange, onItemsChange }) {
  const isLoad = kind === 'load';
  const options = isLoad ? PREV_USAGES : INJ_SOURCES;
  const mainKey = isLoad ? 'type' : 'source';
  const add = () => onItemsChange([
    ...items,
    isLoad
      ? { id: uid(), type: 'process', label: '', powerMva: '', flexible: false }
      : { id: uid(), source: 'PV', label: '', powerMva: '', curtailable: false },
  ]);
  const setItem = (id, key, value) => onItemsChange(items.map(item => item.id === id ? { ...item, [key]: value } : item));
  const remove = id => onItemsChange(items.filter(item => item.id !== id));
  const deltaVisible = mode === 'MANUAL' && Math.abs(safeNum(delta, 0)) >= 0.05;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: isLoad ? 'var(--prelev)' : 'var(--inj)' }}>{title}</p>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
          {['AUTO', 'MANUAL'].map(value => (
            <button
              key={value}
              type="button"
              onClick={() => onModeChange(value)}
              style={{
                border: 'none',
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
                color: mode === value ? '#fff' : 'var(--text-muted)',
                background: mode === value ? 'var(--accent)' : 'var(--bg-surface)',
              }}
            >
              {value === 'AUTO' ? 'Auto' : 'Manuel'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr .8fr .75fr 26px', gap: 6, alignItems: 'center' }}>
            <select className="input-field" value={item[mainKey] || options[0]} onChange={e => setItem(item.id, mainKey, e.target.value)}>
              {options.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <input className="input-field" value={item.label || ''} placeholder="Libellé optionnel" onChange={e => setItem(item.id, 'label', e.target.value)} />
            <input className="input-field" type="number" min="0" step=".1" value={item.powerMva ?? ''} placeholder="MVA" onChange={e => setItem(item.id, 'powerMva', e.target.value)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={Boolean(isLoad ? item.flexible : item.curtailable)}
                onChange={e => setItem(item.id, isLoad ? 'flexible' : 'curtailable', e.target.checked)} />
              {isLoad ? 'Flexible' : 'Curt.'}
            </label>
            <button type="button" onClick={() => remove(item.id)} style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        ))}
      </div>

      <button type="button" onClick={add} className="btn-secondary" style={{ width: '100%', marginTop: 8, fontSize: 11, padding: '5px 10px' }}>
        + Ajouter {isLoad ? 'un usage' : 'une source'}
      </button>

      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'start' }}>
        <FormRow label="Somme composants">
          <input className="input-field" disabled value={f1(sum)} />
        </FormRow>
        <FormRow label="Total demandé" hint={mode === 'AUTO' ? 'Calculé automatiquement' : 'Override contractuel autorisé'}>
          <input className="input-field" type="number" min="0" step=".1" disabled={mode === 'AUTO'} value={mode === 'AUTO' ? f1(sum) : total || ''} onChange={e => onTotalChange(e.target.value)} />
        </FormRow>
      </div>

      {deltaVisible && (
        <p style={{ marginTop: 8, padding: 8, borderRadius: 6, background: 'var(--amber-dim)', color: 'var(--amber)', fontSize: 11, lineHeight: 1.35 }}>
          Écart assumé: total demandé {f1(total)} MVA vs composants {f1(sum)} MVA ({delta > 0 ? '+' : ''}{f1(delta)} MVA).
        </p>
      )}
    </div>
  );
}

function parseAddressFreeform(text) {
  const parts = String(text || '').split(/[,\n]+/).map(p => p.trim()).filter(Boolean);
  const first = parts[0] || '';
  const postalPart = parts.find(part => /\b\d{4,5}\b/.test(part)) || '';
  const postalMatch = postalPart.match(/\b(\d{4,5})\b\s*(.*)$/);
  const streetMatch = first.match(/^(.*?)(?:\s+(\d+[A-Za-z]?(?:[/-]\d+[A-Za-z]?)?))?$/);
  const country = parts.length > 2 ? parts[parts.length - 1] : 'Belgique';
  return {
    street: streetMatch?.[1]?.trim() || first,
    number: streetMatch?.[2] || '',
    postalCode: postalMatch?.[1] || '',
    city: postalMatch?.[2]?.trim() || '',
    country: country || 'Belgique',
    freeform: text || '',
  };
}

function AddressWizardModal({ initialAddress, onApply, onClose }) {
  const [freeform, setFreeform] = useState(initialAddress.freeform || [
    initialAddress.street && `${initialAddress.street} ${initialAddress.number || ''}`.trim(),
    [initialAddress.postalCode, initialAddress.city].filter(Boolean).join(' '),
    initialAddress.country,
  ].filter(Boolean).join(', '));
  const [parsed, setParsed] = useState(parseAddressFreeform(freeform));
  const updateParsed = (key, value) => setParsed(prev => ({ ...prev, [key]: value }));

  return (
    <ModalShell
      title="Wizard adresse"
      subtitle="Parsing local: aucune recherche externe, aucune donnée transmise"
      onClose={onClose}
      wide
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" onClick={() => onApply(parsed)}>Appliquer l’adresse</button>
      </>}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <FormRow label="Adresse collée">
          <textarea className="input-field" rows={3} value={freeform}
            onChange={e => {
              setFreeform(e.target.value);
              setParsed(parseAddressFreeform(e.target.value));
            }}
            placeholder="Ex : Rue Louvrex 95, 4000 Liège, Belgique"
          />
        </FormRow>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .6fr .7fr 1fr 1fr', gap: 10 }}>
          <FormRow label="Rue">
            <input className="input-field" value={parsed.street} onChange={e => updateParsed('street', e.target.value)} />
          </FormRow>
          <FormRow label="N°">
            <input className="input-field" value={parsed.number} onChange={e => updateParsed('number', e.target.value)} />
          </FormRow>
          <FormRow label="CP">
            <input className="input-field" value={parsed.postalCode} onChange={e => updateParsed('postalCode', e.target.value)} />
          </FormRow>
          <FormRow label="Commune">
            <input className="input-field" value={parsed.city} onChange={e => updateParsed('city', e.target.value)} />
          </FormRow>
          <FormRow label="Pays">
            <input className="input-field" value={parsed.country} onChange={e => updateParsed('country', e.target.value)} />
          </FormRow>
        </div>
      </div>
    </ModalShell>
  );
}
