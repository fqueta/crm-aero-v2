import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane, BookOpen, Wrench, Compass, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

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
      <PublicHeader />

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

      <PublicFooter />
    </div>
  );
};

export default LandingPage;