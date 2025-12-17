import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { periodsService } from '@/services/periodsService';
import { contractsService } from '@/services/contractsService';
import type { PeriodRecord } from '@/types/periods';
import { currencyApplyMask } from '@/lib/masks/currency';
import { aircraftService } from '@/services/aircraftService';
import { coursesService } from '@/services/coursesService';

/**
 * PeriodDetail
 * pt-BR: Página de detalhes de um período, exibindo informações básicas e contratos relacionados.
 * en-US: Detail page for a period, showing basic information and related contracts.
 */
export default function PeriodDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  /**
   * formatCurrencyBRL
   * pt-BR: Formata valores numéricos/strings como moeda BRL.
   * en-US: Formats numeric/string values as BRL currency.
   */
  /**
   * formatValorDisplay
   * pt-BR: Formata o valor do período (número ou string) para exibição em BRL.
   *        Números/dígitos puros são tratados como reais (ex.: 17820 -> R$ 17.820,00).
   * en-US: Formats period amount (number or string) for BRL display.
   *        Pure numbers/digits are treated as reais (e.g., 17820 -> R$ 17,820.00).
   */
  function formatValorDisplay(value: number | string | null | undefined): string {
    if (value === null || value === undefined || String(value) === '') return '—';
    if (typeof value === 'number') {
      try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
      } catch {
        return `R$ ${(Number(value) || 0).toFixed(2)}`;
      }
    }
    const s = String(value).trim();
    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(n);
      } catch {
        return `R$ ${(Number(n) || 0).toFixed(2)}`;
      }
    }
    return currencyApplyMask(s, 'pt-BR', 'BRL');
  }

  /**
   * periodQuery
   * pt-BR: Busca os dados do período pelo ID.
   * en-US: Fetches period data by ID.
   */
  const { data: period, isLoading: loadingPeriod } = useQuery<PeriodRecord | null>({
    queryKey: ['periods', 'detail', id],
    queryFn: async () => {
      const res = await periodsService.getById(String(id));
      return res ?? null;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * contractsQuery
   * pt-BR: Busca contratos vinculados ao curso do período para mapear labels de id_contratos.
   * en-US: Fetches contracts tied to the period's course to map labels for id_contratos.
   */
  const { data: contractsList } = useQuery({
    queryKey: ['contracts', 'by_course', period?.id_curso],
    queryFn: async () => {
      if (!period?.id_curso) return { data: [] } as any;
      return contractsService.listContracts({ page: 1, per_page: 200, id_curso: period.id_curso as any });
    },
    enabled: !!period?.id_curso,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const contractItems = ((contractsList as any)?.data || (contractsList as any)?.items || []) as any[];

  /**
   * aircraftQuery
   * pt-BR: Busca aeronaves para mapear labels dos IDs em period.aeronaves.
   * en-US: Fetches aircraft to map labels of IDs in period.aeronaves.
   */
  const { data: aircraftList } = useQuery({
    queryKey: ['aeronaves', 'list', 200],
    queryFn: async () => aircraftService.listAircraft({ page: 1, per_page: 200 }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const aircraftItems = ((aircraftList as any)?.data || (aircraftList as any)?.items || []) as any[];

  /**
   * getContractLabel
   * pt-BR: Obtém label amigável para um contrato pelo ID.
   * en-US: Gets a friendly label for a contract by ID.
   */
  function getContractLabel(cid: string | number): string {
    const c = contractItems.find((x: any) => String(x?.id) === String(cid));
    return String(c?.nome || c?.title || c?.slug || cid);
  }

  function getAircraftLabel(aid: string | number): string {
    const a = aircraftItems.find((x: any) => String(x?.id) === String(aid));
    /**
     * Preferência de label
     * pt-BR: Prioriza campo "nome"; fallback para matrícula, descrição, identificador primário e ID.
     * en-US: Prioritize "nome" field; fallback to matricula, description, identifier_primary, and ID.
     */
    const base = String(a?.nome || a?.matricula || a?.description || a?.identifier_primary || aid);
    return base;
  }

  /**
   * getModuleTypeLabel
   * pt-BR: Retorna o rótulo amigável para o tipo de módulo (1, 2, 3).
   * en-US: Returns a friendly label for module type (1, 2, 3).
   */
  function getModuleTypeLabel(tipo?: number | string | null): string {
    const v = tipo == null ? null : Number(tipo);
    if (v === 1) return 'Teórico';
    if (v === 2) return 'Prático';
    if (v === 3) return 'Teórico/Prático';
    return '—';
  }

  /**
   * coursesIncludedQueries
   * pt-BR: Busca cursos por ID para mapear labels de period.cursos_incluidos.
   * en-US: Fetches courses by ID to map labels for period.cursos_incluidos.
   */
  const includedCourseIds = Array.isArray(period?.cursos_incluidos)
    ? Array.from(new Set((period!.cursos_incluidos as any[]).map((id) => String(id))))
    : [];

  const includedCoursesQueries = useQuery({
    /**
     * pt-BR: Para evitar múltiplas requisições por ID, buscamos uma lista ampla (até 200) e filtramos pelos IDs necessários.
     * en-US: To avoid multiple requests per ID, fetch a broad list (up to 200) and filter by required IDs.
     */
    queryKey: ['cursos', 'for_period_included', includedCourseIds.join(',')],
    queryFn: async () => {
      if (includedCourseIds.length === 0) return { data: [] } as any;
      const res = await coursesService.listCourses({ page: 1, per_page: 200 });
      return res;
    },
    enabled: includedCourseIds.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const allCourses = (includedCoursesQueries.data?.data || includedCoursesQueries.data?.items || []) as any[];

  /**
   * getIncludedCourseLabel
   * pt-BR: Obtém o label de um curso pelo ID usando a lista carregada.
   * en-US: Gets course label by ID using the loaded list.
   */
  function getIncludedCourseLabel(cid: string | number): string {
    const c = allCourses.find((x: any) => String(x?.id) === String(cid));
    return String(c?.titulo || c?.nome || cid);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Detalhes do Período</h1>
        <div className="flex gap-2">
          {/**
           * buildListUrlWithSearch
           * pt-BR: Constrói a URL da listagem de períodos preservando os parâmetros de busca atuais.
           * en-US: Builds the periods listing URL preserving current search parameters.
           */}
          <Button variant="secondary" onClick={() => {
            const suffix = searchParams.toString();
            navigate(`/admin/school/periods${suffix ? `?${suffix}` : ''}`);
          }}>Voltar</Button>
          {period?.id && (
            <Button onClick={() => {
              const suffix = searchParams.toString();
              navigate(`/admin/school/periods/${period.id}/edit${suffix ? `?${suffix}` : ''}`);
            }}>Editar</Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{loadingPeriod ? 'Carregando…' : (period?.nome || period?.id || '—')}</CardTitle>
          <CardDescription>
            {loadingPeriod
              ? 'Buscando informações do período.'
              : 'Veja abaixo os dados do período e seus contratos relacionados.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!period && !loadingPeriod && (
            <p className="text-sm text-red-600">Período não encontrado.</p>
          )}

          {period && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campo</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>{String(period.id)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>{String(period.nome || '—')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Slug</TableCell>
                    <TableCell>{String(period.slug || '—')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Valor</TableCell>
                    <TableCell>{formatValorDisplay((period as any).valor)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Horas práticas</TableCell>
                    <TableCell>{period.h_praticas ?? '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Horas teóricas</TableCell>
                    <TableCell>{period.h_teoricas ?? '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Tipo de Módulo</TableCell>
                    <TableCell>{getModuleTypeLabel((period as any).tipo_modulo)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Cursos incluídos</TableCell>
                    <TableCell>
                      {Array.isArray((period as any).cursos_incluidos) && (period as any).cursos_incluidos.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {(period as any).cursos_incluidos.map((cid: any) => (
                            <Badge key={String(cid)} variant="secondary" className="max-w-[200px] truncate">
                              {getIncludedCourseLabel(cid)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>ID do Curso</TableCell>
                    <TableCell>{String(period.id_curso ?? '—')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>{period.status === 'publish' ? 'Publicado' : 'Rascunho'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Contratos relacionados</h2>
                {Array.isArray(period.id_contratos) && period.id_contratos.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {period.id_contratos.map((cid) => (
                      <Badge key={String(cid)} variant="secondary">{getContractLabel(cid)}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum contrato vinculado.</p>
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Aeronaves</h2>
                {Array.isArray(period.aeronaves) && period.aeronaves.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {period.aeronaves.map((aid) => (
                      <Badge key={String(aid)} variant="outline">{getAircraftLabel(aid)}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma aeronave vinculada.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}