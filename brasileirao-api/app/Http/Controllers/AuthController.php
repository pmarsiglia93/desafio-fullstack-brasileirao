<?php

namespace App\Http\Controllers;

use App\Models\RefreshToken;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Registra um novo usuário comum.
     *
     * Cria um usuário com role `user` e já retorna os tokens de autenticação
     * necessários para acessar a API.
     */
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role' => 'user',
        ]);

        $authPayload = $this->issueAuthPayload($user);

        return response()->json([
            'status' => 'success',
            'message' => 'Usuário registrado com sucesso.',
            'data' => [
                'user' => $user,
                ...$authPayload,
            ],
        ], 201);
    }

    /**
     * Realiza login do usuário.
     *
     * Valida as credenciais, remove tokens antigos e retorna um novo access token
     * junto com um novo refresh token.
     */
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Credenciais inválidas.',
            ], 401);
        }

        $user->tokens()->delete();
        $user->refreshTokens()->delete();

        $authPayload = $this->issueAuthPayload($user);

        return response()->json([
            'status' => 'success',
            'message' => 'Login realizado com sucesso.',
            'data' => [
                'user' => $user,
                ...$authPayload,
            ],
        ]);
    }

    /**
     * Renova o access token usando refresh token.
     *
     * Invalida o refresh token anterior, remove tokens de acesso antigos
     * e devolve um novo par de tokens.
     */
    public function refresh(Request $request)
    {
        $data = $request->validate([
            'refresh_token' => ['required', 'string'],
        ]);

        $hashedToken = hash('sha256', $data['refresh_token']);

        $storedRefreshToken = RefreshToken::with('user')
            ->where('token_hash', $hashedToken)
            ->first();

        if (! $storedRefreshToken) {
            return response()->json([
                'status' => 'error',
                'message' => 'Refresh token inválido.',
            ], 401);
        }

        if ($storedRefreshToken->expires_at->isPast()) {
            $storedRefreshToken->delete();

            return response()->json([
                'status' => 'error',
                'message' => 'Refresh token expirado. Faça login novamente.',
            ], 401);
        }

        $user = $storedRefreshToken->user;

        if (! $user) {
            $storedRefreshToken->delete();

            return response()->json([
                'status' => 'error',
                'message' => 'Usuário do refresh token não encontrado.',
            ], 401);
        }

        $storedRefreshToken->delete();
        $user->tokens()->delete();

        $authPayload = $this->issueAuthPayload($user);

        return response()->json([
            'status' => 'success',
            'message' => 'Token renovado com sucesso.',
            'data' => [
                'user' => $user,
                ...$authPayload,
            ],
        ]);
    }

    /**
     * Retorna os dados do usuário autenticado.
     *
     * Endpoint protegido por bearer token.
     */
    public function me(Request $request)
    {
        return response()->json([
            'status' => 'success',
            'message' => 'Usuário autenticado.',
            'data' => $request->user(),
        ]);
    }

    /**
     * Realiza logout do usuário autenticado.
     *
     * Remove o token de acesso atual e também os refresh tokens associados ao usuário.
     */
    public function logout(Request $request)
    {
        $user = $request->user();

        if ($user?->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        $user?->refreshTokens()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Logout realizado com sucesso.',
        ]);
    }

    /**
     * Gera o payload de autenticação.
     *
     * Cria um access token do Sanctum e um refresh token persistido no banco.
     */
    private function issueAuthPayload(User $user): array
    {
        $accessTokenExpirationMinutes = (int) (config('sanctum.expiration') ?? 60);
        $refreshTokenExpirationDays = 7;

        $accessToken = $user->createToken('auth_token')->plainTextToken;

        $plainRefreshToken = Str::random(80);

        RefreshToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plainRefreshToken),
            'expires_at' => Carbon::now()->addDays($refreshTokenExpirationDays),
        ]);

        return [
            'access_token' => $accessToken,
            'refresh_token' => $plainRefreshToken,
            'expires_in' => $accessTokenExpirationMinutes * 60,
            'token_type' => 'Bearer',
        ];
    }
}