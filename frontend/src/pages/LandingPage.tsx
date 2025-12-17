import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plane, BookOpen, Wrench, Compass, ArrowRight, User, LogOut, Settings, ChevronDown, Monitor, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * LandingPage
 * pt-BR: Página inicial alinhada ao tema do Aeroclube de Juiz de Fora (ACJF).
 *        Atualiza paleta de cores para tons de azul, conteúdo e chamadas.
 * en-US: Home page aligned to Aeroclube de Juiz de Fora theme.
 *        Updates palette to blue tones, content and CTAs.
 */
const LandingPage = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /**
   * handleLogout
   * pt-BR: Efetua logout com feedback visual.
   * en-US: Performs logout with visual feedback.
   */
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-blue-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="Aeroclube JF" className="h-12" />
            <div>
              <h1 className="text-2xl font-bold text-blue-800">Aeroclube de Juiz de Fora</h1>
              <p className="text-sm text-blue-600">Escola de aviação</p>
            </div>
          </div>
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
                <Button variant="outline" asChild className="border-blue-300 text-blue-700 hover:bg-blue-50">
                  <Link to="/login">Entrar</Link>
                </Button>
                <Button asChild className="bg-blue-700 hover:bg-blue-800">
                  <Link to="/public-client-form">Cadastrar</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-5xl md:text-5xl font-bold text-blue-800 mb-6">
              Bem-vindo ao ACJF
              <span className="text-blue-600 block">Toda formação aeronáutica em um só lugar</span>
            </h1>
            <p className="text-lg text-blue-700 mb-6 max-w-3xl mx-auto">
              Somos a escola focada e comprometida com a excelência da sua formação e seu sucesso.
              Conheça nosso Plano de Formação e alcance as melhores companhias aéreas.
            </p>
            <div className="flex gap-3 justify-center">
              <a href="https://aeroclubejf.com.br/" target="_blank" rel="noreferrer">
                <Button size="lg" className="bg-blue-700 hover:bg-blue-800 text-white">
                  Conhecer o site
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <Button size="lg" variant="outline" asChild className="border-blue-300 text-blue-700 hover:bg-blue-50">
                <Link to="/public-client-form">Fazer cadastro</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white/60">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="border-blue-200 hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-8 w-8 text-blue-700" />
                </div>
                <CardTitle className="text-blue-800">Curso Teórico</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-muted-foreground">
                  Todos os cursos homologados pela ANAC.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-blue-200 hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plane className="h-8 w-8 text-blue-700" />
                </div>
                <CardTitle className="text-blue-800">Curso Prático</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-muted-foreground">
                  Frota completa e estrutura dedicada para treinamento.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-blue-200 hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wrench className="h-8 w-8 text-blue-700" />
                </div>
                <CardTitle className="text-blue-800">Revalidações</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-muted-foreground">
                  Renovação de todas as carteiras.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-blue-200 hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Compass className="h-8 w-8 text-blue-700" />
                </div>
                <CardTitle className="text-blue-800">Especializações</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-muted-foreground">
                  Cursos para elevar sua perícia.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-700 to-blue-800">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Pronto para decolar?</h2>
          <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            Cadastre-se e avance na sua formação aeronáutica com o Aeroclube JF.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-blue-800 hover:bg-blue-100" asChild>
              <Link to="/public-client-form">
                Cadastrar-se
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <a href="https://aeroclubejf.com.br/" target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-800">
                Conhecer o site
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-blue-900 text-white py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img src="/logo.png" alt="ACJF" className="h-8" />
                <div>
                  <h3 className="font-bold">Aeroclube de Juiz de Fora</h3>
                  <p className="text-sm text-blue-200">Escola de aviação</p>
                </div>
              </div>
              <p className="text-blue-200 text-sm">
                Excelência em formação aeronáutica desde 1938.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Acesso rápido</h4>
              <ul className="space-y-2 text-sm text-blue-200">
                <li><Link to="/login" className="hover:text-white">Entrar</Link></li>
                <li><Link to="/public-client-form" className="hover:text-white">Cadastro</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Institucional</h4>
              <ul className="space-y-2 text-sm text-blue-200">
                <li><a href="https://aeroclubejf.com.br/" target="_blank" rel="noreferrer" className="hover:text-white">Site oficial</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-blue-800 mt-8 pt-8 text-center text-sm text-blue-200">
            <p>&copy; {new Date().getFullYear()} Aeroclube de Juiz de Fora. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;