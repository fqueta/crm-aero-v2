# CRM Reporting Metrics

## Conversao Comercial

Esta documentacao registra a interpretacao das metricas usadas no CRM Aero nos relatorios e dashboards comerciais.

### Leads Convertidos

- Conta leads unicos que tiveram pelo menos um ganho no periodo analisado.
- O objetivo desta metrica e medir quantas pessoas realmente converteram.
- Mesmo que o mesmo lead tenha 2 ou mais propostas ganhas no periodo, ele entra apenas 1 vez em `Leads convertidos`.

Exemplo:

- Lead `Joao` teve 2 ganhos no mes.
- Resultado: `Leads convertidos = 1`.

### Propostas Ganhas

- Conta todas as propostas ou matriculas marcadas como ganho no periodo analisado.
- O objetivo desta metrica e medir volume de fechamentos.
- Se o mesmo lead teve mais de um ganho, todas as ocorrencias entram na contagem.

Exemplo:

- Lead `Joao` teve 2 ganhos no mes.
- Resultado: `Propostas ganhas = 2`.

### Diferenca Entre As Duas

- `Leads convertidos` responde: quantos leads unicos viraram venda.
- `Propostas ganhas` responde: quantos ganhos aconteceram no total.
- As duas metricas so ficam iguais quando cada lead convertido tem exatamente 1 ganho no periodo.
- Elas deixam de ser iguais quando existe recompra, mais de uma matricula ou mais de uma proposta ganha para o mesmo lead.

### Regra Da Taxa De Conversao

- A taxa de conversao deve usar `Leads convertidos`, e nao `Propostas ganhas`.
- Formula:

```text
taxa de conversao = leads convertidos / leads captados
```

- Essa separacao evita distorcao da taxa, especialmente em cenarios onde um mesmo lead fecha mais de uma proposta.
- Sem essa separacao, a taxa poderia ultrapassar 100 por cento.

### Onde Isso Se Aplica

- Relatorio geral em `/admin/reports/relatorio-geral`
- Dashboard principal em `/admin` e `/admin/aero-dashboard`

### Resumo Executivo

- Use `Leads convertidos` para leitura de conversao real de pessoas.
- Use `Propostas ganhas` para leitura de volume comercial de ganhos.
