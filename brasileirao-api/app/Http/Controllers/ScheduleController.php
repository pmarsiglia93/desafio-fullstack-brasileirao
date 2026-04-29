<?php

namespace App\Http\Controllers;

use App\Models\Game;
use Illuminate\Http\JsonResponse;

class ScheduleController extends Controller
{
    public function index(): JsonResponse
    {
        $games = Game::with(['homeTeam', 'awayTeam'])
            ->where('status', 'scheduled')
            ->orderBy('match_date')
            ->get()
            ->map(fn ($game) => [
                'id'         => $game->id,
                'match_date' => $game->match_date->toIso8601String(),
                'home_team'  => [
                    'id'       => $game->homeTeam->id,
                    'name'     => $game->homeTeam->name,
                    'logo_url' => $game->homeTeam->logo_url,
                ],
                'away_team'  => [
                    'id'       => $game->awayTeam->id,
                    'name'     => $game->awayTeam->name,
                    'logo_url' => $game->awayTeam->logo_url,
                ],
            ]);

        return response()->json([
            'status' => 'success',
            'data'   => $games,
        ]);
    }
}
