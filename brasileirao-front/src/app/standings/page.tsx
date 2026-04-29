"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getUser, type AuthUser } from "@/lib/auth";

type AiChampion = {
  team: string;
  points: number;
  performance_pct: number;
  justification: string;
};

type AiTeamEntry = {
  position: number;
  team: string;
  points: number;
  risk_level?: string;
};

type AiBestPerformer = {
  team: string;
  metric: string;
  detail: string;
};

type AiTeamAtRisk = {
  team: string;
  detail: string;
};

type AiAnalysisData = {
  generated_at: string;
  games_analyzed: number;
  champion: AiChampion | null;
  libertadores: AiTeamEntry[];
  pre_libertadores: AiTeamEntry[];
  sul_americana: AiTeamEntry[];
  relegation: AiTeamEntry[];
  best_performers: AiBestPerformer[];
  teams_at_risk: AiTeamAtRisk[];
  campaign_comparison: string;
  full_analysis: string;
  disclaimer: string;
};

type AiAnalysisResponse = {
  status: string;
  data: AiAnalysisData;
};

type StandingItem = {
  team_id?: number;
  id?: number;
  name?: string;
  team_name?: string;
  logo_url?: string | null;
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
  form?: string[];
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
  formValue: string[];
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

function getFormStyle(result: string) {
  if (result === "V") return "bg-emerald-500 text-white";
  if (result === "E") return "bg-zinc-500 text-white";
  return "bg-red-500 text-white";
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
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

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

  async function loadAiAnalysis() {
    setAiLoading(true);
    setAiError("");
    setAiAnalysis(null);
    try {
      const response = await apiRequest<AiAnalysisResponse>("/ai/standings-analysis");
      setAiAnalysis(response.data);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Erro ao gerar análise.");
    } finally {
      setAiLoading(false);
    }
  }

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
        formValue: item.form ?? [],
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
                <Link
                  href="/schedule"
                  className="inline-flex items-center justify-center rounded-lg bg-zinc-800 px-4 py-2 font-semibold transition hover:bg-zinc-700"
                >
                  Próximos Jogos
                </Link>

                {currentUser?.role === "admin" ? (
                  <Link
                    href="/admin"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 font-semibold transition hover:bg-blue-500"
                  >
                    Painel Admin
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 font-semibold transition hover:bg-emerald-600"
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
                    <th className="px-3 py-4">Forma</th>
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
                          <div className="flex items-center gap-3">
                            {item.logo_url ? (
                              <img
                                src={item.logo_url}
                                alt={item.resolvedName}
                                className="h-8 w-8 shrink-0 object-contain"
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                              />
                            ) : (
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
                                {item.resolvedName.charAt(0)}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="font-semibold text-white">
                                {item.resolvedName}
                              </span>
                              <span className="text-xs text-zinc-500">
                                {formatPerformance(item.pointsValue, item.playedValue)} de aproveitamento
                              </span>
                            </div>
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
                          <div className="flex gap-1">
                            {item.formValue.map((result, i) => (
                              <span
                                key={i}
                                title={result === "V" ? "Vitória" : result === "E" ? "Empate" : "Derrota"}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${getFormStyle(result)}`}
                              >
                                {result}
                              </span>
                            ))}
                            {item.formValue.length === 0 && (
                              <span className="text-xs text-zinc-600">—</span>
                            )}
                          </div>
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
        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 bg-gradient-to-r from-violet-600/15 via-zinc-900 to-indigo-600/15 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                  Powered by Gemini AI
                </p>
                <h2 className="text-2xl font-bold">Análise Inteligente</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Previsões e insights gerados com base nos dados reais do campeonato.
                </p>
              </div>
              <button
                onClick={() => void loadAiAnalysis()}
                disabled={aiLoading}
                className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aiLoading ? "Analisando..." : aiAnalysis ? "Atualizar análise" : "Gerar análise"}
              </button>
            </div>
          </div>

          <div className="p-4 md:p-6">
            {!aiAnalysis && !aiLoading && !aiError && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-8 text-center">
                <p className="text-zinc-400">
                  Clique em{" "}
                  <strong className="text-white">Gerar análise</strong> para receber previsões e
                  insights baseados na tabela atual.
                </p>
              </div>
            )}

            {aiLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-800/60" />
                ))}
              </div>
            )}

            {!aiLoading && aiError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
                {aiError}
              </div>
            )}

            {!aiLoading && aiAnalysis && (
              <div className="space-y-6">
                {aiAnalysis.champion && (
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Possível Campeão
                    </p>
                    <div className="rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-zinc-900 to-yellow-500/5 p-5">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                        <span className="text-2xl font-bold text-yellow-300">
                          {aiAnalysis.champion.team}
                        </span>
                        <span className="text-sm text-zinc-400">
                          {aiAnalysis.champion.points} pts &middot;{" "}
                          {aiAnalysis.champion.performance_pct}% de aproveitamento
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                        {aiAnalysis.champion.justification}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-blue-400">
                      Libertadores
                    </p>
                    <ul className="space-y-2">
                      {aiAnalysis.libertadores.map((t) => (
                        <li key={t.team} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">{t.position}.</span>
                            <span className="text-white">{t.team}</span>
                          </span>
                          <span className="text-zinc-400">{t.points} pts</span>
                        </li>
                      ))}
                      {aiAnalysis.pre_libertadores.map((t) => (
                        <li
                          key={t.team}
                          className="flex items-center justify-between text-sm opacity-75"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">{t.position}.</span>
                            <span className="text-emerald-300">{t.team}</span>
                          </span>
                          <span className="text-zinc-400">{t.points} pts</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-400">
                      Sul-Americana
                    </p>
                    <ul className="space-y-2">
                      {aiAnalysis.sul_americana.map((t) => (
                        <li key={t.team} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">{t.position}.</span>
                            <span className="text-white">{t.team}</span>
                          </span>
                          <span className="text-zinc-400">{t.points} pts</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-red-400">
                      Zona de Rebaixamento
                    </p>
                    <ul className="space-y-2">
                      {aiAnalysis.relegation.map((t) => (
                        <li key={t.team} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">{t.position}.</span>
                            <span className="text-white">{t.team}</span>
                          </span>
                          <span className="text-zinc-400">{t.points} pts</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {aiAnalysis.best_performers && aiAnalysis.best_performers.length > 0 && (
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Destaques
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {aiAnalysis.best_performers.map((p, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            {p.metric}
                          </p>
                          <p className="mt-1 font-bold text-white">{p.team}</p>
                          <p className="mt-0.5 text-sm text-zinc-400">{p.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnalysis.teams_at_risk && aiAnalysis.teams_at_risk.length > 0 && (
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Times em Risco
                    </p>
                    <ul className="space-y-2">
                      {aiAnalysis.teams_at_risk.map((t, i) => (
                        <li
                          key={i}
                          className="flex flex-col gap-0.5 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 text-sm"
                        >
                          <span className="font-semibold text-orange-300">{t.team}</span>
                          <span className="text-zinc-400">{t.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiAnalysis.campaign_comparison && (
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Comparativo de Campanhas
                    </p>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
                      <p className="text-sm leading-relaxed text-zinc-300">
                        {aiAnalysis.campaign_comparison}
                      </p>
                    </div>
                  </div>
                )}

                {aiAnalysis.full_analysis && (
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Análise Completa
                    </p>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
                      <p className="text-sm leading-relaxed text-zinc-300">
                        {aiAnalysis.full_analysis}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-1 border-t border-zinc-800 pt-4">
                  {aiAnalysis.disclaimer && (
                    <p className="text-xs italic text-zinc-600">{aiAnalysis.disclaimer}</p>
                  )}
                  <p className="text-xs text-zinc-600">
                    Análise gerada em{" "}
                    {new Date(aiAnalysis.generated_at).toLocaleString("pt-BR")} &middot;{" "}
                    {aiAnalysis.games_analyzed} jogo
                    {aiAnalysis.games_analyzed !== 1 ? "s" : ""} analisado
                    {aiAnalysis.games_analyzed !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}