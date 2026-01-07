<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCursoRequest extends FormRequest
{
    /**
     * Autoriza a requisição.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Regras de validação para atualizar curso.
     */
    public function rules(): array
    {
        return [
            // Campos principais
            'nome' => ['sometimes','string','max:300'],
            'titulo' => ['sometimes','nullable','string','max:300'],
            'ativo' => ['sometimes','nullable','in:s,n'],
            'destaque' => ['sometimes','nullable','in:s,n'],
            'publicar' => ['sometimes','nullable','in:s,n'],
            'duracao' => ['sometimes','nullable','integer','min:0'],
            'unidade_duracao' => ['sometimes','nullable','string','max:20'],
            'tipo' => ['sometimes','nullable','string','max:20'],
            'categoria' => ['sometimes','nullable','string','max:100'],
            'token' => ['sometimes','nullable','string'],
            'autor' => ['sometimes','nullable','string'],

            // Campos financeiros opcionais
            'inscricao' => ['sometimes','nullable','regex:/^\d+(,\d{2}|\.\d{2})?$/'],
            'valor' => ['sometimes','nullable','regex:/^\d+(,\d{2}|\.\d{2})?$/'],
            'parcelas' => ['sometimes','nullable','integer','min:1'],
            'valor_parcela' => ['sometimes','nullable','regex:/^\d+(,\d{2}|\.\d{2})?$/'],

            // Config (JSON arbitrário)
            'config' => ['sometimes','nullable'],

            // Novos campos do payload
            'aeronaves' => ['sometimes','nullable','array'],
            'aeronaves.*' => ['string','max:50'],
            'modulos' => ['sometimes','nullable','array'],
            // Campos dos módulos agora opcionais: validam somente quando presentes
            'modulos.*.etapa' => ['sometimes','nullable','string','max:50'],
            'modulos.*.titulo' => ['sometimes','nullable','string','max:300'],
            'modulos.*.limite' => ['sometimes','nullable','integer','min:0'],
            'modulos.*.valor' => ['sometimes','nullable','string','max:50'],
            'modulos.*.aviao' => ['nullable','array'],
            'modulos.*.aviao.*' => ['string','max:50'],
        ];
    }
}