import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { turmasService } from '@/services/turmasService';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Calendar, Users, Loader2 } from 'lucide-react';

export interface QuickTurmaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idCurso?: number | string | null;
  courseName?: string;
  onSuccess: (newTurma: any) => void;
}

export function QuickTurmaModal({
  open,
  onOpenChange,
  idCurso,
  courseName,
  onSuccess,
}: QuickTurmaModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [nome, setNome] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [maxAlunos, setMaxAlunos] = useState('30');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setNome('');
    setInicio('');
    setFim('');
    setMaxAlunos('30');
  };

  const handleClose = () => {
    if (loading) return;
    onOpenChange(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!idCurso) {
      toast({
        title: 'Atenção',
        description: 'Selecione um curso principal antes de cadastrar uma turma.',
        variant: 'destructive',
      });
      return;
    }

    if (!nome.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o nome da turma (ex.: Turma A - 2026/1).',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        id_curso: Number(idCurso),
        nome: nome.trim(),
        inicio: inicio ? inicio : null,
        fim: fim ? fim : null,
        max_alunos: maxAlunos ? String(maxAlunos) : '30',
        min_alunos: '1',
        ativo: 's',
        excluido: 'n',
        deletado: 'n',
      };

      const createdTurma = await turmasService.createTurma(payload);

      // Invalida cache de turmas para recarregar opções
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      await queryClient.invalidateQueries({ queryKey: ['turmas'] });

      toast({
        title: 'Turma cadastrada com sucesso!',
        description: `A turma "${nome.trim()}" foi criada e selecionada.`,
      });

      handleClose();
      onSuccess(createdTurma);
    } catch (err: any) {
      console.error('Erro ao cadastrar turma rápida:', err);
      const apiMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Falha ao salvar turma.';
      toast({
        title: 'Erro ao cadastrar turma',
        description: apiMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Nova Turma Rápida</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {courseName ? `Curso: ${courseName}` : 'Cadastre uma nova turma para este curso'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Nome da turma */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Nome / Identificação da Turma *</Label>
            <Input
              placeholder="Ex.: Turma Alfa - 2026/1 ou Semestre 1"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Datas Início e Fim */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Data de Início
              </Label>
              <Input
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Previsão de Término
              </Label>
              <Input
                type="date"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Vagas */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              Capacidade Máxima (Alunos)
            </Label>
            <Input
              type="number"
              min="1"
              max="999"
              placeholder="Ex.: 30"
              value={maxAlunos}
              onChange={(e) => setMaxAlunos(e.target.value)}
              disabled={loading}
            />
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Criar Turma</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export default QuickTurmaModal;
