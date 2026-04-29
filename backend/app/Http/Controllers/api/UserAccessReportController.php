<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\EventLog;
use App\Models\User;
use App\Services\Qlib;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class UserAccessReportController extends Controller
{
    /**
     * Garante que apenas usuários com permission_id=1 acessem o relatório.
     */
    private function ensureSuperAdmin(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        if ((int) ($user->permission_id ?? 0) !== 1) {
            return response()->json(['error' => 'Relatório disponível apenas para permission_id=1'], 403);
        }

        return null;
    }

    /**
     * Retorna o intervalo filtrado, com fallback para os últimos 30 dias.
     */
    private function resolveDateRange(array $validated): array
    {
        $endDate = isset($validated['end_date'])
            ? Carbon::parse($validated['end_date'])->endOfDay()
            : Carbon::now()->endOfDay();

        $startDate = isset($validated['start_date'])
            ? Carbon::parse($validated['start_date'])->startOfDay()
            : $endDate->copy()->subDays(29)->startOfDay();

        if ($startDate->gt($endDate)) {
            $startDate = $endDate->copy()->startOfDay();
        }

        return [$startDate, $endDate];
    }

    /**
     * Lista o relatório de acessos de usuários internos com resumo e paginação.
     */
    public function index(Request $request)
    {
        if ($unauthorized = $this->ensureSuperAdmin($request)) {
            return $unauthorized;
        }

        $validator = Validator::make($request->all(), [
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'user_id' => ['nullable', 'string', 'max:64'],
            'permission_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:255'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Erro de validação',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();
        [$startDate, $endDate] = $this->resolveDateRange($validated);
        $perPage = (int) ($validated['per_page'] ?? 25);
        $clientPermissionId = (int) (Qlib::qoption('permission_client_id') ?? 5);

        $baseUsersQuery = User::query()
            ->where(function ($query) use ($clientPermissionId) {
                $query->whereNull('permission_id')
                    ->orWhere('permission_id', '!=', $clientPermissionId);
            })
            ->where(function ($query) {
                $query->whereNull('permission_id')
                    ->orWhere('permission_id', '!=', 8);
            })
            ->where(function ($query) {
                $query->whereNull('deletado')
                    ->orWhere('deletado', '!=', 's');
            })
            ->where(function ($query) {
                $query->whereNull('excluido')
                    ->orWhere('excluido', '!=', 's');
            });

        if (!empty($validated['user_id'])) {
            $baseUsersQuery->where('id', (string) $validated['user_id']);
        }

        if (isset($validated['permission_id'])) {
            $baseUsersQuery->where('permission_id', (int) $validated['permission_id']);
        }

        if (!empty($validated['search'])) {
            $search = trim((string) $validated['search']);
            $baseUsersQuery->where(function ($query) use ($search) {
                $query->where('name', 'like', '%' . $search . '%')
                    ->orWhere('email', 'like', '%' . $search . '%');
            });
        }

        $allUserIds = (clone $baseUsersQuery)->pluck('id')->map(fn ($id) => (string) $id)->values();

        $users = (clone $baseUsersQuery)
            ->orderBy('name')
            ->paginate($perPage);

        $pageUserIds = collect($users->items())->pluck('id')->map(fn ($id) => (string) $id)->values();

        $pageLogs = collect();
        $activeTokensMap = collect();

        if ($pageUserIds->isNotEmpty()) {
            $pageLogs = EventLog::query()
                ->where('entity_type', 'auth')
                ->whereIn('actor_id', $pageUserIds)
                ->whereBetween('created_at', [$startDate, $endDate])
                ->orderByDesc('created_at')
                ->get()
                ->groupBy('actor_id');

            $activeTokensMap = DB::table('personal_access_tokens')
                ->selectRaw('tokenable_id as user_id, COUNT(*) as active_sessions, MAX(created_at) as last_token_created_at, MAX(last_used_at) as last_used_at')
                ->where('tokenable_type', User::class)
                ->whereIn('tokenable_id', $pageUserIds)
                ->groupBy('tokenable_id')
                ->get()
                ->keyBy('user_id');
        }

        $summary = [
            'totalUsers' => (int) $allUserIds->count(),
            'usersWithLoginInPeriod' => 0,
            'totalLoginEvents' => 0,
            'totalLogoutEvents' => 0,
            'usersWithActiveSessions' => 0,
        ];

        if ($allUserIds->isNotEmpty()) {
            $summary['usersWithLoginInPeriod'] = (int) EventLog::query()
                ->where('entity_type', 'auth')
                ->where('action', 'login')
                ->whereIn('actor_id', $allUserIds)
                ->whereBetween('created_at', [$startDate, $endDate])
                ->distinct('actor_id')
                ->count('actor_id');

            $summary['totalLoginEvents'] = (int) EventLog::query()
                ->where('entity_type', 'auth')
                ->where('action', 'login')
                ->whereIn('actor_id', $allUserIds)
                ->whereBetween('created_at', [$startDate, $endDate])
                ->count();

            $summary['totalLogoutEvents'] = (int) EventLog::query()
                ->where('entity_type', 'auth')
                ->where('action', 'logout')
                ->whereIn('actor_id', $allUserIds)
                ->whereBetween('created_at', [$startDate, $endDate])
                ->count();

            $summary['usersWithActiveSessions'] = (int) DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->whereIn('tokenable_id', $allUserIds)
                ->distinct('tokenable_id')
                ->count('tokenable_id');
        }

        $transformed = collect($users->items())->map(function (User $user) use ($pageLogs, $activeTokensMap) {
            $logs = collect($pageLogs->get((string) $user->id, []));
            $loginEvents = $logs->where('action', 'login')->values();
            $logoutEvents = $logs->where('action', 'logout')->values();
            $lastLogin = $loginEvents->first();
            $lastLogout = $logoutEvents->first();
            $activeToken = $activeTokensMap->get((string) $user->id);

            $lastActivityAt = $activeToken->last_used_at ?? null;
            $lastAccessAt = $lastActivityAt ?: ($lastLogin->created_at ?? null);

            return [
                'userId' => (string) $user->id,
                'name' => (string) ($user->name ?? ''),
                'email' => (string) ($user->email ?? ''),
                'permissionId' => $user->permission_id !== null ? (int) $user->permission_id : null,
                'status' => $user->status ?? null,
                'activeFlag' => $user->ativo ?? null,
                'loginCount' => (int) $loginEvents->count(),
                'logoutCount' => (int) $logoutEvents->count(),
                'lastLoginAt' => optional($lastLogin?->created_at)->toISOString(),
                'lastLogoutAt' => optional($lastLogout?->created_at)->toISOString(),
                'lastLoginIp' => $lastLogin->ip_address ?? null,
                'lastLogoutIp' => $lastLogout->ip_address ?? null,
                'lastActivityAt' => $lastActivityAt ? Carbon::parse($lastActivityAt)->toISOString() : null,
                'lastAccessAt' => $lastAccessAt ? Carbon::parse($lastAccessAt)->toISOString() : null,
                'activeSessions' => isset($activeToken->active_sessions) ? (int) $activeToken->active_sessions : 0,
                'isOnline' => isset($activeToken->active_sessions) && (int) $activeToken->active_sessions > 0,
            ];
        })->values();

        return response()->json([
            'filters' => [
                'startDate' => $startDate->toDateString(),
                'endDate' => $endDate->toDateString(),
                'userId' => $validated['user_id'] ?? null,
                'permissionId' => isset($validated['permission_id']) ? (int) $validated['permission_id'] : null,
                'search' => $validated['search'] ?? null,
                'perPage' => $perPage,
            ],
            'summary' => $summary,
            'data' => $transformed,
            'current_page' => $users->currentPage(),
            'last_page' => $users->lastPage(),
            'per_page' => $users->perPage(),
            'total' => $users->total(),
        ]);
    }
}
