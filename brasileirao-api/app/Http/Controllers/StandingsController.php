<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\Team;
use Illuminate\Http\JsonResponse;

class StandingsController extends Controller
{
    public function index(): JsonResponse
    {
        $teams = Team::orderBy('name')->get();

        $standings = [];

        foreach ($teams as $team) {
            $standings[$team->id] = [
                'team_id'        => $team->id,
                'name'           => $team->name,
                'slug'           => $team->slug,
                'logo_url'       => $team->logo_url,
                'points'         => 0,
                'played'         => 0,
                'wins'           => 0,
                'draws'          => 0,
                'losses'         => 0,
                'goals_for'      => 0,
                'goals_against'  => 0,
                'goal_difference' => 0,
                'form'           => [],
            ];
        }

        $finishedGames = Game::where('status', 'finished')->orderBy('match_date')->get();

        foreach ($finishedGames as $game) {
            $homeId = $game->home_team_id;
            $awayId = $game->away_team_id;

            if (! isset($standings[$homeId], $standings[$awayId])) {
                continue;
            }

            $home = (int) $game->home_score;
            $away = (int) $game->away_score;

            $standings[$homeId]['played']++;
            $standings[$awayId]['played']++;

            $standings[$homeId]['goals_for']     += $home;
            $standings[$homeId]['goals_against']  += $away;
            $standings[$awayId]['goals_for']     += $away;
            $standings[$awayId]['goals_against']  += $home;

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

        $formMap = $this->buildFormMap($finishedGames);

        foreach ($standings as $index => &$team) {
            $team['position'] = $index + 1;
            $team['form']     = $formMap[$team['team_id']] ?? [];
        }
        unset($team);

        return response()->json([
            'status'  => 'success',
            'message' => 'Classificação listada com sucesso.',
            'data'    => $standings,
        ]);
    }

    private function buildFormMap($finishedGames): array
    {
        $gamesByTeam = [];

        foreach ($finishedGames as $game) {
            $gamesByTeam[$game->home_team_id][] = $game;
            $gamesByTeam[$game->away_team_id][] = $game;
        }

        $formMap = [];

        foreach ($gamesByTeam as $teamId => $games) {
            // Games already ordered by match_date ASC; reverse to get most recent first
            $last5 = array_slice(array_reverse($games), 0, 5);

            $form = [];
            foreach ($last5 as $game) {
                $isHome = $game->home_team_id === $teamId;
                $home   = (int) $game->home_score;
                $away   = (int) $game->away_score;

                if ($isHome) {
                    $form[] = $home > $away ? 'V' : ($home < $away ? 'D' : 'E');
                } else {
                    $form[] = $away > $home ? 'V' : ($away < $home ? 'D' : 'E');
                }
            }

            $formMap[$teamId] = $form;
        }

        return $formMap;
    }
}
