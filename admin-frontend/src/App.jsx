import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import { lazy, Suspense } from 'react';

const Tenants      = lazy(() => import('./pages/Tenants'));
const AgentUsers   = lazy(() => import('./pages/AgentUsers'));
const RagMemories  = lazy(() => import('./pages/RagMemories'));
const Logs         = lazy(() => import('./pages/Logs'));
const Infra        = lazy(() => import('./pages/Infra'));
const Integrations = lazy(() => import('./pages/Integrations')); // Fase 4

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
  </div>
);

const S = ({ children }) => <Suspense fallback={<PageLoader />}>{children}</Suspense>;

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="tenants"      element={<S><Tenants /></S>} />
            <Route path="users"        element={<S><AgentUsers /></S>} />
            <Route path="knowledge"    element={<S><RagMemories /></S>} />
            <Route path="logs"         element={<S><Logs /></S>} />
            <Route path="platform"     element={<S><Infra /></S>} />
            <Route path="integrations" element={<S><Integrations /></S>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
