import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { instructionProgramService } from '@/services/instructionProgramService';
import { ContractInstitutionalDefaults } from '@/types/instructionProgram';

const EMPTY_DEFAULTS: ContractInstitutionalDefaults = {
  revisao_mgr: '',
  data_mgr: '',
  identificacao_tabela_e_criterios: '',
  data_base_tarifa: '',
  itens_incluidos: '',
  custos_adicionais: '',
  juros_e_correcao: '',
  modalidade_escala: '',
  carencia_e_data_liberacao: '',
  prazo_maximo_espera: '',
  regra_faltas_bloco: '',
  canal_escala: '',
  canal_secretaria: '',
  canal_qualidade: '',
  canal_privacidade: '',
  limite_realocacoes_ppa: '',
};

export function ContractInstitutionalDefaultsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContractInstitutionalDefaults>(EMPTY_DEFAULTS);

  const { data, isLoading } = useQuery({
    queryKey: ['contract-institutional-defaults'],
    queryFn: () => instructionProgramService.getContractDefaults(),
  });

  useEffect(() => {
    if (data) {
      setForm({ ...EMPTY_DEFAULTS, ...data });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => instructionProgramService.updateContractDefaults(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-institutional-defaults'] });
      toast({
        title: 'Padrões institucionais de contratos salvos!',
        description: 'Os shortcodes de contratos e a base RAG de IA foram atualizados.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro ao salvar padrões institucionais',
        variant: 'destructive',
      });
    },
  });

  const setField = (key: keyof ContractInstitutionalDefaults, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileCheck2 className="h-5 w-5 text-primary" />
          Padrões Institucionais de Contratos & Canais (Shortcodes + RAG)
        </CardTitle>
        <CardDescription>
          Valores padrão injetados automaticamente nos contratos (Quadro da Contratação) e indexados na base RAG da IA.
          Podem ser sobrescritos individualmente por Programa de Instrução, Turma ou Proposta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando padrões institucionais...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Revisão MGR padrão ({'{revisao_mgr}'})</Label>
                <Input
                  value={form.revisao_mgr}
                  onChange={(e) => setField('revisao_mgr', e.target.value)}
                  placeholder="Ex.: 004"
                />
              </div>
              <div>
                <Label>Data MGR padrão ({'{data_mgr}'})</Label>
                <Input
                  type="date"
                  value={form.data_mgr}
                  onChange={(e) => setField('data_mgr', e.target.value)}
                />
              </div>
              <div>
                <Label>Tabela de tarifas-base e critérios ({'{identificacao_tabela_e_criterios}'})</Label>
                <Input
                  value={form.identificacao_tabela_e_criterios}
                  onChange={(e) => setField('identificacao_tabela_e_criterios', e.target.value)}
                  placeholder="Ex.: Tabela Oficial 2026 — Critério de reajuste anual"
                />
              </div>
              <div>
                <Label>Data-base da tarifa ({'{data_base_tarifa}'})</Label>
                <Input
                  type="date"
                  value={form.data_base_tarifa}
                  onChange={(e) => setField('data_base_tarifa', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Juros e correção por atraso ({'{juros_e_correcao}'})</Label>
                <Input
                  value={form.juros_e_correcao}
                  onChange={(e) => setField('juros_e_correcao', e.target.value)}
                  placeholder="Ex.: Multa de 2% + juros de 1% ao mês pro rata die e correção IPCA"
                />
              </div>
              <div>
                <Label>Itens incluídos padrão ({'{itens_incluidos}'})</Label>
                <Textarea
                  rows={2}
                  value={form.itens_incluidos}
                  onChange={(e) => setField('itens_incluidos', e.target.value)}
                  placeholder="Ex.: Instrução prática de voo, briefing e debriefing"
                />
              </div>
              <div>
                <Label>Custos adicionais padrão ({'{custos_adicionais}'})</Label>
                <Textarea
                  rows={2}
                  value={form.custos_adicionais}
                  onChange={(e) => setField('custos_adicionais', e.target.value)}
                  placeholder="Ex.: Cheque, examinador ANAC, taxas aeroportuárias, simulador e materiais didáticos"
                />
              </div>
              <div>
                <Label>Modalidade de escala padrão ({'{modalidade_escala}'})</Label>
                <Input
                  value={form.modalidade_escala}
                  onChange={(e) => setField('modalidade_escala', e.target.value)}
                  placeholder="Ex.: DDS (Dias de Semana) ou FDS (Fins de Semana)"
                />
              </div>
              <div>
                <Label>Carência e data de liberação ({'{carencia_e_data_liberacao}'})</Label>
                <Input
                  value={form.carencia_e_data_liberacao}
                  onChange={(e) => setField('carencia_e_data_liberacao', e.target.value)}
                  placeholder="Ex.: 6 meses a contar do início do parcelamento"
                />
              </div>
              <div>
                <Label>Prazo máximo de espera ({'{prazo_maximo_espera}'})</Label>
                <Input
                  value={form.prazo_maximo_espera}
                  onChange={(e) => setField('prazo_maximo_espera', e.target.value)}
                  placeholder="Ex.: 30 dias corridos após habilitação na fila"
                />
              </div>
              <div>
                <Label>Regra disciplinar por faltas ({'{regra_faltas_bloco}'})</Label>
                <Input
                  value={form.regra_faltas_bloco}
                  onChange={(e) => setField('regra_faltas_bloco', e.target.value)}
                  placeholder="Ex.: Máximo de 2 faltas injustificadas por bloco"
                />
              </div>
              <div>
                <Label>Limite de realocações por turma ({'{limite_realocacoes_ppa}'})</Label>
                <Input
                  value={form.limite_realocacoes_ppa}
                  onChange={(e) => setField('limite_realocacoes_ppa', e.target.value)}
                  placeholder="Ex.: Até 1 realocação por turma"
                />
              </div>
            </div>

            <div className="pt-2 border-t">
              <h4 className="text-sm font-semibold mb-3">Canais Oficiais da Escola</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Canal oficial de escala ({'{canal_escala}'})</Label>
                  <Input
                    value={form.canal_escala}
                    onChange={(e) => setField('canal_escala', e.target.value)}
                    placeholder="Ex.: escala@aeroclube.com.br / WhatsApp (32) 99999-0000"
                  />
                </div>
                <div>
                  <Label>Canal da Secretaria ({'{canal_secretaria}'})</Label>
                  <Input
                    value={form.canal_secretaria}
                    onChange={(e) => setField('canal_secretaria', e.target.value)}
                    placeholder="Ex.: secretaria@aeroclube.com.br"
                  />
                </div>
                <div>
                  <Label>Canal do Gestor da Qualidade ({'{canal_qualidade}'})</Label>
                  <Input
                    value={form.canal_qualidade}
                    onChange={(e) => setField('canal_qualidade', e.target.value)}
                    placeholder="Ex.: qualidade@aeroclube.com.br"
                  />
                </div>
                <div>
                  <Label>Canal de privacidade / LGPD ({'{canal_privacidade}'})</Label>
                  <Input
                    value={form.canal_privacidade}
                    onChange={(e) => setField('canal_privacidade', e.target.value)}
                    placeholder="Ex.: privacidade@aeroclube.com.br"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Padrões Institucionais
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
