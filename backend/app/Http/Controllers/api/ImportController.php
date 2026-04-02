<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Models\Post;
use Illuminate\Support\Facades\Log;

class ImportController extends Controller
{
    /**
     * Import data from an external URL
     */
    public function importData(Request $request)
    {
        $request->validate([
            'url' => 'required|url',
            'method' => 'required|string|in:GET,POST,PUT,PATCH,DELETE',
            'headers' => 'nullable|array',
            'headers.*.key' => 'required_with:headers|string',
            'headers.*.value' => 'required_with:headers|string',
            'body' => 'nullable|string',
            'import_type' => 'required|string|in:contratos',
        ]);

        $url = $request->input('url');
        $method = strtoupper($request->input('method'));
        $headersArray = $request->input('headers', []);
        $body = $request->input('body');
        $importType = $request->input('import_type');

        // Formatar headers
        $headers = [];
        foreach ($headersArray as $header) {
            $headers[$header['key']] = $header['value'];
        }

        // Tentar decodificar body como JSON
        $data = null;
        if (!empty($body)) {
            $data = json_decode($body, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                // Fallback para string se não for JSON
                $data = $body;
            }
        }

        try {
            // Executar requisição
            $httpClient = Http::withHeaders($headers)->timeout(30);

            $options = [];
            if (!empty($data)) {
                if (is_array($data)) {
                    $options['json'] = $data;
                } else {
                    $options['body'] = $data;
                    $options['headers']['Content-Type'] = 'application/json';
                }
            }

            $response = $httpClient->send($method, $url, $options);

            if (!$response || !$response->successful()) {
                return response()->json([
                    'message' => 'Erro ao buscar dados da URL informada.',
                    'status' => $response ? $response->status() : 500,
                    'response' => $response ? $response->body() : null,
                ], 400);
            }

            $responseData = $response->json();

            if (!$responseData) {
                return response()->json([
                    'message' => 'Resposta inválida ou não é JSON.',
                    'response' => $response->body(),
                ], 400);
            }

            // Processar a importação com base no tipo
            $importedCount = 0;
            if ($importType === 'contratos') {
                $importedCount = $this->importContratos($responseData);
            }

            return response()->json([
                'message' => "Importação concluída com sucesso.",
                'imported_count' => $importedCount,
                'response' => $responseData,
            ]);

        } catch (\Exception $e) {
            $errorMsg = $e->getMessage();
            $message = 'Erro interno durante a importação.';

            // Tratamento amigável para deadlock do 'php artisan serve'
            if (strpos($errorMsg, 'cURL error 28') !== false) {
                $message = 'Tempo limite de conexão esgotado (Timeout).';
                $errorMsg .= ' DICA: Se você estiver rodando ambos os projetos localmente usando "php artisan serve", eles não podem rodar na mesma porta. Inicie a API do CRM antigo em uma porta diferente (ex: php artisan serve --port=8001) e tente novamente.';
            }

            Log::error('Erro na importação: ' . $errorMsg);
            return response()->json([
                'message' => $message,
                'error' => $errorMsg
            ], strpos($errorMsg, 'cURL error 28') !== false ? 504 : 500);
        }
    }

    /**
     * Importa contratos para a tabela de posts
     */
    private function importContratos($data)
    {
        $count = 0;
        // A resposta pode ser um objeto principal contendo 'data', ou uma lista direta, ou um objeto com chaves numéricas
        $items = [];
        if (isset($data['data']['data']) && is_array($data['data']['data'])) {
            $items = $data['data']['data'];
        } elseif (isset($data['exec']) && isset($data['data']) && $data['exec'] === true) {
            $items = $data['data'];
        } elseif (is_array($data)) {
            $items = $data;
        }
        foreach ($items as $item) {
            // Ignorar se $item não for um array válido contendo dados
            if (!is_array($item)) {
                continue;
            }

            // Mapeamento dos campos baseado no CRM antigo
            // Vamos tentar várias combinações comuns
            $nome = $item['post_title'] ?? $item['nome'] ?? $item['titulo'] ?? null;
            $conteudo = $item['post_content'] ?? $item['conteudo'] ?? $item['obs'] ?? $item['texto'] ?? '';
            $status = $item['post_status'] ?? $item['ativo'] ?? 'publish';
            $slug = $item['post_name'] ?? $item['slug'] ?? $item['url'] ?? null;
            $tipoConteudo = $item['tipo_conteudo'] ?? null;

            // Se o payload exigir um "tipo_conteudo" específico para contratos, verificamos aqui.
            // O payload de exemplo mostrou "tipo_conteudo": 9
            if ($tipoConteudo !== null && $tipoConteudo != 9 && $tipoConteudo != '9') {
                // Se não for o tipo de conteúdo de contratos (assumindo que seja 9), podemos pular
                // continue;
                // Removido o continue para forçar a importação, caso a chave exista.
            }

            // Configurações e relacionamentos
            $config = [];
            $id_curso = null;

            if (isset($item['config']) && is_array($item['config'])) {
                $config = $item['config'];
                $id_curso = $config['id_curso'] ?? null;
            } elseif (isset($item['id_curso'])) {
                $id_curso = $item['id_curso'];
                $config['id_curso'] = $id_curso;
            }

            if (isset($item['periodo'])) {
                $config['periodo'] = $item['periodo'];
            }

            if (!$nome) {
                continue; // Pular se não tiver nome
            }

            // Verificar se já existe (usando slug ou nome)
            if (!$slug) {
                $slug = (new Post())->generateSlug($nome);
            }

            $post = Post::where('post_type', 'contratos')
                        ->where(function($q) use ($slug, $nome) {
                            $q->where('post_name', $slug)
                              ->orWhere('post_title', $nome);
                        })->first();

            if (!$post) {
                $post = new Post();
                $post->post_type = 'contratos';
                $post->post_name = $slug;
            }

            $post->post_title = $nome;
            $post->post_content = $conteudo;

            // O payload antigo usava "ativo": "s" ou "n"
            if ($status === 's' || $status === '1' || $status === 1 || strtolower($status) === 'publish') {
                $post->post_status = 'publish';
            } else {
                $post->post_status = 'draft';
            }

            if ($id_curso) {
                $post->post_parent = (int) $id_curso;
            }

            $post->config = $config;
            $post->menu_order = $item['ordenar'] ?? 0;
            $post->save();

            $count++;
        }

        return $count;
    }
}
