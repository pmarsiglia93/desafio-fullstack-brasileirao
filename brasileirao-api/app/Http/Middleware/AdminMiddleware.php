<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuário não autenticado.',
            ], 401);
        }

        if ($user->role !== 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Acesso negado. Apenas administradores podem realizar esta ação.',
            ], 403);
        }

        return $next($request);
    }
}