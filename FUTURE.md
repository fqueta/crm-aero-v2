# Melhorias Futuras

## Chat com Evolution API

### Infraestrutura
- [ ] **Service Evolution** — Criar `app/Services/EvolutionService.php` para encapsular chamadas REST (enviar mensagem, criar instância, webhook)
- [ ] **Credenciais Evolution** — Cadastrar integração Evolution no `ApiCredentialController` (URL da instância, apiKey, instanceName)
- [ ] **Webhook inbound** — Configurar webhook no `WebhookController` para receber mensagens da Evolution e identificar cliente pelo número

### Processamento de Mensagens
- [ ] **Inbound processor** — Ao receber webhook, localizar o cliente por celular e salvar mensagem como `ClientAttendance` com canal `whatsapp`
- [ ] **Outbound processor** — Reaproveitar/enriquecer `ZapguruController::enviar_mensagem()` ou criar método específico para Evolution
- [ ] **Message history** — Vincular mensagens de entrada e saída em uma conversa (thread) no banco

### Interface de Chat (Frontend)
- [ ] **Componente ChatWidget** — UI de chat em tempo real (React) usando WebSocket ou polling
- [ ] **Exibição de conversa** — Balões de mensagem com distinção cliente/atendente, timestamps, status (enviada/entregue/lida)
- [ ] **Campo de resposta rápida** — Input com templates pré-definidos e atalhos
- [ ] **Notificações** — Badge de mensagens não lidas no layout e/ou notificação sonora
- [ ] **Integração no ClientView** — Aba "Chat" na página de visualização do cliente

---

## Melhorias Gerais

### WhatsApp / Disparo de Mensagens
- [ ] **Fila de envio** — Usar queue do Laravel (`QUEUE_CONNECTION=database`) para envio assíncrono de WhatsApp
- [ ] **Retry automático** — Job com tentativas em caso de falha na API externa
- [ ] **Template de mensagens** — Gerenciador de templates no admin (variáveis: `{nome}`, `{contrato}`, `{vencimento}`)
- [ ] **Logs centralizados** — Painel admin para visualizar histórico de disparos (sucesso/falha)

### ChatGuru (atual)
- [ ] **Migrar `enviar_mensagem()` para usar fila** — Evitar timeout em requisições síncronas
- [ ] **Remover hardcoded phone_id** — Usar sempre a credencial cadastrada via `ApiCredentialController`
- [ ] **Adicionar `key` e `account_id` como propriedades** — Já parcialmente feito, completar para todos os métodos do `ZapguruController`

### Atendimentos (ClientAttendance)
- [ ] **Anexos** — Permitir envio de imagens/documentos junto com a observação
- [ ] **Classificação automática** — Categorizar atendimentos por IA ou regras de workflow
- [ ] **Relatório de atendimentos** — Dashboard com métricas (atendimentos/dia, canal mais usado, tempo médio de resposta)

### Infraestrutura
- [ ] **WebSocket nativo** — Usar Laravel Reverb ou Pusher para notificações em tempo real
- [ ] **Fila de jobs** — Configurar worker para processar filas em background
