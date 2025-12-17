/**
 * Upload types
 * pt-BR: Tipos para registros de upload de imagens.
 * en-US: Types for image upload records.
 */
export type UploadRecord = {
  id: number;
  nome: string;
  slug: string;
  url: string;
  mime: string;
  size: number;
  ativo: 's' | 'n';
  ordenar: number;
  descricao: string;
};

/**
 * UploadResponse
 * pt-BR: Resposta padrão da API de uploads: { data: UploadRecord }.
 * en-US: Standard API response for uploads: { data: UploadRecord }.
 */
export type UploadResponse = {
  data: UploadRecord;
};