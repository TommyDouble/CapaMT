import { safeNum } from './numbers.js';
import { computeCapacityImpact } from '../engines/capacityImpact.js';
import { normalizeRequest } from '../engines/requestModel.js';

const PROJ_STATUS_NORMALIZE = {
  'Planifié': 'planifié',
  'En cours': 'en_cours',
  'Validé': 'validé',
  'Annulé': 'annulé',
  'annulée': 'annulé',
};

export const normalizeStatus = status => PROJ_STATUS_NORMALIZE[status] || status;

function emptyDirectionalModel() {
  return {
    referenceYear: 2025,
    withdrawalView: {
      maxHistoricLoadBT: 0,
      maxHistoricLoadMT: 0,
      minHistoricInjectionBT: 0,
      minHistoricInjectionMT: 0,
      growthLoadMaxBT: 0,
      growthLoadMaxMT: 0,
      growthMinInjectionBT: 0,
      growthMinInjectionMT: 0,
    },
    injectionView: {
      maxHistoricInjectionBT: 0,
      maxHistoricInjectionMT: 0,
      minHistoricLoadBT: 0,
      minHistoricLoadMT: 0,
      growthMaxInjectionBT: 0,
      growthMaxInjectionMT: 0,
      growthMinLoadBT: 0,
      growthMinLoadMT: 0,
    },
  };
}

function normalizeDirectionalModel(model) {
  const base = model || emptyDirectionalModel();
  const wv = base.withdrawalView || {};
  const iv = base.injectionView || {};
  return {
    referenceYear: safeNum(base.referenceYear, 2025),
    withdrawalView: {
      maxHistoricLoadBT: safeNum(wv.maxHistoricLoadBT, 0),
      maxHistoricLoadMT: safeNum(wv.maxHistoricLoadMT, 0),
      minHistoricInjectionBT: safeNum(wv.minHistoricInjectionBT, 0),
      minHistoricInjectionMT: safeNum(wv.minHistoricInjectionMT, 0),
      growthLoadMaxBT: safeNum(wv.growthLoadMaxBT, 0),
      growthLoadMaxMT: safeNum(wv.growthLoadMaxMT, 0),
      growthMinInjectionBT: safeNum(wv.growthMinInjectionBT, 0),
      growthMinInjectionMT: safeNum(wv.growthMinInjectionMT, 0),
    },
    injectionView: {
      maxHistoricInjectionBT: safeNum(iv.maxHistoricInjectionBT, 0),
      maxHistoricInjectionMT: safeNum(iv.maxHistoricInjectionMT, 0),
      minHistoricLoadBT: safeNum(iv.minHistoricLoadBT, 0),
      minHistoricLoadMT: safeNum(iv.minHistoricLoadMT, 0),
      growthMaxInjectionBT: safeNum(iv.growthMaxInjectionBT, 0),
      growthMaxInjectionMT: safeNum(iv.growthMaxInjectionMT, 0),
      growthMinLoadBT: safeNum(iv.growthMinLoadBT, 0),
      growthMinLoadMT: safeNum(iv.growthMinLoadMT, 0),
    },
  };
}

function normalizeTransformerConfig(config = {}) {
  const transformers = Array.isArray(config.transformers)
    ? config.transformers.map(t => ({
        id: t.id,
        role: t.role || 'normal',
        power: safeNum(t.power, 0),
      }))
    : [];
  return {
    transformers,
    coeffN: safeNum(config.coeffN, 1),
    coeffN1: safeNum(config.coeffN1, 1),
    mtBackup: {
      enabled: Boolean(config.mtBackup?.enabled),
      capacity: safeNum(config.mtBackup?.capacity, 0),
    },
    reverseCapacityRatio: safeNum(config.reverseCapacityRatio, 1),
  };
}

export function normalizeSubstations(substations) {
  return (substations || []).map(sub => {
    const requests = (sub.connectionRequests || []).map(req => {
      const normalized = normalizeRequest(req, sub.id);
      return { ...normalized, capacityImpact: computeCapacityImpact(normalized) };
    });
    return {
      id: sub.id,
      name: sub.name,
      code: sub.code,
      commune: sub.commune,
      voltageLevel: sub.voltageLevel,
      voltageUpstream: sub.voltageUpstream,
      status: sub.status || 'actif',
      transformerConfig: normalizeTransformerConfig(sub.transformerConfig),
      directionalModel: normalizeDirectionalModel(sub.directionalModel),
      foisonnement: sub.foisonnement || {},
      notes: sub.notes || '',
      coordinates: {
        lat: sub.coordinates?.lat ? parseFloat(sub.coordinates.lat) || null : null,
        lng: sub.coordinates?.lng ? parseFloat(sub.coordinates.lng) || null : null,
      },
      connectionRequests: requests,
    };
  });
}

export function normalizeProjects(projects) {
  return (projects || []).map(project => ({
    ...project,
    status: normalizeStatus(project.status),
  }));
}
