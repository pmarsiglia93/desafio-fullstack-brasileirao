<?php

namespace Tests\Feature;

use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_and_receive_access_and_refresh_tokens(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@brasileirao.com',
            'password' => '12345678',
            'role' => 'admin',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'admin@brasileirao.com',
            'password' => '12345678',
        ]);

        $response
            ->assertOk()
            ->assertJsonStructure([
                'status',
                'message',
                'data' => [
                    'user',
                    'access_token',
                    'refresh_token',
                    'expires_in',
                    'token_type',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'email' => 'admin@brasileirao.com',
        ]);
    }

    public function test_user_can_refresh_token(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@brasileirao.com',
            'password' => '12345678',
            'role' => 'admin',
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email' => 'admin@brasileirao.com',
            'password' => '12345678',
        ]);

        $refreshToken = $loginResponse->json('data.refresh_token');

        $response = $this->postJson('/api/refresh', [
            'refresh_token' => $refreshToken,
        ]);

        $response
            ->assertOk()
            ->assertJsonStructure([
                'status',
                'message',
                'data' => [
                    'user',
                    'access_token',
                    'refresh_token',
                    'expires_in',
                    'token_type',
                ],
            ]);

        $this->assertNotNull($response->json('data.access_token'));
        $this->assertNotNull($response->json('data.refresh_token'));
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
        ]);
    }

    public function test_user_can_logout_and_refresh_tokens_are_revoked(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@brasileirao.com',
            'password' => '12345678',
            'role' => 'admin',
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email' => 'admin@brasileirao.com',
            'password' => '12345678',
        ]);

        $accessToken = $loginResponse->json('data.access_token');
        $refreshToken = $loginResponse->json('data.refresh_token');

        $logoutResponse = $this->withHeader('Authorization', 'Bearer ' . $accessToken)
            ->postJson('/api/logout');

        $logoutResponse
            ->assertOk()
            ->assertJson([
                'status' => 'success',
                'message' => 'Logout realizado com sucesso.',
            ]);

        $refreshResponse = $this->postJson('/api/refresh', [
            'refresh_token' => $refreshToken,
        ]);

        $refreshResponse
            ->assertStatus(401)
            ->assertJsonStructure([
                'status',
                'message',
            ]);

        $this->assertDatabaseCount('refresh_tokens', 0);
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        User::factory()->create([
            'email' => 'admin@brasileirao.com',
            'password' => '12345678',
            'role' => 'admin',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'admin@brasileirao.com',
            'password' => 'senha-errada',
        ]);

        $response
            ->assertStatus(401)
            ->assertJson([
                'status' => 'error',
                'message' => 'Credenciais inválidas.',
            ]);
    }
}