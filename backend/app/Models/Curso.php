<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use App\Models\Post;

class Curso extends Model
{
    /**
     * Nome da tabela.
     */
    protected $table = 'cursos';

    /**
     * Atributos liberados para atribuição em massa.
     */
    protected $fillable = [
        'nome',
        'titulo',
        'ativo',
        'destaque',
        'publicar',
        'duracao',
        'unidade_duracao',
        'tipo',
        'categoria',
        'token',
        'autor',
        'config',
        'aeronaves',
        'modulos',
        'inscricao',
        'valor',
        'parcelas',
        'valor_parcela',
        // Campos de lixeira
        'excluido',
        'deletado',
        'excluido_por',
        'deletado_por',
        'reg_excluido',
        'reg_deletado',
    ];

    /**
     * Casts de atributos.
     */
    protected $casts = [
        'config' => 'array',
        'aeronaves' => 'array',
        'modulos' => 'array',
        'duracao' => 'integer',
        'parcelas' => 'integer',
        'reg_excluido' => 'array',
        'reg_deletado' => 'array',
    ];

    /**
     * Escopo global para ocultar registros marcados como excluídos/deletados.
     */
    protected static function booted()
    {
        static::addGlobalScope('notDeleted', function (Builder $builder) {
            $builder->where(function($q) {
                $q->whereNull('excluido')->orWhere('excluido', '!=', 's');
            })->where(function($q) {
                $q->whereNull('deletado')->orWhere('deletado', '!=', 's');
            });
        });
    }

    /**
     * Normaliza valor decimal aceitando vírgula e ponto.
     */
    private function normalizeDecimal(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_string($value)) {
            $normalized = str_replace(',', '.', trim($value));
        } else {
            $normalized = (string) $value;
        }
        if (!is_numeric($normalized)) {
            return null;
        }
        return number_format((float) $normalized, 2, '.', '');
    }

    /**
     * Define 'inscricao' com normalização de decimal.
     */
    public function setInscricaoAttribute($value): void
    {
        $this->attributes['inscricao'] = $this->normalizeDecimal($value);
    }

    /**
     * Define 'valor' com normalização de decimal.
     */
    public function setValorAttribute($value): void
    {
        $this->attributes['valor'] = $this->normalizeDecimal($value);
    }

    /**
     * Define 'valor_parcela' com normalização de decimal.
     */
    public function setValorParcelaAttribute($value): void
    {
        $this->attributes['valor_parcela'] = $this->normalizeDecimal($value);
    }

    /**
     * Define enum 'ativo' aceitando somente 's' | 'n'.
     */
    public function setAtivoAttribute($value): void
    {
        $v = is_string($value) ? strtolower(trim($value)) : $value;
        $this->attributes['ativo'] = ($v === 's' || $v === 'n') ? $v : 'n';
    }

    /**
     * Define enum 'destaque' aceitando somente 's' | 'n'.
     */
    public function setDestaqueAttribute($value): void
    {
        $v = is_string($value) ? strtolower(trim($value)) : $value;
        $this->attributes['destaque'] = ($v === 's' || $v === 'n') ? $v : 'n';
    }

    /**
     * Define enum 'publicar' aceitando somente 's' | 'n'.
     */
    public function setPublicarAttribute($value): void
    {
        $v = is_string($value) ? strtolower(trim($value)) : $value;
        $this->attributes['publicar'] = ($v === 's' || $v === 'n') ? $v : 'n';
    }

    /**
     * Limpa strings removendo crases e espaços.
     */
    private function stripTicks(?string $value): ?string
    {
        if ($value === null) return null;
        $trimmed = trim($value);
        return trim($trimmed, " `\"'\t\n\r");
    }

    /**
     * Define 'nome' sanitizado.
     */
    public function setNomeAttribute($value): void
    {
        $this->attributes['nome'] = $this->stripTicks((string) $value) ?? '';
    }

    /**
     * Define 'titulo' sanitizado.
     */
    public function setTituloAttribute($value): void
    {
        $this->attributes['titulo'] = $this->stripTicks($value);
    }

    /**
     * Define 'token' sanitizado.
     */
    public function setTokenAttribute($value): void
    {
        $this->attributes['token'] = $this->stripTicks($value);
    }

    /**
     * Define 'autor' como string sanitizada.
     */
    public function setAutorAttribute($value): void
    {
        $this->attributes['autor'] = $this->stripTicks(is_null($value) ? null : (string) $value);
    }

    /**
     * Sanitiza recursivamente strings em um array (remove crases/aspas).
     */
    private function sanitizeArrayStrings(mixed $value): mixed
    {
        if (is_array($value)) {
            $out = [];
            foreach ($value as $k => $v) {
                $out[$k] = $this->sanitizeArrayStrings($v);
            }
            return $out;
        }
        if (is_string($value)) {
            return $this->stripTicks($value);
        }
        return $value;
    }

    /**
     * Define 'config' aceitando objeto/array, removendo crases (ex.: video com `...`).
     */
    public function setConfigAttribute($value): void
    {
        $arr = null;
        if (is_array($value)) {
            $arr = $value;
        } elseif (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            $arr = is_array($decoded) ? $decoded : null;
        }
        if ($arr === null) {
            $this->attributes['config'] = null;
            return;
        }
        $clean = $this->sanitizeArrayStrings($arr);
        // Atribui como JSON; cast cuidará do decode ao ler
        $this->attributes['config'] = json_encode($clean);
    }

    /**
     * Define 'aeronaves' como lista sanitizada de strings (JSON persistido).
     * Aceita array nativo ou string JSON.
     */
    public function setAeronavesAttribute($value): void
    {
        $arr = null;
        if (is_array($value)) {
            $arr = $value;
        } elseif (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            $arr = is_array($decoded) ? $decoded : null;
        }
        if ($arr === null) {
            $this->attributes['aeronaves'] = null;
            return;
        }
        // Sanitizar cada item (string)
        $clean = [];
        foreach ($arr as $item) {
            $clean[] = is_string($item) ? $this->stripTicks($item) : $item;
        }
        $this->attributes['aeronaves'] = json_encode($clean);
    }

    /**
     * Define 'modulos' como array sanitizado com tipos coerentes.
     * Converte 'limite' para inteiro quando possível e limpa strings.
     * Aceita array nativo ou string JSON.
     */
    public function setModulosAttribute($value): void
    {
        $arr = null;
        if (is_array($value)) {
            $arr = $value;
        } elseif (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            $arr = is_array($decoded) ? $decoded : null;
        }
        if ($arr === null) {
            $this->attributes['modulos'] = null;
            return;
        }

        $cleanModules = [];
        foreach ($arr as $mod) {
            if (!is_array($mod)) {
                // Ignora itens não array
                continue;
            }
            $m = $this->sanitizeArrayStrings($mod);
            // Normalizar limite para inteiro quando aplicável
            if (isset($m['limite']) && $m['limite'] !== null) {
                $m['limite'] = is_numeric($m['limite']) ? (int) $m['limite'] : 0;
            }
            // Sanitizar lista 'aviao' quando presente
            if (isset($m['aviao'])) {
                if (is_array($m['aviao'])) {
                    $avClean = [];
                    foreach ($m['aviao'] as $av) {
                        $avClean[] = is_string($av) ? $this->stripTicks($av) : $av;
                    }
                    $m['aviao'] = $avClean;
                } elseif (is_string($m['aviao']) && $m['aviao'] !== '') {
                    $decodedAv = json_decode($m['aviao'], true);
                    $m['aviao'] = is_array($decodedAv) ? $decodedAv : [];
                } else {
                    $m['aviao'] = [];
                }
            }
            $cleanModules[] = $m;
        }

        $this->attributes['modulos'] = json_encode($cleanModules);
    }

    /**
     * Define 'duracao' como inteiro seguro.
     */
    public function setDuracaoAttribute($value): void
    {
        $this->attributes['duracao'] = is_numeric($value) ? (int) $value : 0;
    }

    /**
     * Define 'parcelas' como inteiro seguro.
     */
    public function setParcelasAttribute($value): void
    {
        $this->attributes['parcelas'] = is_numeric($value) ? (int) $value : 1;
    }

    /**
     * getModulosAttribute
     * pt-BR: Substitui o campo 'modulos' por registros da tabela 'posts' com
     *        'post_type' = 'periodos' quando o campo 'tipo' for igual a 4.
     *        Caso contrário, retorna o valor original decodificado como array.
     * en-US: Replaces the 'modulos' field with records from the 'posts' table
     *        where 'post_type' = 'periodos' when the 'tipo' field equals 4.
     *        Otherwise, returns the original value decoded as an array.
     */
    public function getModulosAttribute($value): ?array
    {
        $tipo = $this->attributes['tipo'] ?? $this->tipo ?? null;
        $isTipo4 = ($tipo === 4) || (is_string($tipo) && trim($tipo) === '4');

        if ($isTipo4) {
            try {
                $periods = Post::query()
                    ->where('post_type', 'periodos')
                    ->where(function ($q) {
                        $q->where('config->id_curso', $this->id)
                          ->orWhere('post_parent', $this->id);
                    })
                    ->orderBy('menu_order')
                    ->orderByDesc('ID')
                    ->get();
            } catch (\Exception $e) {
                $periods = collect();
            }

            if ($periods->isEmpty()) {
                // Fallback: retorna o valor original decodificado
                return $this->decodeModulosRaw($value);
            }

            // Monta a estrutura dos períodos para substituir 'modulos'
            $items = $periods->map(function ($item) {
                return [
                    'id' => $item->ID,
                    'nome' => $item->post_title,
                    'slug' => $item->post_name,
                    'id_curso' => is_array($item->config) && array_key_exists('id_curso', $item->config)
                        ? $item->config['id_curso']
                        : ($item->post_parent ?: null),
                    'id_contratos' => is_array($item->config) && array_key_exists('id_contratos', $item->config)
                        ? $item->config['id_contratos']
                        : [],
                    'valor' => is_array($item->config) && array_key_exists('valor', $item->config)
                        ? $item->config['valor']
                        : null,
                    'tipo_modulo' => is_array($item->config) && array_key_exists('tipo_modulo', $item->config)
                        ? $item->config['tipo_modulo']
                        : null,
                    'cursos_incluidos' => is_array($item->config) && array_key_exists('cursos_incluidos', $item->config)
                        ? $item->config['cursos_incluidos']
                        : [],
                    'h_praticas' => is_array($item->config) && array_key_exists('h_praticas', $item->config)
                        ? $item->config['h_praticas']
                        : null,
                    'h_teoricas' => is_array($item->config) && array_key_exists('h_teoricas', $item->config)
                        ? $item->config['h_teoricas']
                        : null,
                    'aeronaves' => is_array($item->config) && array_key_exists('aeronaves', $item->config)
                        ? $item->config['aeronaves']
                        : [],
                    'status' => $item->post_status,
                ];
            })->values()->toArray();

            return $items;
        }

        // Caso não seja tipo 4, retorna modulos conforme armazenado (decodificado)
        return $this->decodeModulosRaw($value);
    }

    /**
     * decodeModulosRaw
     * pt-BR: Decodifica o valor bruto de 'modulos' em array, com fallback para null.
     * en-US: Decodes the raw 'modulos' value into an array, with a null fallback.
     */
    private function decodeModulosRaw($value): ?array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : null;
        }
        return null;
    }
}