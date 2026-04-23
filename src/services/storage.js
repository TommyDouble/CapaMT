/**
 * services/storage.js
 * Source unique de vérité pour la persistance.
 *
 * Format v6 : { version, savedAt, substations, networkProjects, activityLog }
 * Migration v5→v6 : suppression du champ `scenario`, ajout de directionalModel
 */

import { STORAGE_KEY, YEARS } from '../constants/index.js';
import { normalizeSubstations, normalizeProjects } from '../utils/normalize.js';
import { INITIAL_SUBSTATIONS, INITIAL_NETWORK_PROJECTS } from '../data/initial.js';
import {
  getWithdrawalRigid, getWithdrawalTotal,
  getInjectionRigid, getInjectionTotal,
  getDirectCapacityN1AtYear, getReverseCapacityN1AtYear,
  getResidualWithdrawalRigid, getResidualInjectionRigid,
  getUtilizationWithdrawalRigid, getUtilizationInjectionRigid,
} from '../engines/directionalSubstation.js';
import { getCapacityAtYear } from '../engines/capacity.js';

const STORAGE_VERSION = 6;
const LEGACY_KEY_V5   = 'resa_planif_v5';

// ── Persistance locale ──────────────────────────────────────────────────────

export function saveState(substations, networkProjects, activityLog) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      substations,
      networkProjects,
      activityLog,
    }));
  } catch (_) {}
}

export function loadState() {
  try {
    // Try v6 first
    let raw = localStorage.getItem(STORAGE_KEY);

    // Fallback: try to migrate v5 data
    if (!raw) {
      const rawV5 = localStorage.getItem(LEGACY_KEY_V5);
      if (rawV5) {
        raw = rawV5;
      }
    }

    if (!raw) return null;
    const d = JSON.parse(raw);

    // Handle v5 → v6 migration
    if (!d.version || d.version < STORAGE_VERSION) {
      // v5 had `scenario` field — drop it silently
      const migrated = {
        version:        STORAGE_VERSION,
        savedAt:        d.savedAt || new Date().toISOString(),
        substations:    normalizeSubstations(d.substations || []),
        networkProjects: normalizeProjects(d.networkProjects || []),
        activityLog:    Array.isArray(d.activityLog) ? d.activityLog : [],
      };
      // Persist migrated data in new key
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (_) {}
      // Remove old v5 key if present
      try { localStorage.removeItem(LEGACY_KEY_V5); } catch (_) {}
      return migrated;
    }

    if (d.substations)     d.substations    = normalizeSubstations(d.substations);
    if (d.networkProjects) d.networkProjects = normalizeProjects(d.networkProjects);
    if (!d.activityLog)    d.activityLog     = [];
    return d;
  } catch (_) { return null; }
}

/**
 * Lit le storage une seule fois et retourne un objet initial complet.
 */
export function hydrateInitialAppState() {
  const saved = loadState();
  return {
    substations:     saved?.substations     || INITIAL_SUBSTATIONS,
    networkProjects: saved?.networkProjects  || INITIAL_NETWORK_PROJECTS,
    activityLog:     saved?.activityLog     || [],
    savedAt:         saved?.savedAt         || null,
    hasSession:      !!saved,
  };
}

export function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  try { localStorage.removeItem(LEGACY_KEY_V5); } catch (_) {}
}

// ── Export JSON ─────────────────────────────────────────────────────────────

export function exportJSON(substations, networkProjects = [], activityLog = []) {
  const data = JSON.stringify({
    version:    STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    substations,
    networkProjects,
    activityLog,
  }, null, 2);
  _triggerDownload(data, `resa-capacite-${_today()}.json`, 'application/json');
}

// ── Export CSV ──────────────────────────────────────────────────────────────

export function exportCSV(substations, networkProjects = []) {
  const header = [
    'Sous-station', 'Code', 'Commune', 'Cap.N-1 (MVA)', 'Cap.Inverse.N-1 (MVA)',
    ...YEARS.flatMap(y => [
      `CapDirN1_${y}`, `CapRevN1_${y}`,
      `WRigid_${y}`, `WTotal_${y}`,
      `InjRigid_${y}`, `InjTotal_${y}`,
      `ResW_${y}`, `ResI_${y}`,
      `UtilW_${y}`, `UtilI_${y}`,
    ]),
  ].join(';');

  const rows = substations.map(s => {
    const cols = [
      s.name, s.code, s.commune,
      s.plannableCapacity,
      (s.plannableCapacity * (s.transformerConfig?.reverseCapacityRatio ?? 1.0)).toFixed(1),
    ];
    YEARS.forEach(y => {
      cols.push(
        getDirectCapacityN1AtYear(s, y, networkProjects).toFixed(2),
        getReverseCapacityN1AtYear(s, y, networkProjects).toFixed(2),
        getWithdrawalRigid(s, y, false, networkProjects).toFixed(2),
        getWithdrawalTotal(s, y, false, networkProjects).toFixed(2),
        getInjectionRigid(s, y, false, networkProjects).toFixed(2),
        getInjectionTotal(s, y, false, networkProjects).toFixed(2),
        getResidualWithdrawalRigid(s, y, networkProjects).toFixed(2),
        getResidualInjectionRigid(s, y, networkProjects).toFixed(2),
        (getUtilizationWithdrawalRigid(s, y, networkProjects) * 100).toFixed(1) + '%',
        (getUtilizationInjectionRigid(s, y, networkProjects) * 100).toFixed(1) + '%',
      );
    });
    return cols.join(';');
  });

  _triggerDownload(
    '\uFEFF' + [header, ...rows].join('\n'),
    `resa-export-${_today()}.csv`,
    'text/csv;charset=utf-8'
  );
}

// ── Import JSON ─────────────────────────────────────────────────────────────

export function importJSONFile(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (!d.substations)
        throw new Error('Format invalide : propriété substations manquante.');

      // Accept v5 or v6 (migrate v5 on import)
      if (d.version && d.version > STORAGE_VERSION)
        throw new Error(
          `Format v${d.version} détecté — version postérieure (actuelle : v${STORAGE_VERSION}).`
        );

      d.substations     = normalizeSubstations(d.substations);
      if (d.networkProjects) d.networkProjects = normalizeProjects(d.networkProjects);
      if (!d.activityLog) d.activityLog = [];
      onSuccess(d);
    } catch (err) { onError(err.message); }
  };
  reader.readAsText(file);
}

// ── Helpers privés ──────────────────────────────────────────────────────────

function _today() { return new Date().toISOString().slice(0, 10); }

function _triggerDownload(content, filename, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
