## Visão Geral
- É possível: já temos múltiplas regras por workflow (mais de um gatilho) e ações padrão (log/webhook/update_field). Ampliaremos para suportar:
  - Gatilhos de webhook com path editável, métodos, headers e templates.
  - Atualização de cliente/matrícula usando mapeamentos a partir do payload (JSONPath/templating).
  - Edição dessas propriedades diretamente no canvas (painel lateral do nó).

## Extensões de Dados
- workflow_rules: manter múltiplos registros por workflow para vários gatilhos (source_type, event). Já suportado.
- workflow_actions (novo payload):
  - webhook: { method, base_url, path_template, headers, body_template, timeout, retry_policy }
  - update_entity_fields: { entity_type: 'user'|'matricula', id_source: 'payload'|'context', id_path, mappings: [{ target_field, value_from: 'jsonpath'|'template', path }] }
  - conditional (fase 2): { expression, on_true_actions, on_false_actions }

## Dispatcher de Eventos
- Adicionar evento WebhookReceived (source_type='webhook', event='received'), disparado no WebhookController.
- Regras que casam source_type='webhook' e filtros por path/query/headers.

## Executor (Jobs)
- Atualizar RunWorkflowAction para:
  - webhook: montar URL com base_url+path_template; aplicar headers/body_template com variáveis do contexto (payload, actorId, entityId); executar com timeout/retries.
  - update_entity_fields: resolver id via payload/context; aplicar mappings usando JSONPath e/ou string templates; salvar no model correspondente.
- Encadear ações conforme ordenação e, futuramente, edges do canvas.

## Canvas e UI
- Tipos de nós: Trigger (matricula/user/webhook) e Action (webhook/update_entity_fields/log).
- Painel lateral de propriedades do nó:
  - Trigger-webhook: editar path esperado, filtros de headers/query.
  - Action-webhook: editar method, base_url, path_template, headers/body.
  - Action-update_entity_fields: editar entity_type, id_path, lista de mappings (target_field ↔ JSONPath).
- Persistir propriedades em filters/conditions/payload do respectivo registro.

## Segurança
- Validar URLs e headers permitidos; ocultar segredos; rate-limit por tenant.
- Sanitização de templates; limitar funções e tamanho do payload.

## Observabilidade
- EventLog: registrar início/fim/erro de cada ação, incluindo latência.
- Métricas: contar execuções por tipo, sucesso/erro.

## Roadmap
1. Adicionar evento WebhookReceived e filtros por path.
2. Evoluir payload de actions (webhook/update_entity_fields) e executor.
3. UI de propriedades dos nós no designer.
4. Testes de integração (webhook → atualização de usuário/matrícula).
5. (Fase 2) Condicionais e edges no canvas para fluxos ramificados.

Confirma que devo iniciar pelas extensões de actions (payload), evento WebhookReceived e o painel de propriedades no designer?