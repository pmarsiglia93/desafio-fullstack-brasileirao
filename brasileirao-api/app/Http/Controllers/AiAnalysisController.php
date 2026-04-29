<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

class AiAnalysisController extends Controller
{
    public function analyze(): JsonResponse
    {
        $standings = $this->calculateStandings();

        $playedCount = collect($standings)->sum('played') / 2;

        if ($playedCount === 0) {
            return response()->json([
                'status' => 'error',
                'message' => 'Não há jogos finalizados para análise. Registre e finalize alguns jogos primeiro.',
            ], 422);
        }

        $apiKey = config('services.gemini.key');

        if (empty($apiKey)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Análise de IA indisponível. Configure GEMINI_API_KEY no arquivo .env do backend.',
            ], 503);
        }

        $totalGames = Game::where('status', 'finished')->count();
        $statsPayload = $this->buildStatsPayload($standings, $totalGames);
        $analysis = $this->callGemini($statsPayload, $apiKey);

        return response()->json([
            'status' => 'success',
            'data' => array_merge([
                'generated_at' => now()->toIso8601String(),
                'games_analyzed' => $totalGames,
            ], $analysis),
        ]);
    }

    private function calculateStandings(): array
    {
        $teams = Team::orderBy('name')->get();

        $standings = [];
        foreach ($teams as $team) {
            $standings[$team->id] = [
                'name' => $team->name,
                'points' => 0,
                'played' => 0,
                'wins' => 0,
                'draws' => 0,
                'losses' => 0,
                'goals_for' => 0,
                'goals_against' => 0,
                'goal_difference' => 0,
            ];
        }

        foreach (Game::where('status', 'finished')->get() as $game) {
            $homeId = $game->home_team_id;
            $awayId = $game->away_team_id;

            if (! isset($standings[$homeId], $standings[$awayId])) {
                continue;
            }

            $home = (int) $game->home_score;
            $away = (int) $game->away_score;

            $standings[$homeId]['played']++;
            $standings[$awayId]['played']++;
            $standings[$homeId]['goals_for'] += $home;
            $standings[$homeId]['goals_against'] += $away;
            $standings[$awayId]['goals_for'] += $away;
            $standings[$awayId]['goals_against'] += $home;

            if ($home > $away) {
                $standings[$homeId]['wins']++;
                $standings[$homeId]['points'] += 3;
                $standings[$awayId]['losses']++;
            } elseif ($home < $away) {
                $standings[$awayId]['wins']++;
                $standings[$awayId]['points'] += 3;
                $standings[$homeId]['losses']++;
            } else {
                $standings[$homeId]['draws']++;
                $standings[$awayId]['draws']++;
                $standings[$homeId]['points']++;
                $standings[$awayId]['points']++;
            }
        }

        foreach ($standings as &$team) {
            $team['goal_difference'] = $team['goals_for'] - $team['goals_against'];
        }
        unset($team);

        $standings = array_values($standings);

        usort($standings, function ($a, $b) {
            if ($a['points'] !== $b['points']) {
                return $b['points'] <=> $a['points'];
            }
            if ($a['goal_difference'] !== $b['goal_difference']) {
                return $b['goal_difference'] <=> $a['goal_difference'];
            }
            if ($a['goals_for'] !== $b['goals_for']) {
                return $b['goals_for'] <=> $a['goals_for'];
            }

            return strcmp($a['name'], $b['name']);
        });

        foreach ($standings as $i => &$team) {
            $team['position'] = $i + 1;
        }
        unset($team);

        return $standings;
    }

    private function buildStatsPayload(array $standings, int $totalGames): array
    {
        $leaderPoints = $standings[0]['points'] ?? 0;
        $g4Points = $standings[3]['points'] ?? 0;
        $g6Points = $standings[5]['points'] ?? 0;
        $relegationPoints = $standings[16]['points'] ?? 0;

        $mapped = array_map(function ($team) use ($leaderPoints, $g4Points, $g6Points, $relegationPoints) {
            $played = $team['played'];
            $performance = $played > 0 ? round(($team['points'] / ($played * 3)) * 100, 1) : 0;
            $pos = $team['position'];

            return [
                'position' => $pos,
                'team' => $team['name'],
                'points' => $team['points'],
                'played' => $played,
                'wins' => $team['wins'],
                'draws' => $team['draws'],
                'losses' => $team['losses'],
                'goals_for' => $team['goals_for'],
                'goals_against' => $team['goals_against'],
                'goal_difference' => $team['goal_difference'],
                'performance_pct' => $performance,
                'points_behind_leader' => $leaderPoints - $team['points'],
                'points_to_g4' => $pos <= 4 ? 0 : max(0, $g4Points - $team['points'] + 1),
                'points_to_g6' => $pos <= 6 ? 0 : max(0, $g6Points - $team['points'] + 1),
                'points_above_relegation' => $team['points'] - $relegationPoints,
            ];
        }, $standings);

        return [
            'total_finished_games' => $totalGames,
            'standings' => $mapped,
        ];
    }

    private function callGemini(array $statsPayload, string $apiKey): array
    {
        $prompt = $this->buildPrompt($statsPayload);

        $response = Http::timeout(45)->post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}",
            [
                'contents' => [['parts' => [['text' => $prompt]]]],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'temperature' => 0.2,
                ],
            ]
        );

        if (! $response->successful()) {
            $errorBody = $response->json('error.message', 'Erro desconhecido na API Gemini.');
            abort(502, "Falha ao comunicar com a IA: {$errorBody}");
        }

        $aiText = $response->json('candidates.0.content.parts.0.text', '{}');
        $parsed = json_decode($aiText, true);

        if (! is_array($parsed)) {
            abort(502, 'A IA retornou uma resposta inválida. Tente novamente.');
        }

        return $parsed;
    }

    private function buildPrompt(array $statsPayload): string
    {
        $statsJson = json_encode($statsPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        return <<<PROMPT
Você é um analista especializado em futebol brasileiro. Analise os dados reais abaixo e gere uma análise estatística e preditiva do Campeonato Brasileiro.

DADOS REAIS DA TABELA:
{$statsJson}

REGRAS DO BRASILEIRÃO:
- Campeão: 1º lugar
- Libertadores: posições 1 a 4
- Pré-Libertadores: posições 5 e 6
- Sul-Americana: posições 7 a 12
- Zona de rebaixamento: posições 17 a 20

INSTRUÇÕES:
- Use SOMENTE os dados fornecidos. Não invente informações.
- Baseie todas as análises nos números reais (pontos, aproveitamento, saldo de gols, etc).
- Escreva em português brasileiro, de forma clara e objetiva.
- Para times sem jogos disputados, indique que não há dados suficientes.

Retorne SOMENTE um JSON válido com esta estrutura exata (sem markdown, sem texto fora do JSON):
{
  "champion": {
    "team": "nome do time",
    "points": número,
    "performance_pct": número,
    "justification": "2-3 frases justificando com base nos dados reais"
  },
  "libertadores": [
    { "position": número, "team": "nome", "points": número }
  ],
  "pre_libertadores": [
    { "position": número, "team": "nome", "points": número }
  ],
  "sul_americana": [
    { "position": número, "team": "nome", "points": número }
  ],
  "relegation": [
    { "position": número, "team": "nome", "points": número, "risk_level": "alto ou médio ou baixo" }
  ],
  "best_performers": [
    { "team": "nome", "metric": "ex: Melhor ataque", "detail": "ex: 42 gols marcados em X jogos" }
  ],
  "teams_at_risk": [
    { "team": "nome", "detail": "razão objetiva do risco em 1 frase" }
  ],
  "campaign_comparison": "1-2 parágrafos comparando as campanhas mais notáveis do campeonato",
  "full_analysis": "3-4 parágrafos de análise geral do momento do campeonato",
  "disclaimer": "Análise baseada nos dados registrados no sistema. Resultados futuros podem variar."
}
PROMPT;
    }
}
