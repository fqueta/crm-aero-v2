/**
 * ResponsibleManagerCard.tsx
 * Card de gestão do Responsável Financeiro na aba de contratos.
 * Aplica o padrão Presentational Component — recebe apenas o hook manager
 * via props e não contém lógica de negócio própria.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Loader2, Pencil, X, UserRound, Plus } from 'lucide-react';
import QuickResponsibleModal from '@/components/proposals/QuickResponsibleModal';
import { cpfApplyMask } from '@/lib/masks/cpf-apply-mask';
import type { ResponsavelManagerState, ResponsavelManagerHandlers } from '@/hooks/useResponsavelManager';

interface ResponsibleManagerCardProps extends ResponsavelManagerState, ResponsavelManagerHandlers {}

export function ResponsibleManagerCard({
  localResponsavel,
  responsibleOptionsWithCurrent,
  responsibleSearch,
  isLoadingResponsibles,
  isSavingResponsavel,
  quickRespData,
  isQuickRespOpen,
  quickRespLoading,
  quickRespEditId,
  setResponsibleSearch,
  setQuickRespData,
  handleSelectResponsavel,
  handleRemoveResponsavel,
  handleEditResponsavel,
  handleOpenNewModal,
  handleCloseModal,
  handleQuickRespCreate,
  handleQuickRespUpdate,
}: ResponsibleManagerCardProps) {
  return (
    <>
      <Card className="border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-amber-600" />
              <div>
                <CardTitle className="text-base">Responsável Financeiro</CardTitle>
                <CardDescription className="text-xs">
                  Vincule o fiador sem alterar os valores da proposta
                </CardDescription>
              </div>
            </div>

            {localResponsavel && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleEditResponsavel} disabled={quickRespLoading}>
                  {quickRespLoading
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Pencil className="h-3 w-3 mr-1" />}
                  Editar Cadastro
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={handleRemoveResponsavel}
                  disabled={isSavingResponsavel}
                >
                  <X className="h-3 w-3 mr-1" /> Remover
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {localResponsavel ? (
            <div className="rounded-md border bg-background p-3 flex items-center gap-3">
              <UserRound className="h-8 w-8 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {localResponsavel.name || localResponsavel.nome}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                  {localResponsavel.email && (
                    <span className="text-xs text-muted-foreground">{localResponsavel.email}</span>
                  )}
                  {(localResponsavel.config?.celular || localResponsavel.celular) && (
                    <span className="text-xs text-muted-foreground">
                      {localResponsavel.config?.celular || localResponsavel.celular}
                    </span>
                  )}
                  {localResponsavel.cpf && (
                    <span className="text-xs text-muted-foreground">
                      CPF: {cpfApplyMask(String(localResponsavel.cpf).replace(/\D/g, ''))}
                    </span>
                  )}
                </div>
              </div>
              {isSavingResponsavel && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              )}
            </div>
          ) : (
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <Combobox
                  options={responsibleOptionsWithCurrent}
                  value=""
                  onValueChange={(val) => { if (val) handleSelectResponsavel(val); }}
                  placeholder="Selecionar responsável existente..."
                  searchPlaceholder="Pesquisar pelo nome..."
                  emptyText="Nenhum responsável encontrado"
                  disabled={isLoadingResponsibles || isSavingResponsavel}
                  loading={isLoadingResponsibles}
                  onSearch={setResponsibleSearch}
                  searchTerm={responsibleSearch}
                  debounceMs={250}
                />
              </div>
              <Button
                size="sm" variant="outline"
                className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={handleOpenNewModal}
              >
                <Plus className="h-4 w-4 mr-1" /> Novo Responsável
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Cadastro/Edição Rápida */}
      <QuickResponsibleModal
        open={isQuickRespOpen}
        loading={quickRespLoading}
        data={quickRespData}
        onChange={setQuickRespData}
        onClose={handleCloseModal}
        mode={quickRespEditId ? 'edit' : 'create'}
        onSubmit={quickRespEditId ? handleQuickRespUpdate : handleQuickRespCreate}
      />
    </>
  );
}
