import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  User,
  LogOut,
  Settings,
  Search,
  X,
  Layers,
  Wrench,
  Landmark,
  Building,
} from "lucide-react";
import * as React from "react";
import { NavLink, useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MenuItemDTO } from "@/types/menu";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  buildMenuFromDTO,
  filterMenuByViewAccess,
  defaultMenu,
  inferSection,
} from "@/lib/menu";
import { cn } from "@/lib/utils";

/**
 * Verifica se a URL do menu corresponde ao caminho atual.
 * pt-BR: Suporta prefixo (detalhes /:id/edit continuam ativos), segmentos
 * dinâmicos no padrão `:param` e equivalência com barra final (ex.: o
 * Dashboard do menu_crm.json tem url `/`, resolvida para `/admin/`).
 */
function matchesPath(currentPath: string, menuUrl: string): boolean {
  if (!menuUrl || menuUrl === '#') return false;
  const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  const current = norm(currentPath);
  const target = norm(menuUrl);
  if (current === target) return true;
  const targetSegs = target.split('/').filter(Boolean);
  const currentSegs = current.split('/').filter(Boolean);
  if (targetSegs.length === currentSegs.length && targetSegs.some((s) => s.startsWith(':'))) {
    return targetSegs.every((s, i) => s.startsWith(':') || s === currentSegs[i]);
  }
  return (current + '/').startsWith(target + '/');
}

const SECTION_ORDER = ["operation", "financial", "saas", "system", "other"];

interface SectionConfig {
  label: string;
  colorClass: string;
  dotClass: string;
}

const SECTION_CONFIG: Record<string, SectionConfig> = {
  operation: {
    label: "Operação",
    colorClass: "text-blue-500 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
  financial: {
    label: "Financeiro & Relatórios",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  saas: {
    label: "Gestão & Plataforma",
    colorClass: "text-violet-600 dark:text-violet-400",
    dotClass: "bg-violet-500",
  },
  system: {
    label: "Sistema & Configurações",
    colorClass: "text-slate-500 dark:text-zinc-400",
    dotClass: "bg-slate-400",
  },
};

const MODULE_FILTERS = [
  { id: "all", label: "Todos", icon: Layers },
  { id: "operation", label: "Operação", icon: Wrench },
  { id: "financial", label: "Financeiro", icon: Landmark },
  { id: "saas", label: "SaaS", icon: Building },
  { id: "system", label: "Config", icon: Settings },
];

/**
 * getItemSection
 * pt-BR: Usa `section` da API quando existir; senão infere pelo título/URL
 * (backend legado sem a coluna) para agrupar e filtrar corretamente.
 */
const getItemSection = (item: any): string =>
  item.section ?? inferSection(item.title, item.url);

/**
 * AppSidebar
 * pt-BR: Menu lateral com modo sanfona única, submenu flutuante no modo
 * encolhido, pílulas de filtro por módulo, agrupamento por seção e
 * rolagem automática para o item ativo.
 * en-US: Sidebar with single-accordion mode, flyout submenu when collapsed,
 * module filter pills, section grouping and auto-scroll to the active item.
 */
export function AppSidebar() {
  const { state, toggleSidebar, setOpenMobile, isMobile, isHoverActive, setIsHoverActive } = useSidebar();
  const { menu: apiMenu, logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  // Quando recolhido pelo usuário mas com hover ativo, renderiza visualmente expandido (em overlay sobre o conteúdo)
  const visuallyCollapsed = collapsed && !isHoverActive;

  /**
   * resolveUrl
   * pt-BR: Normaliza URLs do menu evitando duplicar "/admin" e garantindo barra inicial.
   * en-US: Normalizes menu URLs, avoiding duplicate "/admin" and ensuring leading slash.
   */
  const rota_admin = 'admin';
  const resolveUrl = (url?: string): string => {
    if (!url || url === '#') return '#';
    const base = `/${rota_admin}`;
    if (url.startsWith(base)) return url; // already absolute under /admin
    if (url.startsWith('/')) return `${base}${url}`; // relative from root
    return `${base}/${url}`; // bare path
  };

  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false);
    if (isHoverActive) setIsHoverActive?.(false);
  };

  /**
   * submenu collapse state
   * pt-BR: Persistência de recolhimento de submenus por título do item.
   * en-US: Persist submenu collapsed state by item title key.
   */
  const GROUPS_KEY = 'sidebarGroupsCollapsed';
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(GROUPS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [selectedSection, setSelectedSection] = React.useState<string>(() => {
    try {
      return localStorage.getItem("sidebarSelectedSection") || "all";
    } catch {
      return "all";
    }
  });

  const handleSelectSection = (section: string) => {
    setSelectedSection(section);
    try {
      localStorage.setItem("sidebarSelectedSection", section);
    } catch {}
  };

  /**
   * getGroupKey
   * pt-BR: Gera uma chave estável baseada no título do item.
   * en-US: Generate a stable key from the item title.
   */
  const getGroupKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  /**
   * cloneMenuItems
   * pt-BR: Clona o menu recursivamente para permitir ajustes locais sem mutar o estado de autenticação.
   * en-US: Recursively clones the menu so local adjustments don't mutate auth state.
   */
  const cloneMenuItems = (items: MenuItemDTO[]): MenuItemDTO[] =>
    items.map((item) => ({
      ...item,
      items: item.items ? cloneMenuItems(item.items) : undefined,
    }));

  /**
   * injectSuperAdminReports
   * pt-BR: Injeta relatórios exclusivos do superadmin no grupo "Relatórios".
   * en-US: Injects super-admin-only reports into the "Reports" group.
   */
  const injectSuperAdminReports = (items: MenuItemDTO[]): MenuItemDTO[] => {
    if (Number((user as any)?.permission_id ?? 0) !== 1) {
      return items;
    }

    const nextItems = cloneMenuItems(items);
    const reportsGroup = nextItems.find((item) => item.title === "Relatórios");

    if (!reportsGroup) {
      return nextItems;
    }

    const reportUrl = "/admin/reports/relatorio-acessos";
    const alreadyExists = (reportsGroup.items ?? []).some((item) => item.url === reportUrl);

    if (!alreadyExists) {
      reportsGroup.items = [
        ...(reportsGroup.items ?? []),
        {
          id: "user-access-report",
          parent_id: reportsGroup.id,
          title: "Relatório de Acessos",
          url: reportUrl,
          icon: "BarChart3",
          can_view: true,
        },
      ];
    }

    return nextItems;
  };

  // Build menu from API data or use default menu (memoizado para estabilidade)
  const baseMenu = React.useMemo(() => {
    const source = injectSuperAdminReports(
      apiMenu && apiMenu.length > 0 ? apiMenu : defaultMenu
    );
    return buildMenuFromDTO(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiMenu, (user as any)?.permission_id]);

  // Filter by can_view access (memoizado)
  const menuItems = React.useMemo(() => filterMenuByViewAccess(baseMenu), [baseMenu]);

  const groupKeys = React.useMemo(
    () => menuItems.filter((i: any) => i.items)?.map((i: any) => getGroupKey(i.title)) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [menuItems]
  );

  const [searchQuery, setSearchQuery] = React.useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Filter by search query
  const filteredMenuItems = React.useMemo(() => {
    if (!normalizedQuery) return menuItems;
    return menuItems.map((item: any) => {
      if (item.items) {
        const matchingChildren = item.items.filter((subItem: any) =>
          subItem.title.toLowerCase().includes(normalizedQuery)
        );
        if (matchingChildren.length > 0) return { ...item, items: matchingChildren };
        return item.title.toLowerCase().includes(normalizedQuery) ? item : null;
      }
      return item.title.toLowerCase().includes(normalizedQuery) ? item : null;
    }).filter(Boolean);
  }, [menuItems, normalizedQuery]);

  // Filtro por pílula de módulo (ignorado com busca ativa)
  const sectionFilteredItems = React.useMemo(() => {
    if (normalizedQuery || selectedSection === "all") {
      return filteredMenuItems;
    }
    return filteredMenuItems.filter((item: any) => getItemSection(item) === selectedSection);
  }, [filteredMenuItems, selectedSection, normalizedQuery]);

  /**
   * bestMatch
   * pt-BR: URL mais longa que casa com a rota atual — garante que páginas de
   * detalhe (/:id/edit, /:id/view) mantenham o item pai ativo.
   */
  const bestMatch = React.useMemo(() => {
    let best: string | null = null;
    const walk = (items: any[]) => {
      items.forEach((item: any) => {
        if (item.items) { walk(item.items); }
        else if (item.url) {
          const url = resolveUrl(item.url);
          if (url !== '#' && matchesPath(currentPath, url)) {
            if (!best || url.length > best.length) best = url;
          }
        }
      });
    };
    walk(menuItems);
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, menuItems]);

  const isActive = (path?: string) => {
    if (!path) return false;
    const url = resolveUrl(path);
    return bestMatch !== null && url !== '#' && matchesPath(currentPath, url) && url.length === bestMatch.length;
  };
  const hasActiveChild = (items: any[]) =>
    items?.some((item) => isActive(item.url));

  const isKeyCollapsed = (key: string) => {
    if (collapsedGroups[key] !== undefined) {
      return collapsedGroups[key];
    }
    // Estado inicial: apenas o grupo da página atual começa aberto
    const isCurrentActiveGroup = menuItems.some((item: any) =>
      getGroupKey(item.title) === key &&
      item.items?.some((sub: any) => resolveUrl(sub.url) === bestMatch)
    );
    return !isCurrentActiveGroup;
  };

  const isGroupCollapsed = (title: string) => {
    if (normalizedQuery.trim().length > 0) return false;
    return isKeyCollapsed(getGroupKey(title));
  };

  /**
   * toggleGroup — Modo Sanfona Única (Single Accordion)
   * pt-BR: Ao abrir um grupo, os demais recolhem automaticamente,
   * mantendo a altura compacta e eliminando rolagens excessivas.
   */
  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const key = getGroupKey(title);
      const isCurrentlyCollapsed = isKeyCollapsed(key);

      const next: Record<string, boolean> = {};
      if (isCurrentlyCollapsed) {
        // Abre este grupo e fecha os demais
        groupKeys.forEach((k) => {
          next[k] = (k !== key);
        });
      } else {
        // Fecha este grupo
        groupKeys.forEach((k) => {
          next[k] = (k === key) ? true : (prev[k] ?? true);
        });
      }
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const areAllGroupsCollapsed = groupKeys.length > 0 && groupKeys.every((k) => isKeyCollapsed(k));

  const collapseAllGroups = () => {
    const next = groupKeys.reduce((acc: Record<string, boolean>, k: string) => ({ ...acc, [k]: true }), {});
    setCollapsedGroups(next);
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(next)); } catch {}
  };
  const expandAllGroups = () => {
    const next = groupKeys.reduce((acc: Record<string, boolean>, k: string) => ({ ...acc, [k]: false }), {});
    setCollapsedGroups(next);
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(next)); } catch {}
  };

  const sidebarContentRef = React.useRef<HTMLDivElement>(null);
  const lastPathRef = React.useRef<string>("");
  const lastScrolledPathRef = React.useRef<string>("");

  // Mantém aberto o grupo da rota ativa SOMENTE quando o usuário navega para uma nova URL
  React.useEffect(() => {
    if (!bestMatch || collapsed) return;
    if (currentPath === lastPathRef.current) return;
    lastPathRef.current = currentPath;

    const group = menuItems.find((item: any) =>
      item.items?.some((sub: any) => resolveUrl(sub.url) === bestMatch)
    );
    if (!group) return;
    const activeKey = getGroupKey(group.title);

    setCollapsedGroups((prev) => {
      // Se o grupo já estiver aberto, não altera o estado
      if (prev[activeKey] === false) return prev;
      const next: Record<string, boolean> = {};
      groupKeys.forEach((k) => {
        next[k] = (k !== activeKey);
      });
      try { localStorage.setItem(GROUPS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, bestMatch, collapsed, menuItems, groupKeys]);

  // Rola suavemente para o item ativo SOMENTE quando o usuário navega para uma nova URL
  React.useEffect(() => {
    if (!bestMatch || collapsed) return;
    if (currentPath === lastScrolledPathRef.current) return;
    lastScrolledPathRef.current = currentPath;

    const timer = setTimeout(() => {
      const container = sidebarContentRef.current;
      if (!container) return;
      const activeEl =
        container.querySelector('[data-sidebar="menu-sub-button"][data-active="true"]') ||
        container.querySelector('[data-sidebar="menu-button"][data-active="true"]');
      if (!activeEl) return;
      const containerTop = container.getBoundingClientRect().top;
      const elTop = activeEl.getBoundingClientRect().top;
      const target = container.scrollTop + (elTop - containerTop) - 8;
      container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }, 150);

    return () => clearTimeout(timer);
  }, [currentPath, bestMatch, collapsed]);

  // Agrupamento por seção (somente desktop expandido sem busca ativa)
  const useSections = !visuallyCollapsed && !normalizedQuery;

  const groupedSections = React.useMemo(() => {
    if (!useSections) return null;
    const map: Record<string, any[]> = {};
    for (const item of sectionFilteredItems) {
      const section = getItemSection(item);
      if (!map[section]) map[section] = [];
      map[section].push(item);
    }
    return map;
  }, [sectionFilteredItems, useSections]);

  const [logoUrl, setLogoUrl] = React.useState(() => {
    try {
      const saved = localStorage.getItem('appearanceSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.logoUrl) return settings.logoUrl;
      }
    } catch {}
    return "/aeroclube-logo.svg";
  });

  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appearanceSettings') {
        try {
          const settings = JSON.parse(e.newValue || '{}');
          setLogoUrl(settings.logoUrl || "/aeroclube-logo.svg");
        } catch {}
      }
    };

    const handleCustomEvent = () => {
      try {
        const saved = localStorage.getItem('appearanceSettings');
        if (saved) {
          const settings = JSON.parse(saved);
          setLogoUrl(settings.logoUrl || "/aeroclube-logo.svg");
        }
      } catch {}
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('appearanceSettingsUpdated', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('appearanceSettingsUpdated', handleCustomEvent);
    };
  }, []);

  const userDisplayName: string = (user as any)?.name ?? "Usuário";
  const userEmail: string = (user as any)?.email ?? "";
  const userRole: string = (user as any)?.role_name ?? (user as any)?.role ?? "Usuário";

  // Renderer de item individual de menu
  const renderMenuItem = (item: any) => (
    <SidebarMenuItem key={item.title}>
      {item.items ? (
        visuallyCollapsed ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                isActive={hasActiveChild(item.items)}
                className={cn(
                  "h-10 w-10 p-0 justify-center rounded-md transition-all duration-150 font-semibold text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 sidebar-item-hover group mx-auto cursor-pointer",
                  hasActiveChild(item.items) && "bg-primary/10 text-primary font-semibold sidebar-subitem-active"
                )}
                title={item.title}
              >
                <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", hasActiveChild(item.items) ? "text-primary" : "text-slate-400")} />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              sideOffset={14}
              className="w-56 p-1.5 rounded-lg shadow-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-in fade-in-50 zoom-in-95 duration-150 z-50"
            >
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800 mb-1 flex items-center gap-2">
                <item.icon className="h-3.5 w-3.5 text-primary" />
                <span className="truncate text-slate-800 dark:text-zinc-200">{item.title}</span>
              </DropdownMenuLabel>
              <div className="space-y-0.5 max-h-[70vh] overflow-y-auto">
                {item.items.map((subItem: any) => {
                  const subActive = isActive(subItem.url);
                  return (
                    <DropdownMenuItem asChild key={subItem.title} className="p-0 focus:bg-transparent">
                      <NavLink
                        to={resolveUrl(subItem.url)}
                        onClick={handleNavigate}
                        className={cn(
                          "flex items-center w-full px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors",
                          subActive && "bg-primary/10 text-primary font-semibold"
                        )}
                      >
                        <span className="truncate">{subItem.title}</span>
                        {subActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                      </NavLink>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="space-y-0.5">
            <SidebarMenuButton
              isActive={hasActiveChild(item.items)}
              onClick={() => toggleGroup(item.title)}
              className={cn(
                "h-9 rounded-md transition-all duration-150 font-semibold text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 sidebar-item-hover group px-3 cursor-pointer",
                hasActiveChild(item.items) && "bg-primary/10 text-primary font-semibold sidebar-subitem-active"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", hasActiveChild(item.items) ? "text-primary" : "text-slate-400")} />
              <span className="flex-1 truncate">{item.title}</span>
              <div className="ml-auto transition-transform duration-200">
                {isGroupCollapsed(item.title)
                  ? <ChevronDown className="h-4 w-4 opacity-50" />
                  : <ChevronUp className="h-4 w-4 opacity-50" />}
              </div>
            </SidebarMenuButton>

            {(searchQuery ? item.items?.length > 0 : !isGroupCollapsed(item.title)) && (
              <SidebarMenuSub className="ml-5 pl-3 border-l border-slate-200/80 dark:border-zinc-800 space-y-0.5 mt-0.5">
                {item.items.map((subItem: any) => (
                  <SidebarMenuSubItem key={subItem.title}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={isActive(subItem.url)}
                      className={cn(
                        "h-8 rounded-md font-medium text-[11.5px] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 sidebar-item-hover transition-all px-2.5",
                        isActive(subItem.url) && "text-primary font-semibold bg-primary/10 sidebar-subitem-active"
                      )}
                    >
                      <NavLink to={resolveUrl(subItem.url)} onClick={handleNavigate}>
                        <span className="truncate">{subItem.title}</span>
                      </NavLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            )}
          </div>
        )
      ) : (
        <Tooltip disableHoverableContent={!visuallyCollapsed}>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              asChild
              isActive={isActive(item.url)}
              className={cn(
                "h-9 rounded-md transition-all duration-150 font-semibold text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 sidebar-item-hover group px-3",
                isActive(item.url) && "bg-primary text-primary-foreground font-semibold shadow-xs sidebar-item-active"
              )}
            >
              <NavLink to={resolveUrl(item.url)} onClick={handleNavigate}>
                <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", isActive(item.url) ? "text-white" : "text-slate-400")} />
                {!visuallyCollapsed && <span>{item.title}</span>}
              </NavLink>
            </SidebarMenuButton>
          </TooltipTrigger>
          {visuallyCollapsed && (
            <TooltipContent side="right" className="font-semibold border border-slate-200/80 dark:border-zinc-800 shadow-md rounded-md px-3 py-1.5 text-xs">
              {item.title}
            </TooltipContent>
          )}
        </Tooltip>
      )}
    </SidebarMenuItem>
  );

  return (
    <Sidebar className={cn("border-r border-slate-200/80 dark:border-zinc-800 transition-all duration-300", visuallyCollapsed ? "w-16" : "!w-64 shadow-2xl z-50")} collapsible="icon">
      <SidebarRail />

      {/* Header com branding */}
      <SidebarHeader className={cn("pb-2 print:hidden", visuallyCollapsed ? "p-2" : "p-4")}>
        <div className={cn("flex items-center gap-2", visuallyCollapsed ? "justify-center" : "justify-between")}>
          <Link to="/admin/aero-dashboard" onClick={handleNavigate} className="flex items-center gap-2.5 overflow-hidden transition-all duration-200">
            <div className="rounded-md bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10 hover:scale-105 transition-transform overflow-hidden p-0.5">
              <img
                src={logoUrl}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
                alt="Logo"
                className="h-7 w-auto max-w-[150px] object-contain"
              />
            </div>
            {!visuallyCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold tracking-tight text-slate-900 dark:text-zinc-100 truncate uppercase leading-none">CRM</span>
                <span className="text-[9px] font-semibold text-primary tracking-wider uppercase mt-0.5 opacity-90">Painel de Gestão</span>
              </div>
            )}
          </Link>
          {!visuallyCollapsed && (
            <Button variant="ghost" size="icon" onClick={() => toggleSidebar()} className="h-7 w-7 rounded-md text-slate-400 hover:bg-slate-100 lg:hidden" aria-label="Recolher menu">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      {/* Card de usuário no topo - somente mobile */}
      {isMobile && (
        <div className="mx-3 mb-2 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
              {userDisplayName?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate leading-tight">{userDisplayName}</span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{userEmail}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">{userRole}</span>
              </div>
            </div>
            <button
              onClick={() => { logout(); setOpenMobile(false); }}
              className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 transition-colors shrink-0"
              title="Sair do sistema"
              aria-label="Desconectar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!visuallyCollapsed && (
        <div className="px-3 pb-2 print:hidden shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
            <input
              type="search"
              id="sidebar-menu-search"
              name="sidebar-menu-search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              aria-label="Buscar no menu"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar no menu..."
              className="w-full h-9 rounded-md bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700 pl-9 pr-8 text-xs font-semibold text-slate-700 dark:text-zinc-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Pílulas de filtro rápido por módulo */}
          {!normalizedQuery && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {MODULE_FILTERS.map((mod) => {
                const isSelected = selectedSection === mod.id;
                const ModIcon = mod.icon;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleSelectSection(mod.id)}
                    className={cn(
                      "h-6 px-2 rounded-full text-[10px] font-semibold flex items-center gap-1 shrink-0 transition-all cursor-pointer",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                        : "bg-slate-100 hover:bg-slate-200/80 text-slate-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    <ModIcon className={cn("w-3 h-3", isSelected ? "text-primary-foreground" : "text-slate-400 dark:text-zinc-400")} />
                    <span>{mod.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <SidebarContent ref={sidebarContentRef} className="px-3 py-2 space-y-1">
        <TooltipProvider delayDuration={0}>
          {useSections && groupedSections ? (
            SECTION_ORDER.map((sectionKey, sectionIdx) => {
              const sectionItems = groupedSections[sectionKey];
              if (!sectionItems || sectionItems.length === 0) return null;
              const config = SECTION_CONFIG[sectionKey];
              return (
                <React.Fragment key={sectionKey}>
                  {sectionIdx > 0 && (
                    <SidebarSeparator className="mx-0 my-2 bg-slate-100 dark:bg-zinc-800/80" />
                  )}
                  <SidebarGroup className="p-0">
                    {config && (
                      <SidebarGroupLabel className={cn(
                        "px-2 text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5 h-auto flex items-center gap-1.5",
                        config.colorClass
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dotClass)} />
                        {config.label}
                      </SidebarGroupLabel>
                    )}
                    <SidebarGroupContent>
                      <SidebarMenu className="gap-1">
                        {sectionItems.map(renderMenuItem)}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </React.Fragment>
              );
            })
          ) : (
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 h-auto">
                {!visuallyCollapsed ? "Navegação Principal" : "•"}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {(useSections ? sectionFilteredItems : filteredMenuItems).map(renderMenuItem)}
                  {(useSections ? sectionFilteredItems : filteredMenuItems).length === 0 && (
                    <SidebarMenuItem>
                      <p className="px-2 py-4 text-center text-xs font-medium text-slate-400">
                        Nenhum item encontrado para &quot;{searchQuery}&quot;.
                      </p>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </TooltipProvider>
      </SidebarContent>

      <SidebarFooter className={cn("mt-auto border-t border-slate-100 dark:border-zinc-800/80 transition-all", visuallyCollapsed ? "p-1.5" : "p-2.5")}>
        <div className={cn("bg-slate-50/80 dark:bg-zinc-800/40 rounded-md border border-slate-200/60 dark:border-zinc-800 transition-all", visuallyCollapsed ? "p-1 flex justify-center" : "p-1.5")}>
          <SidebarMenu className={visuallyCollapsed ? "items-center justify-center w-full" : ""}>
            <SidebarMenuItem className={visuallyCollapsed ? "w-full flex justify-center" : ""}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className={cn("rounded-md bg-white dark:bg-zinc-900 shadow-xs border border-slate-200/80 dark:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all group", visuallyCollapsed ? "h-9 w-9 p-0 justify-center mx-auto" : "h-10 p-1.5")}>
                    <div className="w-7 h-7 rounded-md bg-primary text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {userDisplayName?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
                    </div>
                    {!visuallyCollapsed && (
                      <div className="flex flex-col ml-2 min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate leading-none mb-0.5 text-left">{userDisplayName.split(' ')[0]}</span>
                        <div className="flex items-center gap-1 opacity-80">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[9px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">{userRole}</span>
                        </div>
                      </div>
                    )}
                    {!visuallyCollapsed && <ChevronUp className="ml-auto h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors mr-1" />}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="center" className="w-64 p-3 rounded-md shadow-md border border-slate-200/80 dark:border-zinc-800 animate-in slide-in-from-bottom-2 duration-200">
                  <DropdownMenuLabel className="px-2 pb-3 pt-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold text-base">
                        {userDisplayName?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate leading-none">{userDisplayName}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{userEmail}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-[9px] font-semibold px-2 py-0.5 uppercase tracking-wider text-slate-500 rounded-[4px]">
                      Conta Corporativa
                    </Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-100 dark:bg-zinc-800 mb-1" />
                  <div className="space-y-0.5">
                    <DropdownMenuItem asChild className="rounded-md h-9 px-3 cursor-pointer text-xs">
                      <Link to="/admin/settings/user-profiles" onClick={handleNavigate} className="flex items-center w-full">
                        <User className="mr-2 h-4 w-4 text-slate-400" />
                        <span className="font-medium">Perfil do Usuário</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-md h-9 px-3 cursor-pointer text-xs">
                      <Link to="/admin/settings/system" onClick={handleNavigate} className="flex items-center w-full">
                        <Settings className="mr-2 h-4 w-4 text-slate-400" />
                        <span className="font-medium">Configurações do Sistema</span>
                      </Link>
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuSeparator className="bg-slate-100 dark:bg-zinc-800 my-1" />
                  <DropdownMenuItem onClick={logout} className="rounded-md h-9 px-3 cursor-pointer text-xs text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span className="font-medium">Desconectar Sistema</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
          {!visuallyCollapsed && (
            <div className="mt-2 px-2 flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] text-gray-300 dark:text-zinc-600">
              <button
                onClick={() => (areAllGroupsCollapsed ? expandAllGroups() : collapseAllGroups())}
                className="hover:text-primary transition-colors flex items-center gap-1.5 group/btn cursor-pointer"
              >
                <ChevronDown className={cn("w-3 h-3 group-hover/btn:rotate-180 transition-transform", areAllGroupsCollapsed && "rotate-180")} />
                {areAllGroupsCollapsed ? "Expandir Menu" : "Recolher Menu"}
              </button>
              <span className="opacity-40">CRM</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
