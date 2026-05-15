import React, { useState, useRef } from 'react';
import { exportJSON, exportCSV, importJSONFile } from '../../services/storage.js';

export function ExportImportMenu({
  substations,
  onImport,
  networkProjects = [],
  activityLog = [],
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="v3-nav-item"
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: 12, padding: '6px 10px', gap: 6 }}
        title="Exporter / Importer"
      >
        ⇅ Données
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '110%',
            left: 0,
            minWidth: 180,
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 999,
            padding: '4px 0',
          }}
        >
          <button
            className="export-menu-item"
            onClick={() => {
              exportJSON(substations, networkProjects, activityLog);
              setOpen(false);
            }}
          >
            ↓ Exporter JSON
          </button>
          <button
            className="export-menu-item"
            onClick={() => {
              exportCSV(substations, networkProjects);
              setOpen(false);
            }}
          >
            ↓ Exporter CSV
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
          <button
            className="export-menu-item"
            onClick={() => {
              fileRef.current?.click();
              setOpen(false);
            }}
          >
            ↑ Importer JSON
          </button>
          {error && (
            <div
              style={{
                padding: '6px 12px',
                fontSize: 11,
                color: 'var(--red)',
                borderTop: '1px solid var(--border)',
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          importJSONFile(
            f,
            (data) => {
              setError(null);
              onImport(data);
              setOpen(false);
            },
            (msg) => setError(msg),
          );
          e.target.value = '';
        }}
      />
    </div>
  );
}
