<?php

namespace Database\Seeders;

use App\Models\Team;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class TeamSeeder extends Seeder
{
    public function run(): void
    {
        $teams = [
            'Athletico Paranaense',
            'Atlético Mineiro',
            'Bahia',
            'Botafogo',
            'Chapecoense',
            'Corinthians',
            'Coritiba',
            'Cruzeiro',
            'Flamengo',
            'Fluminense',
            'Grêmio',
            'Internacional',
            'Mirassol',
            'Palmeiras',
            'Red Bull Bragantino',
            'Remo',
            'Santos',
            'São Paulo',
            'Vasco',
            'Vitória',
        ];

        foreach ($teams as $teamName) {
            Team::updateOrCreate(
                ['slug' => Str::slug($teamName)],
                [
                    'name' => $teamName,
                    'slug' => Str::slug($teamName),
                ]
            );
        }
    }
}