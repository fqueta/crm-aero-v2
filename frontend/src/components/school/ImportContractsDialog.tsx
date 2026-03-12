import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { coursesService } from '@/services/coursesService';
import { contractsService } from '@/services/contractsService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { ContractRecord } from '@/types/contracts';

interface ImportContractsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCourseId: string | number;
  courseType?: string;
}

export function ImportContractsDialog({
  open,
  onOpenChange,
  currentCourseId,
  courseType,
}: ImportContractsDialogProps) {
  const queryClient = useQueryClient();
  const [selectedSourceCourse, setSelectedSourceCourse] = useState<string>('');
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // 1. Listar cursos do mesmo tipo para serem a origem
  const { data: coursesData, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['courses', 'list_for_import', courseType],
    queryFn: async () => {
      // Busca cursos do mesmo tipo (1 ou 2)
      const res = await coursesService.listCourses({ 
        page: 1, 
        per_page: 100, 
        tipo: courseType 
      });
      return res;
    },
    enabled: open && !!courseType,
    staleTime: 5 * 60 * 1000,
  });

  const sourceCourses = ((coursesData?.data || (coursesData as any)?.items || []) as any[])
    .filter((c) => String(c.id) !== String(currentCourseId));

  // 2. Listar contratos do curso de origem selecionado
  const { data: contractsData, isLoading: isLoadingContracts } = useQuery({
    queryKey: ['contracts', 'by_course', selectedSourceCourse],
    queryFn: async () => {
      if (!selectedSourceCourse) return { data: [] };
      return contractsService.listContracts({ 
        page: 1, 
        per_page: 100, 
        id_curso: selectedSourceCourse 
      });
    },
    enabled: !!selectedSourceCourse,
  });

  const availableContracts = ((contractsData?.data || (contractsData as any)?.items || []) as ContractRecord[]);

  // Toggle de seleção de contrato
  const toggleContract = (contractId: string) => {
    setSelectedContracts((prev) => 
      prev.includes(contractId) 
        ? prev.filter((id) => id !== contractId)
        : [...prev, contractId]
    );
  };

  const handleSelectAll = () => {
    if (selectedContracts.length === availableContracts.length) {
      setSelectedContracts([]);
    } else {
      setSelectedContracts(availableContracts.map(c => String(c.id)));
    }
  };

  // Ação de importação
  const handleImport = async () => {
    if (selectedContracts.length === 0) return;
    
    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Para cada contrato selecionado, buscamos os detalhes completos e criamos uma cópia
      for (const contractId of selectedContracts) {
        try {
          const original = await contractsService.getById(contractId);
          if (original) {
            await contractsService.createContract({
              nome: original.nome, // Mantém o nome original (ou poderia adicionar sulfixo)
              slug: original.slug, // Slug será recalculado ou mantido único pelo backend
              conteudo: original.conteudo || (original as any).content,
              ativo: 'draft', // Importa como rascunho por segurança
              id_curso: currentCourseId,
              periodo: original.periodo
            });
            successCount++;
          }
        } catch (err) {
          console.error(`Erro ao importar contrato ${contractId}`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} contrato(s) importado(s) com sucesso.`);
        queryClient.invalidateQueries({ queryKey: ['contracts', 'by_course', currentCourseId] });
        onOpenChange(false);
        // Reset states
        setSelectedSourceCourse('');
        setSelectedContracts([]);
      }
      
      if (failCount > 0) {
        toast.error(`Falha ao importar ${failCount} contrato(s).`);
      }

    } catch (error) {
      toast.error('Erro ao processar importação.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Importar Contratos</DialogTitle>
          <DialogDescription>
            Copie contratos de outros cursos do mesmo tipo para este curso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Curso de Origem</Label>
            <Select 
              value={selectedSourceCourse} 
              onValueChange={(val) => {
                setSelectedSourceCourse(val);
                setSelectedContracts([]);
              }}
              disabled={isLoadingCourses || isImporting}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingCourses ? "Carregando cursos..." : "Selecione um curso"} />
              </SelectTrigger>
              <SelectContent>
                {sourceCourses.map((course) => (
                  <SelectItem key={course.id} value={String(course.id)}>
                    {course.nome || course.titulo || `Curso #${course.id}`}
                  </SelectItem>
                ))}
                {sourceCourses.length === 0 && !isLoadingCourses && (
                  <div className="p-2 text-sm text-muted-foreground text-center">Nenhum outro curso encontrado.</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedSourceCourse && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Contratos Disponíveis</Label>
                {availableContracts.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-auto p-0 px-2 text-xs">
                    {selectedContracts.length === availableContracts.length ? 'Desmarcar todos' : 'Marcar todos'}
                  </Button>
                )}
              </div>
              
              <div className="border rounded-md p-2">
                {isLoadingContracts ? (
                  <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando contratos...
                  </div>
                ) : availableContracts.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Este curso não possui contratos.
                  </div>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {availableContracts.map((contract) => (
                        <div key={contract.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded">
                          <Checkbox 
                            id={`contract-${contract.id}`} 
                            checked={selectedContracts.includes(String(contract.id))}
                            onCheckedChange={() => toggleContract(String(contract.id))}
                          />
                          <Label 
                            htmlFor={`contract-${contract.id}`} 
                            className="flex-1 cursor-pointer text-sm font-normal"
                          >
                            {contract.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-right">
                {selectedContracts.length} selecionado(s)
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!selectedSourceCourse || selectedContracts.length === 0 || isImporting}>
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar Selecionados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
