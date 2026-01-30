## Objetivo
- Criar um método/endpoint dedicado para mudança rápida de etapa (stage) de uma matrícula, recebendo apenas o id da matrícula e o id da etapa destino.

## Contexto Atual
- Já é possível mudar a etapa via PUT /matriculas/{id} enviando `stage_id` (alias `etapa`).
- Campos e alias existentes: `stage_id` e `etapa`, sincronizados em saída/entrada.
- Referências: [MatriculaController.php:index](file:///d:/Projetos/crm_aeroclube/crm-aero-v2/backend/app/Http/Controllers/api/MatriculaController.php#L39-L115), [mapFields](file:///d:/Projetos/crm_aeroclube/crm-aero-v2/backend/app/Http/Controllers/api/MatriculaController.php#L152-L166), [mapOutputFields](file:///d:/Projetos/crm_aeroclube/crm-aero-v2/backend/app/Http/Controllers/api/MatriculaController.php#L167-L199), [rules](file:///d:/Projetos/crm_aeroclube/crm-aero-v2/backend/app/Http/Controllers/api/MatriculaController.php#L291-L314).

## Mudanças Propostas
- Adicionar método no MatriculaController: `updateStageRapid` para alterar rapidamente a etapa.
- Adicionar rota dedicada: `PATCH /matriculas/{id}/etapa` (ou `/matriculas/{id}/stage`).
- Entrada mínima: `{ "stage_id": number }` (também aceitar `{ "etapa": number }`).
- Atualiza `stage_id` da matrícula, sincroniza em `config` e `preferencias.pipeline` quando aplicável, e opcionalmente deriva `funnel_id` a partir do Stage.
- Retorna a matrícula atualizada usando o mesmo mapeamento de saída (`mapOutputFields`).

## Contrato da API
- Endpoint: `PATCH /matriculas/{id}/etapa`
- Body (JSON):
  - Obrigatório: `stage_id: integer` (ou alias `etapa`)
- Resposta: 200 OK com o registro enriquecido (cliente/curso/turma) igual ao padrão de `index/show` (mantendo consistência de payload).

## Validações e Regras
- Validar a existência de matrícula `{id}`.
- Validar `stage_id` como inteiro e existente em `stages.id`.
- Transições livres entre etapas (mantendo a política atual). Se necessário, podemos adicionar restrições futuras por funil/ordem.

## Auditoria (Opcional, recomendada)
- Criar tabela `matricula_stage_history` com: `matricula_id`, `from_stage_id`, `to_stage_id`, `user_id`, `created_at`.
- Registrar mudança quando `stage_id` alterar. Disponibilizar endpoint para listar histórico por matrícula.

## Integração Frontend
- Adicionar um helper: `updateEnrollmentStage(id, stageId)` chamando o novo endpoint.
- Atualizar pontos de DnD/kanban para usar o método dedicado (opcional, já funciona com PUT genérico).
- Referências: [CustomersLeads.tsx:onDropEnrollmentOnStage](file:///d:/Projetos/crm_aeroclube/crm-aero-v2/frontend/src/pages/CustomersLeads.tsx#L834-L868), [enrollmentsService.updateEnrollment](file:///d:/Projetos/crm_aeroclube/crm-aero-v2/frontend/src/services/enrollmentsService.ts#L59-L66).

## Testes
- Teste de sucesso: muda etapa válida e retorna payload correto.
- Teste de erro: `stage_id` inexistente → 422; matrícula inexistente → 404.
- Garantir sincronização de `config.stage_id` e alias `etapa` na resposta.

## Referências de Código
- Modelo Matrícula com `stage_id`/`funnel_id`: [Matricula.php](file:///d:/Projetos/crm_aeroclube/crm-aero-v2/backend/app/Models/Matricula.php#L18-L66)
- Modelo Stage/Funnel: [Stage.php](file:///d:/Projetos/crm_aeroclube/crm-aero-v2/backend/app/Models/Stage.php#L14-L39), [Funnel.php](file:///d:/Projetos/crm_aeroclube/crm-aero-v2/backend/app/Models/Funnel.php#L76-L92)
- Migrações relacionadas: [create_matriculas_table](file:///d:/Projetos/crm_aeroclube/crm-aero-v2/backend/database/migrations/tenant/2025_10_10_000500_create_matriculas_table.php#L14-L39), [create_stages_table](file:///d:/Projetos/crm_aeroclube/crm-aero-v2/backend/database/migrations/tenant/2025_10_17_205605_create_stages_table.php#L12-L31).

## Próximos Passos
- Implementar método e rota.
- (Opcional) Implementar auditoria de histórico.
- Atualizar frontend helper (se desejado).
