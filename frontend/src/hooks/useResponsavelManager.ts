/**
 * useResponsavelManager.ts
 * Hook customizado que encapsula toda a lógica de gestão do responsável
 * financeiro: busca, seleção, cadastro rápido e edição via modal.
 *
 * Padrões aplicados:
 * - Custom Hook: encapsula efeitos, estado e handlers em uma unidade coesa.
 * - Facade: expõe uma interface simples ocultando complexidade de múltiplos serviços.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { responsaveisService } from '@/services/responsaveisService';
import { enrollmentsService } from '@/services/enrollmentsService';
import { createEmptyQuickResponsibleData, QuickResponsibleFormData } from '@/components/proposals/QuickResponsibleModal';
import { cpfApplyMask } from '@/lib/masks/cpf-apply-mask';
import { cepApplyMask } from '@/lib/masks/cep-apply-mask';
import { phoneApplyMask } from '@/lib/masks/phone-apply-mask';
import { buildCreateResponsavelPayload, buildUpdateResponsavelPayload } from '@/lib/responsavel-payload';

export interface ResponsavelManagerState {
  /** Responsável atualmente vinculado (ou null) */
  localResponsavel: any;
  /** Opções do Combobox (incluindo o atual, se houver) */
  responsibleOptionsWithCurrent: { value: string; label: string }[];
  /** Termo de busca do Combobox */
  responsibleSearch: string;
  /** Indica carregamento das opções do Combobox */
  isLoadingResponsibles: boolean;
  /** Indica salvamento do vínculo */
  isSavingResponsavel: boolean;
  /** Dados do formulário do modal */
  quickRespData: QuickResponsibleFormData;
  /** Indica se o modal está aberto */
  isQuickRespOpen: boolean;
  /** Indica carregamento interno do modal (carregar dados / salvar) */
  quickRespLoading: boolean;
  /** ID em edição (null = criação) */
  quickRespEditId: string | null;
}

export interface ResponsavelManagerHandlers {
  setResponsibleSearch: (v: string) => void;
  setQuickRespData: (v: QuickResponsibleFormData) => void;
  handleSelectResponsavel: (id: string) => Promise<void>;
  handleRemoveResponsavel: () => Promise<void>;
  handleEditResponsavel: () => Promise<void>;
  handleOpenNewModal: () => void;
  handleCloseModal: () => void;
  handleQuickRespCreate: () => Promise<void>;
  handleQuickRespUpdate: () => Promise<void>;
}

export function useResponsavelManager(
  enrollmentId: string,
  initialResponsavel?: any,
): ResponsavelManagerState & ResponsavelManagerHandlers {
  const { toast } = useToast();

  // ── Estado ───────────────────────────────────────────────────────────────
  const [localResponsavel, setLocalResponsavel] = useState<any>(initialResponsavel ?? null);
  const [responsibleSearch, setResponsibleSearch] = useState('');
  const [responsibleOptions, setResponsibleOptions] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingResponsibles, setIsLoadingResponsibles] = useState(false);
  const [isSavingResponsavel, setIsSavingResponsavel] = useState(false);
  const [isQuickRespOpen, setIsQuickRespOpen] = useState(false);
  const [quickRespData, setQuickRespData] = useState<QuickResponsibleFormData>(createEmptyQuickResponsibleData());
  const [quickRespLoading, setQuickRespLoading] = useState(false);
  const [quickRespEditId, setQuickRespEditId] = useState<string | null>(null);

  // Sincroniza com mudanças externas da prop
  useEffect(() => { setLocalResponsavel(initialResponsavel ?? null); }, [initialResponsavel]);

  // Busca de responsáveis com debounce interno
  useEffect(() => {
    let active = true;
    setIsLoadingResponsibles(true);
    const timer = setTimeout(async () => {
      try {
        const result = await responsaveisService.list({ search: responsibleSearch, per_page: 30 } as any);
        const items: any[] = (result as any)?.data || (result as any)?.items || [];
        if (active) {
          setResponsibleOptions(items.map((r: any) => ({
            value: String(r.id),
            label: String(r.name || r.nome || `Responsável ${r.id}`),
          })));
        }
      } catch {
        if (active) setResponsibleOptions([]);
      } finally {
        if (active) setIsLoadingResponsibles(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [responsibleSearch]);

  // Garante que o atual apareça nas opções
  const responsibleOptionsWithCurrent = useMemo(() => {
    if (!localResponsavel) return responsibleOptions;
    const currentId = String(localResponsavel.id);
    if (responsibleOptions.some(o => o.value === currentId)) return responsibleOptions;
    return [
      { value: currentId, label: String(localResponsavel.name || localResponsavel.nome || `Responsável ${currentId}`) },
      ...responsibleOptions,
    ];
  }, [responsibleOptions, localResponsavel]);

  // ── Helpers internos ─────────────────────────────────────────────────────

  /** Salva apenas o id_responsavel sem tocar nos dados financeiros. */
  const persistResponsavel = useCallback(async (id: string | null) => {
    if (!enrollmentId) return;
    setIsSavingResponsavel(true);
    try {
      await enrollmentsService.updateEnrollment(enrollmentId, { id_responsavel: id ?? null } as any);
      toast({ title: 'Sucesso', description: id ? 'Responsável vinculado.' : 'Responsável removido.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível salvar o responsável.', variant: 'destructive' });
    } finally {
      setIsSavingResponsavel(false);
    }
  }, [enrollmentId, toast]);

  const closeModal = useCallback(() => {
    setIsQuickRespOpen(false);
    setQuickRespEditId(null);
    setQuickRespData(createEmptyQuickResponsibleData());
  }, []);

  // ── Handlers públicos ────────────────────────────────────────────────────

  const handleSelectResponsavel = useCallback(async (id: string) => {
    const found = responsibleOptions.find(o => o.value === id);
    setLocalResponsavel(found ? { id, name: found.label } : { id, name: `Responsável ${id}` });
    await persistResponsavel(id);
  }, [responsibleOptions, persistResponsavel]);

  const handleRemoveResponsavel = useCallback(async () => {
    setLocalResponsavel(null);
    await persistResponsavel(null);
  }, [persistResponsavel]);

  const handleEditResponsavel = useCallback(async () => {
    if (!localResponsavel?.id) return;
    setQuickRespLoading(true);
    try {
      const resp = await responsaveisService.getById(String(localResponsavel.id));
      const config = (() => {
        const c = (resp as any)?.config;
        if (typeof c === 'string') { try { return JSON.parse(c); } catch { return {}; } }
        return c ?? {};
      })();
      const cpfRaw = String((resp as any)?.cpf ?? '').replace(/\D/g, '');
      const phoneRaw = String(config?.celular ?? '').replace(/\D/g, '');
      setQuickRespData({
        name: (resp as any)?.name ?? '',
        email: (resp as any)?.email ?? '',
        cpf: cpfRaw ? cpfApplyMask(cpfRaw) : '',
        nationality: config?.nacionalidade ?? 'Brasileira',
        profession: config?.profissao ?? '',
        maritalStatus: config?.estado_civil ?? '',
        identity: config?.identidade ?? config?.rg ?? '',
        cep: config?.cep ? cepApplyMask(String(config.cep)) : '',
        address: config?.endereco ?? '',
        number: config?.numero ?? '',
        complement: config?.complemento ?? '',
        bairro: config?.bairro ?? '',
        city: config?.cidade ?? '',
        state: config?.uf ?? '',
        phone: phoneRaw ? phoneApplyMask(phoneRaw) : '',
      });
      setQuickRespEditId(String(localResponsavel.id));
      setIsQuickRespOpen(true);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível carregar dados do responsável.', variant: 'destructive' });
    } finally {
      setQuickRespLoading(false);
    }
  }, [localResponsavel, toast]);

  const handleOpenNewModal = useCallback(() => {
    setQuickRespEditId(null);
    setQuickRespData(createEmptyQuickResponsibleData());
    setIsQuickRespOpen(true);
  }, []);

  const handleQuickRespCreate = useCallback(async () => {
    if (!quickRespData.name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' }); return;
    }
    setQuickRespLoading(true);
    try {
      const payload = buildCreateResponsavelPayload(quickRespData);
      const created: any = await responsaveisService.create(payload);
      setLocalResponsavel(created);
      closeModal();
      await persistResponsavel(String(created.id));
      toast({ title: 'Sucesso', description: `${created.name} cadastrado e vinculado.` });
    } catch (err: any) {
      const respData = err?.response?.data;
      const detailedError = respData?.errors 
        ? Object.values(respData.errors).flat().join(' ') 
        : (respData?.message || 'Erro ao criar responsável.');
      toast({ title: 'Erro de validação', description: detailedError, variant: 'destructive' });
    } finally {
      setQuickRespLoading(false);
    }
  }, [quickRespData, persistResponsavel, closeModal, toast]);

  const handleQuickRespUpdate = useCallback(async () => {
    if (!quickRespEditId || !quickRespData.name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' }); return;
    }
    setQuickRespLoading(true);
    try {
      const payload = buildUpdateResponsavelPayload(quickRespData);
      const updated: any = await responsaveisService.update(quickRespEditId, payload);
      setLocalResponsavel(updated);
      closeModal();
      toast({ title: 'Sucesso', description: 'Responsável atualizado.' });
    } catch (err: any) {
      const respData = err?.response?.data;
      const detailedError = respData?.errors 
        ? Object.values(respData.errors).flat().join(' ') 
        : (respData?.message || 'Erro ao atualizar responsável.');
      toast({ title: 'Erro de validação', description: detailedError, variant: 'destructive' });
    } finally {
      setQuickRespLoading(false);
    }
  }, [quickRespEditId, quickRespData, closeModal, toast]);

  return {
    // State
    localResponsavel,
    responsibleOptionsWithCurrent,
    responsibleSearch,
    isLoadingResponsibles,
    isSavingResponsavel,
    quickRespData,
    isQuickRespOpen,
    quickRespLoading,
    quickRespEditId,
    // Handlers
    setResponsibleSearch,
    setQuickRespData,
    handleSelectResponsavel,
    handleRemoveResponsavel,
    handleEditResponsavel,
    handleOpenNewModal,
    handleCloseModal: closeModal,
    handleQuickRespCreate,
    handleQuickRespUpdate,
  };
}
