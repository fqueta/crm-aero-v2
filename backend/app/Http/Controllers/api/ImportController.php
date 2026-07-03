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
        @set_time_limit(300);
        
        $request->validate([
            'url' => 'required|url',
            'method' => 'required|string|in:GET,POST,PUT,PATCH,DELETE',
            'headers' => 'nullable|array',
            'headers.*.key' => 'required_with:headers|string',
            'headers.*.value' => 'required_with:headers|string',
            'body' => 'nullable|string',
            'import_type' => 'required|string|in:contratos,matriculas,turmas,clientes',
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
            } elseif ($importType === 'matriculas') {
                $importedCount = $this->importMatriculas($responseData);
            } elseif ($importType === 'turmas') {
                $importedCount = $this->importTurmas($responseData);
            } elseif ($importType === 'clientes') {
                $importedCount = $this->importClientes($responseData);
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

    /**
     * Importa matrículas (enrollments) do CRM antigo.
     *
     * Mapeia:
     *   - User (cliente) por CPF
     *   - Curso por nome/tipo
     *   - Turma por nome legado
     *   - Matricula com dados financeiros e config
     */
    private function importMatriculas($data)
    {
        $count = 0;

        // Extrair items (mesma lógica de contrato)
        $items = [];
        if (isset($data['data']['data']) && is_array($data['data']['data'])) {
            $items = $data['data']['data'];
        } elseif (isset($data['exec']) && isset($data['data']) && $data['exec'] === true) {
            $items = $data['data'];
        } elseif (is_array($data)) {
            $items = $data;
        }

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            // 1. User (cliente) — tenta por CPF, depois por legacy_client_id
            $cpf = $this->cleanCpf($item['cpf_aluno'] ?? null);
            $user = null;
            if ($cpf) {
                $user = $this->findOrCreateUser($item, $cpf);
            }
            if (!$user) {
                // Fallback: busca pelo id_cliente legado (já importado via importClientes)
                $legacyClientId = $item['id_cliente'] ?? null;
                if ($legacyClientId) {
                    $user = \App\Models\User::where('config->legacy_client_id', $legacyClientId)->first();
                }
            }
            if (!$user) {
                continue;
            }

            // 2. Curso (by legacy id_curso or nome)
            $legacyCursoId = $item['id_curso'] ?? null;
            $curso = $this->findCurso($legacyCursoId, $item['nome_curso'] ?? null);
            if (!$curso) {
                continue;
            }

            // 3. Turma
            $legacyTurmaId = $item['id_turma'] ?? null;
            $turma = $this->findOrCreateTurma($legacyTurmaId, $curso->id);

            // 4. Situação
            $situacaoId = $this->mapLegacyStatusToSituacao($item['status'] ?? null);
            if (!$situacaoId) {
                $situacaoId = (int) (\App\Services\Qlib::qoption('default_proposal_situacao_id') ?: 101);
            }

            // 5. Data / timestamps
            $dataMatricula = $item['data_matricula'] ?? $item['data'] ?? null;
            $dataAtualizado = $item['atualizado'] ?? $item['updated_at'] ?? null;

            // 6. Matricula keyed by legacy id in config
            $legacyId = $item['id'] ?? null;

            $matricula = \App\Models\Matricula::where('config->legacy_id', $legacyId)->first();

            $configData = [];
            if ($matricula && $matricula->config) {
                $configData = $matricula->config;
            }

            $configData['legacy_id'] = $legacyId;
            $configData['legacy_client_id'] = $item['id_cliente'] ?? null;
            $configData['legacy_curso_id'] = $legacyCursoId;
            $configData['legacy_turma_id'] = $legacyTurmaId;
            $configData['legacy_status'] = $item['status'] ?? null;
            $configData['reg_inscricao'] = $item['reg_inscricao'] ?? null;
            $configData['reg_pagamento'] = $item['reg_pagamento'] ?? null;
            $configData['token_legado'] = $item['token'] ?? null;
            $configData['rescisao'] = $item['rescisao'] ?? null;
            $configData['contratos'] = $item['contratos'] ?? null;
            $configData['data_contrato'] = $item['data_contrato'] ?? null;
            $configData['parcelamento'] = $item['parcelamento'] ?? null;
            $configData['valor_parcela'] = $item['valor_parcela'] ?? null;
            $configData['orc_encerrado'] = $item['orc_encerrado'] ?? null;
            $configData['data_inicio'] = $item['data_inicio'] ?? null;

            // Carregar períodos do curso para mapear IDs dos módulos no orc
            $periodos = \Illuminate\Support\Facades\DB::table('posts')
                ->where('post_type', 'periodos')
                ->where('post_parent', $curso->id)
                ->where(function($q) {
                    $q->whereNull('excluido')->orWhere('excluido', '!=', 's');
                })
                ->where(function($q) {
                    $q->whereNull('deletado')->orWhere('deletado', '!=', 's');
                })
                ->orderBy('menu_order', 'asc')
                ->get();

            // Parse orc if JSON string
            $orc = $item['orc'] ?? null;
            if (is_string($orc)) {
                $parsedOrc = json_decode($orc, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $orc = $parsedOrc;
                }
            }

            if (is_array($orc) && isset($orc['modulos']) && is_array($orc['modulos'])) {
                foreach ($orc['modulos'] as $mIdx => $mod) {
                    if (isset($periodos[$mIdx])) {
                        $period = $periodos[$mIdx];
                        $orc['modulos'][$mIdx]['id'] = $period->ID;
                        $orc['modulos'][$mIdx]['nome'] = $period->post_title;
                    }
                }
            }

            $matriculaData = [
                'id_cliente' => $user->id,
                'id_curso' => $curso->id,
                'id_turma' => $turma ? $turma->id : 0,
                'situacao_id' => $situacaoId,
                'status' => 'g', // Ganho (situacao='g' no legado)
                'descricao' => $item['obs'] ?? $item['descricao'] ?? null,
                'config' => $configData,
                'tag' => $item['tag'] ?? null,
                'desconto' => $this->parseDecimal($item['desconto'] ?? 0),
                'combustivel' => $this->parseDecimal($item['combustivel'] ?? 0),
                'subtotal' => $this->parseDecimal($item['subtotal'] ?? $item['valor'] ?? 0),
                'total' => $this->parseDecimal($item['total'] ?? $item['valor'] ?? 0),
                'orc' => $orc,
                'data' => $dataMatricula ? date('Y-m-d H:i:s', strtotime($dataMatricula)) : now(),
                'atualizado' => $dataAtualizado ? date('Y-m-d H:i:s', strtotime($dataAtualizado)) : now(),
            ];

            if (!$matricula) {
                $matricula = new \App\Models\Matricula();
            }

            $matricula->fill($matriculaData);
            $matricula->save();

            // Persistir metacampos se informados
            $metacampos = $item['metacampos'] ?? [];
            if (!empty($metacampos) && is_array($metacampos)) {
                $this->persistMatriculaMeta($matricula->id, $metacampos);
            }

            // Gerar e persistir gera_valor a partir do orc.modulos legados para manter compatibilidade com o seletor de períodos
            if (isset($orc['modulos']) && is_array($orc['modulos'])) {
                foreach ($orc['modulos'] as $idx => $mod) {
                    if (isset($mod['sele']) && $mod['sele'] === 'on') {
                        $val = $mod['valor'] ?? 0;
                        if (isset($periodos[$idx])) {
                            $period = $periodos[$idx];
                            $periodConfig = is_string($period->config) ? json_decode($period->config, true) : (is_array($period->config) ? $period->config : []);
                            if (isset($periodConfig['valor'])) {
                                $val = $periodConfig['valor'];
                            }
                        }
                        if (is_numeric($val)) {
                            $priceMasked = number_format((float) $val, 2, ',', '.');
                        } else {
                            $cleanVal = preg_replace('/[^0-9,\-]/', '', (string)$val);
                            $cleanVal = str_replace('.', '', $cleanVal);
                            $cleanVal = str_replace(',', '.', $cleanVal);
                            $priceMasked = number_format((float) $cleanVal, 2, ',', '.');
                        }
                        $geraValor = "{$priceMasked}::{$idx}";
                        \App\Services\Qlib::update_matriculameta($matricula->id, 'gera_valor', $geraValor);
                        break;
                    }
                }
            }

            $count++;
        }

        return $count;
    }

    /**
     * Remove máscara do CPF, retorna só dígitos.
     */
    private function cleanCpf($cpf)
    {
        if (!$cpf) {
            return null;
        }
        $cleaned = preg_replace('/\D/', '', $cpf);
        return strlen($cleaned) === 11 ? $cleaned : null;
    }
    private function findOrCreateUser(array $item, string $cpf)
    {
        $cliente_permission_id = (int) (\App\Services\Qlib::qoption('permission_client_id') ?? 7);

        // 1. Buscar por CPF
        $user = \App\Models\User::where('cpf', $cpf)->first();
        if ($user) {
            if (empty($user->permission_id)) {
                $user->permission_id = $cliente_permission_id;
                $user->save();
            }
            return $user;
        }

        // 2. Buscar por E-mail
        $email = $item['Email'] ?? $item['email'] ?? null;
        if (is_string($email)) {
            $email = trim($email);
            if ($email === '') {
                $email = null;
            }
        }
        if ($email) {
            $user = \App\Models\User::where('email', $email)->first();
            if ($user) {
                $changed = false;
                if (empty($user->cpf)) {
                    $user->cpf = $cpf;
                    $changed = true;
                }
                if (empty($user->permission_id)) {
                    $user->permission_id = $cliente_permission_id;
                    $changed = true;
                }
                if ($changed) {
                    $user->save();
                }
                return $user;
            }
        }

        // 3. Buscar por Celular
        $celular = $item['telefonezap'] ?? $item['Celular'] ?? $item['celular'] ?? $item['Tel'] ?? $item['telefone'] ?? null;
        if (is_string($celular)) {
            $celular = trim($celular);
            if ($celular === '') {
                $celular = null;
            }
        }
        if ($celular) {
            $user = \App\Models\User::where('celular', $celular)->first();
            if ($user) {
                $changed = false;
                if (empty($user->cpf)) {
                    $user->cpf = $cpf;
                    $changed = true;
                }
                if ($email && empty($user->email)) {
                    $user->email = $email;
                    $changed = true;
                }
                if (empty($user->permission_id)) {
                    $user->permission_id = $cliente_permission_id;
                    $changed = true;
                }
                if ($changed) {
                    $user->save();
                }
                return $user;
            }
        }

        // Build name
        $firstName = trim($item['Nome'] ?? $item['nome'] ?? '');
        $lastName = trim($item['sobrenome'] ?? $item['Sobrenome'] ?? '');
        $name = $firstName;
        if ($lastName) {
            $name .= ' ' . $lastName;
        }
        if (!$name) {
            $name = $item['aluno'] ?? 'Importado';
        }

        // Build endereco config
        $userConfig = [];
        $endereco = $item['Endereco'] ?? $item['endereco'] ?? null;
        if (!empty($endereco)) {
            $userConfig['endereco'] = $endereco;
            $userConfig['numero'] = $item['Numero'] ?? $item['numero'] ?? '';
            $userConfig['bairro'] = $item['Bairro'] ?? $item['bairro'] ?? '';
            $userConfig['cidade'] = $item['Cidade'] ?? $item['cidade'] ?? '';
            $userConfig['uf'] = $item['Uf'] ?? $item['uf'] ?? '';
            $userConfig['cep'] = $item['Cep'] ?? $item['cep'] ?? '';
            $userConfig['complemento'] = $item['Compl'] ?? $item['compl'] ?? '';
        }
        
        $dataNasc = $item['DtNasc2'] ?? $item['data_nascimento'] ?? $item['DtNasc'] ?? null;
        if (!empty($dataNasc) && $dataNasc !== '0000-00-00') {
            $userConfig['data_nascimento'] = $dataNasc;
        }
        
        $nacionalidade = $item['nacionalidade'] ?? $item['Nacionalidade'] ?? null;
        if (!empty($nacionalidade)) {
            $userConfig['nacionalidade'] = $nacionalidade;
        }
        
        $profissao = $item['profissao'] ?? $item['Profissao'] ?? null;
        if (!empty($profissao)) {
            $userConfig['profissao'] = $profissao;
        }
        
        $identidade = $item['Ident'] ?? $item['identidade'] ?? $item['rg'] ?? null;
        if (!empty($identidade)) {
            $userConfig['identidade'] = $identidade;
        }

        // Generate a random password (user must reset)
        $password = \Illuminate\Support\Str::random(16);

        $user = new \App\Models\User();
        $user->fill([
            'name' => $name,
            'cpf' => $cpf,
            'email' => $email,
            'celular' => $celular,
            'password' => bcrypt($password),
            'status' => 'actived',
            'tipo_pessoa' => 'pf',
            'genero' => 'ni',
            'permission_id' => $cliente_permission_id,
            'config' => $userConfig,
            'ativo' => 's',
            'verificado' => 's',
            'excluido' => 'n',
            'deletado' => 'n',
        ]);
        $user->save();

        return $user;
    }

    /**
     * Find curso by legacy ID or name.
     */
    private function findCurso($legacyId, $legacyName)
    {
        // First, try to find by config->legacy_id
        if ($legacyId) {
            // First, try to find by ID directly (since IDs are matching)
            $curso = \App\Models\Curso::find($legacyId);
            if ($curso) {
                return $curso;
            }

            // Otherwise, try to find by config->legacy_id
            $curso = \App\Models\Curso::where('config->legacy_id', $legacyId)->first();
            if ($curso) {
                return $curso;
            }
        }

        // Try by name
        if ($legacyName) {
            $curso = \App\Models\Curso::where('nome', 'like', '%' . $legacyName . '%')->first();
            if ($curso) {
                return $curso;
            }
        }

        // Fallback: find by tipo (Plano de Formação = tipo 4)
        $curso = \App\Models\Curso::where('tipo', 4)->first();
        if ($curso) {
            return $curso;
        }

        // Last resort: any curso
        $curso = \App\Models\Curso::first();
        return $curso;
    }

    /**
     * Find or create a Turma by legacy ID.
     */
    private function findOrCreateTurma($legacyTurmaId, $cursoId)
    {
        if (!$legacyTurmaId) {
            return null;
        }

        // Try by config->legacy_id
        $turma = \App\Models\Turma::where('config->legacy_id', $legacyTurmaId)->first();
        if ($turma) {
            return $turma;
        }

        // Try by nome matching legacy ID
        $turma = \App\Models\Turma::where('nome', 'Turma ' . $legacyTurmaId)
            ->where('id_curso', $cursoId)
            ->first();
        if ($turma) {
            return $turma;
        }

        // Create new turma
        $turma = new \App\Models\Turma();
        $turma->fill([
            'token' => \Illuminate\Support\Str::random(30),
            'id_curso' => $cursoId,
            'nome' => 'Turma ' . $legacyTurmaId,
            'config' => ['legacy_id' => $legacyTurmaId],
            'ativo' => 's',
            'excluido' => 'n',
            'deletado' => 'n',
        ]);
        $turma->save();

        return $turma;
    }

    /**
     * Importa turmas do CRM antigo.
     */
    private function importTurmas($data)
    {
        $count = 0;

        // Extrair items (mesma lógica)
        $items = [];
        if (isset($data['data']['data']) && is_array($data['data']['data'])) {
            $items = $data['data']['data'];
        } elseif (isset($data['exec']) && isset($data['data']) && $data['exec'] === true) {
            $items = $data['data'];
        } elseif (is_array($data)) {
            $items = $data;
        }

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $legacyId = $item['id'] ?? null;
            if (!$legacyId) {
                continue;
            }

            // Encontrar ou criar curso
            $legacyCursoId = $item['id_curso'] ?? null;
            $curso = $this->findCurso($legacyCursoId, $item['nome_curso'] ?? null);
            $cursoId = $curso ? $curso->id : 0;

            // Verificar se já existe a turma por legacy_id ou nome
            $turma = \App\Models\Turma::where('config->legacy_id', $legacyId)->first();
            if (!$turma && isset($item['nome'])) {
                $turma = \App\Models\Turma::where('nome', $item['nome'])
                    ->where('id_curso', $cursoId)
                    ->first();
            }

            if (!$turma) {
                $turma = new \App\Models\Turma();
                $turma->token = $item['token'] ?? \Illuminate\Support\Str::random(30);
            }

            $configData = is_array($turma->config) ? $turma->config : [];
            $configData['legacy_id'] = $legacyId;
            $configData['legacy_curso_id'] = $legacyCursoId;

            // Mapear campos da turma
            $turmaData = [
                'id_curso' => $cursoId,
                'nome' => $item['nome'] ?? 'Turma ' . $legacyId,
                'inicio' => isset($item['inicio']) && $item['inicio'] !== '0000-00-00' ? $item['inicio'] : null,
                'fim' => isset($item['fim']) && $item['fim'] !== '0000-00-00' ? $item['fim'] : null,
                'professor' => $item['professor'] ?? null,
                'Pgto' => $item['Pgto'] ?? null,
                'Valor' => $this->parseDecimal($item['Valor'] ?? 0),
                'Matricula' => $this->parseDecimal($item['Matricula'] ?? 0),
                'hora_inicio' => isset($item['hora_inicio']) && $item['hora_inicio'] !== '00:00:00' ? $item['hora_inicio'] : null,
                'hora_fim' => isset($item['hora_fim']) && $item['hora_fim'] !== '00:00:00' ? $item['hora_fim'] : null,
                'duracao' => isset($item['duracao']) ? (int) $item['duracao'] : null,
                'unidade_duracao' => $item['unidade_duracao'] ?? null,
                'dia1' => $item['dia1'] ?? null,
                'dia2' => $item['dia2'] ?? null,
                'dia3' => $item['dia3'] ?? null,
                'dia4' => $item['dia4'] ?? null,
                'dia5' => $item['dia5'] ?? null,
                'dia6' => $item['dia6'] ?? null,
                'dia7' => $item['dia7'] ?? null,
                'TemHorario' => $item['TemHorario'] ?? 'n',
                'Quadro' => $item['Quadro'] ?? 'n',
                'ativo' => $item['ativo'] ?? 's',
                'ordenar' => isset($item['ordenar']) ? (int) $item['ordenar'] : 0,
                'CodGrade' => isset($item['CodGrade']) ? (int) $item['CodGrade'] : null,
                'Cidade' => $item['Cidade'] ?? null,
                'QuemseDestina' => $item['QuemseDestina'] ?? null,
                'Novo' => $item['Novo'] ?? 'n',
                'obs' => $item['obs'] ?? null,
                'excluido' => $item['excluido'] ?? 'n',
                'deletado' => $item['deletado'] ?? 'n',
                'max_alunos' => isset($item['max_alunos']) ? (int) $item['max_alunos'] : null,
                'min_alunos' => isset($item['min_alunos']) ? (int) $item['min_alunos'] : null,
                'config' => $configData,
            ];

            $turma->fill($turmaData);
            $turma->save();

            $count++;
        }

        return $count;
    }

    /**
     * Importa clientes do CRM antigo para o banco do novo CRM.
     */
    private function importClientes($data)
    {
        $count = 0;

        // Extrair items
        $items = [];
        if (isset($data['data']['data']) && is_array($data['data']['data'])) {
            $items = $data['data']['data'];
        } elseif (isset($data['exec']) && isset($data['data']) && $data['exec'] === true) {
            $items = $data['data'];
        } elseif (is_array($data)) {
            $items = $data;
        }

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $cpf = $this->cleanCpf($item['Cpf'] ?? $item['cpf_aluno'] ?? $item['cpf'] ?? null);
            if (!$cpf) {
                continue; // Pula se não houver um CPF válido
            }

            // Mapeia ou cria o usuário usando a rotina robusta que implementamos
            $user = $this->findOrCreateUser($item, $cpf);
            if ($user) {
                // Armazena legacy_client_id no config do usuário para lookup futuro (ex: matrículas)
                $legacyId = $item['id'] ?? null;
                if ($legacyId) {
                    $userConfig = $user->config ?: [];
                    if (($userConfig['legacy_client_id'] ?? null) != $legacyId) {
                        $userConfig['legacy_client_id'] = $legacyId;
                        $user->config = $userConfig;
                        $user->save();
                    }
                }
                $count++;
            }
        }

        return $count;
    }

    /**
     * Persiste metacampos para matrícula usando Qlib::update_matriculameta.
     */
    private function persistMatriculaMeta(int|string $matriculaId, array $meta): void
    {
        if (!$matriculaId || empty($meta)) {
            return;
        }
        foreach ($meta as $metaKey => $metaValue) {
            if ($metaKey === null || $metaKey === '' || $metaValue === null) {
                continue;
            }

            if (is_bool($metaValue)) {
                \App\Services\Qlib::update_matriculameta($matriculaId, $metaKey, $metaValue ? '1' : '0');
                continue;
            }

            if (is_array($metaValue)) {
                \App\Services\Qlib::update_matriculameta($matriculaId, $metaKey, json_encode($metaValue, JSON_UNESCAPED_UNICODE));
                continue;
            }

            if ($metaValue !== '') {
                \App\Services\Qlib::update_matriculameta($matriculaId, $metaKey, (string) $metaValue);
            }
        }
    }

    /**
     * Map legacy status (2=Matriculado, 3=Realocar) to situacao_id.
     */
    private function mapLegacyStatusToSituacao($legacyStatus)
    {
        // status=2 -> Matriculado (ID 101), status=3 -> Realocar (ID 102)
        $map = [
            '2' => 101,
            '3' => 102,
        ];
        return $map[(string) $legacyStatus] ?? null;
    }

    /**
     * Parse a value to decimal (2 decimal places).
     */
    private function parseDecimal($value)
    {
        if (is_null($value) || $value === '') {
            return 0;
        }
        // Remove currency symbols, dots (thousand sep), replace comma with dot
        $clean = preg_replace('/[^0-9,\-]/', '', (string) $value);
        $clean = str_replace('.', '', $clean);
        $clean = str_replace(',', '.', $clean);
        return round((float) $clean, 2);
    }
}
