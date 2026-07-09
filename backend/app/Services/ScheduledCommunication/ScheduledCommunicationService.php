<?php

namespace App\Services\ScheduledCommunication;

use App\Jobs\ProcessScheduledCommunicationJob;
use App\Models\ClientAttendance;
use App\Models\EventLog;
use App\Models\Matricula;
use App\Models\ScheduledCommunication;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ScheduledCommunicationService
{
    public function __construct(
        protected ScheduledCommunicationStrategyFactory $strategyFactory
    ) {
    }

    /**
     * scheduleBatch
     * pt-BR: Cria agendamentos em lote a partir das propostas selecionadas no funil.
     * en-US: Creates batch schedules from the proposals selected in the funnel.
     *
     * @param array<int, int|string> $matriculaIds
     * @return array{created: array<int, ScheduledCommunication>, skipped: array<int, array<string, mixed>>}
     */
    public function scheduleBatch(array $matriculaIds, array $payload, ?User $actor, string $ipAddress = ''): array
    {
        $created = [];
        $skipped = [];
        $scheduledAt = Carbon::parse((string) $payload['scheduled_at']);
        $channel = (string) ($payload['channel'] ?? 'email');
        $provider = $channel === 'email' ? 'brevo' : 'internal';

        foreach (collect($matriculaIds)->filter()->unique() as $matriculaId) {
            $matricula = Matricula::with(['cliente', 'curso'])->find($matriculaId);
            if (!$matricula) {
                $skipped[] = [
                    'matricula_id' => $matriculaId,
                    'reason' => 'Proposta não encontrada.',
                ];
                continue;
            }

            $context = $this->buildCommunicationContext($matricula, $payload);
            if ($channel === 'email' && empty($context['recipient_email'])) {
                $skipped[] = [
                    'matricula_id' => $matriculaId,
                    'reason' => 'Cliente sem e-mail cadastrado.',
                ];
                continue;
            }

            $communication = DB::transaction(function () use ($matricula, $payload, $context, $scheduledAt, $channel, $provider, $actor, $ipAddress) {
                $communication = ScheduledCommunication::create([
                    'client_id' => $context['client_id'],
                    'matricula_id' => $matricula->id,
                    'channel' => $channel,
                    'provider' => $provider,
                    'status' => 'scheduled',
                    'recipient_name' => $context['recipient_name'],
                    'recipient_email' => $context['recipient_email'],
                    'subject' => $this->replaceTemplateTokens((string) ($payload['subject'] ?? ''), $context),
                    'message' => $this->replaceTemplateTokens((string) ($payload['message'] ?? ''), $context),
                    'scheduled_at' => $scheduledAt,
                    'max_attempts' => (int) ($payload['max_attempts'] ?? 3),
                    'created_by' => $actor?->id ? (string) $actor->id : null,
                    'metadata' => [
                        'tags' => $payload['tags'] ?? [],
                        'create_attendance_log' => (bool) ($payload['create_attendance_log'] ?? true),
                        'app_url' => $payload['app_url'] ?? null,
                    ],
                    'payload' => $context,
                ]);

                $this->createEventLog(
                    $communication,
                    'scheduled',
                    'Agendamento criado com sucesso.',
                    [
                        'channel' => $channel,
                        'provider' => $provider,
                        'scheduled_at' => $scheduledAt->toDateTimeString(),
                    ],
                    $actor?->id ? (string) $actor->id : null,
                    $ipAddress
                );

                return $communication;
            });

            $this->dispatchProcessingJob($communication);
            $created[] = $communication->fresh(['client', 'matricula.cliente', 'matricula.curso', 'creator']);
        }

        return [
            'created' => $created,
            'skipped' => $skipped,
        ];
    }

    /**
     * process
     * pt-BR: Executa o agendamento usando a estratégia correta e registra auditoria.
     * en-US: Executes the scheduled communication using the proper strategy and records audit logs.
     */
    public function process(ScheduledCommunication $communication): ScheduledCommunication
    {
        $communication->refresh();
        if (in_array($communication->status, ['sent', 'cancelled'], true)) {
            return $communication;
        }

        $communication->status = 'processing';
        $communication->attempts = (int) $communication->attempts + 1;
        $communication->processed_at = now();
        $communication->save();

        $strategy = $this->strategyFactory->make($communication);
        $result = $strategy->send($communication);

        $metadata = $communication->metadata ?? [];
        $metadata['last_response'] = $result['response'] ?? null;
        $communication->metadata = $metadata;

        if (!empty($result['success'])) {
            $communication->status = 'sent';
            $communication->sent_at = now();
            $communication->provider_message_id = $result['provider_message_id'] ?? null;
            $communication->last_error = null;
            $communication->save();

            if (($communication->metadata['create_attendance_log'] ?? true) === true) {
                $this->createAttendanceLog($communication);
            }

            $this->createEventLog(
                $communication,
                'processed',
                'Agendamento executado com sucesso.',
                [
                    'provider_message_id' => $communication->provider_message_id,
                    'channel' => $communication->channel,
                ],
                $communication->created_by,
                ''
            );

            return $communication->fresh(['client', 'matricula.cliente', 'matricula.curso', 'creator']);
        }

        $communication->status = 'failed';
        $communication->last_error = (string) ($result['error'] ?? 'Falha no processamento do agendamento.');
        $communication->save();

        $this->createEventLog(
            $communication,
            'failed',
            'Falha ao executar agendamento.',
            [
                'error' => $communication->last_error,
                'channel' => $communication->channel,
            ],
            $communication->created_by,
            ''
        );

        return $communication->fresh(['client', 'matricula.cliente', 'matricula.curso', 'creator']);
    }

    /**
     * cancel
     * pt-BR: Cancela um agendamento que ainda não foi processado com sucesso.
     * en-US: Cancels a communication that has not yet been processed successfully.
     */
    public function cancel(ScheduledCommunication $communication, ?User $actor, string $ipAddress = ''): ScheduledCommunication
    {
        if ($communication->status === 'sent') {
            throw new RuntimeException('Não é possível cancelar um agendamento já enviado.');
        }

        $communication->status = 'cancelled';
        $communication->cancelled_at = now();
        $communication->save();

        $this->createEventLog(
            $communication,
            'cancelled',
            'Agendamento cancelado pelo usuário.',
            [],
            $actor?->id ? (string) $actor->id : null,
            $ipAddress
        );

        return $communication->fresh(['client', 'matricula.cliente', 'matricula.curso', 'creator']);
    }

    /**
     * retry
     * pt-BR: Reagenda um item para nova tentativa imediata ou em horário informado.
     * en-US: Reschedules an item for a new immediate attempt or for a provided date/time.
     */
    public function retry(ScheduledCommunication $communication, ?Carbon $scheduledAt = null, ?User $actor = null, string $ipAddress = ''): ScheduledCommunication
    {
        $communication->status = 'scheduled';
        $communication->scheduled_at = $scheduledAt ?: now();
        $communication->cancelled_at = null;
        $communication->last_error = null;
        $communication->save();

        $this->createEventLog(
            $communication,
            'retried',
            'Agendamento reenfileirado para nova tentativa.',
            [
                'scheduled_at' => $communication->scheduled_at?->toDateTimeString(),
            ],
            $actor?->id ? (string) $actor->id : null,
            $ipAddress
        );

        $this->dispatchProcessingJob($communication);

        return $communication->fresh(['client', 'matricula.cliente', 'matricula.curso', 'creator']);
    }

    /**
     * dispatchProcessingJob
     * pt-BR: Enfileira o job com atraso calculado a partir do horário do agendamento.
     * en-US: Dispatches the job with a delay calculated from the scheduled datetime.
     */
    public function dispatchProcessingJob(ScheduledCommunication $communication): void
    {
        $delayUntil = $communication->scheduled_at && $communication->scheduled_at->isFuture()
            ? $communication->scheduled_at
            : null;

        $job = new ProcessScheduledCommunicationJob((int) $communication->id);
        if ($delayUntil) {
            dispatch($job->delay($delayUntil));
            return;
        }

        dispatch($job);
    }

    /**
     * buildCommunicationContext
     * pt-BR: Monta os dados consolidados da proposta usados nos templates do agendamento.
     * en-US: Builds consolidated proposal data used by the communication templates.
     */
    protected function buildCommunicationContext(Matricula $matricula, array $payload): array
    {
        $client = $matricula->cliente;
        $course = $matricula->curso;
        $appUrl = rtrim((string) ($payload['app_url'] ?? config('app.url')), '/');
        $signatureLink = $payload['signature_link'] ?? null;

        if (!$signatureLink && $matricula->id_cliente && $matricula->id) {
            $signatureLink = $appUrl . '/aluno/assinatura/' . $matricula->id_cliente . '_' . $matricula->id . '/1';
        }

        return [
            'client_id' => $client?->id ? (string) $client->id : null,
            'recipient_name' => $payload['recipient_name'] ?? $client?->name ?? 'Cliente',
            'recipient_email' => $payload['recipient_email'] ?? $client?->email ?? null,
            'course_name' => $course?->post_title ?? $course?->name ?? 'Curso',
            'matricula_id' => (string) $matricula->id,
            'signature_link' => $signatureLink,
            'proposal_amount' => (string) ($matricula->total ?? $matricula->subtotal ?? ''),
        ];
    }

    /**
     * replaceTemplateTokens
     * pt-BR: Substitui placeholders simples no assunto e na mensagem do agendamento.
     * en-US: Replaces simple placeholders in the subject and message templates.
     */
    protected function replaceTemplateTokens(string $content, array $context): string
    {
        $replacements = [
            '{nome}' => (string) ($context['recipient_name'] ?? ''),
            '{email}' => (string) ($context['recipient_email'] ?? ''),
            '{curso}' => (string) ($context['course_name'] ?? ''),
            '{link_assinatura}' => (string) ($context['signature_link'] ?? ''),
            '{id_proposta}' => (string) ($context['matricula_id'] ?? ''),
            '{valor_proposta}' => (string) ($context['proposal_amount'] ?? ''),
        ];

        return str_replace(array_keys($replacements), array_values($replacements), $content);
    }

    /**
     * createAttendanceLog
     * pt-BR: Replica o resultado do agendamento no histórico de atendimento do cliente.
     * en-US: Mirrors the communication result into the client's attendance history.
     */
    protected function createAttendanceLog(ScheduledCommunication $communication): void
    {
        if (!$communication->client_id) {
            return;
        }

        ClientAttendance::create([
            'client_id' => $communication->client_id,
            'attended_by' => $communication->created_by,
            'channel' => $communication->channel,
            'observation' => $communication->message,
            'metadata' => [
                'scheduled_communication_id' => $communication->id,
                'matricula_id' => $communication->matricula_id,
                'provider' => $communication->provider,
                'provider_message_id' => $communication->provider_message_id,
            ],
        ]);
    }

    /**
     * createEventLog
     * pt-BR: Centraliza a gravação de auditoria do ciclo de vida do agendamento.
     * en-US: Centralizes audit logging for the scheduled communication lifecycle.
     */
    protected function createEventLog(
        ScheduledCommunication $communication,
        string $action,
        string $description,
        array $payload = [],
        ?string $actorId = null,
        string $ipAddress = ''
    ): void {
        EventLog::create([
            'entity_type' => 'scheduled_communication',
            'entity_id' => (string) $communication->id,
            'action' => $action,
            'description' => $description,
            'payload' => array_merge($payload, [
                'scheduled_communication_id' => (string) $communication->id,
                'matricula_id' => $communication->matricula_id ? (string) $communication->matricula_id : null,
                'client_id' => $communication->client_id,
            ]),
            'actor_id' => $actorId,
            'ip_address' => $ipAddress ?: null,
        ]);
    }
}
