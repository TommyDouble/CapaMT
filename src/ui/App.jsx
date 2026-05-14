/**
 * ui/App.jsx — v2.0
 * Orchestrateur principal — navigation via useNavigation hook.
 * État global conservé ici (useReducer non branché car cross-cutting saisie/log).
 * Navigation entièrement déléguée au hook.
 */
import React, {
  createContext, useContext, useState, useEffect,
} from 'react';

import { INITIAL_SUBSTATIONS, INITIAL_NETWORK_PROJECTS } from '../data/initial.js';
import { uid, fmtDate }                from '../utils/format.js';
import {
  saveState, clearState, hydrateInitialAppState,
} from '../services/storage.js';
import { getEffectiveSubstations }     from '../engines/capacity.js';
import { normalizeProjects, normalizeStatus, normalizeSubstations } from '../utils/normalize.js';

// Shell
import { ThemeProvider }               from './shell/ThemeToggle.jsx';
import { Sidebar }                     from './shell/Sidebar.jsx';
import { Topbar }                      from './shell/Topbar.jsx';

// Pages
import { Overview }                    from './pages/overview/OverviewPage.jsx';
import { SubstationList }              from './pages/substations/SubstationListPage.jsx';
import { SubstationDetail }            from './pages/substations/SubstationDetail.jsx';
import { GlobalQueuePage }             from './pages/queue/GlobalQueuePage.jsx';
import { NetworkProjectsPage }         from './pages/projects/NetworkProjectsPage.jsx';
import { RequestCasePage }             from './pages/requests/RequestCasePage.jsx';

// Modals & drawers
import { SaisieModal }                 from './pages/intake/SaisieModal.jsx';
import { ActivityLogDrawer }           from './shared/ActivityLogDrawer.jsx';

// Hooks
import { useNavigation }               from './hooks/useNavigation.js';
import { useKeyboardShortcuts }        from './hooks/useKeyboardShortcuts.js';

// ── Context projets réseau ────────────────────────────────────────────────────
export const ProjectsCtx = createContext([]);
export const useProjects  = () => useContext(ProjectsCtx);

function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const _initial = hydrateInitialAppState();
  const [substations,     setSubstations]    = useState(() => _initial.substations);
  const [networkProjects, setNetworkProjects] = useState(() => _initial.networkProjects);
  const [activityLog,     setActivityLog]    = useState(() => _initial.activityLog);
  const [savedAt]                            = useState(() => _initial.savedAt);
  const [sessionBanner,   setSessionBanner]  = useState(() => _initial.hasSession);

  // ── Navigation (hook) ──────────────────────────────────────────────────────
  const {
    view, navActive, selectedId, selectedTab, selectedReqId, prevLabel,
    nav, handleSelect, handleBack, navigateToRequest,
  } = useNavigation();

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [showSaisie,      setShowSaisie]     = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useKeyboardShortcuts({
    onOpenSaisie: () => setShowSaisie(true),
    onNav: nav,
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const allSubstations = getEffectiveSubstations(substations, networkProjects, 2035);
  const selected       = allSubstations.find(s => s.id === selectedId) || null;

  // ── Autosave ───────────────────────────────────────────────────────────────
  useEffect(() => {
    saveState(substations, networkProjects, activityLog);
  }, [substations, networkProjects, activityLog]);

  // ── Data handlers ──────────────────────────────────────────────────────────
  const handleUpdate = updated =>
    setSubstations(prev => prev.map(s => s.id === updated.id ? normalizeSubstations([updated])[0] : s));

  const handleAddActivity = entry =>
    setActivityLog(prev => [{
      id: uid(),
      timestamp: new Date().toISOString(),
      entryType: 'request_activity',
      ...entry,
    }, ...prev].slice(0, 100));

  const handleUpdateProject = updated =>
    setNetworkProjects(prev => prev.map(p => p.id === updated.id ? { ...updated, status: normalizeStatus(updated.status) } : p));

  const handleAddProject = proj =>
    setNetworkProjects(prev => [...prev, { ...proj, id: uid() }]);

  const handleDeleteProject = id =>
    setNetworkProjects(prev => prev.filter(p => p.id !== id));

  const handleSaisieSubmit = ({ subId, entryType, data }) => {
    const sub = substations.find(s => s.id === subId);
    if (!sub) return;
    const newEntry = { ...data, id: uid() };
    handleUpdate({ ...sub, connectionRequests: [...sub.connectionRequests, newEntry] });
    setActivityLog(prev =>
      [{ id: uid(), entryType, subId, subName: sub.name, subCode: sub.code, data: newEntry,
         timestamp: new Date().toISOString() }, ...prev].slice(0, 50)
    );
  };

  const handleLogDelete = ({ logId, subId, dataId }) => {
    const sub = substations.find(s => s.id === subId);
    if (!sub) return;
    handleUpdate({ ...sub, connectionRequests: sub.connectionRequests.filter(r => r.id !== dataId) });
    setActivityLog(prev => prev.filter(l => l.id !== logId));
  };

  const handleImport = data => {
    setSubstations(data.substations);
    if (data.networkProjects) setNetworkProjects(data.networkProjects);
    setActivityLog(Array.isArray(data.activityLog) ? data.activityLog : []);
    setSessionBanner(false);
  };

  const handleReset = () => {
    setSubstations(normalizeSubstations(INITIAL_SUBSTATIONS));
    setNetworkProjects(normalizeProjects(INITIAL_NETWORK_PROJECTS));
    setActivityLog([]);
    clearState();
    setSessionBanner(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ProjectsCtx.Provider value={networkProjects}>
      <div className="app-layout">
        <Sidebar
          navActive={navActive} onNav={nav}
          substations={allSubstations}
          networkProjects={networkProjects}
          activityLog={activityLog}
          onImport={handleImport}
          onOpenSaisie={() => setShowSaisie(true)}
          onOpenActivityLog={() => setShowActivityLog(true)}
        />

        <div className="app-layout__main">
          <Topbar view={view} detailName={selected?.name} onBack={handleBack} />

          <div className="app-layout__content">
            {sessionBanner && (
              <div className="session-banner">
                <span>Session précédente restaurée depuis le {fmtDate(savedAt || new Date())}</span>
                <div className="flex items-center gap-3">
                  <button className="btn-primary" style={{ fontSize: 12, padding: '5px 14px' }}
                    onClick={() => setSessionBanner(false)}>
                    ✓ Reprendre cette session
                  </button>
                  <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 14px' }}
                    onClick={handleReset}>
                    Repartir des données d'exemple
                  </button>
                </div>
              </div>
            )}

            {view === 'overview'        && <Overview substations={allSubstations} onNavigate={handleSelect} />}
            {view === 'list'            && <SubstationList substations={allSubstations} onSelect={handleSelect} />}
            {view === 'file_attente'    && (
              <GlobalQueuePage substations={allSubstations} onNavigate={handleSelect}
                onNavigateToRequest={navigateToRequest}
                onAdd={() => setShowSaisie(true)} />
            )}
            {view === 'investissements' && (
              <NetworkProjectsPage substations={substations} allSubstations={allSubstations}
                projects={networkProjects} onNavigate={handleSelect}
                onUpdateProject={handleUpdateProject} onAddProject={handleAddProject}
                onDeleteProject={handleDeleteProject} />
            )}
            {view === 'detail' && selected && (
              <SubstationDetail sub={selected} initialTab={selectedTab}
                onBack={handleBack} onUpdate={handleUpdate} prevViewLabel={prevLabel}
                onNavigateToRequest={navigateToRequest} />
            )}
            {view === 'request_case' && selected && (
              <RequestCasePage
                sub={selected}
                reqId={selectedReqId}
                projects={networkProjects}
                activityLog={activityLog}
                onBack={handleBack}
                onUpdate={handleUpdate}
                onActivity={handleAddActivity}
                onLogDelete={handleLogDelete}
                prevViewLabel={prevLabel}
              />
            )}
          </div>
        </div>

        <SaisieModal
          show={showSaisie}
          onClose={() => setShowSaisie(false)}
          substations={allSubstations}
          activityLog={activityLog}
          onSubmit={handleSaisieSubmit}
          onLogDelete={handleLogDelete}
          onNavigate={handleSelect}
          onGoToProjects={() => { setShowSaisie(false); nav('investissements'); }}
        />

        <ActivityLogDrawer
          show={showActivityLog}
          onClose={() => setShowActivityLog(false)}
          activityLog={activityLog}
          onLogDelete={handleLogDelete}
          onNavigate={handleSelect}
        />
      </div>
    </ProjectsCtx.Provider>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error('React Error:', e, info); }
  render() {
    if (this.state.error) {
      return React.createElement('div',
        { style: { padding: 32, fontFamily: 'monospace', background: 'var(--red-light)', color: 'var(--red)', borderRadius: 12, margin: 24 } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, marginBottom: 12 } }, '❌ Erreur React'),
        React.createElement('pre', { style: { fontSize: 12, whiteSpace: 'pre-wrap' } },
          String(this.state.error) + '\n\n' + (this.state.error.stack || '')));
    }
    return this.props.children;
  }
}

export default function AppWithBoundary() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
