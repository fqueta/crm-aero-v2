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
  { tag: "modalidade_pagamento", desc: "Modalidade de pagamento (à vista, parcelado, forma)", grupo: "Vendas / Parcelamento" },
  { tag: "juros_e_correcao", desc: "Juros, multa e correção por atraso", grupo: "Vendas / Parcelamento" },
  { tag: "tabela_parcelamento", desc: "Nome da tabela de parcelamento empregada", grupo: "Vendas / Parcelamento" },
  { tag: "nome_tabela_parcelamento", desc: "Nome da tabela de parcelamento (alias)", grupo: "Vendas / Parcelamento" },
  // Turma & Vigência (Quadro da Contratação)
  { tag: "identificacao_turma", desc: "Identificação / nome da turma", grupo: "Turma & Vigência" },
  { tag: "inicio_turma", desc: "Início previsto da turma", grupo: "Turma & Vigência" },
  { tag: "primeira_chamada_elegivel", desc: "Primeira chamada elegível prevista", grupo: "Turma & Vigência" },
  { tag: "inicio_uso_credito", desc: "Data inicial de utilização do crédito", grupo: "Turma & Vigência" },
  { tag: "fim_vigencia", desc: "Vencimento ordinário / fim de vigência", grupo: "Turma & Vigência" },
  // Programa de Instrução & MGR
  { tag: "identificacao_pi", desc: "Identificação / código do Programa de Instrução (ex: PPAP)", grupo: "Programa de Instrução" },
  { tag: "revisao_pi", desc: "Revisão vigente do Programa de Instrução (ex: 001G)", grupo: "Programa de Instrução" },
  { tag: "data_pi", desc: "Data de emissão da revisão do Programa de Instrução", grupo: "Programa de Instrução" },
  { tag: "declaracao_aceite_pi", desc: "Texto da declaração de ciência e aceite do PI", grupo: "Programa de Instrução" },
  { tag: "clausula_aceite_pi", desc: "Cláusula formatada em HTML de ciência e aceite do PI", grupo: "Programa de Instrução" },
  { tag: "revisao_mgr", desc: "Revisão do MGR disponibilizado", grupo: "Programa de Instrução" },
  { tag: "data_mgr", desc: "Data de emissão do MGR disponibilizado", grupo: "Programa de Instrução" },
  // Proposta, Aeronave & Tarifas
  { tag: "identificacao_proposta", desc: "Identificação / número da proposta aceita", grupo: "Tarifas & Aeronave" },
  { tag: "data_proposta", desc: "Data da proposta aceita", grupo: "Tarifas & Aeronave" },
  { tag: "modelo_aeronave", desc: "Modelo de aeronave de referência", grupo: "Tarifas & Aeronave" },
  { tag: "valor_credito_voo", desc: "Saldo de instrução contratado em reais", grupo: "Tarifas & Aeronave" },
  { tag: "tarifa_referencia", desc: "Tarifa inicial de referência (hora de voo)", grupo: "Tarifas & Aeronave" },
  { tag: "horas_estimadas", desc: "Horas estimadas de instrução", grupo: "Tarifas & Aeronave" },
  { tag: "identificacao_tabela_e_criterios", desc: "Tabela de tarifas-base por modelo e critérios", grupo: "Tarifas & Aeronave" },
  { tag: "data_base_tarifa", desc: "Data-base da tabela de tarifas", grupo: "Tarifas & Aeronave" },
  { tag: "itens_incluidos", desc: "Itens incluídos na contratação", grupo: "Tarifas & Aeronave" },
  { tag: "custos_adicionais", desc: "Custos adicionais (cheque, examinador, taxas, simulador, materiais)", grupo: "Tarifas & Aeronave" },
  // Escala, Regras & Canais Oficiais
  { tag: "modalidade_escala", desc: "Modalidade de escala (DDS ou FDS)", grupo: "Escala & Canais" },
  { tag: "carencia_e_data_liberacao", desc: "Carência no parcelamento — marco inicial e data de liberação", grupo: "Escala & Canais" },
  { tag: "prazo_maximo_espera", desc: "Prioridade contratual por prazo máximo de espera", grupo: "Escala & Canais" },
  { tag: "regra_faltas_bloco", desc: "Regra disciplinar por faltas no bloco", grupo: "Escala & Canais" },
  { tag: "canal_escala", desc: "Canal oficial de escala", grupo: "Escala & Canais" },
  { tag: "canal_secretaria", desc: "Canal oficial da Secretaria", grupo: "Escala & Canais" },
  { tag: "canal_qualidade", desc: "Canal do Gestor da Qualidade", grupo: "Escala & Canais" },
  { tag: "canal_privacidade", desc: "Canal de privacidade (LGPD)", grupo: "Escala & Canais" },
  { tag: "limite_realocacoes_ppa", desc: "Limite de realocações por turma", grupo: "Escala & Canais" },
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
