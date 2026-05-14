/**
 * RequestCasePage — Vue dossier unifiée pour une demande de raccordement.
 * Orchestrateur : résout sub + req, passe les données aux blocs enfants.
 * Aucun calcul métier ici — tout vit dans les engines ou les composants enfants.
 */
import React, { useRef, useState } from 'react';
import { getQueueAnalysis } from '../../../engines/queue.js';
import { buildConditionSummary } from '../../../engines/requests.js';
import { CaseHeader } from './components/CaseHeader.jsx';
import { CaseTimeline } from './components/CaseTimeline.jsx';
import { CasePowerComparison } from './components/CasePowerComparison.jsx';
import { CaseNetworkSummary } from './components/CaseNetworkSummary.jsx';
import { CaseActivityLog } from './components/CaseActivityLog.jsx';
import { CaseInternalNotes } from './components/CaseInternalNotes.jsx';
import { evaluateRequestCapacity } from '../../../engines/capacityEvaluation.js';
import { normalizeRequest, getAssessment, getCustomer } from '../../../engines/requestModel.js';
import { canEditCustomer, canEditOffer, canStartStudy, getPrimaryAction, lockReason } from '../../../engines/workflowRules.js';
import { ModalShell } from '../../shared/ModalShell.jsx';
import {
  CustomerRequestForm,
  DecisionBanner,
  OfferStatusModal,
  RequestReadOnlySections,
  TechnicalAssessmentPanel,
} from './components/RequestWorkflowPanels.jsx';

function NetworkConditionBanner({ summary }) {
  if (!summary) return null;
  return (
    <div style={{
      padding: '12px 16px',
      borderRadius: 8,
      border: `1px solid ${summary.warning ? 'rgba(217,119,6,.28)' : 'var(--border-accent)'}`,
      background: summary.warning ? 'var(--amber-dim)' : 'var(--accent-bg)',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 900, color: summary.warning ? 'var(--amber)' : 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
            Condition réseau
          </p>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 3 }}>
            {summary.label}
          </p>
          {summary.warning && (
            <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 3 }}>
              Lien projet à compléter pour rendre la condition auditée.
            </p>
          )}
        </div>
        {summary.projects?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {summary.projects.map(project => (
              <span key={project.id} style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-raised)',
                color: 'var(--text-secondary)',
                borderRadius: 999,
                padding: '4px 9px',
                fontSize: 10,
                fontWeight: 800,
              }}>
                {project.status || 'statut n/a'} · MES {project.year || 'n/a'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function RequestCasePage({
  sub, reqId, projects, activityLog,
  onBack, onUpdate, onActivity, onLogDelete, prevViewLabel,
}) {
  const req = (sub.connectionRequests || []).find(r => r.id === reqId);
  const [customerPanel, setCustomerPanel] = useState(false);
  const [offerPanel, setOfferPanel] = useState(false);
  const [toast,     setToast]     = useState(null);
  const technicalPanelRef = useRef(null);

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  if (!req) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }} className="fade-in">
        <p style={{ fontSize: 16, color: 'var(--text-muted)', marginBottom: 16 }}>
          Demande introuvable (id : {reqId}).
        </p>
        <button onClick={onBack} className="btn-secondary">← Retour</button>
      </div>
    );
  }

  // Queue analysis — appel unique, résultat partagé vers tous les blocs
  const { queue, conditionals, cancelled } = getQueueAnalysis(sub, projects);
  const allItems = [...queue, ...conditionals, ...cancelled];
  const queueItem = allItems.find(item => item.req.id === reqId) || null;

  const logActivity = (data, meta = {}) => {
    if (!onActivity || !meta.actionKey) return;
    onActivity({
      subId: sub.id,
      subName: sub.name,
      subCode: sub.code,
      reqId: data.id,
      actionKey: meta.actionKey,
      actionLabel: meta.actionLabel || meta.summary || 'Action dossier',
      summary: meta.summary || meta.actionLabel || 'Action dossier enregistrée',
      data: {
        id: data.id,
        customer: getCustomer(data),
      },
    });
  };

  const persistReq = (data, message = '✓ Dossier mis à jour', meta = {}) => {
    const reqs = sub.connectionRequests.map(r => r.id === data.id ? data : r);
    onUpdate({ ...sub, connectionRequests: reqs });
    logActivity(data, meta);
    showToast(message);
  };

  const handleSaveCustomer = data => {
    persistReq(data, '✓ Demande client enregistrée', {
      actionKey: 'customer_saved',
      actionLabel: 'Demande client enregistrée',
      summary: 'Demande client enregistrée',
    });
    setCustomerPanel(false);
  };

  const handleStartStudy = () => {
    const updated = evaluateRequestCapacity(sub, normalizeRequest({
      ...req,
      assessment: {
        ...getAssessment(req),
        status: 'under_study',
        takenInChargeAt: new Date().toISOString(),
      },
    }, sub.id), projects);
    persistReq(updated, '✓ Dossier pris en charge', {
      actionKey: 'study_started',
      actionLabel: 'Prise en charge étude',
      summary: 'Dossier pris en charge pour étude',
    });
  };

  const handleSaveAssessment = (updated, meta = {}) => {
    persistReq(updated, meta.toast || '✓ Étude technique enregistrée', {
      actionKey: meta.actionKey || 'assessment_saved',
      actionLabel: meta.actionLabel || 'Étude enregistrée',
      summary: meta.summary || 'Étude technique enregistrée',
    });
  };

  const handleSaveOffer = updated => {
    persistReq(updated, '✓ Offre mise à jour', {
      actionKey: 'offer_updated',
      actionLabel: 'Offre mise à jour',
      summary: 'Offre / raccordement mis à jour',
    });
    setOfferPanel(false);
  };

  const handleSubUpdateWithActivity = (updatedSub, meta = {}) => {
    onUpdate(updatedSub);
    const updatedReq = (updatedSub.connectionRequests || []).find(r => r.id === req.id) || req;
    logActivity(updatedReq, meta);
    if (meta.toast) showToast(meta.toast);
  };

  const primaryAction = getPrimaryAction(req);
  const assessment = getAssessment(req);
  const finalStatuses = [assessment.final?.load?.status, assessment.final?.injection?.status].filter(Boolean);
  const conditionSummary = buildConditionSummary(
    req,
    projects,
    finalStatuses.includes('LIMIT') || finalStatuses.includes('FULL_FLEX')
  );

  const handleAssessmentAction = () => {
    technicalPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePrimaryAction = () => {
    if (primaryAction.key === 'START_STUDY') handleStartStudy();
    if (primaryAction.key === 'EDIT_CUSTOMER') setCustomerPanel(true);
    if (primaryAction.key === 'EDIT_OFFER') setOfferPanel(true);
    if (primaryAction.key === 'EDIT_ASSESSMENT') handleAssessmentAction();
  };

  const primaryIsButton = primaryAction.key !== 'VIEW';
  const noActionReason = lockReason('offer', req)
    || lockReason('assessment', req)
    || lockReason('customer', req)
    || 'Aucune action requise pour ce dossier.';

  return (
    <div style={{ paddingBottom: 40 }} className="fade-in">
      {toast && <div className="toast">{toast}</div>}

      {/* Header — identité + métriques + bouton retour */}
      <CaseHeader
        req={req}
        sub={sub}
        queueItem={queueItem}
        onEdit={() => setCustomerPanel(true)}
        editDisabled={!canEditCustomer(req)}
        editLabel={canEditCustomer(req) ? 'Modifier client' : 'Client verrouillé'}
        onBack={onBack}
        prevViewLabel={prevViewLabel}
      />

      <div style={{ marginTop: 16 }}>
        <CaseTimeline
          req={req}
          sub={sub}
          onUpdate={updatedSub => handleSubUpdateWithActivity(updatedSub, {
            actionKey: 'milestone_updated',
            actionLabel: 'Jalon mis à jour',
            summary: 'Calendrier du dossier mis à jour',
          })}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <NetworkConditionBanner summary={conditionSummary} />
        <DecisionBanner req={req} />
      </div>

      <div style={{ padding: '12px 20px', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Prochaine action
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {primaryIsButton ? (
            <button className="btn-primary" onClick={handlePrimaryAction}>
              {primaryAction.label}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{noActionReason}</span>
          )}
          {canEditCustomer(req) && primaryAction.key !== 'EDIT_CUSTOMER' && (
            <button className="btn-secondary" onClick={() => setCustomerPanel(true)}>
              Modifier demande client
            </button>
          )}
          {canEditOffer(req) && primaryAction.key !== 'EDIT_OFFER' && (
            <button className="btn-secondary" onClick={() => setOfferPanel(true)}>
              Mettre à jour l'offre
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        <RequestReadOnlySections req={req} queueItem={queueItem} />

        <div ref={technicalPanelRef}>
          <TechnicalAssessmentPanel
            req={req}
            sub={sub}
            projects={projects}
            onSave={handleSaveAssessment}
          />
        </div>

        {/* Traçabilité client / étude / impact calculé */}
        <CasePowerComparison req={req} sub={sub} />

        {/* Résumé réseau : résiduel + projets conditionnants */}
        <CaseNetworkSummary req={req} sub={sub} projects={projects} queueItem={queueItem} />

        {/* Journal d'activité + historique de changements (V2) */}
        <CaseActivityLog req={req} sub={sub} activityLog={activityLog} onLogDelete={onLogDelete} />

        {/* Notes internes (V2) */}
        <CaseInternalNotes
          req={req}
          sub={sub}
          onUpdate={updatedSub => handleSubUpdateWithActivity(updatedSub, {
            actionKey: 'internal_notes_saved',
            actionLabel: 'Notes internes enregistrées',
            summary: 'Notes internes enregistrées',
          })}
        />

      </div>

      {customerPanel && (
        <ModalShell
          title={canEditCustomer(req) ? 'Modifier la demande client' : 'Demande client verrouillée'}
          subtitle="Aucune donnée technique ni offre dans cet écran"
          onClose={() => setCustomerPanel(false)}
          wide
        >
          <CustomerRequestForm
            req={req}
            sub={sub}
            onSave={handleSaveCustomer}
            onClose={() => setCustomerPanel(false)}
          />
        </ModalShell>
      )}

      {offerPanel && (
        <OfferStatusModal
          req={req}
          onSave={handleSaveOffer}
          onClose={() => setOfferPanel(false)}
        />
      )}
    </div>
  );
}
