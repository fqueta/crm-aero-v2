import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRedirect } from '@/hooks/useRedirect';
import { AuthPreloader } from './AuthPreloader';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const { createLoginUrl } = useRedirect();

  if (isLoading) {
    return <AuthPreloader />;
  }

  if (!isAuthenticated) {
    // Salvar a rota atual para redirecionamento após login
    // Preserva a URL completa incluindo query parameters e hash
    const loginUrl = createLoginUrl();
    return <Navigate to={loginUrl} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}