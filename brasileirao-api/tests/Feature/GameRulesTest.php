<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GameRulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_cannot_create_game_with_same_home_and_away_team(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $team = Team::factory()->create([
            'name' => 'Palmeiras',
            'slug' => 'palmeiras',
        ]);

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/games', [
            'home_team_id' => $team->id,
            'away_team_id' => $team->id,
            'match_date' => now()->addDay()->toDateTimeString(),
        ]);

        $response->assertStatus(422);
    }

    public function test_admin_cannot_create_same_match_with_same_home_advantage_twice(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $homeTeam = Team::factory()->create([
            'name' => 'Palmeiras',
            'slug' => 'palmeiras',
        ]);

        $awayTeam = Team::factory()->create([
            'name' => 'Corinthians',
            'slug' => 'corinthians',
        ]);

        Game::factory()->create([
            'home_team_id' => $homeTeam->id,
            'away_team_id' => $awayTeam->id,
            'match_date' => now()->addDay(),
            'status' => 'scheduled',
        ]);

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/games', [
            'home_team_id' => $homeTeam->id,
            'away_team_id' => $awayTeam->id,
            'match_date' => now()->addDays(2)->toDateTimeString(),
        ]);

        $response
            ->assertStatus(422)
            ->assertJson([
                'status' => 'error',
                'message' => 'Este confronto com o mesmo mando já foi cadastrado.',
            ]);
    }

    public function test_admin_can_create_return_match_with_inverted_home_advantage(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $teamA = Team::factory()->create([
            'name' => 'Palmeiras',
            'slug' => 'palmeiras',
        ]);

        $teamB = Team::factory()->create([
            'name' => 'Corinthians',
            'slug' => 'corinthians',
        ]);

        Game::factory()->create([
            'home_team_id' => $teamA->id,
            'away_team_id' => $teamB->id,
            'match_date' => now()->addDay(),
            'status' => 'scheduled',
        ]);

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/games', [
            'home_team_id' => $teamB->id,
            'away_team_id' => $teamA->id,
            'match_date' => now()->addDays(2)->toDateTimeString(),
        ]);

        $response
            ->assertCreated()
            ->assertJson([
                'status' => 'success',
                'message' => 'Jogo criado com sucesso.',
            ]);
    }

    public function test_admin_cannot_create_third_match_between_same_pair_of_teams(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $teamA = Team::factory()->create([
            'name' => 'Palmeiras',
            'slug' => 'palmeiras',
        ]);

        $teamB = Team::factory()->create([
            'name' => 'Corinthians',
            'slug' => 'corinthians',
        ]);

        Game::factory()->create([
            'home_team_id' => $teamA->id,
            'away_team_id' => $teamB->id,
            'match_date' => now()->addDay(),
            'status' => 'scheduled',
        ]);

        Game::factory()->create([
            'home_team_id' => $teamB->id,
            'away_team_id' => $teamA->id,
            'match_date' => now()->addDays(2),
            'status' => 'scheduled',
        ]);

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/games', [
            'home_team_id' => $teamA->id,
            'away_team_id' => $teamB->id,
            'match_date' => now()->addDays(3)->toDateTimeString(),
        ]);

        $response
            ->assertStatus(422)
            ->assertJson([
                'status' => 'error',
                'message' => 'Este confronto com o mesmo mando já foi cadastrado.',
            ]);
    }

    public function test_finished_game_older_than_three_days_cannot_be_deleted(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $homeTeam = Team::factory()->create([
            'name' => 'Palmeiras',
            'slug' => 'palmeiras',
        ]);

        $awayTeam = Team::factory()->create([
            'name' => 'Corinthians',
            'slug' => 'corinthians',
        ]);

        $game = Game::factory()->create([
            'home_team_id' => $homeTeam->id,
            'away_team_id' => $awayTeam->id,
            'match_date' => now()->subDays(4),
            'home_score' => 2,
            'away_score' => 1,
            'status' => 'finished',
        ]);

        Sanctum::actingAs($admin);

        $response = $this->deleteJson("/api/games/{$game->id}");

        $response
            ->assertStatus(422)
            ->assertJson([
                'status' => 'error',
                'message' => 'Só é permitido excluir jogos finalizados nos últimos 3 dias.',
            ]);
    }

    public function test_admin_can_update_score_and_finish_game(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $homeTeam = Team::factory()->create([
            'name' => 'Palmeiras',
            'slug' => 'palmeiras',
        ]);

        $awayTeam = Team::factory()->create([
            'name' => 'Corinthians',
            'slug' => 'corinthians',
        ]);

        $game = Game::factory()->create([
            'home_team_id' => $homeTeam->id,
            'away_team_id' => $awayTeam->id,
            'match_date' => now()->subDay(),
            'home_score' => null,
            'away_score' => null,
            'status' => 'scheduled',
        ]);

        Sanctum::actingAs($admin);

        $response = $this->putJson("/api/games/{$game->id}/score", [
            'home_score' => 2,
            'away_score' => 1,
        ]);

        $response
            ->assertOk()
            ->assertJson([
                'status' => 'success',
                'message' => 'Placar lançado com sucesso.',
            ]);

        $this->assertDatabaseHas('games', [
            'id' => $game->id,
            'home_score' => 2,
            'away_score' => 1,
            'status' => 'finished',
        ]);
    }
}