<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCursoRequest extends FormRequest
{
    /**
     * Autoriza a requisição.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Regras de validação para criar curso.
     */
    public function rules(): array
    {
        return [
            // Identificador opcional para update-or-create
            'id' => ['nullable','numeric'],

            // Campos principais
            'nome' => ['required','string','max:300'],
            'titulo' => ['nullable','string','max:300'],
            'ativo' => ['nullable','in:s,n'],
            'destaque' => ['nullable','in:s,n'],
            'publicar' => ['nullable','in:s,n'],
            'duracao' => ['nullable','integer','min:0'],
            'unidade_duracao' => ['nullable','string','max:20'],
            'tipo' => ['nullable','string','max:20'],
            'categoria' => ['nullable','string','max:100'],
            'token' => ['nullable','string'],
            'autor' => ['nullable','string'],

            // Campos financeiros opcionais
            'inscricao' => ['nullable','regex:/^\d+(,\d{2}|\.\d{2})?$/'],
            'valor' => ['nullable','regex:/^\d+(,\d{2}|\.\d{2})?$/'],
            'parcelas' => ['nullable','integer','min:1'],
            'valor_parcela' => ['nullable','regex:/^\d+(,\d{2}|\.\d{2})?$/'],

            // Config (JSON arbitrário)
            'config' => ['nullable'],

            // Novos campos do payload
            'aeronaves' => ['nullable','array'],
            'aeronaves.*' => ['string','max:50'],
            'modulos' => ['nullable','array'],
            // Campos dos módulos tornam-se opcionais na criação
            'modulos.*.etapa' => ['nullable','string','max:50'],
            'modulos.*.titulo' => ['nullable','string','max:300'],
            'modulos.*.limite' => ['required','integer','min:0'],
            'modulos.*.valor' => ['nullable','string','max:50'],
            'modulos.*.aviao' => ['nullable','array'],
            'modulos.*.aviao.*' => ['string','max:50'],
        ];
    }
}