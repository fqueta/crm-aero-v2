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
 *        Atualiza paleta de cores para tons de azul, conteúdo, chamadas e suporte a modo escuro.
 * en-US: Home page aligned to Aeroclube de Juiz de Fora theme with dark mode support.
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50/30 dark:from-slate-950 dark:via-zinc-950 dark:to-slate-950 text-foreground flex flex-col transition-colors duration-300">
      <PublicHeader />

      {/* Hero Section */}
      <section className="py-16 sm:py-20 md:py-24 px-4 flex-1 flex items-center">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-blue-900 dark:text-blue-100 mb-6 leading-tight">
              Bem-vindo ao ACJF
              <span className="text-blue-600 dark:text-blue-400 block mt-2">Toda formação aeronáutica em um só lugar</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-700 dark:text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Somos a escola focada e comprometida com a excelência da sua formação e seu sucesso.
              Conheça nosso Plano de Formação e alcance as melhores companhias aéreas.
            </p>
            <div className="flex flex-col sm:flex-row gap-3.5 justify-center items-center">
              <a href="https://aeroclubejf.com.br/" target="_blank" rel="noreferrer" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-medium shadow-md shadow-blue-500/20 h-12 px-6">
                  Conhecer o site
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto border-blue-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900 text-blue-700 dark:text-zinc-100 hover:bg-blue-50 dark:hover:bg-zinc-800 font-medium h-12 px-6 shadow-sm">
                <Link to="/public-client-form">Fazer cadastro</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white/70 dark:bg-zinc-900/40 border-y border-blue-100/60 dark:border-zinc-800/80 backdrop-blur-sm">
        <div className="container mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            <Card className="border-blue-100 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 hover:shadow-xl dark:hover:border-blue-800/60 transition-all duration-300">
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-slate-900 dark:text-zinc-100 text-xl font-bold">Curso Teórico</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-slate-600 dark:text-zinc-400 text-sm leading-relaxed">
                  Todos os cursos homologados pela ANAC.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-blue-100 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 hover:shadow-xl dark:hover:border-blue-800/60 transition-all duration-300">
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plane className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-slate-900 dark:text-zinc-100 text-xl font-bold">Curso Prático</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-slate-600 dark:text-zinc-400 text-sm leading-relaxed">
                  Frota completa e estrutura dedicada para treinamento.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-blue-100 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 hover:shadow-xl dark:hover:border-blue-800/60 transition-all duration-300">
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wrench className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-slate-900 dark:text-zinc-100 text-xl font-bold">Revalidações</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-slate-600 dark:text-zinc-400 text-sm leading-relaxed">
                  Renovação de todas as carteiras.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-blue-100 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 hover:shadow-xl dark:hover:border-blue-800/60 transition-all duration-300">
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Compass className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-slate-900 dark:text-zinc-100 text-xl font-bold">Especializações</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-slate-600 dark:text-zinc-400 text-sm leading-relaxed">
                  Cursos para elevar sua perícia.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-700 via-blue-800 to-blue-900 dark:from-blue-950 dark:via-slate-900 dark:to-zinc-950 border-t border-transparent dark:border-zinc-800 text-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">Pronto para decolar?</h2>
          <p className="text-base sm:text-lg text-blue-100 dark:text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            Cadastre-se e avance na sua formação aeronáutica com o Aeroclube JF.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="w-full sm:w-auto bg-white text-blue-900 hover:bg-blue-50 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 font-semibold shadow-lg shadow-blue-950/30 h-12 px-6" asChild>
              <Link to="/public-client-form">
                Cadastrar-se
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <a href="https://aeroclubejf.com.br/" target="_blank" rel="noreferrer" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/80 text-white hover:bg-white/10 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 h-12 px-6">
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