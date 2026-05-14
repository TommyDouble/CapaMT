import React, { useMemo, useState } from 'react';
import {
  CAPACITY_SPLIT_CONFIG,
  CONFIDENCE_CONFIG,
  OFFER_STATUS_CONFIG,
  CONNECTED_RETENTION_DEFAULT_MONTHS,
  CONNECTED_RETENTION_MAX_MONTHS,
  CONNECTED_RETENTION_MIN_MONTHS,
  SCENARIO_PROFILE_CONFIG,
} from '../../../../constants/index.js';
import { f1, fmtShortDate } from '../../../../utils/format.js';
import { safeNum } from '../../../../utils/numbers.js';
import {
  makeCapacitySplit,
  pendingSplit,
} from '../../../../engines/capacitySplit.js';
import { getActionLabel, readNextActions } from '../../../../constants/workflowActions.js';
import { computeCapacityImpact, normalizeConnectedRetentionMonths } from '../../../../engines/capacityImpact.js';
import { computeSubstationSplit, evaluateRequestCapacity } from '../../../../engines/capacityEvaluation.js';
import {
  canEditAssessment,
  canEditOffer,
  canFinalizeAssessment,
  getAllowedOfferTransitions,
  lockReason,
} from '../../../../engines/workflowRules.js';
import {
  normalizeRequest,
  getAssessment,
  getCustomer,
  getOffer,
  getRequestedInjection,
  getRequestedLoad,
  isUpstreamResponseComplete,
  isQualifiedLimitingConstraint,
  clampActualDate,
  normalizeCapacTracking,
  updateCapacTrackingForUpstream,
} from '../../../../engines/requestModel.js';
import {
  AssessmentStatusBadge,
  CapacityImpactChip,
  CapacitySplitStatusBadge,
  CustomerStatusBadge,
  OfferStatusBadge,
} from '../../../shared/badges.jsx';
import { FormRow } from '../../../shared/forms.jsx';
import { ModalShell } from '../../../shared/ModalShell.jsx';

export { CustomerRequestForm } from './CustomerRequestForm.jsx';
export { RequestReadOnlySections } from './RequestReadOnlySections.jsx';

const TODAY = () => new Date().toISOString().slice(0, 10);

const SOURCE_LABELS = {
  UPSTREAM: 'Amont / CAPAC',
  SUBSTATION: 'Local / sous-station',
  NETWORK: 'Réseau MT abstrait',
  UNKNOWN: 'Réponse disponible',
};

function badgeStyle(config, key) {
  const c = config[key] || Object.values(config)[0];
  return {
    background: c.bg,
    color: c.color,
    border: `1px solid ${c.border}`,
    borderRadius: 8,
  };
}

function missingSourcesLabel(sources = []) {
  return (sources || []).filter(Boolean).map(source => SOURCE_LABELS[source] || source).join(', ');
}

function actionLabels(actions = [], assessment = {}) {
  return (actions || []).map(action => getActionLabel(action, { assessment }));
}

export function CapacitySplitCard({ title, split, compact = false }) {
  if (!split) {
    return (
      <div className="card" style={{ padding: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)' }}>{title}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Non applicable</p>
      </div>
    );
  }
  const statusStyle = badgeStyle(CAPACITY_SPLIT_CONFIG, split.status);
  const missing = split.status === 'PENDING' ? missingSourcesLabel(split.missingSources) : '';
  return (
    <div className="card" style={{ padding: compact ? 12 : 14, borderTop: `3px solid ${statusStyle.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>
          {title}
        </p>
        <CapacitySplitStatusBadge status={split.status} size="xs" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
        <Metric label="Demandé" value={split.requested} />
        <Metric label="Permanent" value={split.permanent} color={statusStyle.color} />
        <Metric label="Flexible" value={split.flexible} color="var(--amber)" />
      </div>
      {missing ? (
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.4 }}>
          Réponses manquantes: {missing}
        </p>
      ) : split.reason && (
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.4 }}>
          {split.reason}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, color = 'var(--text-primary)' }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div className="mono" style={{ fontSize: 17, fontWeight: 800, color }}>{f1(value)} <span style={{ fontSize: 10, fontWeight: 500 }}>MVA</span></div>
    </div>
  );
}

function constraintLabel(value) {
  const labels = {
    UPSTREAM: 'Amont / CAPAC',
    SUBSTATION: 'Local / sous-station',
    NETWORK: 'Réseau MT',
    UNKNOWN: 'À déterminer',
  };
  return labels[value] || labels.UNKNOWN;
}

function finalStatusFromSplits(splits = []) {
  const statuses = splits.map(split => split?.status).filter(Boolean);
  if (!statuses.length || statuses.includes('PENDING')) return 'PENDING';
  if (statuses.includes('KO')) return 'KO';
  if (statuses.includes('LIMIT')) return 'LIMIT';
  if (statuses.includes('FULL_FLEX')) return 'FULL_FLEX';
  return 'OK';
}

function formatFinalResponse(load, injection) {
  const parts = [];
  if (load) parts.push(`Prél. ${f1(load.permanent)} permanent + ${f1(load.flexible)} flexible`);
  if (injection) parts.push(`Inj. ${f1(injection.permanent)} permanent + ${f1(injection.flexible)} flexible`);
  return parts.join(' · ') || 'Non applicable';
}

function displayFinalSplit(assessment, split) {
  if (!split) return split;
  if (split.status === 'OK' && String(split.reason || '').startsWith('Contrainte limitante:')) {
    return { ...split, reason: 'Aucune contrainte limitante' };
  }
  if (isQualifiedLimitingConstraint(assessment)) return split;
  if (String(split.reason || '').startsWith('Contrainte limitante:')) {
    return { ...split, reason: 'Contrainte à déterminer' };
  }
  return split;
}

function confidenceTooltip(assessment) {
  const confidence = assessment.confidence || 'MEDIUM';
  const base = {
    HIGH: 'Confiance haute: toutes les couches applicables sont renseignées sans warning majeur.',
    MEDIUM: 'Confiance moyenne: warning non bloquant ou couche encodée avec confiance moyenne.',
    LOW: 'Confiance basse: CAPAC, local, réseau ou modèle directionnel à compléter, ou couche à confiance basse.',
  }[confidence] || `Confiance ${confidence}`;
  const warnings = (assessment.warnings || []).map(w => w.label || w.code).filter(Boolean);
  return warnings.length ? `${base}\nWarnings: ${warnings.join(' · ')}` : base;
}

export function DecisionBanner({ req }) {
  const assessment = getAssessment(req);
  const finalLoad = assessment.final?.load;
  const finalInjection = assessment.final?.injection;
  const finalPending = assessment.status !== 'studied'
    || finalStatusFromSplits([finalLoad, finalInjection]) === 'PENDING';
  const status = finalPending ? 'PENDING' : finalStatusFromSplits([finalLoad, finalInjection]);
  const c = CAPACITY_SPLIT_CONFIG[status] || CAPACITY_SPLIT_CONFIG.PENDING;
  const qualifiedConstraint = isQualifiedLimitingConstraint(assessment);

  return (
    <div className="card" style={{ padding: 18, borderLeft: `4px solid ${c.color}`, background: c.bg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 360px' }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: c.color, marginBottom: 4 }}>
            {finalPending
              ? 'Réponse client à compléter'
              : `Réponse client: ${formatFinalResponse(finalLoad, finalInjection)}`}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Contrainte limitante: <strong>{qualifiedConstraint ? constraintLabel(assessment.final?.limitingConstraint) : 'À déterminer'}</strong>
          </p>
        </div>
        {assessment.warnings?.length > 0 && (
          <div style={{ textAlign: 'right', minWidth: 180 }}>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
              Qualité données
            </p>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--orange)' }}>
              {assessment.warnings.length} warning(s)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function RequestStatusStrip({ req }) {
  const customer = getCustomer(req);
  const assessment = getAssessment(req);
  const offer = getOffer(req);
  const impact = computeCapacityImpact(req);
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <CustomerStatusBadge status={customer.status} size="xs" />
      <AssessmentStatusBadge status={assessment.status} size="xs" />
      <OfferStatusBadge status={offer.status} size="xs" />
      <CapacityImpactChip impact={impact.status} size="xs" />
      {customer.requestDate && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Demande {fmtShortDate(customer.requestDate)}
        </span>
      )}
      {customer.readyForStudyAt && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Priorité file {fmtShortDate(customer.readyForStudyAt)}
        </span>
      )}
    </div>
  );
}

function splitToForm(split) {
  const defaultPendingReasons = new Set([
    'Réponse CAPAC à compléter',
    'Réponse local/sous-station à compléter',
    'Étude réseau MT à compléter',
    'Étude réseau MT abstraite à compléter',
    'Réponse finale à calculer',
  ]);
  return {
    status: split?.status || 'PENDING',
    permanent: split?.permanent ?? '',
    reason: split?.status === 'PENDING' && defaultPendingReasons.has(split?.reason) ? '' : (split?.reason || ''),
    answeredAt: split?.answeredAt || split?.responseDate || split?.validUntil || '',
  };
}

function formToSplit(form, requested, source, defaultReason, fallbackAnsweredAt = '') {
  if (requested <= 0) return undefined;
  const answeredAt = clampActualDate(form.answeredAt || fallbackAnsweredAt || '');
  if (form.status === 'PENDING') return pendingSplit(requested, source, form.reason || defaultReason);
  if (form.status === 'KO') return makeCapacitySplit({ requested, status: 'KO', source, reason: form.reason || defaultReason, confidence: 'HIGH', answeredAt });
  const permanent = form.status === 'OK'
    ? requested
    : form.status === 'FULL_FLEX'
      ? 0
      : safeNum(form.permanent, 0);
  return makeCapacitySplit({
    requested,
    permanent,
    source,
    reason: form.reason || defaultReason,
    confidence: form.status === 'PENDING' ? 'LOW' : 'MEDIUM',
    answeredAt: answeredAt || undefined,
  });
}

export function TechnicalAssessmentPanel({ req, sub, projects, onSave }) {
  const requestedLoad = getRequestedLoad(req);
  const requestedInjection = getRequestedInjection(req);
  const assessment = getAssessment(req);
  const editable = canEditAssessment(req);
  const [scenarioProfile, setScenarioProfile] = useState(assessment.scenarioProfile || 'central');
  const substationSuggestion = useMemo(
    () => computeSubstationSplit(sub, req, projects, scenarioProfile),
    [sub, req, projects, scenarioProfile]
  );
  const [upLoad, setUpLoad] = useState(splitToForm(assessment.upstream?.load));
  const [upInj, setUpInj] = useState(splitToForm(assessment.upstream?.injection));
  const [subLoad, setSubLoad] = useState(splitToForm(assessment.substation?.load));
  const [subInj, setSubInj] = useState(splitToForm(assessment.substation?.injection));
  const [netLoad, setNetLoad] = useState(splitToForm(assessment.network?.load));
  const [netInj, setNetInj] = useState(splitToForm(assessment.network?.injection));
  const [subProjectIds, setSubProjectIds] = useState(assessment.substation?.conditionedOnProjectIds || []);
  const [netProjectIds, setNetProjectIds] = useState(assessment.network?.conditionedOnProjectIds || req.conditionedOnProjectIds || []);
  const [capac, setCapac] = useState(normalizeCapacTracking(assessment.capac, assessment.upstream, requestedLoad, requestedInjection));
  const [wizardOpen, setWizardOpen] = useState(false);
  const [capacReturnOpen, setCapacReturnOpen] = useState(false);

  const updateForm = (setter, key, value) => setter(prev => ({ ...prev, [key]: key === 'answeredAt' ? clampActualDate(value) : value }));

  const updateUpstreamForm = (setter, key, value) => setter(prev => {
    const next = { ...prev, [key]: key === 'answeredAt' ? clampActualDate(value) : value };
    if (key === 'status' && next.status !== 'PENDING' && !next.answeredAt && capac.receivedAt) {
      next.answeredAt = clampActualDate(capac.receivedAt);
    }
    return next;
  });

  const handleCapacChange = updater => {
    setCapac(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const normalizedNext = {
        ...next,
        sentAt: clampActualDate(next.sentAt || ''),
        receivedAt: clampActualDate(next.receivedAt || ''),
      };
      if (normalizedNext.receivedAt && normalizedNext.receivedAt !== prev.receivedAt) {
        const sync = form => {
          if (form.status === 'PENDING') return form;
          if (form.answeredAt && form.answeredAt !== prev.receivedAt) return form;
          return { ...form, answeredAt: normalizedNext.receivedAt };
        };
        setUpLoad(sync);
        setUpInj(sync);
      }
      return normalizedNext;
    });
  };

  const buildUpstreamLayer = (fallbackAnsweredAt = capac.receivedAt, loadForm = upLoad, injectionForm = upInj) => ({
    load: formToSplit(loadForm, requestedLoad, 'UPSTREAM', 'Réponse CAPAC à compléter', fallbackAnsweredAt),
    injection: formToSplit(injectionForm, requestedInjection, 'UPSTREAM', 'Réponse CAPAC à compléter', fallbackAnsweredAt),
  });

  const buildEdited = ({
    capacForm = capac,
    upstreamLoadForm = upLoad,
    upstreamInjectionForm = upInj,
  } = {}) => {
    let upstream = buildUpstreamLayer(capacForm.receivedAt, upstreamLoadForm, upstreamInjectionForm);
    let capacTracking = updateCapacTrackingForUpstream(capacForm, upstream, requestedLoad, requestedInjection, TODAY());
    if (capacTracking.receivedAt) {
      upstream = buildUpstreamLayer(capacTracking.receivedAt, upstreamLoadForm, upstreamInjectionForm);
      capacTracking = updateCapacTrackingForUpstream(capacTracking, upstream, requestedLoad, requestedInjection, TODAY());
    }
    const conditionedOnProjectIds = [...subProjectIds, ...netProjectIds]
      .filter((projectId, index, arr) => projectId && arr.indexOf(projectId) === index);
    const edited = normalizeRequest({
      ...req,
      conditionedOnProjectIds,
      assessment: {
        ...assessment,
        scenarioProfile,
        capac: capacTracking,
        upstream,
        substation: {
          conditionedOnProjectIds: subProjectIds,
          load: formToSplit(subLoad, requestedLoad, 'SUBSTATION', 'Réponse local/sous-station à compléter'),
          injection: formToSplit(subInj, requestedInjection, 'SUBSTATION', 'Réponse local/sous-station à compléter'),
        },
        network: {
          conditionedOnProjectIds: netProjectIds,
          load: formToSplit(netLoad, requestedLoad, 'NETWORK', 'Étude réseau MT abstraite à compléter'),
          injection: formToSplit(netInj, requestedInjection, 'NETWORK', 'Étude réseau MT abstraite à compléter'),
        },
      },
    }, sub.id);
    return evaluateRequestCapacity(sub, edited, projects);
  };

  const applySubstationWizard = () => {
    if (substationSuggestion.load) setSubLoad(splitToForm(substationSuggestion.load));
    if (substationSuggestion.injection) setSubInj(splitToForm(substationSuggestion.injection));
    setWizardOpen(false);
  };

  const handleSaveStudy = () => onSave(buildEdited(), {
    actionKey: 'assessment_saved',
    actionLabel: 'Étude enregistrée',
    summary: 'Étude technique enregistrée',
  });
  const preview = buildEdited();
  const upstreamComplete = isUpstreamResponseComplete(buildUpstreamLayer(), requestedLoad, requestedInjection);

  const handleMarkCapacSent = () => {
    const nextCapac = {
      ...capac,
      status: capac.status === 'RECEIVED' ? 'RECEIVED' : 'SENT',
      sentAt: capac.sentAt || TODAY(),
    };
    setCapac(nextCapac);
    onSave(buildEdited({ capacForm: nextCapac }), {
      actionKey: 'capac_sent',
      actionLabel: 'Demande CAPAC effectuée',
      summary: `Demande CAPAC effectuée le ${nextCapac.sentAt}`,
    });
  };

  const handleCapacReturnSave = ({ loadForm, injectionForm, capacForm }) => {
    if (requestedLoad > 0) setUpLoad(loadForm);
    if (requestedInjection > 0) setUpInj(injectionForm);
    setCapac(capacForm);
    setCapacReturnOpen(false);
    onSave(buildEdited({
      capacForm,
      upstreamLoadForm: loadForm,
      upstreamInjectionForm: injectionForm,
    }), {
      actionKey: 'capac_return',
      actionLabel: 'Retour CAPAC enregistré',
      summary: capacForm.status === 'RECEIVED'
        ? `Retour CAPAC complet reçu le ${capacForm.receivedAt}`
        : 'Retour CAPAC partiel enregistré',
    });
  };

  const handleFinalize = () => {
    const evaluatedStudy = preview;
    const finalLoadPending = evaluatedStudy.assessment.final?.load?.status === 'PENDING';
    const finalInjectionPending = evaluatedStudy.assessment.final?.injection?.status === 'PENDING';
    if (finalLoadPending || finalInjectionPending) return;
    onSave(normalizeRequest({
      ...evaluatedStudy,
      assessment: {
        ...evaluatedStudy.assessment,
        status: 'studied',
        assessedAt: new Date().toISOString(),
      },
      offer: {
        ...getOffer(evaluatedStudy),
        status: 'offer_formulated',
        formulatedAt: TODAY(),
      },
    }, sub.id), {
      actionKey: 'assessment_finalized',
      actionLabel: 'Étude finalisée',
      summary: 'Étude finalisée et offre formulée',
    });
  };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--accent)' }}>
            Étude technique
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            Vue puissance au poste; réseau MT détaillé hors calcul automatique.
          </p>
        </div>
        <AssessmentStatusBadge status={assessment.status} />
      </div>

      {!editable && (
        <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg-muted)', color: 'var(--text-muted)', fontSize: 12, marginBottom: 14 }}>
          {lockReason('assessment', req)}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        <LayerEditor
          title="Amont / CAPAC / ELIA"
          disabled={!editable}
          requestedLoad={requestedLoad}
          requestedInjection={requestedInjection}
          loadForm={upLoad}
          injectionForm={upInj}
          onLoadChange={(k, v) => updateUpstreamForm(setUpLoad, k, v)}
          onInjectionChange={(k, v) => updateUpstreamForm(setUpInj, k, v)}
        >
          <CapacTrackingEditor
            capac={capac}
            disabled={!editable}
            upstreamComplete={upstreamComplete}
            onChange={handleCapacChange}
            onMarkSent={handleMarkCapacSent}
            onOpenReturn={() => setCapacReturnOpen(true)}
          />
        </LayerEditor>
        <LayerEditor
          title="Local / sous-station"
          disabled={!editable}
          requestedLoad={requestedLoad}
          requestedInjection={requestedInjection}
          loadForm={subLoad}
          injectionForm={subInj}
          actionLabel="Wizard poste"
          onAction={() => setWizardOpen(true)}
          projects={projects}
          substationId={sub.id}
          conditionProjectIds={subProjectIds}
          onConditionProjectIdsChange={setSubProjectIds}
          onLoadChange={(k, v) => updateForm(setSubLoad, k, v)}
          onInjectionChange={(k, v) => updateForm(setSubInj, k, v)}
        />
        <LayerEditor
          title="Réseau MT abstrait"
          disabled={!editable}
          requestedLoad={requestedLoad}
          requestedInjection={requestedInjection}
          loadForm={netLoad}
          injectionForm={netInj}
          projects={projects}
          substationId={sub.id}
          conditionProjectIds={netProjectIds}
          onConditionProjectIdsChange={setNetProjectIds}
          onLoadChange={(k, v) => updateForm(setNetLoad, k, v)}
          onInjectionChange={(k, v) => updateForm(setNetInj, k, v)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
        <CapacitySplitCard title="Final prélèvement" split={displayFinalSplit(preview.assessment, preview.assessment.final?.load)} compact />
        <CapacitySplitCard title="Final injection" split={displayFinalSplit(preview.assessment, preview.assessment.final?.injection)} compact />
        <AssessmentResultCard req={preview} />
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          Scénario
          <select className="input-field" style={{ width: 150 }} disabled={!editable} value={scenarioProfile} onChange={e => setScenarioProfile(e.target.value)}>
            {Object.entries(SCENARIO_PROFILE_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" disabled={!editable} onClick={handleSaveStudy}>Enregistrer étude</button>
          <button className="btn-primary" disabled={!editable || !canFinalizeAssessment(preview)} onClick={handleFinalize}>
            Finaliser étude
          </button>
        </div>
      </div>

      {wizardOpen && (
        <SubstationWizardModal
          req={req}
          suggestion={substationSuggestion}
          onApply={applySubstationWizard}
          onClose={() => setWizardOpen(false)}
        />
      )}
      {capacReturnOpen && (
        <CapacReturnModal
          capac={capac}
          requestedLoad={requestedLoad}
          requestedInjection={requestedInjection}
          loadForm={upLoad}
          injectionForm={upInj}
          onSave={handleCapacReturnSave}
          onClose={() => setCapacReturnOpen(false)}
        />
      )}
    </div>
  );
}

function LayerEditor({
  title, disabled, requestedLoad, requestedInjection,
  loadForm, injectionForm, onLoadChange, onInjectionChange, actionLabel, onAction,
  projects, substationId, conditionProjectIds, onConditionProjectIdsChange,
  children,
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</p>
        {onAction && (
          <button className="btn-secondary" disabled={disabled} onClick={onAction} style={{ fontSize: 11, padding: '4px 8px' }}>
            {actionLabel}
          </button>
        )}
      </div>
      {children}
      {requestedLoad > 0 && <SplitInput label="Prélèvement" form={loadForm} onChange={onLoadChange} disabled={disabled} />}
      {requestedInjection > 0 && <SplitInput label="Injection" form={injectionForm} onChange={onInjectionChange} disabled={disabled} />}
      {onConditionProjectIdsChange && (
        <ConditionProjectSelector
          projects={projects}
          substationId={substationId}
          selectedIds={conditionProjectIds}
          disabled={disabled}
          onChange={onConditionProjectIdsChange}
        />
      )}
      {requestedLoad <= 0 && requestedInjection <= 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Aucune puissance demandée.</p>
      )}
    </div>
  );
}

function projectAffectsSubstation(project, substationId) {
  if (!substationId) return true;
  return (project.effects || []).some(effect =>
    effect.ssId === substationId
    || effect.newSS?.id === substationId
    || effect.fromSSId === substationId
    || effect.toSSId === substationId
  );
}

function ConditionProjectSelector({ projects = [], substationId, selectedIds = [], disabled, onChange }) {
  const activeProjects = (projects || []).filter(project => project.status !== 'annulé');
  const relevantProjects = activeProjects.filter(project =>
    projectAffectsSubstation(project, substationId) || selectedIds.includes(project.id)
  );
  const otherProjects = activeProjects.filter(project =>
    !relevantProjects.some(relevant => relevant.id === project.id)
  );
  const toggle = projectId => {
    const next = selectedIds.includes(projectId)
      ? selectedIds.filter(id => id !== projectId)
      : [...selectedIds, projectId];
    onChange(next);
  };
  const renderProject = project => {
    const selected = selectedIds.includes(project.id);
    const outsideSubstation = substationId && !projectAffectsSubstation(project, substationId);
    return (
      <label key={project.id} style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 7,
        alignItems: 'start',
        padding: '7px 8px',
        border: `1px solid ${selected ? 'var(--border-accent)' : 'var(--border)'}`,
        borderRadius: 8,
        background: selected ? 'var(--accent-bg)' : 'var(--bg-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
        <input
          type="checkbox"
          disabled={disabled}
          checked={selected}
          onChange={() => toggle(project.id)}
          style={{ marginTop: 2 }}
        />
        <span>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)' }}>
            {project.name || project.id}
          </span>
          <span style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
            {project.status || 'statut n/a'} · MES {project.year || 'n/a'}{outsideSubstation ? ' · hors sous-station' : ''}
          </span>
        </span>
      </label>
    );
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
        Projet conditionnant
      </p>
      {activeProjects.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Aucun projet réseau disponible.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {relevantProjects.length > 0 ? relevantProjects.map(renderProject) : (
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Aucun projet ne cible directement cette sous-station.
            </p>
          )}
          {otherProjects.length > 0 && (
            <details style={{ marginTop: 2 }}>
              <summary style={{ cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)', fontWeight: 800 }}>
                Autres projets réseau ({otherProjects.length})
              </summary>
              <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                {otherProjects.map(renderProject)}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

const CAPAC_TRACKING_CONFIG = {
  NOT_SENT: { label: 'À demander', color: 'var(--text-muted)', bg: 'var(--bg-muted)', border: 'var(--border)' },
  SENT: { label: 'Demandée', color: 'var(--orange)', bg: 'rgba(234, 88, 12, .08)', border: 'rgba(234, 88, 12, .25)' },
  RECEIVED: { label: 'Reçue', color: 'var(--inj)', bg: 'rgba(20, 184, 166, .08)', border: 'rgba(20, 184, 166, .28)' },
};

function CapacTrackingEditor({ capac, disabled, upstreamComplete, onChange, onMarkSent, onOpenReturn }) {
  const current = CAPAC_TRACKING_CONFIG[capac.status] || CAPAC_TRACKING_CONFIG.NOT_SENT;
  const updateDate = (field, value) => onChange(prev => {
    const next = { ...prev, [field]: clampActualDate(value) };
    if (field === 'receivedAt') next.status = value ? 'RECEIVED' : (next.sentAt ? 'SENT' : 'NOT_SENT');
    if (field === 'sentAt' && next.status !== 'RECEIVED') next.status = value ? 'SENT' : 'NOT_SENT';
    return next;
  });

  return (
    <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-muted)', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Suivi CAPAC
        </span>
        <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '3px 8px', color: current.color, background: current.bg, border: `1px solid ${current.border}` }}>
          {current.label}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input className="input-field" type="date" max={TODAY()} disabled={disabled} value={capac.sentAt || ''} onChange={e => updateDate('sentAt', e.target.value)} title="Date d'envoi de la demande CAPAC" />
        <input className="input-field" type="date" max={TODAY()} disabled={disabled} value={capac.receivedAt || ''} onChange={e => updateDate('receivedAt', e.target.value)} title="Date de réception complète de la réponse CAPAC" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.35 }}>
          {upstreamComplete ? 'Réponse amont complète: passage en CAPAC reçue à l’enregistrement.' : 'Dates auditables: demande envoyée puis réponse ELIA reçue.'}
        </p>
        {capac.status === 'NOT_SENT' ? (
          <button className="btn-secondary" disabled={disabled} onClick={onMarkSent} style={{ fontSize: 10, padding: '4px 8px', whiteSpace: 'nowrap' }}>
            Demande CAPAC effectuée
          </button>
        ) : (
          <button className="btn-secondary" disabled={disabled} onClick={onOpenReturn} style={{ fontSize: 10, padding: '4px 8px', whiteSpace: 'nowrap' }}>
            Retour CAPAC
          </button>
        )}
      </div>
    </div>
  );
}

function CapacReturnModal({
  capac,
  requestedLoad,
  requestedInjection,
  loadForm,
  injectionForm,
  onSave,
  onClose,
}) {
  const defaultDate = capac.receivedAt || TODAY();
  const withDefaultDate = form => ({
    ...form,
    answeredAt: form.answeredAt || defaultDate,
  });
  const [loadDraft, setLoadDraft] = useState(withDefaultDate(loadForm));
  const [injectionDraft, setInjectionDraft] = useState(withDefaultDate(injectionForm));
  const updateLoad = (key, value) => setLoadDraft(prev => ({ ...prev, [key]: key === 'answeredAt' ? clampActualDate(value) : value }));
  const updateInjection = (key, value) => setInjectionDraft(prev => ({ ...prev, [key]: key === 'answeredAt' ? clampActualDate(value) : value }));

  const handleSave = () => {
    const upstream = {
      load: formToSplit(loadDraft, requestedLoad, 'UPSTREAM', 'Réponse CAPAC à compléter'),
      injection: formToSplit(injectionDraft, requestedInjection, 'UPSTREAM', 'Réponse CAPAC à compléter'),
    };
    const nextCapac = updateCapacTrackingForUpstream(capac, upstream, requestedLoad, requestedInjection, TODAY());
    onSave({
      loadForm: loadDraft,
      injectionForm: injectionDraft,
      capacForm: nextCapac,
    });
  };

  return (
    <ModalShell
      title="Retour CAPAC"
      subtitle="Encoder une réponse amont partielle ou complète"
      onClose={onClose}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" onClick={handleSave}>Enregistrer retour CAPAC</button>
      </>}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {requestedLoad > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Prélèvement</p>
            <SplitInput label="Réponse" form={loadDraft} onChange={updateLoad} disabled={false} />
          </div>
        )}
        {requestedInjection > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Injection</p>
            <SplitInput label="Réponse" form={injectionDraft} onChange={updateInjection} disabled={false} />
          </div>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          Une réponse partielle complète uniquement le sens encodé. Le suivi CAPAC passe en reçue lorsque tous les sens applicables sont renseignés.
        </p>
      </div>
    </ModalShell>
  );
}

function AssessmentResultCard({ req }) {
  const assessment = getAssessment(req);
  const finalLoad = assessment.final?.load;
  const finalInjection = assessment.final?.injection;
  const statuses = [finalLoad?.status, finalInjection?.status].filter(Boolean);
  const pending = statuses.includes('PENDING');
  const status = pending ? 'PENDING' : (statuses.includes('KO') ? 'KO' : (statuses.includes('LIMIT') || statuses.includes('FULL_FLEX') ? 'LIMIT' : 'OK'));
  const c = CAPACITY_SPLIT_CONFIG[status] || CAPACITY_SPLIT_CONFIG.PENDING;
  const actions = actionLabels(readNextActions(assessment), assessment);
  const action = actions.length ? actions.join(' · ') : (pending ? 'Compléter les couches manquantes' : 'Prêt à finaliser');

  return (
    <div className="card" style={{ padding: 12, borderTop: `3px solid ${c.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>
          Résumé étude
        </p>
        <CapacitySplitStatusBadge status={status} size="xs" />
      </div>
      <div style={{ marginTop: 12, display: 'grid', gap: 7, fontSize: 11, color: 'var(--text-secondary)' }}>
        <p><strong>Contrainte:</strong> {isQualifiedLimitingConstraint(assessment) ? constraintLabel(assessment.final?.limitingConstraint) : 'À déterminer'}</p>
        <p><strong>Action:</strong> {action}</p>
        {assessment.confidence && (
          <p>
            <strong>Confiance:</strong>{' '}
            <span title={confidenceTooltip(assessment)} style={{ textDecoration: 'underline dotted', cursor: 'help' }}>
              {CONFIDENCE_CONFIG[assessment.confidence]?.label || assessment.confidence}
            </span>
          </p>
        )}
        {Array.isArray(assessment.warnings) && assessment.warnings.length > 0 && (
          <p style={{ color: 'var(--orange)' }}>{assessment.warnings.length} warning(s) données</p>
        )}
      </div>
    </div>
  );
}

function SubstationWizardModal({ req, suggestion, onApply, onClose }) {
  const customer = getCustomer(req);
  const requestedLoad = getRequestedLoad(req);
  const requestedInjection = getRequestedInjection(req);
  const d = suggestion?.diagnostics || {};
  const counted = d.countedRequests || [];
  const excluded = d.excludedRequests || [];
  const activeCommitments = counted.filter(row => row.reason === 'active_commitment');
  const fifoPrevious = counted.filter(row => row.reason === 'fifo_previous');

  return (
    <ModalShell
      title="Suggestion Local / sous-station"
      subtitle="Pré-remplissage explicable depuis les données connues au poste"
      onClose={onClose}
      wide
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Fermer</button>
        <button className="btn-primary" onClick={onApply}>Appliquer la proposition</button>
      </>}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          <WizardMetric label="Demande" value={customer.client?.name || '—'} />
          <WizardMetric label="Année cible" value={d.year || customer.requested?.year || '—'} />
          <WizardMetric label="Foisonnement" value={f1(d.foison || 0)} />
          <WizardMetric label="Puissance" value={`P ${f1(requestedLoad)} / I ${f1(requestedInjection)} MVA`} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <WizardCalcCard
            title="Calcul prélèvement"
            split={suggestion?.load}
            rows={[
              ['Capacité N-1', d.capLoad],
              ['Pointe/base poste', d.baseLoad],
              ['Réservations comptées', d.committedLoad],
              ['Marge avant demande', d.residualLoad],
              ['Plafond client avec foisonnement', Math.max(0, d.maxClientLoad || 0)],
            ]}
          />
          <WizardCalcCard
            title="Calcul injection"
            split={suggestion?.injection}
            rows={[
              ['Capacité inverse N-1', d.capInjection],
              ['Base injection poste', d.baseInjection],
              ['Réservations comptées', d.committedInjection],
              ['Marge avant demande', d.residualInjection],
            ]}
          />
        </div>

        <DiagnosticsList title="Projets sécurisés comptés" rows={d.countedProjects || []} empty="Aucun projet sécurisé compté." type="project" />
        <DiagnosticsList title="Projets exclus" rows={d.excludedProjects || []} empty="Aucun projet poste exclu." type="project" muted />
        <DiagnosticsList title="Engagements actifs comptés" rows={activeCommitments} empty="Aucun engagement actif déjà acquis/réservé." />
        <DiagnosticsList title="Demandes FIFO antérieures comptées" rows={fifoPrevious} empty="Aucune demande antérieure ne consomme la marge avant ce dossier." />
        <DiagnosticsList title="Demandes exclues" rows={excluded} empty="Aucune demande exclue." muted />
      </div>
    </ModalShell>
  );
}

function WizardMetric({ label, value }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-muted)' }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function WizardCalcCard({ title, split, rows }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</p>
        {split ? <CapacitySplitStatusBadge status={split.status} size="xs" /> : <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Non applicable</span>}
      </div>
      <div style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>{label}</span>
            <span className="mono">{value == null ? '—' : `${f1(value)} MVA`}</span>
          </div>
        ))}
      </div>
      {split && (
        <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-primary)', fontWeight: 800 }}>
          Proposition: {f1(split.permanent)} MVA permanent / {f1(split.flexible)} MVA flexible
        </p>
      )}
    </div>
  );
}

const DIAGNOSTIC_REASON_LABELS = {
  active_commitment: 'Engagement actif',
  fifo_previous: 'FIFO antérieure',
  fifo_later: 'FIFO postérieure',
  future_commissioning: 'MES postérieure',
  not_active: 'Non active',
  secured_project: 'Projet sécurisé',
  future_project: 'Projet futur',
  not_secured_project: 'Projet non sécurisé',
};

function DiagnosticsList({ title, rows, empty, type = 'request', muted = false }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '8px 10px', background: muted ? 'var(--bg-muted)' : 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: muted ? 'var(--text-muted)' : 'var(--text-primary)' }}>{title}</p>
      </div>
      {!rows?.length ? (
        <p style={{ padding: 10, fontSize: 11, color: 'var(--text-muted)' }}>{empty}</p>
      ) : (
        <div style={{ display: 'grid' }}>
          {rows.map(row => (
            <div key={`${type}-${row.id}-${row.reason}`} style={{
              display: 'grid',
              gridTemplateColumns: type === 'project' ? '1.6fr .7fr .7fr 1fr' : '1.6fr .8fr .8fr .8fr .8fr 1fr',
              gap: 8,
              padding: '7px 10px',
              borderTop: '1px solid var(--border)',
              fontSize: 10,
              color: muted ? 'var(--text-muted)' : 'var(--text-secondary)',
              alignItems: 'center',
            }}>
              {type === 'project' ? (
                <>
                  <strong style={{ color: 'var(--text-primary)' }}>{row.name}</strong>
                  <span>{row.status || '—'}</span>
                  <span>{row.year || '—'}</span>
                  <span>{DIAGNOSTIC_REASON_LABELS[row.reason] || row.reason}</span>
                </>
              ) : (
                <>
                  <strong style={{ color: 'var(--text-primary)' }}>{row.name}</strong>
                  <span className="mono">{row.reference || row.id}</span>
                  <span>{row.targetYear || '—'}</span>
                  <span className="mono">P {f1(row.committedLoad)}</span>
                  <span className="mono">I {f1(row.committedInjection)}</span>
                  <span>{DIAGNOSTIC_REASON_LABELS[row.reason] || row.reason}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SplitInput({ label, form, onChange, disabled }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</span>
      <select className="input-field" disabled={disabled} value={form.status} onChange={e => onChange('status', e.target.value)}>
        {['PENDING', 'OK', 'LIMIT', 'FULL_FLEX', 'KO'].map(status => (
          <option key={status} value={status}>{CAPACITY_SPLIT_CONFIG[status].label}</option>
        ))}
      </select>
      <input className="input-field" disabled={disabled || ['OK', 'PENDING', 'KO', 'FULL_FLEX'].includes(form.status)}
        type="number" min="0" step=".1" value={form.permanent}
        placeholder="Permanent MVA" onChange={e => onChange('permanent', e.target.value)} />
      <span />
      <input className="input-field" disabled={disabled}
        value={form.reason} placeholder="Commentaire / référence"
        onChange={e => onChange('reason', e.target.value)} />
      <input className="input-field" disabled={disabled}
        type="date" max={TODAY()} value={form.answeredAt || ''}
        title="Date de réponse"
        onChange={e => onChange('answeredAt', clampActualDate(e.target.value))} />
    </div>
  );
}

export function OfferStatusModal({ req, onSave, onClose }) {
  const offer = getOffer(req);
  const allowed = getAllowedOfferTransitions(req);
  const statuses = [offer.status, ...allowed].filter((v, i, arr) => arr.indexOf(v) === i);
  const [status, setStatus] = useState(offer.status);
  const [date, setDate] = useState(offer.status === 'offer_connected' ? (offer.connectedAt || TODAY()) : TODAY());
  const [retentionMonths, setRetentionMonths] = useState(
    String(normalizeConnectedRetentionMonths(offer.connectedRetentionMonths ?? CONNECTED_RETENTION_DEFAULT_MONTHS))
  );
  const [comment, setComment] = useState(offer.comment || '');

  const handleSave = () => {
    const patch = { status, comment };
    if (status === 'offer_formulated') patch.formulatedAt = date;
    if (status === 'offer_expired') patch.expiredAt = date;
    if (status === 'offer_cancelled') patch.cancelledAt = date;
    if (status === 'offer_accepted') patch.acceptedAt = date;
    if (status === 'offer_connected') {
      patch.connectedAt = date || TODAY();
      patch.connectedRetentionMonths = normalizeConnectedRetentionMonths(retentionMonths);
    }
    onSave(normalizeRequest({
      ...req,
      offer: {
        ...offer,
        ...patch,
      },
    }, getCustomer(req).targetSubstationId));
  };

  return (
    <ModalShell title="Mettre à jour l’offre" subtitle="Cycle commercial séparé de l’étude technique" onClose={onClose}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" onClick={handleSave}>Enregistrer</button>
      </>}>
      {!canEditOffer(req) && (
        <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg-muted)', color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
          {lockReason('offer', req)}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormRow label="Nouveau statut">
          <select className="input-field" value={status} disabled={!canEditOffer(req)} onChange={e => setStatus(e.target.value)}>
            {statuses.map(s => <option key={s} value={s}>{OFFER_STATUS_CONFIG[s]?.label || s}</option>)}
          </select>
        </FormRow>
        <FormRow label="Date de changement">
          <input className="input-field" type="date" max={TODAY()} value={date} disabled={!canEditOffer(req)} onChange={e => setDate(clampActualDate(e.target.value))} />
        </FormRow>
      </div>
      <FormRow label="Commentaire">
        <textarea className="input-field" rows={3} value={comment} disabled={!canEditOffer(req)}
          onChange={e => setComment(e.target.value)} />
      </FormRow>
      {status === 'offer_connected' && (
        <FormRow label="Maintien capacité raccordée">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input className="input-field" type="number"
              min={CONNECTED_RETENTION_MIN_MONTHS}
              max={CONNECTED_RETENTION_MAX_MONTHS}
              step="1"
              value={retentionMonths}
              disabled={!canEditOffer(req)}
              onChange={e => setRetentionMonths(e.target.value)}
              style={{ maxWidth: 120 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>mois après raccordement</span>
          </div>
        </FormRow>
      )}
    </ModalShell>
  );
}
