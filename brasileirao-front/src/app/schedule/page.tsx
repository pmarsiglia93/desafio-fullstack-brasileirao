"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

type ScheduledTeam = {
  id: number;
  name: string;
  logo_url: string | null;
};

type ScheduledGame = {
  id: number;
  match_date: string;
  home_team: ScheduledTeam;
  away_team: ScheduledTeam;
};

type ScheduleResponse = {
  status: string;
  data: ScheduledGame[];
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(isoDate: string): string {
  const time = new Date(isoDate).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return time === "00:00" ? "A definir" : time;
}

function TeamDisplay({
  team,
  align,
}: {
  team: ScheduledTeam;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      {team.logo_url ? (
        <img
          src={team.logo_url}
          alt={team.name}
          className="h-10 w-10 shrink-0 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-bold text-zinc-300">
          {team.name.charAt(0)}
        </div>
      )}
      <span
        className={`font-semibold text-white ${align === "right" ? "text-right" : "text-left"}`}
      >
        {team.name}
      </span>
    </div>
  );
}

export default function SchedulePage() {
  const [games, setGames] = useState<ScheduledGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest<ScheduleResponse>("/schedule");
        setGames(res.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar jogos.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, ScheduledGame[]>();

    for (const game of games) {
      const key = formatDate(game.match_date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(game);
    }

    return Array.from(groups.entries());
  }, [games]);

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl">
          <div className="border-b border-zinc-800 bg-gradient-to-r from-blue-600/20 via-zinc-900 to-emerald-600/20 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                  Campeonato Brasileiro 2026
                </p>
                <h1 className="text-3xl font-bold md:text-4xl">Próximos Jogos</h1>
                <p className="mt-2 text-sm text-zinc-400">
                  {loading
                    ? "Carregando..."
                    : `${games.length} jogos agendados · ${groupedByDate.length} datas`}
                </p>
              </div>

              <div className="flex gap-3">
                <Link
                  href="/standings"
                  className="inline-flex items-center justify-center rounded-lg bg-zinc-800 px-4 py-2 font-semibold transition hover:bg-zinc-700"
                >
                  Classificação
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-6 w-48 animate-pulse rounded bg-zinc-800" />
                <div className="h-20 animate-pulse rounded-xl bg-zinc-900" />
                <div className="h-20 animate-pulse rounded-xl bg-zinc-900" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && games.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
            Nenhum jogo agendado encontrado.
          </div>
        )}

        {/* Game groups */}
        {!loading && !error && groupedByDate.map(([date, dateGames]) => (
          <section key={date} className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-800" />
              <span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                {date}
              </span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            <div className="space-y-2">
              {dateGames.map((game) => (
                <div
                  key={game.id}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition hover:border-zinc-700 hover:bg-zinc-800/60"
                >
                  <TeamDisplay team={game.home_team} align="left" />

                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-bold text-zinc-500">
                      {formatTime(game.match_date)}
                    </span>
                    <span className="text-sm font-bold text-zinc-600">×</span>
                  </div>

                  <TeamDisplay team={game.away_team} align="right" />
                </div>
              ))}
            </div>
          </section>
        ))}

      </div>
    </main>
  );
}
