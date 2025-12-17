import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserPrefsProvider } from "@/contexts/UserPrefsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AdminProtectedRoute } from "./components/auth/AdminProtectedRoute";
import { AuthRedirect } from "./components/auth/AuthRedirect";
import { AppLayout } from "./components/layout/AppLayout";
// import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientView from "./pages/ClientView";
import ClientCreate from "./pages/ClientCreate";
import ClientEdit from "./pages/ClientEdit";
import Partners from "./pages/Partners";
import PartnerView from "./pages/PartnerView";
import ServiceObjects from "./pages/ServiceObjects";
import Aircraft from "./pages/Aircraft";
import AircraftView from "./pages/AircraftView";
import Products from "./pages/Products";
import ProductView from "./pages/ProductView";
import ProductCreate from "./pages/ProductCreate";
import ProductEdit from "./pages/ProductEdit";
import Services from "./pages/Services";
import ServiceView from "./pages/ServiceView";
import Categories from "./pages/Categories";
import Permissions from "./pages/settings/Permissions";
import Users from "./pages/settings/Users";
import UserCreate from "./pages/settings/UserCreate";
import UserProfiles from "./pages/settings/UserProfiles";
import SystemSettings from "./pages/settings/SystemSettings";
import Stages from "./pages/settings/Stages";
import TableInstallment from "./pages/settings/TableInstallment";
import Login from "./pages/auth/Login";
import Metrics from "./pages/settings/Metrics";
import AircraftsSettings from "./pages/settings/AircraftsSettings";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import NotFound from "./pages/NotFound";
import { PermissionGuard } from "./components/auth/PermissionGuard";
import Dashboard from "@/pages/Dashboard";
import MetricsDashboard from "@/pages/MetricsDashboard";
import ServiceOrders from "./pages/ServiceOrders";
import CreateServiceOrder from "./pages/CreateServiceOrder";
import UpdateServiceOrder from "./pages/UpdateServiceOrder";
import ShowServiceOrder from "./pages/ShowServiceOrder";
import QuickCreateServiceOrder from "./pages/QuickCreateServiceOrder";
import Financial from "./pages/financial/Financial";
import FinancialCategories from "./pages/FinancialCategories";
import PublicClientForm from "@/pages/PublicClientForm";
import PointsStore from "@/pages/loja/PointsStore";
import ProductDetails from "./pages/loja/ProductDetails";
import MyRedemptions from "./pages/loja/MyRedemptions";
import RedemptionDetails from "./pages/loja/RedemptionDetails";
import ClientArea from "./pages/loja/ClientArea";
import LandingPage from "./pages/LandingPage";
/**
 * Removed Admin points pages imports
 * pt-BR: Removidos imports das páginas de administração de pontos para evitar
 *        requisições GET de módulos inexistentes durante o carregamento.
 * en-US: Removed imports of admin points pages to prevent GET requests for
 *        missing modules at app load time.
 */
import AeroclubeDashboard from "./pages/AeroclubeDashboard";
import CustomersLeads from "./pages/CustomersLeads";
import Sales from "./pages/Sales";
import ProposalsCreate from "./pages/ProposalsCreate";
import ProposalsEdit from "./pages/ProposalsEdit";
import ProposalsView from "./pages/ProposalsView";
import Courses from "./pages/school/Courses";
import CourseCreate from "./pages/school/CourseCreate";
import CourseEdit from "./pages/school/CourseEdit";
import Classes from "./pages/school/Classes";
import ClassCreate from "./pages/school/ClassCreate";
import ClassEdit from "./pages/school/ClassEdit";
import Enroll from "./pages/school/Enroll";
import ContractsList from "./pages/school/ContractsList";
import ContractCreate from "./pages/school/ContractCreate";
import ContractEdit from "./pages/school/ContractEdit";
import PeriodsList from "./pages/school/PeriodsList";
import PeriodCreate from "./pages/school/PeriodCreate";
import PeriodEdit from "./pages/school/PeriodEdit";
import PeriodDetail from "./pages/school/PeriodDetail";
import EnrollmentSituationPage from "./pages/school/EnrollmentSituation";
import Interested from "./pages/school/Interested";
import SiteComponentsList from "./pages/SiteComponentsList";
import SiteComponentsForm from "./pages/SiteComponentsForm";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Configurações para consultas
      retry: (failureCount, error: any) => {
        if (
          error?.status === 400 ||
          error?.status === 401 ||
          error?.status === 403 ||
          error?.status === 404
        ) {
          return false;
        }
        return failureCount < 1;
      },
      // 5 minutos
      staleTime: 5 * 60 * 1000,
      // 30 minutos (anteriormente cacheTime)
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      refetchOnMount: true,
    },
    mutations: {
      // Configurações para mutações (create, update, delete)
      retry: 1,
    },
  },
});

/**
 * App — Provider stack and routes
 * pt-BR: Envolve a aplicação com QueryClientProvider, ThemeProvider, AuthProvider
 * e UserPrefsProvider, garantindo o contexto em todas as rotas e layouts.
 * en-US: Wraps the app with QueryClientProvider, ThemeProvider, AuthProvider,
 * and UserPrefsProvider, ensuring context availability across routes/layouts.
 */
const App = () => {
  const link_loja = "/lojaderesgatesantenamais";
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <UserPrefsProvider>
            <TooltipProvider>
            <Toaster />
            <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Rotas públicas */}
              <Route path="/"  element={<LandingPage linkLoja={link_loja} />} />
              <Route path="/login" element={
                <AuthRedirect>
                  <Login />
                </AuthRedirect>
              } />
              <Route path="/register" element={
                <AuthRedirect>
                  <Register />
                </AuthRedirect>
              } />
              <Route path="/forgot-password" element={
                <AuthRedirect>
                  <ForgotPassword />
                </AuthRedirect>
              } />
              <Route path="/reset-password" element={
                <AuthRedirect>
                  <ResetPassword />
                </AuthRedirect>
              } />
              {/* Rota alternativa: suporta token como segmento de caminho */}
              <Route path="/reset-password/:token" element={
                <AuthRedirect>
                  <ResetPassword />
                </AuthRedirect>
              } />
              <Route path="/form-client-active/:cpf" element={<PublicClientForm />} />
              <Route path="/public-client-form" element={<PublicClientForm />} />
              
              {/* Rotas da loja - protegidas */}
              <Route path={link_loja} element={
                <ProtectedRoute>
                  <PointsStore linkLoja={link_loja} />
                </ProtectedRoute>
              } />
              <Route path={link_loja + "/produto/:productId"} element={
                <ProtectedRoute>
                  <ProductDetails linkLoja={link_loja} />
                </ProtectedRoute>
              } />
              <Route path={link_loja + "/meus-resgates"} element={
                <ProtectedRoute>
                  <MyRedemptions linkLoja={link_loja} />
                </ProtectedRoute>
              } />
              <Route path={link_loja + "/resgate/:id"} element={
                <ProtectedRoute>
                  <RedemptionDetails linkLoja={link_loja} />
                </ProtectedRoute>
              } />
              <Route path={link_loja + "/area-cliente"} element={ 
                <ProtectedRoute>
                  <ClientArea linkLoja={link_loja} />
                </ProtectedRoute>
              } />
              <Route path={link_loja + "/configuracoes"} element={ 
                <ProtectedRoute>
                  <Navigate to={`${link_loja}/area-cliente?tab=settings`} replace />
                </ProtectedRoute>
              } />
              
              {/* Rotas protegidas */}
              <Route path="/admin" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    {/* <Dashboard2 /> */}
                    {/* <Dashboard /> */}
                    <AeroclubeDashboard />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              {/* Dashboard inspirado na imagem com dados mockados */}
              <Route path="/admin/aero-dashboard" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <AeroclubeDashboard />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              {/* <Route path="/painel2" element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard2 />
                  </AppLayout>
                </ProtectedRoute>
              } /> */}
              <Route path="/admin/clients" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <Clients />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              {/* Escola / Cursos */}
              <Route path="/admin/school/courses" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <Courses />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/school/courses/create" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <CourseCreate />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/school/courses/:id/edit" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <CourseEdit />
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* Escola / Turmas */}
              <Route path="/admin/school/classes" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <Classes />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              {/* Escola / Contratos */}
              <Route path="/admin/school/contracts" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ContractsList />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/school/contracts/create" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ContractCreate />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/school/contracts/:id/edit" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ContractEdit />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              {/* Escola / Períodos */}
              <Route path="/admin/school/periods" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PeriodsList />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/school/periods/:id" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PeriodDetail />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/school/periods/create" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PeriodCreate />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/school/periods/:id/edit" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PeriodEdit />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              {/* Escola / Matrículas */}
              <Route path="/admin/school/enroll" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <Enroll />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              {/* Escola / Interessados */}
              <Route path="/admin/school/interested" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <Interested />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              {/* Escola / Situações de Matrícula */}
              <Route path="/admin/school/enrollment-situation" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <EnrollmentSituationPage />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/school/classes/create" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ClassCreate />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/school/classes/:id/edit" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ClassEdit />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/clients/create" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ClientCreate />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/clients/:id/view" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ClientView />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/clients/:id/edit" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ClientEdit />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              {/* Rotas de parceiros */}
              <Route path="/admin/partners" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <Partners />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              {/* Aeronaves (listagem com painel de filtros) */}
              <Route path="/admin/aircrafts" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <Aircraft />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/partners/:id" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PartnerView />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/partners/:id/edit" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <Partners />
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* Rotas de produtos */}
              <Route path="/admin/products" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <Products />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/products/create" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ProductCreate />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/products/:id/edit" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ProductEdit />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/products/:id" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ProductView />
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* Leads de Atendimento */}
              <Route path="/admin/customers/leads" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <CustomersLeads />
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* Vendas / Funis de Vendas */}
              <Route path="/admin/sales" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <Sales />
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* Vendas / Cadastro de Propostas */}
              <Route path="/admin/sales/proposals/create" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ProposalsCreate />
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* Vendas / Editar Proposta */}
              <Route path="/admin/sales/proposals/edit/:id" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ProposalsEdit />
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* Vendas / Visualizar Proposta */}
              <Route path="/admin/sales/proposals/view/:id" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ProposalsView />
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* Alias sem prefixo admin (redireciona) */}
              <Route path="/sales/proposals/create" element={<Navigate to="/admin/sales/proposals/create" replace />} />
              <Route path="/sales/proposals/edit/:id" element={<Navigate to="/admin/sales/proposals/edit/:id" replace />} />
              <Route path="/sales/proposals/view/:id" element={<Navigate to="/admin/sales/proposals/view/:id" replace />} />

              {/* Rotas de serviços */}
              <Route path="/admin/services" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <Services />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/services/:id" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ServiceView />
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* CMS / Conteúdo do Site (Componentes) */}
              <Route path="/admin/site/conteudo-site" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <SiteComponentsList />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/site/conteudo-site/create" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <SiteComponentsForm />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/site/conteudo-site/:id/edit" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <SiteComponentsForm />
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* Categorias */}
              <Route path="/admin/categories" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <Categories />
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* Settings */}
              <Route path="/admin/settings/permissions" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PermissionGuard 
                      required="settings.permissions.view" 
                      menuPath="/admin/settings/permissions"
                      requireRemote={false}
                    >
                      <Permissions />
                    </PermissionGuard>
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/settings/table-installment" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    {/* pt-BR/en-US: Installment tables management */}
                    <TableInstallment />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              {/* TableInstallment dedicated pages: create and edit */}
              <Route path="/admin/settings/table-installment/create" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <TableInstallment />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/settings/table-installment/:id/edit" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <TableInstallment />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/settings/aircrafts" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <AircraftsSettings />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/settings/stages" element={
                <AdminProtectedRoute>
                  <AppLayout>
                  {/* Sem PermissionGuard por enquanto para acesso rápido */}
                    <Stages />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/settings/users" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PermissionGuard 
                      menuPath="/admin/settings/users"
                      requireRemote={false}
                    >
                      <Users />
                    </PermissionGuard>
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              {/* Página dedicada para criação de usuário */}
              <Route path="/admin/settings/users/create" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PermissionGuard 
                      menuPath="/admin/settings/users"
                      requireRemote={false}
                    >
                      {/* pt-BR/en-US: Dedicated user creation page */}
                      <UserCreate />
                    </PermissionGuard>
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/settings/metrics" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PermissionGuard required="settings.metrics.view">
                      <Metrics />
                    </PermissionGuard>
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/metrics-dashboard" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PermissionGuard required="settings.metrics.view">
                      <MetricsDashboard />
                    </PermissionGuard>
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/settings/user-profiles" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <UserProfiles />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/settings/system" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PermissionGuard 
                      required="settings.system.view" 
                      menuPath="/admin/settings/system"
                      requireRemote={false}
                    >
                      <SystemSettings />
                    </PermissionGuard>
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* Financeiro */}
              <Route path="/admin/financial" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PermissionGuard 
                      required="financial.view" 
                      menuPath="/admin/financial"
                      requireRemote={false}
                    >
                      <Financial />
                    </PermissionGuard>
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/financial/categories" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <PermissionGuard 
                      required="financial.categories.view" 
                      menuPath="/admin/financial/categories"
                      requireRemote={false}
                    >
                      <FinancialCategories />
                    </PermissionGuard>
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/**
               * Points Admin routes removed
               * pt-BR: Rotas de administração de pontos desativadas temporariamente para
               *        impedir a tentativa de carregar módulos ausentes.
               * en-US: Points admin routes temporarily disabled to prevent loading
               *        missing modules.
               */}

              {/* Ordens de Serviço */}
              <Route path="/admin/service-orders" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ServiceOrders />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/service-orders/quick-create" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <QuickCreateServiceOrder />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/service-orders/create" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <CreateServiceOrder />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/service-orders/update/:id" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <UpdateServiceOrder />
                  </AppLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/service-orders/show/:id" element={
                <AdminProtectedRoute>
                  <AppLayout>
                    <ShowServiceOrder />
                  </AppLayout>
                </AdminProtectedRoute>
              } />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </TooltipProvider>
          </UserPrefsProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
