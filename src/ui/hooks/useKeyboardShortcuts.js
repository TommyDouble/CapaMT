/**
 * hooks/useKeyboardShortcuts.js
 * Global keyboard shortcuts for power-user navigation.
 *
 * Ctrl+N — Open new connection request modal
 * Ctrl+1..4 — Navigate to views (overview, list, queue, projects)
 * Ctrl+/ — Focus search (if search field exists)
 */
import { useEffect } from 'react';

export function useKeyboardShortcuts({ onOpenSaisie, onNav }) {
  useEffect(() => {
    const handler = (e) => {
      // Don't capture when typing in inputs
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Only capture Escape inside inputs
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'n') {
        e.preventDefault();
        onOpenSaisie();
        return;
      }

      if (ctrl && e.key === '1') { e.preventDefault(); onNav('overview'); return; }
      if (ctrl && e.key === '2') { e.preventDefault(); onNav('list'); return; }
      if (ctrl && e.key === '3') { e.preventDefault(); onNav('file_attente'); return; }
      if (ctrl && e.key === '4') { e.preventDefault(); onNav('investissements'); return; }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onOpenSaisie, onNav]);
}
