import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

interface SuperAdminGuardProps {
  children: React.ReactNode;
}

/**
 * Restringe o conteúdo a usuários com permission_id=1.
 */
export function SuperAdminGuard({ children }: SuperAdminGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      {Number(user?.permission_id ?? 0) === 1 ? (
        children
      ) : (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center p-6 max-w-md">
            <h2 className="text-2xl font-semibold text-destructive mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground">
              Este relatório está disponível apenas para usuários com `permission_id = 1`.
            </p>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
