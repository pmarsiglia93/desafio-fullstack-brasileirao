<?php

namespace App\Console\Commands;

use App\Models\Game;
use App\Models\Team;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class SyncBrasileirao extends Command
{
    protected $signature = 'sync:brasileirao
                            {--season=2026 : Temporada a sincronizar}
                            {--fresh : Apaga todos os jogos e sincroniza tudo do zero}';

    protected $description = 'Sincroniza times e partidas do Campeonato Brasileiro via Football-Data.org';

    private const BASE_URL = 'https://api.football-data.org/v4';
    private const COMPETITION = 'BSA';

    /**
     * Mapeamento de nomes curtos da API para nomes no banco de dados local.
     * Necessário quando a API retorna nomes diferentes dos cadastrados no seeder.
     */
    private const TEAM_ALIASES = [
        'Mineiro'       => ['Atlético Mineiro', 'Atletico Mineiro'],
        'Paranaense'    => ['Athletico Paranaense', 'Athletico-PR'],
        'Vasco da Gama' => ['Vasco', 'CR Vasco da Gama'],
        'Clube do Remo' => ['Remo', 'CR Remo'],
    ];

    public function handle(): int
    {
        $apiKey = config('services.footballdata.key');

        if (empty($apiKey)) {
            $this->error('FOOTBALLDATA_API_KEY não configurada. Adicione ao arquivo .env do backend.');
            return self::FAILURE;
        }

        $season = (int) $this->option('season');
        $fresh = $this->option('fresh');

        $this->info("Campeonato Brasileiro Série A — Temporada {$season}");
        $this->newLine();

        if ($fresh) {
            $this->warn('Modo --fresh: removendo todos os jogos existentes...');
            Game::query()->delete();
            $this->line('  Jogos removidos.');
            $this->newLine();
        }

        $apiTeams = $this->fetchTeams($season, $apiKey);

        if (empty($apiTeams)) {
            return self::FAILURE;
        }

        $teamMap = $this->syncTeams($apiTeams, $fresh);

        $this->newLine();

        $this->syncMatches($season, $apiKey, $teamMap);

        $this->newLine();
        $this->info('Sincronização concluída!');

        return self::SUCCESS;
    }

    private function fetchTeams(int $season, string $apiKey): array
    {
        $this->line('<fg=cyan>Buscando times do Brasileirão ' . $season . '...</>');

        $data = $this->get('/competitions/' . self::COMPETITION . '/teams', ['season' => $season], $apiKey);

        if (empty($data['teams'])) {
            $this->error('Nenhum time retornado. Verifique se o plano cobre o Brasileirão (BSA).');
            return [];
        }

        return $data['teams'];
    }

    private function syncTeams(array $apiTeams, bool $fresh): array
    {
        $teamMap = [];

        foreach ($apiTeams as $apiTeam) {
            $apiId = $apiTeam['id'];
            $shortName = $apiTeam['shortName'] ?? $apiTeam['name'];
            $fullName = $apiTeam['name'];

            $local = $this->findOrCreateTeam($shortName, $fullName);
            $teamMap[$apiId] = $local->id;

            $crest = $apiTeam['crest'] ?? null;
            if ($crest && $local->logo_url !== $crest) {
                $local->update(['logo_url' => $crest]);
            }

            $indicator = $local->wasRecentlyCreated ? '<fg=yellow>criado</>' : '<fg=green>ok</>';
            $this->line("  [{$indicator}] {$shortName}");
        }

        // Em modo fresh, remove times do banco que não pertencem ao Brasileirão desta temporada
        if ($fresh) {
            $idsToKeep = array_values($teamMap);
            $removed = Team::whereNotIn('id', $idsToKeep)->delete();

            if ($removed > 0) {
                $this->line("  <fg=red>Removidos {$removed} time(s) que não pertencem a esta temporada.</>");
            }
        }

        $this->line('  Total: ' . count($teamMap) . ' times sincronizados.');

        return $teamMap;
    }

    private function syncMatches(int $season, string $apiKey, array $teamMap): void
    {
        $this->line('<fg=cyan>Buscando partidas do Brasileirão ' . $season . '...</>');

        $data = $this->get('/competitions/' . self::COMPETITION . '/matches', ['season' => $season], $apiKey);

        if (empty($data['matches'])) {
            $this->warn('Nenhuma partida retornada pela API.');
            return;
        }

        $created = 0;
        $updated = 0;
        $skipped = 0;

        foreach ($data['matches'] as $match) {
            $apiHomeId = $match['homeTeam']['id'];
            $apiAwayId = $match['awayTeam']['id'];
            $status = $match['status'];

            if (in_array($status, ['CANCELLED', 'VOIDED'])) {
                $skipped++;
                continue;
            }

            $homeId = $teamMap[$apiHomeId] ?? null;
            $awayId = $teamMap[$apiAwayId] ?? null;

            if (! $homeId || ! $awayId) {
                $skipped++;
                continue;
            }

            $isFinished = in_array($status, ['FINISHED', 'AWARDED']);
            $homeGoals = $match['score']['fullTime']['home'] ?? null;
            $awayGoals = $match['score']['fullTime']['away'] ?? null;
            $matchDate = date('Y-m-d H:i:s', strtotime($match['utcDate']));

            $existing = Game::where('home_team_id', $homeId)
                ->where('away_team_id', $awayId)
                ->first();

            if ($existing) {
                if ($isFinished && $existing->status !== 'finished') {
                    $existing->update([
                        'home_score' => $homeGoals,
                        'away_score' => $awayGoals,
                        'status' => 'finished',
                        'match_date' => $matchDate,
                    ]);
                    $updated++;
                } else {
                    $skipped++;
                }
            } else {
                Game::create([
                    'home_team_id' => $homeId,
                    'away_team_id' => $awayId,
                    'match_date' => $matchDate,
                    'home_score' => $isFinished ? $homeGoals : null,
                    'away_score' => $isFinished ? $awayGoals : null,
                    'status' => $isFinished ? 'finished' : 'scheduled',
                ]);
                $created++;
            }
        }

        $total = count($data['matches']);
        $this->line("  Total na API: {$total} | Criadas: {$created} | Atualizadas: {$updated} | Ignoradas: {$skipped}");
    }

    private function findOrCreateTeam(string $shortName, string $fullName): Team
    {
        // 1. Correspondência exata pelo nome curto da API
        $team = Team::where('name', $shortName)->first();
        if ($team) {
            return $team;
        }

        // 2. Aliases explícitos para nomes que diferem entre API e banco
        $aliases = self::TEAM_ALIASES[$shortName] ?? [];
        foreach ($aliases as $alias) {
            $team = Team::where('name', $alias)->first()
                ?? Team::where('slug', Str::slug($alias))->first();
            if ($team) {
                return $team;
            }
        }

        // 3. Correspondência por slug
        $team = Team::where('slug', Str::slug($shortName))->first();
        if ($team) {
            return $team;
        }

        // 4. Correspondência normalizada (ignora acentos e siglas comuns)
        $normalizedShort = $this->normalizeName($shortName);
        $normalizedFull = $this->normalizeName($fullName);

        $team = Team::all()->first(function ($t) use ($normalizedShort, $normalizedFull) {
            $n = $this->normalizeName($t->name);
            return $n === $normalizedShort || $n === $normalizedFull;
        });

        if ($team) {
            return $team;
        }

        // 5. Cria novo time se não encontrou correspondência
        return Team::create([
            'name' => $shortName,
            'slug' => Str::slug($shortName),
        ]);
    }

    private function normalizeName(string $name): string
    {
        $name = mb_strtolower($name, 'UTF-8');
        $name = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
        $name = preg_replace('/\b(fc|sc|cr|ec|se|sa|afc|cf|rb|red bull|foot.ball|football|clube|club)\b/', '', $name);
        $name = preg_replace('/[^a-z0-9\s]/', '', $name);
        $name = preg_replace('/\s+/', ' ', trim($name));

        return $name;
    }

    private function get(string $endpoint, array $params, string $apiKey): array
    {
        $response = Http::timeout(20)
            ->withHeaders(['X-Auth-Token' => $apiKey])
            ->get(self::BASE_URL . $endpoint, $params);

        if (! $response->successful()) {
            $status = $response->status();
            $msg = $response->json('message') ?? $response->body();

            if ($status === 403) {
                $this->error('Acesso negado (403). O plano gratuito pode não cobrir o Brasileirão (BSA).');
            } else {
                $this->error("Erro na API [{$status}]: {$msg}");
            }

            return [];
        }

        return $response->json() ?? [];
    }
}
