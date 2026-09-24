/**
 * contractShortcodes.ts — Catálogo único de shortcodes do contrato
 * pt-BR: Fonte da verdade para as variáveis dinâmicas do termo/contrato:
 * chips clicáveis, "Copiar Lista Base" e autocomplete (`{` + Ctrl+Espaço)
 * no editor de Contratos e termos. Ao criar um shortcode novo no backend
 * (`$dm` em `contratos_periodos`), registre aqui com descrição.
 * en-US: Single source of truth for contract term shortcodes:
 * clickable chips, "Copy Base List" and autocomplete (`{` + Ctrl+Space)
 * in the Contracts editor. When adding a backend shortcode
 * (`$dm` in `contratos_periodos`), register it here with a description.
 */

export interface ContractShortcode {
  /** Tag sem chaves, ex.: "tabela_parcelas" */
  tag: string;
  /** Descrição curta exibida como ajuda */
  desc: string;
  /** Grupo para organização futura */
  grupo: string;
}

export const CONTRACT_SHORTCODES: ContractShortcode[] = [
  // Aluno
  { tag: "aluno", desc: "Nome do Aluno", grupo: "Aluno" },
  { tag: "cpf_aluno", desc: "CPF do Aluno", grupo: "Aluno" },
  { tag: "identidade", desc: "RG Aluno", grupo: "Aluno" },
  { tag: "data_nascimento", desc: "Nasc. Aluno", grupo: "Aluno" },
  { tag: "nacionalidade", desc: "Nacionalidade", grupo: "Aluno" },
  { tag: "estado_civil", desc: "Estado Civil", grupo: "Aluno" },
  { tag: "profissao", desc: "Profissão", grupo: "Aluno" },
  { tag: "endereco", desc: "Endereço", grupo: "Aluno" },
  { tag: "logradouro", desc: "Logradouro", grupo: "Aluno" },
  { tag: "numero", desc: "Número", grupo: "Aluno" },
  { tag: "bairro", desc: "Bairro", grupo: "Aluno" },
  { tag: "cidade", desc: "Cidade", grupo: "Aluno" },
  { tag: "estado", desc: "Estado", grupo: "Aluno" },
  { tag: "cep", desc: "CEP", grupo: "Aluno" },
  { tag: "celular", desc: "Celular do Aluno", grupo: "Aluno" },
  { tag: "telefone", desc: "Telefone do Aluno", grupo: "Aluno" },
  // Responsável / fiador
  { tag: "responsavel_nome", desc: "Nome do Fiador/Responsável", grupo: "Responsável" },
  { tag: "responsavel_cpf", desc: "CPF do Fiador/Responsável", grupo: "Responsável" },
  { tag: "responsavel_identidade", desc: "RG do Fiador", grupo: "Responsável" },
  { tag: "responsavel_email", desc: "E-mail do Fiador", grupo: "Responsável" },
  { tag: "responsavel_celular", desc: "Celular do Fiador", grupo: "Responsável" },
  { tag: "responsavel_data_nascimento", desc: "Nascimento do Fiador", grupo: "Responsável" },
  { tag: "responsavel_estado_civil", desc: "Estado Civil do Fiador", grupo: "Responsável" },
  { tag: "responsavel_nacionalidade", desc: "Nacionalidade do Fiador", grupo: "Responsável" },
  { tag: "responsavel_profissao", desc: "Profissão do Fiador", grupo: "Responsável" },
  { tag: "responsavel_endereco", desc: "Endereço do Fiador", grupo: "Responsável" },
  { tag: "responsavel_numero", desc: "Número do Fiador", grupo: "Responsável" },
  { tag: "responsavel_bairro", desc: "Bairro do Fiador", grupo: "Responsável" },
  { tag: "responsavel_cidade", desc: "Cidade do Fiador", grupo: "Responsável" },
  { tag: "responsavel_uf", desc: "UF do Fiador", grupo: "Responsável" },
  { tag: "responsavel_cep", desc: "CEP do Fiador", grupo: "Responsável" },
  // Curso / proposta
  { tag: "curso", desc: "Nome do Curso", grupo: "Curso" },
  { tag: "nome_curso", desc: "Nome do Curso (alias)", grupo: "Curso" },
  { tag: "valor_total", desc: "Valor Total do Contrato", grupo: "Curso" },
  { tag: "numero_contrato", desc: "Número do Contrato", grupo: "Contrato" },
  // Vendas / Parcelamento (Painel de Vendas + Programação de Pagamento)
  { tag: "total_parcelas", desc: "Total de parcelas (Painel de Vendas)", grupo: "Vendas / Parcelamento" },
  { tag: "qtd_parcelas", desc: "Qtd. de parcelas (alias)", grupo: "Vendas / Parcelamento" },
  { tag: "valor_parcela", desc: "Valor da parcela (bruto)", grupo: "Vendas / Parcelamento" },
  { tag: "desconto_pontualidade", desc: "Desconto por pontualidade", grupo: "Vendas / Parcelamento" },
  { tag: "parcela_com_desconto", desc: "Valor líquido da parcela (com desconto)", grupo: "Vendas / Parcelamento" },
  { tag: "texto_desconto", desc: "Texto descritivo de desconto da proposta", grupo: "Vendas / Parcelamento" },
  { tag: "tabela_parcelas", desc: "Tabela com cronograma de parcelas e vencimentos", grupo: "Vendas / Parcelamento" },
  { tag: "cronograma_parcelas", desc: "Cronograma de parcelas (alias de tabela)", grupo: "Vendas / Parcelamento" },
  { tag: "dia_vencimento_parcelas", desc: "Dia do vencimento das parcelas", grupo: "Vendas / Parcelamento" },
  { tag: "dia_pagamento", desc: "Dia do pagamento (alias)", grupo: "Vendas / Parcelamento" },
  { tag: "data_primeira_parcela", desc: "Data da 1ª parcela (entrada)", grupo: "Vendas / Parcelamento" },
  { tag: "primeira_parcela_data", desc: "Data da 1ª parcela (alias)", grupo: "Vendas / Parcelamento" },
  { tag: "primeira_parcela_valor", desc: "Valor da 1ª parcela (entrada)", grupo: "Vendas / Parcelamento" },
  // Taxa de Matrícula / Inscrição
  { tag: "valor_matricula", desc: "Valor da taxa de matrícula/inscrição (R$)", grupo: "Vendas / Parcelamento" },
  { tag: "taxa_matricula", desc: "Taxa de matrícula (alias)", grupo: "Vendas / Parcelamento" },
  { tag: "vencimento_matricula", desc: "Data de vencimento da matrícula", grupo: "Vendas / Parcelamento" },
  { tag: "data_vencimento_matricula", desc: "Vencimento da matrícula (alias)", grupo: "Vendas / Parcelamento" },
  { tag: "recebimento_matricula", desc: "Forma de recebimento da matrícula (avulsa, 1ª parcela, diluída)", grupo: "Vendas / Parcelamento" },
  { tag: "numero_matricula", desc: "Número da matrícula/proposta", grupo: "Contrato" },
  { tag: "id_matricula", desc: "ID da matrícula (alias)", grupo: "Contrato" },
  // Forma de pagamento / Plano
  { tag: "forma_pagamento", desc: "Forma de pagamento empregada (ex: Boleto Bancário, Cartão)", grupo: "Vendas / Parcelamento" },
  { tag: "metodo_pagamento", desc: "Método de pagamento (alias)", grupo: "Vendas / Parcelamento" },
  { tag: "tabela_parcelamento", desc: "Nome da tabela de parcelamento empregada", grupo: "Vendas / Parcelamento" },
  { tag: "nome_tabela_parcelamento", desc: "Nome da tabela de parcelamento (alias)", grupo: "Vendas / Parcelamento" },
  // Data / contrato
  { tag: "dia", desc: "Dia atual (01-31)", grupo: "Data" },
  { tag: "mes", desc: "Mês atual (01-12)", grupo: "Data" },
  { tag: "ano", desc: "Ano atual (4 dígitos)", grupo: "Data" },
  { tag: "data_contrato_aceito", desc: "Data do aceite do contrato", grupo: "Data" },
];

/**
 * CONTRACT_SHORTCODE_BASE_LIST
 * pt-BR: Lista copiada pelo botão "Copiar Lista Base" (com chaves).
 */
export const CONTRACT_SHORTCODE_BASE_LIST: string[] = CONTRACT_SHORTCODES.map((s) => `{${s.tag}}`);
