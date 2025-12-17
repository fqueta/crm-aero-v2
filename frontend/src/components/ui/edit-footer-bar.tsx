import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, CheckCircle } from 'lucide-react';

export interface EditFooterBarProps {
  /**
   * onBack
   * pt-BR: Handler para ação de voltar.
   * en-US: Handler for the back action.
   */
  onBack: () => void;
  /**
   * onContinue
   * pt-BR: Handler para salvar e continuar edição nesta página.
   * en-US: Handler to save and keep editing on this page.
   */
  onContinue?: () => void;
  /**
   * onFinish
   * pt-BR: Handler para salvar e finalizar, retornando à origem/lista.
   * en-US: Handler to save and finish, returning to origin/listing.
   */
  onFinish?: () => void;
  /**
   * disabled
   * pt-BR: Desabilita ações enquanto há submissão/carregamento.
   * en-US: Disables actions while submitting/loading.
   */
  disabled?: boolean;
  /**
   * backLabel
   * pt-BR: Texto do botão Voltar.
   * en-US: Back button label.
   */
  backLabel?: string;
  /**
   * continueLabel
   * pt-BR: Texto do botão Salvar e Continuar.
   * en-US: Save and Continue button label.
   */
  continueLabel?: string;
  /**
   * finishLabel
   * pt-BR: Texto do botão Salvar e Finalizar.
   * en-US: Save and Finish button label.
   */
  finishLabel?: string;
  /**
   * showContinue
   * pt-BR: Controla a exibição do botão "Salvar e Continuar".
   * en-US: Controls visibility of the "Save and Continue" button.
   */
  showContinue?: boolean;
  /**
   * showFinish
   * pt-BR: Controla a exibição do botão "Salvar e Finalizar".
   * en-US: Controls visibility of the "Save and Finish" button.
   */
  showFinish?: boolean;
  /**
   * fixed
   * pt-BR: Define se a barra é fixa ao rodapé da janela.
   * en-US: Defines whether the bar is fixed to the window footer.
   */
  fixed?: boolean;
  /**
   * className
   * pt-BR: Classe adicional para customização do contêiner.
   * en-US: Additional class for container customization.
   */
  className?: string;
}

/**
 * EditFooterBar
 * pt-BR: Barra fixa de ações de edição para reutilizar em páginas de formulário.
 *        Inclui Voltar, Salvar e Continuar e Salvar e Finalizar com ícones.
 * en-US: Fixed action bar for editing pages to reuse across forms.
 *        Includes Back, Save and Continue, and Save and Finish with icons.
 */
export function EditFooterBar({
  onBack,
  onContinue,
  onFinish,
  disabled = false,
  backLabel = 'Voltar',
  continueLabel = 'Salvar e Continuar',
  finishLabel = 'Salvar e Finalizar',
  showContinue = true,
  showFinish = true,
  fixed = true,
  className = '',
}: EditFooterBarProps) {
  const containerClasses = fixed
    ? 'fixed bottom-0 left-0 md:left-[var(--sidebar-width)] right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'
    : '';

  return (
    <div className={`${containerClasses} ${className}`.trim()}>
      <div className="container mx-auto py-3 flex flex-wrap items-center gap-2 justify-start">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {backLabel}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {showContinue && (
            <Button type="button" onClick={onContinue} disabled={disabled}>
              <Save className="h-4 w-4 mr-2" /> {continueLabel}
            </Button>
          )}
          {showFinish && (
            <Button type="button" onClick={onFinish} disabled={disabled}>
              <CheckCircle className="h-4 w-4 mr-2" /> {finishLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditFooterBar;