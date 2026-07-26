import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import { lazy, Suspense } from 'react';

// --- Pages ---
const Tenants            = lazy(() => import('./pages/Tenants'));
const Companies          = lazy(() => import('./pages/Companies'));
const CompanyDashboard   = lazy(() => import('./pages/CompanyDashboard'));
const AgentUsers         = lazy(() => import('./pages/AgentUsers'));
const AgentRoles         = lazy(() => import('./pages/AgentRoles'));
const RagMemories        = lazy(() => import('./pages/RagMemories'));
const Logs               = lazy(() => import('./pages/Logs'));
const AuditUsagePage     = lazy(() => import('./pages/AuditUsagePage'));
const Infra              = lazy(() => import('./pages/Infra'));
const Config             = lazy(() => import('./pages/Config'));
const Licenses           = lazy(() => import('./pages/Licenses'));
const Integrations       = lazy(() => import('./pages/Integrations'));
const DictionarySyncPage = lazy(() => import('./pages/DictionarySyncPage'));
const SnapshotsPage      = lazy(() => import('./pages/SnapshotsPage'));
const Tables             = lazy(() => import('./pages/Tables'));
const PermissionEditorPage = lazy(() => import('./pages/PermissionEditorPage'));
const QueryGuardPage     = lazy(() => import('./pages/QueryGuardPage'));
const Adminer            = lazy(() => import('./pages/Adminer'));

const Loader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
  </div>
);
const S = ({ children }) => <Suspense fallback={<Loader />}>{children}</Suspense>;

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            {/* Dashboard */}
            <Route index element={<Dashboard />} />

            {/* Tenants & Empresas */}
            <Route path="tenants"           element={<S><Tenants /></S>} />
            <Route path="companies"         element={<S><Companies /></S>} />
            <Route path="companies/:id"     element={<S><CompanyDashboard /></S>} />

            {/* Usuários */}
            <Route path="users"             element={<S><AgentUsers /></S>} />
            <Route path="roles"             element={<S><AgentRoles /></S>} />

            {/* Conhecimento & RAG */}
            <Route path="knowledge"         element={<S><RagMemories /></S>} />

            {/* Logs & Auditoria */}
            <Route path="logs"              element={<S><Logs /></S>} />
            <Route path="audit"             element={<S><AuditUsagePage /></S>} />

            {/* Plataforma */}
            <Route path="platform"          element={<S><Infra /></S>} />
            <Route path="config"            element={<S><Config /></S>} />
            <Route path="licenses"          element={<S><Licenses /></S>} />

            {/* Integrações */}
            <Route path="integrations"      element={<S><Integrations /></S>} />

            {/* Catálogo Protheus (Governance) */}
            <Route path="dictionary"        element={<S><DictionarySyncPage /></S>} />
            <Route path="snapshots"         element={<S><SnapshotsPage /></S>} />
            <Route path="tables"            element={<S><Tables /></S>} />
            <Route path="permissions"       element={<S><PermissionEditorPage /></S>} />
            <Route path="query-guard"       element={<S><QueryGuardPage /></S>} />

            {/* DB Admin */}
            <Route path="adminer"           element={<S><Adminer /></S>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
