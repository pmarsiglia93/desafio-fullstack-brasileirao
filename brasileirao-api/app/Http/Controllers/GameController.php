<?php

namespace App\Http\Controllers;

use App\Models\Game;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GameController extends Controller
{
    /**
     * Lista os jogos cadastrados.
     *
     * Permite filtrar por nome do time, data inicial e data final.
     * O retorno é paginado.
     */
    public function index(Request $request)
    {
        $request->validate([
            'team' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ]);

        $query = Game::with(['homeTeam', 'awayTeam'])
            ->orderBy('match_date', 'desc');

        if ($request->filled('team')) {
            $teamName = $request->team;

            $query->where(function ($q) use ($teamName) {
                $q->whereHas('homeTeam', function ($teamQuery) use ($teamName) {
                    $teamQuery->where('name', 'like', '%' . $teamName . '%');
                })->orWhereHas('awayTeam', function ($teamQuery) use ($teamName) {
                    $teamQuery->where('name', 'like', '%' . $teamName . '%');
                });
            });
        }

        if ($request->filled('start_date')) {
            $query->whereDate('match_date', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $query->whereDate('match_date', '<=', $request->end_date);
        }

        $games = $query->paginate(10);

        return response()->json([
            'status' => 'success',
            'message' => 'Jogos listados com sucesso.',
            'data' => $games,
        ]);
    }

    /**
     * Exibe os detalhes de um jogo.
     *
     * Retorna o jogo com os relacionamentos de time mandante e visitante carregados.
     */
    public function show(Game $game)
    {
        $game->load(['homeTeam', 'awayTeam']);

        return response()->json([
            'status' => 'success',
            'message' => 'Jogo encontrado com sucesso.',
            'data' => $game,
        ]);
    }

    /**
     * Cria um novo jogo.
     *
     * Endpoint restrito a administradores.
     *
     * Regras de negócio:
     * - impede time contra ele mesmo
     * - impede duplicidade do mesmo confronto com o mesmo mando
     * - permite confronto invertido
     * - impede um terceiro confronto entre o mesmo par de times
     * - se houver placar informado, o jogo é salvo como finalizado
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'home_team_id' => ['required', 'exists:teams,id'],
            'away_team_id' => ['required', 'exists:teams,id', 'different:home_team_id'],
            'match_date' => ['required', 'date'],
            'status' => ['nullable', Rule::in(['scheduled', 'finished'])],
            'home_score' => ['nullable', 'integer', 'min:0', 'required_with:away_score'],
            'away_score' => ['nullable', 'integer', 'min:0', 'required_with:home_score'],
        ]);

        $validationError = $this->validateMatchRules(
            (int) $data['home_team_id'],
            (int) $data['away_team_id']
        );

        if ($validationError) {
            return response()->json([
                'status' => 'error',
                'message' => $validationError,
            ], 422);
        }

        $hasScores = isset($data['home_score']) && isset($data['away_score']);
        $status = $data['status'] ?? 'scheduled';

        if ($hasScores) {
            $status = 'finished';
        }

        if (! $hasScores && $status === 'finished') {
            return response()->json([
                'status' => 'error',
                'message' => 'Um jogo finalizado precisa ter home_score e away_score.',
            ], 422);
        }

        $game = Game::create([
            'home_team_id' => $data['home_team_id'],
            'away_team_id' => $data['away_team_id'],
            'match_date' => $data['match_date'],
            'home_score' => $data['home_score'] ?? null,
            'away_score' => $data['away_score'] ?? null,
            'status' => $status,
        ]);

        $game->load(['homeTeam', 'awayTeam']);

        return response()->json([
            'status' => 'success',
            'message' => 'Jogo criado com sucesso.',
            'data' => $game,
        ], 201);
    }

    /**
     * Atualiza um jogo existente.
     *
     * Endpoint restrito a administradores.
     *
     * Mantém as mesmas regras de negócio aplicadas na criação.
     */
    public function update(Request $request, Game $game)
    {
        $data = $request->validate([
            'home_team_id' => ['required', 'exists:teams,id'],
            'away_team_id' => ['required', 'exists:teams,id', 'different:home_team_id'],
            'match_date' => ['required', 'date'],
            'status' => ['nullable', Rule::in(['scheduled', 'finished'])],
            'home_score' => ['nullable', 'integer', 'min:0', 'required_with:away_score'],
            'away_score' => ['nullable', 'integer', 'min:0', 'required_with:home_score'],
        ]);

        $validationError = $this->validateMatchRules(
            (int) $data['home_team_id'],
            (int) $data['away_team_id'],
            $game->id
        );

        if ($validationError) {
            return response()->json([
                'status' => 'error',
                'message' => $validationError,
            ], 422);
        }

        $hasScores = isset($data['home_score']) && isset($data['away_score']);
        $status = $data['status'] ?? 'scheduled';

        if ($hasScores) {
            $status = 'finished';
        }

        if (! $hasScores && $status === 'finished') {
            return response()->json([
                'status' => 'error',
                'message' => 'Um jogo finalizado precisa ter home_score e away_score.',
            ], 422);
        }

        $game->update([
            'home_team_id' => $data['home_team_id'],
            'away_team_id' => $data['away_team_id'],
            'match_date' => $data['match_date'],
            'home_score' => $data['home_score'] ?? null,
            'away_score' => $data['away_score'] ?? null,
            'status' => $status,
        ]);

        $game->load(['homeTeam', 'awayTeam']);

        return response()->json([
            'status' => 'success',
            'message' => 'Jogo atualizado com sucesso.',
            'data' => $game,
        ]);
    }

    /**
     * Lança ou atualiza o placar de um jogo.
     *
     * Endpoint restrito a administradores.
     * Ao lançar placar, o jogo passa automaticamente para status `finished`.
     */
    public function updateScore(Request $request, Game $game)
    {
        $data = $request->validate([
            'home_score' => ['required', 'integer', 'min:0'],
            'away_score' => ['required', 'integer', 'min:0'],
        ]);

        $game->update([
            'home_score' => $data['home_score'],
            'away_score' => $data['away_score'],
            'status' => 'finished',
        ]);

        $game->load(['homeTeam', 'awayTeam']);

        return response()->json([
            'status' => 'success',
            'message' => 'Placar lançado com sucesso.',
            'data' => $game,
        ]);
    }

    /**
     * Remove um jogo.
     *
     * Endpoint restrito a administradores.
     *
     * Regras de negócio:
     * - apenas jogos finalizados podem ser removidos
     * - apenas jogos finalizados nos últimos 3 dias podem ser removidos
     */
    public function destroy(Game $game)
    {
        if ($game->status !== 'finished') {
            return response()->json([
                'status' => 'error',
                'message' => 'Só é permitido excluir jogos finalizados.',
            ], 422);
        }

        $gameDate = Carbon::parse($game->match_date);
        $limitDate = now()->subDays(3);

        if ($gameDate->lt($limitDate)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Só é permitido excluir jogos finalizados nos últimos 3 dias.',
            ], 422);
        }

        $game->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Jogo removido com sucesso.',
        ]);
    }

    /**
     * Valida as regras de confronto entre dois times.
     *
     * Regras:
     * - o mandante deve ser diferente do visitante
     * - não pode existir duplicidade do mesmo confronto com o mesmo mando
     * - o limite máximo entre o mesmo par de times é de dois jogos
     */
    private function validateMatchRules(int $homeTeamId, int $awayTeamId, ?int $ignoreGameId = null): ?string
    {
        if ($homeTeamId === $awayTeamId) {
            return 'O time mandante deve ser diferente do time visitante.';
        }

        $sameDirectionQuery = Game::query()
            ->where('home_team_id', $homeTeamId)
            ->where('away_team_id', $awayTeamId);

        if ($ignoreGameId !== null) {
            $sameDirectionQuery->where('id', '!=', $ignoreGameId);
        }

        if ($sameDirectionQuery->exists()) {
            return 'Este confronto com o mesmo mando já foi cadastrado.';
        }

        $pairGamesQuery = Game::query()
            ->where(function ($query) use ($homeTeamId, $awayTeamId) {
                $query->where('home_team_id', $homeTeamId)
                    ->where('away_team_id', $awayTeamId);
            })
            ->orWhere(function ($query) use ($homeTeamId, $awayTeamId) {
                $query->where('home_team_id', $awayTeamId)
                    ->where('away_team_id', $homeTeamId);
            });

        if ($ignoreGameId !== null) {
            $pairGamesQuery->where('id', '!=', $ignoreGameId);
        }

        if ($pairGamesQuery->count() >= 2) {
            return 'Este confronto já atingiu o limite de ida e volta.';
        }

        return null;
    }
}