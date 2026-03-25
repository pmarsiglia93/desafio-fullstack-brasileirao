<?php

namespace App\Http\Controllers;

use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TeamController extends Controller
{
    /**
     * Lista todos os times cadastrados.
     *
     * Endpoint protegido por autenticação.
     */
    public function index()
    {
        $teams = Team::orderBy('name')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Times listados com sucesso.',
            'data' => $teams,
        ]);
    }

    /**
     * Cria um novo time.
     *
     * Endpoint restrito a administradores.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:teams,name'],
            'logo_url' => ['nullable', 'url'],
        ]);

        $team = Team::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'logo_url' => $data['logo_url'] ?? null,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Time criado com sucesso.',
            'data' => $team,
        ], 201);
    }

    /**
     * Atualiza um time existente.
     *
     * Endpoint restrito a administradores.
     */
    public function update(Request $request, Team $team)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:teams,name,' . $team->id],
            'logo_url' => ['nullable', 'url'],
        ]);

        $team->update([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'logo_url' => $data['logo_url'] ?? null,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Time atualizado com sucesso.',
            'data' => $team,
        ]);
    }

    /**
     * Remove um time.
     *
     * Endpoint restrito a administradores.
     * Não é permitido remover um time que possui jogos cadastrados.
     */
    public function destroy(Team $team)
    {
        $hasGames = $team->homeGames()->exists() || $team->awayGames()->exists();

        if ($hasGames) {
            return response()->json([
                'status' => 'error',
                'message' => 'Não é possível remover um time que possui jogos cadastrados.',
            ], 422);
        }

        $team->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Time removido com sucesso.',
        ]);
    }
}