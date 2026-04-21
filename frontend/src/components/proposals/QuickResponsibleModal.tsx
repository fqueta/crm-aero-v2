import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCep } from '@/hooks/useCep';
import { cepApplyMask } from '@/lib/masks/cep-apply-mask';
import { cpfApplyMask } from '@/lib/masks/cpf-apply-mask';
import { phoneApplyMask } from '@/lib/masks/phone-apply-mask';

export interface QuickResponsibleFormData {
  name: string;
  nationality: string;
  profession: string;
  maritalStatus: string;
  cpf: string;
  identity: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  bairro: string;
  city: string;
  state: string;
  phone: string;
  email: string;
}

interface QuickResponsibleModalProps {
  open: boolean;
  loading: boolean;
  data: QuickResponsibleFormData;
  onChange: (next: QuickResponsibleFormData) => void;
  onClose: () => void;
  onSubmit: () => void;
  mode?: 'create' | 'edit';
}

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const;

const MARITAL_STATUS_OPTIONS = [
  'Solteiro(a)',
  'Casado(a)',
  'Divorciado(a)',
  'Viuvo(a)',
  'Uniao estavel',
] as const;

/**
 * createEmptyQuickResponsibleData
 * pt-BR: Retorna os valores iniciais do formulario rapido de responsavel.
 * en-US: Returns initial values for the quick responsible form.
 */
export function createEmptyQuickResponsibleData(): QuickResponsibleFormData {
  return {
    name: '',
    nationality: 'Brasileira',
    profession: '',
    maritalStatus: '',
    cpf: '',
    identity: '',
    cep: '',
    address: '',
    number: '',
    complement: '',
    bairro: '',
    city: '',
    state: '',
    phone: '',
    email: '',
  };
}

/**
 * SectionTitle
 * pt-BR: Renderiza o cabecalho azul de cada secao do modal.
 * en-US: Renders the blue header for each modal section.
 */
function SectionTitle({ title }: { title: string }) {
  return <div className="bg-[#357ab8] text-white font-semibold px-4 py-3 rounded-sm">{title}</div>;
}

/**
 * QuickResponsibleModal
 * pt-BR: Exibe o formulario rapido de responsavel com dados pessoais, endereco e contato.
 * en-US: Displays the quick responsible form with personal, address, and contact fields.
 */
export default function QuickResponsibleModal({
  open,
  loading,
  data,
  onChange,
  onClose,
  onSubmit,
  mode = 'create',
}: QuickResponsibleModalProps) {
  const { fetchCep, loading: cepLoading } = useCep();

  /**
   * updateField
   * pt-BR: Atualiza um campo simples do formulario mantendo o restante do estado.
   * en-US: Updates a simple form field while preserving the rest of the state.
   */
  function updateField<K extends keyof QuickResponsibleFormData>(field: K, value: QuickResponsibleFormData[K]) {
    onChange({ ...data, [field]: value });
  }

  /**
   * handleCepChange
   * pt-BR: Aplica mascara ao CEP e preenche endereco automaticamente quando houver 8 digitos.
   * en-US: Applies CEP mask and auto-fills address when 8 digits are provided.
   */
  async function handleCepChange(rawValue: string) {
    const masked = cepApplyMask(rawValue);
    const digits = masked.replace(/\D/g, '');
    updateField('cep', masked);

    if (digits.length !== 8) return;

    const address = await fetchCep(digits);
    if (!address) return;

    onChange({
      ...data,
      cep: masked,
      address: address.endereco || '',
      bairro: address.bairro || '',
      city: address.cidade || '',
      state: address.uf || '',
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-6xl bg-background rounded-lg shadow-lg border max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b">
          <div className="font-medium text-2xl">
            {mode === 'edit' ? 'Editar Responsável Financeiro' : 'Cadastro do Fiador'}
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <SectionTitle title="Dados Pessoais" />
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nome completo</label>
                <Input
                  value={data.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Nome completo do fiador"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Nacionalidade</label>
                  <Input
                    value={data.nationality}
                    onChange={(e) => updateField('nationality', e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Profissao</label>
                  <Input
                    value={data.profession}
                    onChange={(e) => updateField('profession', e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Estado Civil</label>
                  <Select value={data.maritalStatus} onValueChange={(value) => updateField('maritalStatus', value)} disabled={loading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Estado Civil" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARITAL_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">CPF</label>
                  <Input
                    value={data.cpf}
                    onChange={(e) => updateField('cpf', cpfApplyMask(e.target.value.replace(/\D/g, '').slice(0, 11)))}
                    placeholder="000.000.000-00"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Ident</label>
                  <Input
                    value={data.identity}
                    onChange={(e) => updateField('identity', e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle title="Endereco" />
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_160px] gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">CEP</label>
                  <Input
                    value={data.cep}
                    onChange={(e) => void handleCepChange(e.target.value)}
                    placeholder={cepLoading ? 'Buscando...' : '00000-000'}
                    disabled={loading || cepLoading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Endereco</label>
                  <Input
                    value={data.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Numero</label>
                  <Input
                    value={data.number}
                    onChange={(e) => updateField('number', e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Compl</label>
                  <Input
                    value={data.complement}
                    onChange={(e) => updateField('complement', e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Bairro</label>
                  <Input
                    value={data.bairro}
                    onChange={(e) => updateField('bairro', e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Cidade</label>
                  <Input
                    value={data.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Estado</label>
                  <Select value={data.state} onValueChange={(value) => updateField('state', value)} disabled={loading}>
                    <SelectTrigger>
                      <SelectValue placeholder="-- Estado --" />
                    </SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle title="Contato" />
            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Telefone Zap</label>
                <Input
                  value={data.phone}
                  onChange={(e) => updateField('phone', phoneApplyMask(e.target.value))}
                  placeholder="Somente numeros"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <Input
                  value={data.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="email@exemplo.com"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 flex items-center justify-end gap-2 border-t bg-muted/20 rounded-b-lg">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Fechar
          </Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? 'Salvando...' : (mode === 'edit' ? 'Atualizar' : 'Salvar')}
          </Button>
        </div>
      </div>
    </div>
  );
}
