import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // basename=/admin já adiciona o prefixo automaticamente
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
