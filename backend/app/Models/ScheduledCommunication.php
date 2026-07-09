<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduledCommunication extends Model
{
    use HasFactory;

    protected $table = 'scheduled_communications';

    protected $fillable = [
        'client_id',
        'matricula_id',
        'channel',
        'provider',
        'status',
        'recipient_name',
        'recipient_email',
        'recipient_phone',
        'subject',
        'message',
        'scheduled_at',
        'processed_at',
        'sent_at',
        'cancelled_at',
        'attempts',
        'max_attempts',
        'created_by',
        'provider_message_id',
        'last_error',
        'metadata',
        'payload',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'processed_at' => 'datetime',
        'sent_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'metadata' => 'array',
        'payload' => 'array',
    ];

    /**
     * client
     * pt-BR: Retorna o cliente relacionado ao agendamento.
     * en-US: Returns the client related to the scheduled communication.
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    /**
     * matricula
     * pt-BR: Retorna a matrícula/proposta relacionada ao agendamento.
     * en-US: Returns the enrollment/proposal related to the scheduled communication.
     */
    public function matricula(): BelongsTo
    {
        return $this->belongsTo(Matricula::class, 'matricula_id');
    }

    /**
     * creator
     * pt-BR: Retorna o usuário que criou o agendamento.
     * en-US: Returns the user who created the scheduled communication.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
