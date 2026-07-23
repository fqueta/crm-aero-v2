<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Curso;
use App\Models\Matricula;
use App\Models\User;
use Illuminate\Http\Request;

class ConsultaGeralController extends Controller
{
    public function query(Request $request)
    {
        $table = $request->input('table', 'matriculas');

        if ($table === 'cursos') {
            return $this->queryCursos($request);
        }

        return $this->queryMatriculas($request);
    }

    public function search(Request $request)
    {
        $q = $request->input('q', '');
        $limit = (int) $request->input('per_page', 10);

        if (strlen($q) < 1) {
            return response()->json(['clients' => [], 'matriculas' => [], 'cursos' => []]);
        }

        $clients = User::where(function ($query) use ($q) {
            $query->where('name', 'like', "%{$q}%")
                  ->orWhere('cpf', 'like', "%{$q}%")
                  ->orWhere('email', 'like', "%{$q}%")
                  ->orWhere('celular', 'like', "%{$q}%");
        })->where('status', '!=', 'inactive')
          ->where('permission_id', '>=', 5)
          ->limit($limit)
          ->get(['id', 'name', 'cpf', 'celular', 'email']);

        $matriculas = Matricula::with(['cliente', 'curso'])
            ->where(function ($query) use ($q) {
                $query->where('id', $q)
                      ->orWhere('descricao', 'like', "%{$q}%");
            })
            ->limit($limit)
            ->get();

        $cursos = Curso::where(function ($query) use ($q) {
            $query->where('nome', 'like', "%{$q}%")
                  ->orWhere('titulo', 'like', "%{$q}%");
        })->limit($limit)
          ->get(['id', 'nome', 'titulo', 'tipo', 'ativo']);

        return response()->json([
            'clients' => $clients,
            'matriculas' => $matriculas,
            'cursos' => $cursos,
        ]);
    }

    protected function queryMatriculas(Request $request)
    {
        $perPage = (int) $request->input('per_page', 20);
        $query = Matricula::query()->with(['cliente', 'curso']);

        if ($request->filled('id')) {
            $query->where('id', $request->input('id'));
        }

        if ($search = $request->input('descricao')) {
            $query->where('descricao', 'like', "%{$search}%");
        }

        $results = $query->orderByDesc('data')->paginate($perPage);

        return response()->json($results);
    }

    protected function queryCursos(Request $request)
    {
        $perPage = (int) $request->input('per_page', 20);
        $query = Curso::query();

        if ($search = $request->input('nome')) {
            $query->where('nome', 'like', "%{$search}%");
        }

        if ($search = $request->input('titulo')) {
            $query->where('titulo', 'like', "%{$search}%");
        }

        $results = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json($results);
    }
}
