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
  carte:           'la carte',
  detail:          'la sous-station',
  request_case:    'le dossier',
};

export function useNavigation() {
  const [view,          setView]         = useState('overview');
  const [navActive,     setNavActive]    = useState('overview');
  const [selectedId,    setSelectedId]   = useState(null);
  const [selectedTab,   setSelectedTab]  = useState('evolution');
  const [selectedReqId, setSelectedReqId] = useState(null);
  const [prevView,      setPrevView]     = useState('list');

  // Use ref for view to avoid stale closures in callbacks
  const viewRef = useRef(view);
  viewRef.current = view;

  const nav = v => {
    setView(v);
    setNavActive(v);
    setSelectedId(null);
    setSelectedReqId(null);
  };

  const handleSelect = (id, tab) => {
    const currentView = viewRef.current;
    if (currentView !== 'detail' && currentView !== 'request_case') setPrevView(currentView);
    setSelectedId(id);
    setSelectedReqId(null);
    setView('detail');
    setNavActive('list');
    setSelectedTab(tab || 'evolution');
  };

  const navigateToRequest = (subId, reqId) => {
    const currentView = viewRef.current;
    if (currentView !== 'request_case') setPrevView(currentView);
    setSelectedId(subId);
    setSelectedReqId(reqId);
    setView('request_case');
    setNavActive('file_attente');
  };

  const handleBack = () => {
    setView(prevView);
    setNavActive(prevView);
    setSelectedId(null);
    setSelectedReqId(null);
  };

  const prevLabel = PREV_LABELS[prevView];

  return {
    view, navActive, selectedId, selectedTab, selectedReqId,
    prevView, prevLabel,
    nav, handleSelect, handleBack, navigateToRequest,
  };
}
