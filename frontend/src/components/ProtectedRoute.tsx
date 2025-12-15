import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FuncaoUsuario } from '../types';

interface Props {
  children: ReactNode;
  requiredRole?: FuncaoUsuario;
}

const ProtectedRoute: React.FC<Props> = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-400">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const hasRequiredRole = requiredRole
    ? user.funcoes.includes(requiredRole) || user.funcoes.includes('admin')
    : true;

  if (!hasRequiredRole) {
    return <Navigate to="/operador" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
