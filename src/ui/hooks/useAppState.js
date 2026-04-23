/**
 * hooks/useAppState.js
 * Centralized state management via useReducer.
 * Replaces the scattered useState calls in App.jsx.
 * Engines/services/data are NOT touched — only consumed.
 */
import { useReducer, useEffect, useCallback } from 'react';
import { INITIAL_SUBSTATIONS, INITIAL_NETWORK_PROJECTS } from '../../data/initial.js';
import { uid, fmtDate } from '../../utils/format.js';
import { saveState, clearState, hydrateInitialAppState } from '../../services/storage.js';
import { normalizeStatus, normalizeSubstations } from '../../utils/normalize.js';

// ── Action types ──────────────────────────────────────────────────────────────
const A = {
  UPDATE_SUBSTATION:   'UPDATE_SUBSTATION',
  SET_SUBSTATIONS:     'SET_SUBSTATIONS',
  UPDATE_PROJECT:      'UPDATE_PROJECT',
  ADD_PROJECT:         'ADD_PROJECT',
  DELETE_PROJECT:      'DELETE_PROJECT',
  SET_PROJECTS:        'SET_PROJECTS',
  ADD_LOG_ENTRY:       'ADD_LOG_ENTRY',
  DELETE_LOG_ENTRY:    'DELETE_LOG_ENTRY',
  SET_ACTIVITY_LOG:    'SET_ACTIVITY_LOG',
  DISMISS_BANNER:      'DISMISS_BANNER',
  RESET_TO_DEFAULTS:   'RESET_TO_DEFAULTS',
  IMPORT_DATA:         'IMPORT_DATA',
};

// ── Reducer ───────────────────────────────────────────────────────────────────
function appReducer(state, action) {
  switch (action.type) {

    case A.UPDATE_SUBSTATION:
      return {
        ...state,
        substations: state.substations.map(s =>
          s.id === action.payload.id ? normalizeSubstations([action.payload])[0] : s
        ),
      };

    case A.SET_SUBSTATIONS:
      return { ...state, substations: action.payload };

    case A.UPDATE_PROJECT:
      return {
        ...state,
        networkProjects: state.networkProjects.map(p =>
          p.id === action.payload.id
            ? { ...action.payload, status: normalizeStatus(action.payload.status) }
            : p
        ),
      };

    case A.ADD_PROJECT:
      return {
        ...state,
        networkProjects: [...state.networkProjects, { ...action.payload, id: uid() }],
      };

    case A.DELETE_PROJECT:
      return {
        ...state,
        networkProjects: state.networkProjects.filter(p => p.id !== action.payload),
      };

    case A.SET_PROJECTS:
      return { ...state, networkProjects: action.payload };

    case A.ADD_LOG_ENTRY:
      return {
        ...state,
        activityLog: [action.payload, ...state.activityLog].slice(0, 50),
      };

    case A.DELETE_LOG_ENTRY: {
      const { logId, subId, dataId } = action.payload;
      const sub = state.substations.find(s => s.id === subId);
      if (!sub) return state;
      return {
        ...state,
        substations: state.substations.map(s =>
          s.id === subId
            ? { ...s, connectionRequests: s.connectionRequests.filter(r => r.id !== dataId) }
            : s
        ),
        activityLog: state.activityLog.filter(l => l.id !== logId),
      };
    }

    case A.SET_ACTIVITY_LOG:
      return { ...state, activityLog: action.payload };

    case A.DISMISS_BANNER:
      return { ...state, sessionBanner: false };

    case A.RESET_TO_DEFAULTS:
      clearState();
      return {
        ...state,
        substations: INITIAL_SUBSTATIONS,
        networkProjects: INITIAL_NETWORK_PROJECTS,
        activityLog: [],
        sessionBanner: false,
      };

    case A.IMPORT_DATA:
      return {
        ...state,
        substations: action.payload.substations,
        networkProjects: action.payload.networkProjects || state.networkProjects,
        activityLog: Array.isArray(action.payload.activityLog) ? action.payload.activityLog : [],
        sessionBanner: false,
      };

    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAppState() {
  const initial = hydrateInitialAppState();

  const [state, dispatch] = useReducer(appReducer, {
    substations:    initial.substations,
    networkProjects: initial.networkProjects,
    activityLog:    initial.activityLog,
    savedAt:        initial.savedAt,
    sessionBanner:  initial.hasSession,
  });

  // Autosave
  useEffect(() => {
    saveState(state.substations, state.networkProjects, state.activityLog);
  }, [state.substations, state.networkProjects, state.activityLog]);

  // ── Memoized action creators ────────────────────────────────────────────
  const actions = {
    updateSubstation: useCallback(
      sub => dispatch({ type: A.UPDATE_SUBSTATION, payload: sub }),
      []
    ),
    updateProject: useCallback(
      proj => dispatch({ type: A.UPDATE_PROJECT, payload: proj }),
      []
    ),
    addProject: useCallback(
      proj => dispatch({ type: A.ADD_PROJECT, payload: proj }),
      []
    ),
    deleteProject: useCallback(
      id => dispatch({ type: A.DELETE_PROJECT, payload: id }),
      []
    ),
    submitSaisie: useCallback(({ subId, entryType, data }) => {
      // We need current state, so this is a two-step dispatch
      dispatch((_, getState) => {
        // Note: useReducer doesn't support thunks. We handle this externally.
      });
    }, []),
    // Saisie submit requires access to current substations — handled by App.jsx wrapper
    addLogEntry: useCallback(
      entry => dispatch({ type: A.ADD_LOG_ENTRY, payload: entry }),
      []
    ),
    deleteLogEntry: useCallback(
      payload => dispatch({ type: A.DELETE_LOG_ENTRY, payload }),
      []
    ),
    dismissBanner: useCallback(
      () => dispatch({ type: A.DISMISS_BANNER }),
      []
    ),
    resetToDefaults: useCallback(
      () => dispatch({ type: A.RESET_TO_DEFAULTS }),
      []
    ),
    importData: useCallback(
      data => dispatch({ type: A.IMPORT_DATA, payload: data }),
      []
    ),
  };

  return { state, actions, dispatch };
}

export { A as ActionTypes };
