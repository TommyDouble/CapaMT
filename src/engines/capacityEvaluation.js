/**
 * engines/capacityEvaluation.js
 *
 * Évaluation amont/poste/réseau et réponse finale permanent/flexible.
 */

import { getFoisonnement } from '../constants/index.js';
import { safeNum } from '../utils/numbers.js';
import {
  getDirectCapacityN1AtYear,
  getReverseCapacityN1AtYear,
  getWithdrawalBaseNet,
  getInjectionBaseNet,
} from './directionalSubstation.js';
import { computeCapacityImpact, isActiveCapacityImpact } from './capacityImpact.js';
import { combineSplits, makeCapacitySplit, pendingSplit } from './capacitySplit.js';
import { deriveConfidence, buildDataQualityWarnings } from './dataQuality.js';
import {
  normalizeRequest,
  getAssessment,
  getCustomer,
  getRequestedInjection,
  getRequestedLoad,
} from './requestModel.js';
import { compareQueueRequests, getReadyForStudyDate } from './queueOrdering.js';

export function filterSecuredProjects(projects = []) {
  return (projects || []).filter(p => p.status === 'validé' || p.status === 'en_cours');
}

function requestYear(req) {
  return safeNum(getCustomer(req).requested?.year, 2026);
}

function requestDiagnostic(req, sub, reason) {
  const impact = computeCapacityImpact(req);
  const customer = getCustomer(req);
  const foison = getFoisonnement(req, sub);
  return {
    id: req.id,
    name: customer.client?.name || req.id,
    reference: customer.client?.reference || '',
    type: customer.client?.type || '',
    status: impact.status,
    reason,
    readyForStudyAt: getReadyForStudyDate(req),
    targetYear: requestYear(req),
    reservedLoadPermanent: safeNum(impact.reservedLoadPermanent, 0),
    reservedInjectionPermanent: safeNum(impact.reservedInjectionPermanent, 0),
    committedLoad: safeNum(impact.reservedLoadPermanent, 0) * foison,
    committedInjection: safeNum(impact.reservedInjectionPermanent, 0) * foison,
    foison,
  };
}

function classifyOtherRequests(sub, req, year) {
  const counted = [];
  const excluded = [];

  (sub.connectionRequests || []).forEach(other => {
    if (other.id === req.id) return;
    const impact = computeCapacityImpact(other);
    const reqYear = requestYear(other);

    if (!isActiveCapacityImpact(impact)) {
      excluded.push(requestDiagnostic(other, sub, 'not_active'));
      return;
    }
    if (reqYear > year) {
      excluded.push(requestDiagnostic(other, sub, 'future_commissioning'));
      return;
    }
    if (impact.status === 'STUDY_RESERVED' || impact.status === 'ACQUIRED') {
      counted.push(requestDiagnostic(other, sub, 'active_commitment'));
      return;
    }
    if (impact.status === 'QUEUE_RESERVED' && compareQueueRequests(other, req) < 0) {
      counted.push(requestDiagnostic(other, sub, 'fifo_previous'));
      return;
    }
    excluded.push(requestDiagnostic(other, sub, 'fifo_later'));
  });

  return { counted, excluded };
}

export function computeSubstationSplit(sub, req, projects = [], scenarioProfile = 'central') {
  const canonical = normalizeRequest(req, sub?.id);
  const requestedLoad = getRequestedLoad(canonical);
  const requestedInjection = getRequestedInjection(canonical);
  const year = requestYear(canonical);
  const securedProjects = filterSecuredProjects(projects);
  const foison = getFoisonnement(canonical, sub);
  const requestSelection = classifyOtherRequests(sub, canonical, year);
  const other = requestSelection.counted;

  const committedLoad = other.reduce((sum, r) => sum + safeNum(r.committedLoad, 0), 0);
  const committedInjection = other.reduce((sum, r) => sum + safeNum(r.committedInjection, 0), 0);

  const capLoad = getDirectCapacityN1AtYear(sub, year, securedProjects);
  const baseLoad = getWithdrawalBaseNet(sub, year, securedProjects);
  const residualLoad = capLoad - baseLoad - committedLoad;
  const maxClientLoad = residualLoad / Math.max(foison, 0.0001);
  const permanentLoad = Math.max(0, Math.min(requestedLoad, maxClientLoad));

  const capInjection = getReverseCapacityN1AtYear(sub, year, securedProjects);
  const baseInjectionAfterReservations = getInjectionBaseNet(sub, year, securedProjects) - committedInjection;
  const residualInjection = baseInjectionAfterReservations < 0
    ? capInjection - Math.abs(baseInjectionAfterReservations)
    : capInjection;
  const permanentInjection = Math.max(0, Math.min(requestedInjection, residualInjection / Math.max(foison, 0.0001)));

  const projectAffectsSub = project => (project.effects || []).some(effect => effect.ssId === sub?.id || effect.newSS?.id === sub?.id);
  const countedProjects = (projects || [])
    .filter(project => filterSecuredProjects([project]).length && safeNum(project.year, 9999) <= year && projectAffectsSub(project))
    .map(project => ({ id: project.id, name: project.name || project.label || project.id, status: project.status, year: project.year, reason: 'secured_project' }));
  const excludedProjects = (projects || [])
    .filter(project => !countedProjects.some(p => p.id === project.id) && projectAffectsSub(project))
    .map(project => ({
      id: project.id,
      name: project.name || project.label || project.id,
      status: project.status,
      year: project.year,
      reason: filterSecuredProjects([project]).length ? 'future_project' : 'not_secured_project',
    }));

  return {
    load: requestedLoad > 0 ? makeCapacitySplit({
      requested: requestedLoad,
      permanent: permanentLoad,
      source: 'SUBSTATION',
      reason: `Marge poste N-1 ${year}: ${residualLoad.toFixed(1)} MVA avant demande · foisonnement ${foison.toFixed(2)} · plafond client ${Math.max(0, maxClientLoad).toFixed(1)} MVA`,
      confidence: scenarioProfile === 'stress' ? 'MEDIUM' : 'HIGH',
    }) : undefined,
    injection: requestedInjection > 0 ? makeCapacitySplit({
      requested: requestedInjection,
      permanent: permanentInjection,
      source: 'SUBSTATION',
      reason: `Marge injection N-1 ${year}: ${residualInjection.toFixed(1)} MVA avant demande`,
      confidence: scenarioProfile === 'stress' ? 'MEDIUM' : 'HIGH',
    }) : undefined,
    diagnostics: {
      year,
      capLoad,
      capInjection,
      baseLoad,
      baseInjection: getInjectionBaseNet(sub, year, securedProjects),
      residualLoad,
      maxClientLoad,
      residualInjection,
      baseInjectionAfterReservations,
      committedLoad,
      committedInjection,
      foison,
      securedProjectIds: securedProjects.map(p => p.id),
      countedRequests: requestSelection.counted,
      excludedRequests: requestSelection.excluded,
      countedProjects,
      excludedProjects,
    },
  };
}

function layerSplit(assessment, source, direction, requested) {
  if (requested <= 0) return undefined;
  const key = source.toLowerCase();
  const labels = {
    UPSTREAM: 'Amont / CAPAC / ELIA',
    SUBSTATION: 'Local / sous-station',
    NETWORK: 'Réseau MT abstrait',
  };
  return assessment[key]?.[direction] || pendingSplit(requested, source, `${labels[source] || source} à compléter`);
}

function unique(values = []) {
  return values.filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index);
}

function firstQualifiedConstraint(...constraints) {
  return constraints.find(constraint => constraint && constraint !== 'UNKNOWN') || 'UNKNOWN';
}

export function evaluateRequestCapacity(sub, req, projects = []) {
  const canonical = normalizeRequest(req, sub?.id);
  const assessment = getAssessment(canonical);
  const scenarioProfile = assessment.scenarioProfile || 'central';
  const substationSuggestion = computeSubstationSplit(sub, canonical, projects, scenarioProfile);
  const loadRequested = getRequestedLoad(canonical);
  const injectionRequested = getRequestedInjection(canonical);

  const loadCombination = loadRequested > 0 ? combineSplits([
    layerSplit(assessment, 'UPSTREAM', 'load', loadRequested),
    layerSplit(assessment, 'SUBSTATION', 'load', loadRequested),
    layerSplit(assessment, 'NETWORK', 'load', loadRequested),
  ], loadRequested, 'FINAL') : null;

  const injectionCombination = injectionRequested > 0 ? combineSplits([
    layerSplit(assessment, 'UPSTREAM', 'injection', injectionRequested),
    layerSplit(assessment, 'SUBSTATION', 'injection', injectionRequested),
    layerSplit(assessment, 'NETWORK', 'injection', injectionRequested),
  ], injectionRequested, 'FINAL') : null;

  const final = {
    load: loadCombination?.final,
    injection: injectionCombination?.final,
    limitingConstraint: firstQualifiedConstraint(
      loadCombination?.limitingConstraint,
      injectionCombination?.limitingConstraint
    ),
  };
  const nextActions = unique([
    ...(loadCombination?.nextActions || []),
    ...(injectionCombination?.nextActions || []),
  ]);
  const missingSources = unique([
    ...(loadCombination?.missingSources || []),
    ...(injectionCombination?.missingSources || []),
  ]);
  const nextAction = nextActions[0] || loadCombination?.nextAction || injectionCombination?.nextAction || null;
  const evaluated = {
    ...canonical,
    assessment: {
      ...assessment,
      substation: assessment.substation,
      substationSuggestion,
      final,
      nextAction,
      nextActions,
      missingSources,
      diagnostics: substationSuggestion.diagnostics,
    },
  };
  const warnings = buildDataQualityWarnings(evaluated, sub);
  const confidence = deriveConfidence(evaluated, sub);
  return {
    ...evaluated,
    assessment: {
      ...evaluated.assessment,
      warnings,
      confidence,
    },
  };
}
