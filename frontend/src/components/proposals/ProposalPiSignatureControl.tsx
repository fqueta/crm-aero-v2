import React from 'react';
import { BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  control: any;
  selectedCourse?: any;
  selectedModule?: any;
}

export default function ProposalPiSignatureControl({ control, selectedCourse, selectedModule }: Props) {
  if (!selectedCourse) {
    return null;
  }

  const isTipo4 = String(selectedCourse?.tipo ?? '') === '4';
  const periodPi = isTipo4 ? selectedModule?.instruction_program : null;

  let defaultLabel = 'Oculto por padrão';
  if (isTipo4 && selectedModule) {
    if (selectedModule.signature_require_pi_acceptance) {
      defaultLabel = 'Exibir + aceite obrigatório (regra do período)';
    } else if (selectedModule.signature_show_pi_link) {
      defaultLabel = 'Exibir link opcional (regra do período)';
    } else if (selectedCourse?.config?.signature_require_pi_acceptance) {
      defaultLabel = 'Exibir + aceite obrigatório (padrão do curso)';
    } else if (selectedCourse?.config?.signature_show_pi_link) {
      defaultLabel = 'Exibir link opcional (padrão do curso)';
    }
  } else if (selectedCourse?.config?.signature_require_pi_acceptance) {
    defaultLabel = 'Exibir + aceite obrigatório (padrão do curso)';
  } else if (selectedCourse?.config?.signature_show_pi_link) {
    defaultLabel = 'Exibir link opcional (padrão do curso)';
  }

  return (
    <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/30 dark:bg-emerald-950/10 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <BookOpen className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-foreground flex flex-wrap items-center gap-1.5">
              <span>Programa de Instrução (PI) na Assinatura do Contrato</span>
              <Badge variant="outline" className="text-[10px] font-normal">
                {defaultLabel}
              </Badge>
            </div>
            {isTipo4 && selectedModule ? (
              periodPi ? (
                <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5">
                  <span>
                    Período <strong>{selectedModule.nome}</strong>: <strong>{periodPi.title}</strong>
                  </span>
                  {periodPi.code && (
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {periodPi.code}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    Rev. {periodPi.current_revision}
                  </Badge>
                  {periodPi.curso_id && Number(periodPi.curso_id) !== Number(selectedCourse.id) && (
                    <Badge variant="secondary" className="text-[10px] bg-sky-100 text-sky-800 border-sky-200">
                      Reaproveitado de: {periodPi.curso_nome || `Curso #${periodPi.curso_id}`}
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground">
                  Período <strong>{selectedModule.nome}</strong> sem PI exclusivo (usa fallback do curso, se publicado).
                </div>
              )
            ) : isTipo4 ? (
              <div className="text-[11px] text-muted-foreground">
                Selecione um período acima para visualizar o PI vinculado e definir a exibição nesta proposta.
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground">
                Defina se o PI do curso deve ser exibido ou ocultado especificamente nesta proposta.
              </div>
            )}
          </div>
        </div>
      </div>

      <FormField
        control={control}
        name="pi_signature_override"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Exibição do PI na assinatura desta proposta
            </FormLabel>
            <Select value={field.value || 'default'} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="bg-white dark:bg-zinc-900">
                  <SelectValue placeholder="Padrão do período / curso" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="default">Usar padrão do período / curso ({defaultLabel})</SelectItem>
                <SelectItem value="show">Exibir link do PI na assinatura (opcional)</SelectItem>
                <SelectItem value="show_and_require">Exibir link e exigir aceite obrigatório do PI</SelectItem>
                <SelectItem value="hide">Não exibir PI na assinatura desta proposta</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
