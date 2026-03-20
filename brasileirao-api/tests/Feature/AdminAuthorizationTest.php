<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_team(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/teams', [
            'name' => 'Palmeiras',
        ]);

        $response
            ->assertCreated()
            ->assertJson([
                'status' => 'success',
                'message' => 'Time criado com sucesso.',
            ]);

        $this->assertDatabaseHas('teams', [
            'name' => 'Palmeiras',
            'slug' => 'palmeiras',
        ]);
    }

    public function test_regular_user_cannot_create_team(): void
    {
        $user = User::factory()->create([
            'role' => 'user',
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/teams', [
            'name' => 'Palmeiras',
        ]);

        $response->assertStatus(403);
    }

    public function test_guest_cannot_access_protected_admin_route(): void
    {
        $response = $this->postJson('/api/teams', [
            'name' => 'Palmeiras',
        ]);

        $response->assertStatus(401);
    }
}