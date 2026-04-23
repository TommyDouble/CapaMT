/**
 * hooks/useNavigation.js
 * Centralized navigation state and handlers.
 * No useCallback — these handlers are cheap and avoid stale-closure issues.
 */
import { useState, useRef } from 'react';

const PREV_LABELS = {
  list:            'la liste',
  overview:        "la vue d'ensemble",
  file_attente:    "la file d'attente",
  investissements: 'le portefeuille',
};

export function useNavigation() {
  const [view,        setView]       = useState('overview');
  const [navActive,   setNavActive]  = useState('overview');
  const [selectedId,  setSelectedId] = useState(null);
  const [selectedTab, setSelectedTab] = useState('evolution');
  const [prevView,    setPrevView]   = useState('list');

  // Use ref for view to avoid stale closures in callbacks
  const viewRef = useRef(view);
  viewRef.current = view;

  const nav = v => {
    setView(v);
    setNavActive(v);
    setSelectedId(null);
  };

  const handleSelect = (id, tab) => {
    const currentView = viewRef.current;
    if (currentView !== 'detail') setPrevView(currentView);
    setSelectedId(id);
    setView('detail');
    setNavActive('list');
    setSelectedTab(tab || 'evolution');
  };

  const handleBack = () => {
    setView(prevView);
    setNavActive(prevView);
    setSelectedId(null);
  };

  const prevLabel = PREV_LABELS[prevView];

  return {
    view, navActive, selectedId, selectedTab,
    prevView, prevLabel,
    nav, handleSelect, handleBack,
  };
}
