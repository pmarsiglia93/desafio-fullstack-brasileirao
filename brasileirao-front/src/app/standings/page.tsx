"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getUser, type AuthUser } from "@/lib/auth";

type StandingItem = {
  team_id?: number;
  id?: number;
  name?: string;
  team_name?: string;
  team?: {
    id?: number;
    name?: string;
  };
  points?: number;
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goals_for?: number;
  goals_against?: number;
  goal_difference?: number;
};

type StandingsResponse =
  | StandingItem[]
  | {
      data?: StandingItem[];
      standings?: StandingItem[];
      table?: StandingItem[];
      classification?: StandingItem[];
    };

type ClassifiedStandingItem = StandingItem & {
  position: number;
  resolvedName: string;
  pointsValue: number;
  playedValue: number;
  winsValue: number;
  drawsValue: number;
  lossesValue: number;
  goalsForValue: number;
  goalsAgainstValue: number;
  goalDifferenceValue: number;
  performance: number;
};

function normalizeStandings(data: StandingsResponse): StandingItem[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.standings)) {
    return data.standings;
  }

  if (Array.isArray(data?.table)) {
    return data.table;
  }

  if (Array.isArray(data?.classification)) {
    return data.classification;
  }

  return [];
}

function getResolvedTeamName(item: StandingItem) {
  return item.name ?? item.team_name ?? item.team?.name ?? "Time";
}

function getZoneStyles(position: number) {
  if (position <= 4) {
    return {
      bar: "bg-blue-500",
      badge: "bg-blue-500/15 text-blue-300 border border-blue-500/20",
      label: "Libertadores",
    };
  }

  if (position <= 6) {
    return {
      bar: "bg-emerald-500",
      badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
      label: "Pré-Libertadores",
    };
  }

  if (position <= 12) {
    return {
      bar: "bg-cyan-500",
      badge: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20",
      label: "Sul-Americana",
    };
  }

  if (position >= 17) {
    return {
      bar: "bg-red-500",
      badge: "bg-red-500/15 text-red-300 border border-red-500/20",
      label: "Rebaixamento",
    };
  }

  return {
    bar: "bg-zinc-600",
    badge: "bg-zinc-800 text-zinc-300 border border-zinc-700",
    label: "Meio da tabela",
  };
}

function formatPerformance(points: number, played: number) {
  if (played <= 0) return "0%";

  const maxPoints = played * 3;
  const performance = (points / maxPoints) * 100;

  return `${performance.toFixed(0)}%`;
}

export default function StandingsPage() {
  const [standings, setStandings] = useState<StandingItem[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCurrentUser(getUser());

    async function loadStandings() {
      try {
        const response = await apiRequest<StandingsResponse>("/standings");
        const normalized = normalizeStandings(response);
        setStandings(normalized);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Erro ao carregar classificação.";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    void loadStandings();
  }, []);

  const enrichedStandings = useMemo<ClassifiedStandingItem[]>(() => {
    return standings.map((item, index) => {
      const pointsValue = item.points ?? 0;
      const playedValue = item.played ?? 0;
      const winsValue = item.wins ?? 0;
      const drawsValue = item.draws ?? 0;
      const lossesValue = item.losses ?? 0;
      const goalsForValue = item.goals_for ?? 0;
      const goalsAgainstValue = item.goals_against ?? 0;
      const goalDifferenceValue = item.goal_difference ?? 0;

      return {
        ...item,
        position: index + 1,
        resolvedName: getResolvedTeamName(item),
        pointsValue,
        playedValue,
        winsValue,
        drawsValue,
        lossesValue,
        goalsForValue,
        goalsAgainstValue,
        goalDifferenceValue,
        performance:
          playedValue > 0 ? Number(((pointsValue / (playedValue * 3)) * 100).toFixed(0)) : 0,
      };
    });
  }, [standings]);

  const topTeam = enrichedStandings[0] ?? null;
  const libertadoresCount = enrichedStandings.filter((item) => item.position <= 6).length;
  const relegationCount = enrichedStandings.filter((item) => item.position >= 17).length;

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl">
          <div className="border-b border-zinc-800 bg-gradient-to-r from-emerald-600/20 via-zinc-900 to-blue-600/20 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                  Campeonato Brasileiro
                </p>
                <h1 className="text-3xl font-bold md:text-4xl">Classificação</h1>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  Visualização da tabela com desempenho dos times, zonas de classificação e
                  destaque das faixas mais importantes do campeonato.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {currentUser?.role === "admin" ? (
                  <Link
                    href="/admin"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 font-semibold transition hover:bg-blue-500"
                  >
                    Voltar para admin
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-lg bg-zinc-800 px-4 py-2 font-semibold transition hover:bg-zinc-700"
                  >
                    Fazer login
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Líder atual</p>
              <p className="mt-2 text-lg font-bold text-white">
                {topTeam ? topTeam.resolvedName : "-"}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {topTeam ? `${topTeam.pointsValue} pts` : "Sem dados"}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Vaga Libertadores</p>
              <p className="mt-2 text-lg font-bold text-white">{libertadoresCount}</p>
              <p className="mt-1 text-sm text-zinc-400">Top 6 destacados</p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Zona de queda</p>
              <p className="mt-2 text-lg font-bold text-white">{relegationCount}</p>
              <p className="mt-1 text-sm text-zinc-400">Últimos 4 colocados</p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Times na tabela</p>
              <p className="mt-2 text-lg font-bold text-white">{enrichedStandings.length}</p>
              <p className="mt-1 text-sm text-zinc-400">Classificação geral</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 md:p-6">
          <div className="mb-4 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              Libertadores
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Pré-Libertadores
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
              Sul-Americana
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              Rebaixamento
            </span>
          </div>

          {loading && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6 text-zinc-300">
              Carregando classificação...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && enrichedStandings.length === 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6 text-zinc-300">
              Nenhum dado de classificação encontrado.
            </div>
          )}

          {!loading && !error && enrichedStandings.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="min-w-full bg-zinc-900">
                <thead className="bg-zinc-800/95 text-left text-xs uppercase tracking-wide text-zinc-300">
                  <tr>
                    <th className="px-3 py-4">#</th>
                    <th className="px-3 py-4">Time</th>
                    <th className="px-3 py-4 text-center">Pts</th>
                    <th className="px-3 py-4 text-center">J</th>
                    <th className="px-3 py-4 text-center">V</th>
                    <th className="px-3 py-4 text-center">E</th>
                    <th className="px-3 py-4 text-center">D</th>
                    <th className="px-3 py-4 text-center">GP</th>
                    <th className="px-3 py-4 text-center">GC</th>
                    <th className="px-3 py-4 text-center">SG</th>
                    <th className="px-3 py-4 text-center">%</th>
                    <th className="px-3 py-4">Zona</th>
                  </tr>
                </thead>

                <tbody>
                  {enrichedStandings.map((item) => {
                    const zone = getZoneStyles(item.position);

                    return (
                      <tr
                        key={item.team_id ?? item.id ?? item.team?.id ?? item.position}
                        className="border-t border-zinc-800 transition hover:bg-zinc-800/40"
                      >
                        <td className="w-16 px-3 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`h-10 w-1 rounded-full ${zone.bar}`} />
                            <span className="text-sm font-semibold text-zinc-200">
                              {item.position}
                            </span>
                          </div>
                        </td>

                        <td className="min-w-[240px] px-3 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">
                              {item.resolvedName}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {formatPerformance(item.pointsValue, item.playedValue)} de aproveitamento
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-4 text-center text-base font-bold text-white">
                          {item.pointsValue}
                        </td>
                        <td className="px-3 py-4 text-center text-zinc-300">
                          {item.playedValue}
                        </td>
                        <td className="px-3 py-4 text-center text-zinc-300">
                          {item.winsValue}
                        </td>
                        <td className="px-3 py-4 text-center text-zinc-300">
                          {item.drawsValue}
                        </td>
                        <td className="px-3 py-4 text-center text-zinc-300">
                          {item.lossesValue}
                        </td>
                        <td className="px-3 py-4 text-center text-zinc-300">
                          {item.goalsForValue}
                        </td>
                        <td className="px-3 py-4 text-center text-zinc-300">
                          {item.goalsAgainstValue}
                        </td>
                        <td
                          className={`px-3 py-4 text-center font-semibold ${
                            item.goalDifferenceValue > 0
                              ? "text-emerald-300"
                              : item.goalDifferenceValue < 0
                                ? "text-red-300"
                                : "text-zinc-300"
                          }`}
                        >
                          {item.goalDifferenceValue > 0
                            ? `+${item.goalDifferenceValue}`
                            : item.goalDifferenceValue}
                        </td>
                        <td className="px-3 py-4 text-center text-zinc-300">
                          {item.performance}%
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${zone.badge}`}
                          >
                            {zone.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}