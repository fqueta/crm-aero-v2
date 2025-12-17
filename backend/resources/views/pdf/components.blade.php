<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <title>Relatório de Componentes</title>
    <style>
        body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #222; }
        h1 { font-size: 18px; margin: 0 0 8px; }
        .subtitle { font-size: 11px; color: #555; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; }
        th { background: #f3f3f3; text-align: left; }
        .muted { color: #777; }
    </style>
</head>
<body>
    <h1>Relatório de Componentes</h1>
    <div class="subtitle">
        Gerado em: {{ $generatedAt->format('d/m/Y H:i') }}
        | Total: {{ $items->count() }}
    </div>

    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Slug</th>
                <th>Tipo Conteúdo</th>
                <th>Curso</th>
                <th>Ativo</th>
                <th>Ordenar</th>
                <th>Galeria (IDs)</th>
                <th>Criado</th>
                <th>Atualizado</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($items as $it)
            <tr>
                <td>{{ $it->id }}</td>
                <td>{{ $it->nome }}</td>
                <td class="muted">{{ $it->slug }}</td>
                <td>{{ $it->tipo_conteudo_nome ?? '-' }}</td>
                <td>{{ $it->curso_nome ?? '-' }}</td>
                <td>{{ strtoupper($it->ativo) }}</td>
                <td>{{ $it->ordenar }}</td>
                <td>{{ !empty($it->galeria) ? implode(',', $it->galeria) : '-' }}</td>
                <td>{{ optional($it->created_at)->format('d/m/Y H:i') }}</td>
                <td>{{ optional($it->updated_at)->format('d/m/Y H:i') }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>