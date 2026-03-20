<?php

namespace Database\Factories;

use App\Models\Game;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Game>
 */
class GameFactory extends Factory
{
    protected $model = Game::class;

    public function definition(): array
    {
        $homeTeam = Team::factory()->create();
        $awayTeam = Team::factory()->create();

        while ($homeTeam->id === $awayTeam->id) {
            $awayTeam = Team::factory()->create();
        }

        return [
            'home_team_id' => $homeTeam->id,
            'away_team_id' => $awayTeam->id,
            'match_date' => now()->addDay(),
            'home_score' => null,
            'away_score' => null,
            'status' => 'scheduled',
        ];
    }
}