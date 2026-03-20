<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\Team;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StandingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_can_view_standings(): void
    {
        $response = $this->getJson('/api/standings');

        $response
            ->assertOk()
            ->assertJsonStructure([
                'status',
                'message',
                'data',
            ]);
    }

    public function test_standings_are_calculated_and_ordered_correctly(): void
    {
        $palmeiras = Team::factory()->create([
            'name' => 'Palmeiras',
            'slug' => 'palmeiras',
        ]);

        $corinthians = Team::factory()->create([
            'name' => 'Corinthians',
            'slug' => 'corinthians',
        ]);

        $santos = Team::factory()->create([
            'name' => 'Santos',
            'slug' => 'santos',
        ]);

        Game::factory()->create([
            'home_team_id' => $palmeiras->id,
            'away_team_id' => $corinthians->id,
            'home_score' => 2,
            'away_score' => 0,
            'status' => 'finished',
            'match_date' => now()->subDay(),
        ]);

        Game::factory()->create([
            'home_team_id' => $santos->id,
            'away_team_id' => $palmeiras->id,
            'home_score' => 1,
            'away_score' => 1,
            'status' => 'finished',
            'match_date' => now()->subHours(12),
        ]);

        $response = $this->getJson('/api/standings');

        $response->assertOk();

        $data = $response->json('data');

        $this->assertEquals('Palmeiras', $data[0]['name']);
        $this->assertEquals(4, $data[0]['points']);
        $this->assertEquals(2, $data[0]['played']);
        $this->assertEquals(1, $data[0]['wins']);
        $this->assertEquals(1, $data[0]['draws']);
        $this->assertEquals(0, $data[0]['losses']);
        $this->assertEquals(3, $data[0]['goals_for']);
        $this->assertEquals(1, $data[0]['goals_against']);
        $this->assertEquals(2, $data[0]['goal_difference']);
    }
}