import {
  Home,
  Users,
  Wrench,
  Package,
  FileText,
  ClipboardList,
  DollarSign,
  BarChart3,
  Settings,
  Calendar,
  Building,
  Landmark,
  Layers,
  ChartLine,
  Plane,
  Store,
  Cog,
  LineChart,
  LucideIcon,
} from "lucide-react";
import { MenuItemDTO, MenuItemResolved } from "@/types/menu";

// Icon map for resolving string icon names to components
export const iconMap: Record<string, LucideIcon> = {
  Home,
  home: Home,
  gauge: Home,
  Gauge: Home,
  Users,
  user: Users,
  users: Users,
  Wrench,
  wrench: Wrench,
  Package,
  package: Package,
  FileText,
  "file-text": FileText,
  ClipboardList,
  DollarSign,
  BarChart3,
  "chart-bar": BarChart3,
  "chart-line": ChartLine,
  ChartLine,
  LineChart,
  "line-chart": LineChart,
  "linechart": LineChart,
  Settings,
  settings: Settings,
  Cog,
  cog: Cog,
  Calendar,
  calendar: Calendar,
  Building,
  building: Building,
  Landmark,
  landmark: Landmark,
  Layers,
  layers: Layers,
  Plane,
  plane: Plane,
  Store,
  store: Store,
  // "Shop" é o ícone usado no menu_crm.json (Vendas e Propostas);
  // o lucide-react atual não exporta Shop — usa Store como equivalente.
  Shop: Store,
  shop: Store,
};

// Helper to check if can_view is truthy (considers 1, '1', true as truthy)
export function isCanViewTruthy(canView?: boolean | number | '0' | '1'): boolean {
  if (canView === undefined || canView === null) return false;
  if (typeof canView === 'boolean') return canView;
  if (typeof canView === 'number') return canView === 1;
  if (typeof canView === 'string') return canView === '1';
  return false;
}

// Resolve menu DTOs to menu items with actual icon components
export function buildMenuFromDTO(menuDTO: MenuItemDTO[]): MenuItemResolved[] {
  return menuDTO.map((item) => ({
    ...item,
    id: item.id,
    parent_id: item.parent_id,
    icon: iconMap[item.icon || ""] || FileText, // fallback to FileText
    section: item.section,
    module: item.module,
    location: item.location,
    permission: item.permission,
    can_view: item.can_view,
    items: item.items ? buildMenuFromDTO(item.items) : undefined,
  }));
}

// Find menu item by URL path
export function findMenuItemByUrl(menu: MenuItemDTO[], url: string): MenuItemDTO | undefined {
  for (const item of menu) {
    if (item.url === url) {
      return item;
    }
    if (item.items) {
      const found = findMenuItemByUrl(item.items, url);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * defaultMenu — fallback quando a API não retorna menu.
 * pt-BR: Espelha `backend/database/seeders/data/menu_crm.json` (fonte usada pelo
 * `MenuSeeder` para popular a tabela `menus`): mesmos títulos, URLs, ícones e
 * submenus. As URLs são relativas (ex.: `/school/enroll`) e o `AppSidebar`
 * prefixa `/admin` via `resolveUrl`. Campos extras (`section`, `permission`,
 * `can_view`) existem só no frontend, para agrupamento e filtro por módulo.
 * en-US: Mirrors `backend/database/seeders/data/menu_crm.json` (source used by
 * `MenuSeeder` to seed the `menus` table): same titles, URLs, icons and
 * submenus. URLs are relative (e.g. `/school/enroll`) and `AppSidebar`
 * prefixes `/admin` via `resolveUrl`. Extra fields (`section`, `permission`,
 * `can_view`) exist only in the frontend, for grouping and module filtering.
 */
export const defaultMenu: MenuItemDTO[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: "Home",
    section: "operation",
    permission: "dashboard.view",
    can_view: true
  },
  {
    title: "Vendas e Propostas",
    icon: "Shop",
    section: "operation",
    permission: "sales.view",
    can_view: true,
    items: [
      {
        title: "Atendimento (FloW)",
        url: "/sales",
        permission: "sales.view",
        can_view: true
      }
    ]
  },
  {
    title: "Clientes",
    icon: "Users",
    section: "operation",
    permission: "clients.view",
    can_view: true,
    items: [
      {
        title: "Atendimento (FloW)",
        url: "/customers/leads",
        permission: "clients.view",
        can_view: true
      },
      {
        title: "Arquivo Clientes",
        url: "/clients",
        permission: "clients.view",
        can_view: true
      }
    ]
  },
  {
    title: "Escola",
    section: "operation",
    permission: "school.view",
    can_view: true,
    items: [
      {
        title: "Interessados",
        url: "/school/interested",
        permission: "school.interested.view",
        can_view: true
      },
      {
        title: "Matrículas",
        url: "/school/enroll",
        permission: "school.enroll.view",
        can_view: true
      },
      {
        title: "Todos cursos",
        url: "/school/courses",
        permission: "school.courses.view",
        can_view: true
      },
      {
        title: "Todas turmas",
        url: "/school/classes",
        permission: "school.classes.view",
        can_view: true
      },
      {
        title: "Rescisões",
        url: "/school/termination",
        permission: "school.termination.view",
        can_view: true
      },
      {
        title: "Ganhos",
        url: "/school/ganhos",
        permission: "school.ganhos.view",
        can_view: true
      },
      {
        title: "Situações",
        url: "/school/enrollment-situation",
        permission: "school.enrollment-situation.view",
        can_view: true
      },
      {
        title: "Controle de Formação (PNL)",
        url: "/school/formation-control",
        permission: "school.formation-control.view",
        can_view: true
      }
    ]
  },
  {
    title: "Gerenciar Site",
    icon: "FileText",
    section: "operation",
    permission: "site.view",
    can_view: true,
    items: [
      {
        title: "Paginas do site",
        url: "/site/paginas",
        permission: "site.pages.view",
        can_view: true
      },
      {
        title: "Componentes",
        url: "/site/conteudo-site",
        permission: "site.components.view",
        can_view: true
      },
      {
        title: "Tipos de conteúdo",
        url: "/site/content-types",
        permission: "site.content-types.view",
        can_view: true
      }
    ]
  },
  {
    title: "Financeiro",
    icon: "DollarSign",
    section: "financial",
    permission: "finance.view",
    can_view: true,
    items: [
      {
        title: "Contas",
        url: "/financial",
        permission: "finance.view",
        can_view: true
      },
      {
        title: "Categorias",
        url: "/financial/categories",
        permission: "financial.categories.view",
        can_view: true
      }
    ]
  },
  {
    title: "Relatórios",
    icon: "LineChart",
    section: "financial",
    permission: "reports.view",
    can_view: true,
    items: [
      {
        title: "Geral",
        url: "/reports/relatorio-geral",
        permission: "reports.view",
        can_view: true
      },
      {
        title: "Vendas",
        url: "/reports/relatorio-vendas",
        permission: "reports.financial.view",
        can_view: true
      },
      {
        title: "Pós Venda",
        url: "/reports/relatorio-escola",
        permission: "reports.school.view",
        can_view: true
      },
      {
        title: "Balanço",
        url: "/reports/relatorio-balanco",
        permission: "reports.balance.view",
        can_view: true
      },
      {
        title: "Turmas",
        url: "/reports/relatorio-turmas",
        permission: "reports.classes.view",
        can_view: true
      },
      {
        title: "Atendimento",
        url: "/reports/relatorio-atendimento",
        permission: "reports.attendance.view",
        can_view: true
      },
      {
        title: "Acessos",
        url: "/reports/relatorio-acessos",
        permission: "reports.access.view",
        can_view: true
      },
      {
        title: "Horas Voadas",
        url: "/reports/horas_voadas",
        permission: "reports.flight-hours.view",
        can_view: true
      },
      {
        title: "Contratos vencidos",
        url: "/reports/contratos_vencidos",
        permission: "reports.expired-contracts.view",
        can_view: true
      }
    ]
  },
  {
    title: "Configurações",
    icon: "Cog",
    section: "system",
    permission: "settings.view",
    can_view: true,
    items: [
      {
        title: "Usuários",
        url: "/settings/users",
        permission: "settings.users.view",
        can_view: true
      },
      {
        title: "Aeronaves",
        url: "/settings/aircrafts",
        permission: "settings.aircrafts.view",
        can_view: true
      },
      {
        title: "Permissões",
        url: "/settings/permissions",
        permission: "settings.permissions.view",
        can_view: true
      },
      {
        title: "Cupom de desconto",
        url: "/settings/cupom_desconto",
        permission: "settings.coupons.view",
        can_view: true
      },
      {
        title: "Tabelas de preço",
        url: "/settings/table-price",
        permission: "settings.table-price.view",
        can_view: true
      },
      {
        title: "Funil e etapas",
        url: "/settings/stages",
        permission: "settings.stages.view",
        can_view: true
      },
      {
        title: "Categorias",
        url: "/categories",
        permission: "catalog.categories.view",
        can_view: true
      },
      {
        title: "Tabelas de parcelamento",
        url: "/settings/table-installment",
        permission: "settings.table-installment.view",
        can_view: true
      },
      {
        title: "Tabelas de desconto",
        url: "/settings/table-discount",
        permission: "settings.table-discount.view",
        can_view: true
      },
      {
        title: "Contratos e termos",
        url: "/school/contracts",
        permission: "school.contracts.view",
        can_view: true
      },
      {
        title: "Períodos",
        url: "/school/periods",
        permission: "school.periods.view",
        can_view: true
      },
      {
        title: "Sistema",
        url: "/settings/system",
        permission: "settings.system.view",
        can_view: true
      },
      {
        title: "Workflows",
        url: "/admin/settings/workflows",
        permission: "settings.workflows.view",
        can_view: true
      },
      {
        title: "Regras",
        url: "/admin/settings/rules",
        permission: "settings.rules.view",
        can_view: true
      },
      {
        title: "Ações",
        url: "/admin/settings/actions",
        permission: "settings.actions.view",
        can_view: true
      },
      {
        title: "Integrações",
        url: "/admin/settings/integrations",
        permission: "settings.integrations.view",
        can_view: true
      },
      {
        title: "Importação de Dados",
        url: "/settings/import-data",
        permission: "settings.import-data.view",
        can_view: true
      }
    ]
  }
];

/**
 * inferSection
 * pt-BR: Infere a seção do item quando a API não envia `section`
 * (backend legado sem a coluna), para que o agrupamento por seção e as
 * pílulas de filtro funcionem também com o menu dinâmico.
 * en-US: Infers the item section when the API omits `section`
 * (legacy backend without the column), so section grouping and filter
 * pills also work with the dynamic menu.
 */
export function inferSection(title?: string, url?: string): string {
  const hay = `${title ?? ""} ${url ?? ""}`.toLowerCase();
  if (/financ|pagamento|receb|caixa|cobran|fatura|relat|report|dre|receita|balan/.test(hay)) return "financial";
  if (/config|usu[aá]rio|perfil|permiss|workflow|regra|a[cç][aã]o|sistema|importa|integra|etapa|m[eé]todo|status|tabela|aeronave|cupom|desconto|per[ií]odo|contrato/.test(hay)) return "system";
  if (/saas|plano|assinatura|organiza/i.test(hay)) return "saas";
  return "operation";
}

// Filter menu based on can_view access (can_view undefined = invisible by default)
export function filterMenuByViewAccess(menu: MenuItemResolved[]): MenuItemResolved[] {
  return menu
    .filter((item) => {
      // Menus destinados exclusivamente ao rodapé do aplicativo móvel não aparecem na sidebar desktop
      if (
        item.location === "app_footer" ||
        item.title?.toLowerCase().includes("menu do aplicativo")
      ) {
        return false;
      }
      return true;
    })
    .map((item) => {
      // If item has subitems, filter them recursively first
      let filteredItems: MenuItemResolved[] | undefined;
      if (item.items) {
        filteredItems = filterMenuByViewAccess(item.items);
      }

      // Item is visible if:
      // 1. Its can_view is truthy OR
      // 2. It has visible children (even if its own can_view is falsy/undefined)
      const hasVisibleChildren = filteredItems && filteredItems.length > 0;
      const isItemVisible = isCanViewTruthy(item.can_view) || hasVisibleChildren;

      if (!isItemVisible) {
        return null;
      }

      return {
        ...item,
        items: filteredItems,
      };
    })
    .filter((item) => item !== null) as MenuItemResolved[];
}
