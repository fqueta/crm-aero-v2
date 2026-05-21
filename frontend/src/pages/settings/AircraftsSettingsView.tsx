import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { aircraftSettingsService } from '@/services/aircraftSettingsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Pencil } from 'lucide-react';

export default function AircraftsSettingsView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: aircraftData, isLoading } = useQuery({
    queryKey: ['aircrafts', id],
    queryFn: () => aircraftSettingsService.getById(id as string),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="container mx-auto py-10 text-center">Carregando detalhes da aeronave...</div>;
  }

  if (!aircraftData) {
    return (
      <div className="container mx-auto py-10 text-center">
        <p>Aeronave não encontrada.</p>
        <Button onClick={() => navigate('/admin/settings/aircrafts')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const row = aircraftData as any;
  const isActive = row.ativo === 's' || row.ativo === true;

  return (
    <div className="space-y-6 w-full py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/admin/settings/aircrafts')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Visualizar Aeronave</h1>
            <p className="text-sm text-muted-foreground">Detalhes completos da aeronave</p>
          </div>
        </div>
        <Button onClick={() => navigate(`/admin/settings/aircrafts/${id}/edit`)}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nome</p>
              <p className="font-medium">{row.nome || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Código</p>
              <p className="font-medium">{row.codigo || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tipo</p>
              <p className="font-medium">{row.tipo || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Ativo' : 'Inativo'}</Badge>
            </div>
          </div>
          {row.descricao && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Descrição</p>
              <p className="text-sm mt-1">{row.descricao}</p>
            </div>
          )}
          {row.hora_rescisao && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Valor hora para rescisão</p>
              <p className="font-medium text-sm">R$ {row.hora_rescisao}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Combustível Ativo</p>
              <Badge variant={row.config?.combustivel?.ativar === 's' ? 'default' : 'secondary'}>
                {row.config?.combustivel?.ativar === 's' ? 'Sim' : 'Não'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Consumo por hora</p>
                <p className="font-medium">{row.config?.combustivel?.consumo_hora || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Preço por litro</p>
                <p className="font-medium">R$ {row.config?.combustivel?.preco_litro || '-'}</p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Prefixos</p>
              {row.config?.prefixos?.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {row.config.prefixos.map((p: string) => <Badge key={p} variant="outline">{p}</Badge>)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum prefixo registrado.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pacotes de Horas</CardTitle>
          </CardHeader>
          <CardContent>
            {row.pacotes && Object.keys(row.pacotes).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(row.pacotes).map(([key, pkg]: [string, any]) => (
                  <div key={key} className="p-3 border rounded-md text-sm space-y-2 bg-muted/20">
                    <div className="flex justify-between items-center font-medium">
                      <span>{pkg.label || `Pacote ${key}`}</span>
                      <Badge variant="secondary">{pkg.moeda || 'BRL'}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">A partir de:</span> {pkg.limite || '-'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hora (BRL):</span> R$ {pkg['hora-seca'] || '-'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hora (USD):</span> $ {pkg['hora-seca_dolar'] || '-'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum pacote de horas configurado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
