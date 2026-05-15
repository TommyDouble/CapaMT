/**
 * ui/App.jsx — v2.0
 * Orchestrateur principal — navigation via useNavigation hook.
 * État global conservé ici (useReducer non branché car cross-cutting saisie/log).
 * Navigation entièrement déléguée au hook.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { INITIAL_SUBSTATIONS, INITIAL_NETWORK_PROJECTS } from '../data/initial.js';
import { uid, fmtDate } from '../utils/format.js';
import { saveState, clearState, hydrateInitialAppState, exportJSON } from '../services/storage.js';
import { getEffectiveSubstations } from '../engines/capacity.js';
import { normalizeProjects, normalizeStatus, normalizeSubstations } from '../utils/normalize.js';

// Shell
import { ThemeProvider } from './shell/ThemeToggle.jsx';
import { Sidebar } from './shell/Sidebar.jsx';
import { Topbar } from './shell/Topbar.jsx';

// Pages
import { Overview } from './pages/overview/OverviewPage.jsx';
import { SubstationList } from './pages/substations/SubstationListPage.jsx';
import { SubstationDetail } from './pages/substations/SubstationDetail.jsx';
import { GlobalQueuePage } from './pages/queue/GlobalQueuePage.jsx';
import { NetworkProjectsPage } from './pages/projects/NetworkProjectsPage.jsx';
import { RequestCasePage } from './pages/requests/RequestCasePage.jsx';
import { MapPage } from './pages/map/MapPage.jsx';

// Modals & drawers
import { SaisieModal } from './pages/intake/SaisieModal.jsx';
import { ActivityLogDrawer } from './shared/ActivityLogDrawer.jsx';
import { ModalShell } from './shared/ModalShell.jsx';

// Hooks
import { useNavigation } from './hooks/useNavigation.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';

// ── Context projets réseau ────────────────────────────────────────────────────
export const ProjectsCtx = createContext([]);
export const useProjects = () => useContext(ProjectsCtx);

function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const _initial = hydrateInitialAppState();
  const [substations, setSubstations] = useState(() => _initial.substations);
  const [networkProjects, setNetworkProjects] = useState(() => _initial.networkProjects);
  const [activityLog, setActivityLog] = useState(() => _initial.activityLog);
  const [savedAt] = useState(() => _initial.savedAt);
  const [sessionBanner, setSessionBanner] = useState(() => _initial.hasSession);
  const [storageWarning, setStorageWarning] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');

  // ── Navigation (hook) ──────────────────────────────────────────────────────
  const {
    view,
    navActive,
    selectedId,
    selectedTab,
    selectedReqId,
    prevLabel,
    nav,
    handleSelect,
    handleBack,
    navigateToRequest,
  } = useNavigation();

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [showSaisie, setShowSaisie] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const contentRef = useRef(null);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useKeyboardShortcuts({
    onOpenSaisie: () => setShowSaisie(true),
    onNav: nav,
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const allSubstations = useMemo(
    () => getEffectiveSubstations(substations, networkProjects, 2035),
    [substations, networkProjects],
  );
  const selected = useMemo(
    () => allSubstations.find((s) => s.id === selectedId) || null,
    [allSubstations, selectedId],
  );

  // ── Autosave ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const result = saveState(substations, networkProjects, activityLog);
    if (result.ok) {
      setStorageWarning((current) => (current ? null : current));
      return;
    }
    setStorageWarning(result);
  }, [substations, networkProjects, activityLog]);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [view, selectedId, selectedReqId]);

  // ── Data handlers ──────────────────────────────────────────────────────────
  const handleUpdate = (updated) =>
    setSubstations((prev) =>
      prev.map((s) => (s.id === updated.id ? normalizeSubstations([updated])[0] : s)),
    );

  const handleAddActivity = (entry) =>
    setActivityLog((prev) =>
      [
        {
          id: uid(),
          timestamp: new Date().toISOString(),
          entryType: 'request_activity',
          ...entry,
        },
        ...prev,
      ].slice(0, 100),
    );

  const handleUpdateProject = (updated) =>
    setNetworkProjects((prev) =>
      prev.map((p) =>
        p.id === updated.id ? { ...updated, status: normalizeStatus(updated.status) } : p,
      ),
    );

  const handleAddProject = (proj) =>
    setNetworkProjects((prev) => [...prev, { ...proj, id: uid() }]);

  const handleDeleteProject = (id) => setNetworkProjects((prev) => prev.filter((p) => p.id !== id));

  const handleSaisieSubmit = ({ subId, entryType, data }) => {
    const sub = substations.find((s) => s.id === subId);
    if (!sub) return;
    const newEntry = { ...data, id: uid() };
    handleUpdate({ ...sub, connectionRequests: [...sub.connectionRequests, newEntry] });
    setActivityLog((prev) =>
      [
        {
          id: uid(),
          entryType,
          subId,
          subName: sub.name,
          subCode: sub.code,
          data: newEntry,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 50),
    );
  };

  const handleLogDelete = ({ logId, subId, dataId }) => {
    const sub = substations.find((s) => s.id === subId);
    if (!sub) return;
    handleUpdate({
      ...sub,
      connectionRequests: sub.connectionRequests.filter((r) => r.id !== dataId),
    });
    setActivityLog((prev) => prev.filter((l) => l.id !== logId));
  };

  const handleImport = (data) => {
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
    setShowResetConfirm(false);
    setResetConfirmation('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ProjectsCtx.Provider value={networkProjects}>
      <div className="app-layout">
        <Sidebar
          navActive={navActive}
          onNav={nav}
          substations={allSubstations}
          networkProjects={networkProjects}
          activityLog={activityLog}
          onImport={handleImport}
          onOpenSaisie={() => setShowSaisie(true)}
          onOpenActivityLog={() => setShowActivityLog(true)}
        />

        <div className="app-layout__main">
          <Topbar view={view} detailName={selected?.name} onBack={handleBack} />

          <div className="app-layout__content" ref={contentRef}>
            {sessionBanner && (
              <div className="session-banner">
                <span>Session précédente restaurée depuis le {fmtDate(savedAt || new Date())}</span>
                <div className="flex items-center gap-3">
                  <button
                    className="btn-primary"
                    style={{ fontSize: 12, padding: '5px 14px' }}
                    onClick={() => setSessionBanner(false)}
                  >
                    ✓ Reprendre cette session
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 12, padding: '5px 14px' }}
                    onClick={() => {
                      setResetConfirmation('');
                      setShowResetConfirm(true);
                    }}
                  >
                    Repartir des données d'exemple
                  </button>
                </div>
              </div>
            )}

            {storageWarning && (
              <div
                className="session-banner"
                style={{
                  borderColor: 'var(--amber)',
                  background: 'var(--amber-dim)',
                }}
              >
                <span>
                  {storageWarning.reason === 'quota'
                    ? 'Sauvegarde locale impossible : le stockage du navigateur est plein.'
                    : 'Sauvegarde locale impossible : une erreur navigateur est survenue.'}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    className="btn-primary"
                    style={{ fontSize: 12, padding: '5px 14px' }}
                    onClick={() => exportJSON(substations, networkProjects, activityLog)}
                  >
                    Exporter JSON
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 12, padding: '5px 14px' }}
                    onClick={() => setStorageWarning(null)}
                  >
                    Masquer
                  </button>
                </div>
              </div>
            )}

            {view === 'overview' && (
              <Overview substations={allSubstations} onNavigate={handleSelect} />
            )}
            {view === 'list' && (
              <SubstationList substations={allSubstations} onSelect={handleSelect} />
            )}
            {view === 'file_attente' && (
              <GlobalQueuePage
                substations={allSubstations}
                onNavigate={handleSelect}
                onNavigateToRequest={navigateToRequest}
                onAdd={() => setShowSaisie(true)}
              />
            )}
            {view === 'investissements' && (
              <NetworkProjectsPage
                substations={substations}
                allSubstations={allSubstations}
                projects={networkProjects}
                onNavigate={handleSelect}
                onUpdateProject={handleUpdateProject}
                onAddProject={handleAddProject}
                onDeleteProject={handleDeleteProject}
              />
            )}
            {view === 'detail' && selected && (
              <SubstationDetail
                sub={selected}
                initialTab={selectedTab}
                onBack={handleBack}
                onUpdate={handleUpdate}
                prevViewLabel={prevLabel}
                onNavigateToRequest={navigateToRequest}
              />
            )}
            {view === 'carte' && (
              <MapPage
                baseSubstations={substations}
                displaySubstations={allSubstations}
                projects={networkProjects}
                onUpdateSubstation={handleUpdate}
              />
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
          onGoToProjects={() => {
            setShowSaisie(false);
            nav('investissements');
          }}
        />

        <ActivityLogDrawer
          show={showActivityLog}
          onClose={() => setShowActivityLog(false)}
          activityLog={activityLog}
          onLogDelete={handleLogDelete}
          onNavigate={handleSelect}
        />

        {showResetConfirm && (
          <ModalShell
            title="Repartir des données d'exemple"
            subtitle="Cette action remplace la session locale par les données de démonstration."
            onClose={() => {
              setShowResetConfirm(false);
              setResetConfirmation('');
            }}
            footer={
              <>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowResetConfirm(false);
                    setResetConfirmation('');
                  }}
                >
                  Annuler
                </button>
                <button
                  className="btn-primary"
                  disabled={resetConfirmation !== 'REINITIALISER'}
                  onClick={handleReset}
                >
                  Réinitialiser
                </button>
              </>
            }
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Les sous-stations, projets réseau et activités de cette session locale seront
                remplacés. Exportez vos données avant de confirmer si vous souhaitez les conserver.
              </p>
              <label
                htmlFor="reset-confirmation"
                style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}
              >
                Saisissez REINITIALISER pour confirmer
                <input
                  id="reset-confirmation"
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  autoFocus
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </label>
            </div>
          </ModalShell>
        )}
      </div>
    </ProjectsCtx.Provider>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e) {
    return { error: e };
  }
  componentDidCatch(e, info) {
    console.error('React Error:', e, info);
  }
  render() {
    if (this.state.error) {
      return React.createElement(
        'div',
        {
          style: {
            padding: 32,
            fontFamily: 'monospace',
            background: 'var(--red-light)',
            color: 'var(--red)',
            borderRadius: 12,
            margin: 24,
          },
        },
        React.createElement(
          'h2',
          { style: { fontSize: 18, fontWeight: 700, marginBottom: 12 } },
          '❌ Erreur React',
        ),
        React.createElement(
          'pre',
          { style: { fontSize: 12, whiteSpace: 'pre-wrap' } },
          String(this.state.error) + '\n\n' + (this.state.error.stack || ''),
        ),
      );
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
