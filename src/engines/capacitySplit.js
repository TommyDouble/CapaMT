/**
 * engines/capacitySplit.js
 *
 * Modèle pur permanent/flexible.
 * Un CapacitySplit décrit la réponse d'une couche de contrainte pour un sens
 * de puissance donné (prélèvement ou injection).
 */

import { safeNum } from '../utils/numbers.js';
import { ACTION_CODES, actionForSource } from '../constants/workflowActions.js';

const EPS = 0.0001;

export function roundCapacity(value) {
  return +safeNum(value, 0).toFixed(1);
}

export function deriveStatus({ requested, permanent, flexible, pending = false, ko = false }) {
  const req = roundCapacity(requested);
  const perm = roundCapacity(permanent);
  const flex = roundCapacity(flexible);
  if (pending) return 'PENDING';
  if (ko) return 'KO';
  if (req <= EPS) return 'OK';
  if (perm <= EPS && flex <= EPS) return 'KO';
  if (perm <= EPS && flex >= req - EPS) return 'FULL_FLEX';
  if (perm >= req - EPS) return 'OK';
  return 'LIMIT';
}

export function makeCapacitySplit({
  requested = 0,
  permanent = 0,
  flexible,
  status,
  reason = '',
  confidence = 'HIGH',
  source = 'SUBSTATION',
  limiting = false,
  validUntil,
  answeredAt,
  missingSources = [],
  nextActions = [],
  updatedAt,
  updatedBy,
} = {}) {
  const req = Math.max(0, roundCapacity(requested));
  const isPending = status === 'PENDING';
  const isKo = status === 'KO';
  const perm = isPending || isKo ? 0 : Math.max(0, Math.min(req, roundCapacity(permanent)));
  const flexValue = flexible === undefined ? req - perm : flexible;
  const flex = isPending || isKo ? 0 : Math.max(0, roundCapacity(flexValue));
  const normalizedStatus =
    status || deriveStatus({ requested: req, permanent: perm, flexible: flex });

  return {
    requested: req,
    permanent: normalizedStatus === 'PENDING' || normalizedStatus === 'KO' ? 0 : perm,
    flexible:
      normalizedStatus === 'PENDING' || normalizedStatus === 'KO' ? 0 : roundCapacity(req - perm),
    status: normalizedStatus,
    reason,
    confidence,
    source,
    limiting,
    validUntil,
    answeredAt,
    missingSources,
    nextActions,
    updatedAt,
    updatedBy,
  };
}

export function pendingSplit(requested = 0, source = 'UPSTREAM', reason = 'Réponse à compléter') {
  return makeCapacitySplit({
    requested,
    status: 'PENDING',
    source,
    reason,
    confidence: 'LOW',
  });
}

export function okSplit(
  requested = 0,
  source = 'UPSTREAM',
  reason = 'Aucune limitation identifiée',
) {
  return makeCapacitySplit({
    requested,
    permanent: requested,
    source,
    reason,
    confidence: 'HIGH',
  });
}

export function koSplit(requested = 0, source = 'NETWORK', reason = 'Aucune capacité accordable') {
  return makeCapacitySplit({
    requested,
    status: 'KO',
    source,
    reason,
    confidence: 'HIGH',
  });
}

function sourceRank(source) {
  if (source === 'UPSTREAM') return 0;
  if (source === 'SUBSTATION') return 1;
  if (source === 'NETWORK') return 2;
  return 3;
}

function unique(values = []) {
  return values.filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index);
}

export function combineSplits(splits = [], requested = 0, source = 'FINAL') {
  const req = Math.max(0, roundCapacity(requested));
  const usable = (splits || []).filter(Boolean).map((split) => ({
    ...split,
    requested: req,
  }));

  if (!usable.length)
    return {
      final: makeCapacitySplit({
        requested: req,
        status: 'PENDING',
        source,
        reason: 'Aucune réponse disponible',
        confidence: 'LOW',
        missingSources: ['UNKNOWN'],
        nextActions: [ACTION_CODES.COMPLETER_DONNEES],
      }),
      limitingConstraint: 'UNKNOWN',
      nextAction: ACTION_CODES.COMPLETER_DONNEES,
      missingSources: ['UNKNOWN'],
      nextActions: [ACTION_CODES.COMPLETER_DONNEES],
    };

  const pendingSplits = usable.filter((split) => split.status === 'PENDING');
  if (pendingSplits.length) {
    const missingSources = unique(pendingSplits.map((split) => split.source || 'UNKNOWN'));
    const nextActions = unique(missingSources.map(actionForSource));
    return {
      final: makeCapacitySplit({
        requested: req,
        status: 'PENDING',
        source,
        reason: `Réponses manquantes: ${missingSources.join(', ')}`,
        confidence: 'LOW',
        missingSources,
        nextActions,
      }),
      limitingConstraint: missingSources[0] || 'UNKNOWN',
      nextAction: nextActions[0] || null,
      missingSources,
      nextActions,
    };
  }

  const ko = usable.find((split) => split.status === 'KO');
  if (ko)
    return {
      final: koSplit(req, source, ko.reason || `Blocage ${ko.source}`),
      limitingConstraint: ko.source || 'UNKNOWN',
      nextAction: ACTION_CODES.TRAITER_BLOCAGE,
      missingSources: [],
      nextActions: [ACTION_CODES.TRAITER_BLOCAGE],
    };

  const minPermanent = Math.min(...usable.map((split) => safeNum(split.permanent, 0)));
  const lowestConfidence = usable.some((s) => s.confidence === 'LOW')
    ? 'LOW'
    : usable.some((s) => s.confidence === 'MEDIUM')
      ? 'MEDIUM'
      : 'HIGH';

  if (minPermanent >= req - EPS) {
    return {
      final: makeCapacitySplit({
        requested: req,
        permanent: req,
        source,
        reason: 'Aucune contrainte limitante',
        confidence: lowestConfidence,
      }),
      limitingConstraint: 'UNKNOWN',
      nextAction: null,
      missingSources: [],
      nextActions: [],
    };
  }

  const limiting = usable
    .filter((split) => Math.abs(safeNum(split.permanent, 0) - minPermanent) < EPS)
    .sort((a, b) => sourceRank(a.source) - sourceRank(b.source))[0];

  return {
    final: makeCapacitySplit({
      requested: req,
      permanent: minPermanent,
      source,
      reason: limiting ? `Contrainte limitante: ${limiting.source}` : 'Réponse combinée',
      confidence: lowestConfidence,
    }),
    limitingConstraint: limiting?.source || 'UNKNOWN',
    nextAction: null,
    missingSources: [],
    nextActions: [],
  };
}

export function withRequested(split, requested) {
  if (!split) return pendingSplit(requested);
  return makeCapacitySplit({
    ...split,
    requested,
    permanent: split.status === 'OK' ? requested : split.permanent,
    flexible: split.status === 'OK' ? 0 : split.flexible,
  });
}
