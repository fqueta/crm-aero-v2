## Estado Atual
- Já existem Funnel/Stage com CRUD e reordenação.
- Há auditoria genérica via EventLog e histórico de mudanças de etapa em matrículas.
- Existe Workflow (model/controller), mas a migration está incompleta e o controller está em stub.
- Não há estruturas de gatilhos/ações nem um event-bus central para acionar workflows.

## Objetivo
- Permitir definir workflows personalizáveis (por funil/entidade) compostos por regras: gatilho → condição → ação.
- Ações executadas automaticamente quando eventos (ex.: stage_changed) ocorrem em ServiceOrder, Matrícula, Cliente ou via webhook.

## Arquitetura Proposta
- Camada de regras: Workflow + WorkflowRule (gatilho/condições) + WorkflowAction (ações executáveis).
- Event dispatcher: publicar eventos internos (DomainEvent) quando ocorrerem mudanças relevantes.
- Executor assíncrono: fila/queue para rodar ações que podem falhar ou demorar.
- Painel de configuração: CRUD de workflows, regras e ações com testes de execução.

## Esquema de Dados
- workflows: id, name, description, funnel_id (FK), isActive, settings (json), timestamps.
- workflow_rules: id, workflow_id (FK), source_type (service_order|matricula|user|webhook|tracking), event (created|updated|stage_changed|custom), filters (json: stage_id, funnel_id etc.), conditions (json), order, isActive, timestamps.
- workflow_actions: id, rule_id (FK), type (notify|webhook|update_field|create_task|custom), payload (json), order, isActive, retry_policy (json), timestamps.

## Disparo de Eventos (Hooks)
- Matrícula: publicShow/publicSign/publicApprove e updateStageRapid → publicar event stage_changed.
- ServiceOrder: create/update quando funnel/stage mudarem → publicar event stage_changed.
- ClientAttendance: quando stage_id/funnelId alterarem cliente → publicar event stage_changed.
- Webhook/Tracking: transformar entrada externa em eventos internos (custom).

## Ações Suportadas (fase 1)
- Notificação: email/in-app (payload com template/vars).
- Webhook: POST para endpoint externo com headers/JSON.
- Atualização de campo: mudar stage_id/situacao/config em entidade alvo.
- Log: gravar EventLog com contexto.

## Endpoints/Controllers
- WorkflowController: CRUD + toggleActive.
- WorkflowRuleController: CRUD, ativação/desativação, reordenação.
- WorkflowActionController: CRUD, teste de execução, reordenação.
- EventsController (opcional): listar eventos disparados (paginado) e reprocesso manual.

## Integração com Queue
- Usar queue padrão (configurada) para executar WorkflowActionJobs.
- Retry/backoff conforme retry_policy.

## Multi-Tenant
- Todas as tabelas em schema tenant; associar tenant via contexto (tenancy) nos controllers.
- Isolar execução por tenant (chaves/URLs por tenant nas actions).

## Segurança
- Validação de payloads e URLs nas actions de webhook.
- Permissões: apenas perfis com acesso de “configuração” podem alterar workflows.

## Observabilidade
- Registrar EventLog em cada execução de ação (sucesso/erro) com payload/stacktrace reduzido.
- Expor métricas: total de execuções, falhas, tempo médio.

## UI (Fase 2)
- Tela de Workflows com lista, filtros por funil/entidade.
- Editor de regra com seleção de gatilho/evento e condições (stage/funnel etc.).
- Editor de ação com tipo, payload e teste.

## Roadmap Incremental
1. Corrigir migration de workflows e implementar WorkflowController (CRUD/toggle). 
2. Criar migrations/models de workflow_rules e workflow_actions. 
3. Introduzir eventos internos e publicar nos pontos de hook (sem alterar lógica funcional). 
4. Implementar executor (jobs) e actions notify/webhook/update_field/log. 
5. Endpoints de administração (CRUD regr/aç) + filtros. 
6. Observabilidade com EventLog e métricas. 
7. UI administrativa (fase 2) e testes end-to-end.

Confirma que devo iniciar pela correção da migration de workflows e criação das tabelas de regras/ações?