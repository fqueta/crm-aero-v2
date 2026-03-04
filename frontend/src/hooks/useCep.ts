import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Interface para os dados retornados pela API de CEP
 */
interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

/**
 * Interface para os dados de endereço formatados
 */
interface AddressData {
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
}

/**
 * Hook personalizado para buscar dados de CEP usando a API ViaCEP
 * @returns Objeto com função de busca, dados do endereço, estado de loading e erro
 */
export const useCep = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressData, setAddressData] = useState<AddressData | null>(null);

  /**
   * Função para limpar apenas os dígitos do CEP
   * @param cep CEP com ou sem formatação
   * @returns CEP apenas com dígitos
   */
  const cleanCep = (cep: string): string => {
    return cep.replace(/\D/g, '');
  };

  /**
   * Função para validar se o CEP tem o formato correto
   * @param cep CEP para validação
   * @returns true se o CEP é válido
   */
  const isValidCep = (cep: string): boolean => {
    const cleanedCep = cleanCep(cep);
    return cleanedCep.length === 8 && /^\d{8}$/.test(cleanedCep);
  };

  /**
   * Função para buscar dados do CEP na API ViaCEP
   * @param cep CEP para busca
   * @returns Promise com os dados do endereço ou null em caso de erro
   */
  const fetchCep = async (cep: string): Promise<AddressData | null> => {
    if (!isValidCep(cep)) {
      setError('CEP inválido. Digite um CEP com 8 dígitos.');
      toast.error('CEP inválido');
      return null;
    }

    const cleanedCep = cleanCep(cep);
    setLoading(true);
    setError(null);

    try {
      // 1) ViaCEP
      const respVia = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
      if (respVia.ok) {
        const dataVia: CepData = await respVia.json();
        if (!dataVia.erro) {
          const formattedVia: AddressData = {
            endereco: dataVia.logradouro || '',
            bairro: dataVia.bairro || '',
            cidade: dataVia.localidade || '',
            uf: dataVia.uf || ''
          };
          setAddressData(formattedVia);
          toast.success('CEP encontrado (ViaCEP)');
          return formattedVia;
        }
      }
      // 2) BrasilAPI fallback
      const respBra = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanedCep}`);
      if (respBra.ok) {
        const dataBra = await respBra.json() as any;
        if (dataBra && (dataBra.street || dataBra.city || dataBra.state)) {
          const formattedBra: AddressData = {
            endereco: dataBra.street || '',
            bairro: dataBra.neighborhood || '',
            cidade: dataBra.city || '',
            uf: dataBra.state || ''
          };
          setAddressData(formattedBra);
          toast.success('CEP encontrado (BrasilAPI)');
          return formattedBra;
        }
      }
      // 3) API CEP fallback
      const respApiCep = await fetch(`https://apicep.com/api/cep/${cleanedCep}.json`);
      if (respApiCep.ok) {
        const dataApiCep = await respApiCep.json() as any;
        if (dataApiCep && dataApiCep.status === 200) {
          const formattedApi: AddressData = {
            endereco: dataApiCep.address || '',
            bairro: dataApiCep.district || '',
            cidade: dataApiCep.city || '',
            uf: dataApiCep.state || ''
          };
          setAddressData(formattedApi);
          toast.success('CEP encontrado (API CEP)');
          return formattedApi;
        }
      }
      setError('CEP não encontrado nas fontes disponíveis');
      toast.error('CEP não encontrado nas fontes disponíveis');
      return null;
    } catch (err) {
      setError('Erro ao buscar CEP nas fontes disponíveis.');
      toast.error('Erro ao buscar CEP nas fontes disponíveis.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Função para limpar os dados de endereço
   */
  const clearAddressData = () => {
    setAddressData(null);
    setError(null);
  };

  return {
    fetchCep,
    loading,
    error,
    addressData,
    clearAddressData,
    isValidCep
  };
};
