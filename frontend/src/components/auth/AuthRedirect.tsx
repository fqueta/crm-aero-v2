import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRedirect } from '@/hooks/useRedirect';
import { AuthPreloader } from './AuthPreloader';

interface AuthRedirectProps {
  children: React.ReactNode;
}

/**
 * Componente que redireciona usuários autenticados usando a lógica do useRedirect
 * Usado para proteger páginas de login/registro de usuários já logados
 */
export function AuthRedirect({ children }: AuthRedirectProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { redirectAfterAuth } = useRedirect();

  useEffect(() => {
    // Se o usuário está autenticado e não está carregando, redireciona usando a lógica do useRedirect
    if (isAuthenticated && !isLoading && user) {
      redirectAfterAuth(user);
    }
  }, [isAuthenticated, isLoading, user, redirectAfterAuth]);

  // Carregando sessão: preloader com identidade em vez de tela em branco
  if (isLoading) {
    return <AuthPreloader />;
  }

  // Autenticado aguardando redirecionamento: mantém o preloader visível
  // até a próxima rota pintar (evita flash branco entre login e painel)
  if (isAuthenticated) {
    return <AuthPreloader message="Sessão ativa! Levando você ao painel..." />;
  }

  // Se não está autenticado, renderiza o conteúdo normalmente
  return <>{children}</>;
}