<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\Team;
use Illuminate\Http\JsonResponse;

class StandingsController extends Controller
{
    /**
     * Retorna a classificação atual do campeonato.
     *
     * A classificação é calculada com base apenas nos jogos com status `finished`.
     *
     * Critérios de ordenação:
     * - pontos
     * - saldo de gols
     * - gols pró
     * - ordem alfabética do nome
     */
    public function index(): JsonResponse
    {
        $teams = Team::orderBy('name')->get();

        $standings = [];

        foreach ($teams as $team) {
            $standings[$team->id] = [
                'team_id' => $team->id,
                'name' => $team->name,
                'slug' => $team->slug,
                'logo_url' => $team->logo_url,
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

        $finishedGames = Game::where('status', 'finished')->get();

        foreach ($finishedGames as $game) {
            $homeTeamId = $game->home_team_id;
            $awayTeamId = $game->away_team_id;

            $homeScore = (int) $game->home_score;
            $awayScore = (int) $game->away_score;

            if (! isset($standings[$homeTeamId]) || ! isset($standings[$awayTeamId])) {
                continue;
            }

            $standings[$homeTeamId]['played']++;
            $standings[$awayTeamId]['played']++;

            $standings[$homeTeamId]['goals_for'] += $homeScore;
            $standings[$homeTeamId]['goals_against'] += $awayScore;

            $standings[$awayTeamId]['goals_for'] += $awayScore;
            $standings[$awayTeamId]['goals_against'] += $homeScore;

            if ($homeScore > $awayScore) {
                $standings[$homeTeamId]['wins']++;
                $standings[$homeTeamId]['points'] += 3;
                $standings[$awayTeamId]['losses']++;
            } elseif ($homeScore < $awayScore) {
                $standings[$awayTeamId]['wins']++;
                $standings[$awayTeamId]['points'] += 3;
                $standings[$homeTeamId]['losses']++;
            } else {
                $standings[$homeTeamId]['draws']++;
                $standings[$awayTeamId]['draws']++;
                $standings[$homeTeamId]['points']++;
                $standings[$awayTeamId]['points']++;
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

        foreach ($standings as $index => &$team) {
            $team['position'] = $index + 1;
        }
        unset($team);

        return response()->json([
            'status' => 'success',
            'message' => 'Classificação listada com sucesso.',
            'data' => $standings,
        ]);
    }
}