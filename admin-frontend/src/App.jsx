import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

// Lazy placeholders para as demais seções (serão implementadas na Fase 3)
import { lazy, Suspense } from 'react';
const Tenants = lazy(() => import('./pages/Tenants'));
const AgentUsers = lazy(() => import('./pages/AgentUsers'));
const RagMemories = lazy(() => import('./pages/RagMemories'));
const Logs = lazy(() => import('./pages/Logs'));
const Infra = lazy(() => import('./pages/Infra'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="tenants" element={<Suspense fallback={<PageLoader />}><Tenants /></Suspense>} />
            <Route path="users" element={<Suspense fallback={<PageLoader />}><AgentUsers /></Suspense>} />
            <Route path="knowledge" element={<Suspense fallback={<PageLoader />}><RagMemories /></Suspense>} />
            <Route path="logs" element={<Suspense fallback={<PageLoader />}><Logs /></Suspense>} />
            <Route path="platform" element={<Suspense fallback={<PageLoader />}><Infra /></Suspense>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
