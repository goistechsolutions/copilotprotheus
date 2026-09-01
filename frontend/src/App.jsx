import React, { useState, useEffect } from 'react';
import AgentWorkspace from './pages/AgentWorkspace';
import ExecutiveDashboard from './pages/ExecutiveDashboard';

export default function App() {
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = urlParams.get('page');
      if (pageParam === 'workspace' || pageParam === 'agent' || pageParam === 'chat') return 'workspace';
      if (pageParam === 'dashboard' || pageParam === 'executivo') return 'dashboard';
    } catch {}
    return 'dashboard';
  });

  const [selectedArea, setSelectedArea] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('area') || 'financeiro';
    } catch {
      return 'financeiro';
    }
  });

  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = urlParams.get('page');
      const areaParam = urlParams.get('area');
      if (areaParam) setSelectedArea(areaParam);
      if (pageParam === 'workspace' || pageParam === 'agent' || pageParam === 'chat') {
        setCurrentPage('workspace');
      } else {
        setCurrentPage('dashboard');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToDashboard = (targetArea) => {
    if (targetArea) {
      setSelectedArea(targetArea);
    }
    setCurrentPage('dashboard');
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('page', 'dashboard');
      if (targetArea) {
        url.searchParams.set('area', targetArea);
      }
      window.history.pushState({}, '', url.toString());
    } catch {}
  };

  const navigateToWorkspace = () => {
    setCurrentPage('workspace');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('page');
      window.history.pushState({}, '', url.toString());
    } catch {}
  };

  if (currentPage === 'dashboard') {
    return (
      <ExecutiveDashboard
        initialArea={selectedArea}
        onNavigateToWorkspace={navigateToWorkspace}
      />
    );
  }

  return <AgentWorkspace onNavigateToDashboard={navigateToDashboard} />;
}
