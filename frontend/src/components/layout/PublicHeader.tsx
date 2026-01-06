import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, ChevronDown, Monitor, ExternalLink, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function PublicHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const permission_id: any = user?.permission_id;

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-blue-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3">
          <img src="/logo.png" alt="Aeroclube JF" className="h-12" />
          <div>
            <h1 className="text-2xl font-bold text-blue-800">Aeroclube de Juiz de Fora</h1>
            <p className="text-sm text-blue-600">Escola de aviação</p>
          </div>
        </Link>
        <div className="flex space-x-4">
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                  <User className="w-4 h-4 mr-2" />
                  {user.name}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {permission_id <= 5 && (
                  <>
                    <DropdownMenuLabel>Painel Administrativo</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center">
                        <Monitor className="mr-2 h-4 w-4" />
                        Acessar painel
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuLabel>Site institucional</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="https://aeroclubejf.com.br/" target="_blank" rel="noreferrer" className="flex items-center">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    aeroclubejf.com.br
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  {isLoggingOut ? 'Saindo...' : 'Sair'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (

            <>
              {/* Desktop View */}
              <div className="hidden md:flex items-center space-x-4">
                <Button variant="outline" asChild className="border-blue-300 text-blue-700 hover:bg-blue-50">
                  <Link to="/login">Entrar</Link>
                </Button>
                <Button asChild className="bg-blue-700 hover:bg-blue-800">
                  <Link to="/public-client-form">Cadastrar</Link>
                </Button>
              </div>

              {/* Mobile View */}
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-blue-800 hover:bg-blue-50">
                      <Menu className="h-6 w-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link to="/login" className="w-full cursor-pointer">
                        Entrar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/public-client-form" className="w-full cursor-pointer font-medium text-blue-700">
                        Cadastrar
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}

        </div>
      </div>
    </header>
  );
}
