import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ExecutiveProvider } from './contexts/ExecutiveContext';
import ExecutivePlatformPage from './pages/ExecutivePlatformPage';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import Companies from './pages/Companies';
import CompanyDashboard from './pages/CompanyDashboard';
import AgentUsers from './pages/AgentUsers';
import AgentRoles from './pages/AgentRoles';
import Tables from './pages/Tables';
import DictionarySyncPage from './pages/DictionarySyncPage';
import SnapshotsPage from './pages/SnapshotsPage';
import PermissionEditorPage from './pages/PermissionEditorPage';
import QueryGuardPage from './pages/QueryGuardPage';
import RagMemories from './pages/RagMemories';
import Logs from './pages/Logs';
import AuditUsagePage from './pages/AuditUsagePage';
import Infra from './pages/Infra';
import Integrations from './pages/Integrations';
import Licenses from './pages/Licenses';
import Config from './pages/Config';
import Adminer from './pages/Adminer';
import LoginPage from './pages/LoginPage';

export default function App() {
  return (
    <AuthProvider>
      <ExecutiveProvider>
        <BrowserRouter>
          <Routes>
            {/* PROTHEUS COPILOTO EXECUTIVO — Main Executive Intelligence Experience */}
            <Route path="/" element={<ExecutivePlatformPage />} />
            <Route path="/executive" element={<ExecutivePlatformPage />} />
            <Route path="/copilot" element={<ExecutivePlatformPage />} />

            {/* Admin & Governance Portal */}
            <Route path="/admin/login" element={<LoginPage />} />
            <Route path="/admin" element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="tenants" element={<Tenants />} />
              <Route path="companies" element={<Companies />} />
              <Route path="company-dashboard" element={<CompanyDashboard />} />
              <Route path="users" element={<AgentUsers />} />
              <Route path="roles" element={<AgentRoles />} />
              <Route path="tables" element={<Tables />} />
              <Route path="dictionary" element={<DictionarySyncPage />} />
              <Route path="snapshots" element={<SnapshotsPage />} />
              <Route path="permissions" element={<PermissionEditorPage />} />
              <Route path="query-guard" element={<QueryGuardPage />} />
              <Route path="knowledge" element={<RagMemories />} />
              <Route path="logs" element={<Logs />} />
              <Route path="audit" element={<AuditUsagePage />} />
              <Route path="platform" element={<Infra />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="licenses" element={<Licenses />} />
              <Route path="config" element={<Config />} />
              <Route path="adminer" element={<Adminer />} />
            </Route>

            {/* Fallback to executive platform */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ExecutiveProvider>
    </AuthProvider>
  );
}
