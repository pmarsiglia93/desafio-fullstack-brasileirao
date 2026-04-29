"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import {
  getToken,
  getUser,
  removeAuth,
  saveUser,
  type AuthUser,
} from "@/lib/auth";

type Team = {
  id: number;
  name: string;
  logo_url?: string | null;
};

type Game = {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  match_date?: string;
  status?: string;
  home_team?: Team;
  away_team?: Team;
  homeTeam?: Team;
  awayTeam?: Team;
};

type AlertType = "success" | "error" | "info";

type PaginationMeta = {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
};

type MeResponse = {
  status?: string;
  message?: string;
  data?: {
    id?: number;
    name?: string;
    email?: string;
    role?: string;
    user?: {
      id?: number;
      name?: string;
      email?: string;
      role?: string;
    };
  };
};

function extractUserFromMe(response: MeResponse): AuthUser | null {
  const nestedUser = response?.data?.user;

  if (nestedUser) {
    return {
      id: nestedUser.id,
      name: nestedUser.name,
      email: nestedUser.email,
      role: nestedUser.role,
    };
  }

  if (response?.data) {
    return {
      id: response.data.id,
      name: response.data.name,
      email: response.data.email,
      role: response.data.role,
    };
  }

  return null;
}

function extractArrayFromUnknown<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;

    const directKeys = [
      "data",
      "teams",
      "games",
      "items",
      "results",
      "rows",
      "list",
    ];

    for (const key of directKeys) {
      if (Array.isArray(obj[key])) {
        return obj[key] as T[];
      }
    }

    for (const key of directKeys) {
      const nested = obj[key];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        const nestedObj = nested as Record<string, unknown>;

        for (const nestedKey of directKeys) {
          if (Array.isArray(nestedObj[nestedKey])) {
            return nestedObj[nestedKey] as T[];
          }
        }
      }
    }
  }

  return [];
}

function extractPaginationMeta(value: unknown): PaginationMeta {
  const fallback: PaginationMeta = {
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  };

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const obj = value as Record<string, unknown>;
  const dataObj =
    obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : null;

  const source = dataObj ?? obj;

  const currentPage =
    typeof source.current_page === "number" ? source.current_page : 1;
  const lastPage = typeof source.last_page === "number" ? source.last_page : 1;
  const perPage = typeof source.per_page === "number" ? source.per_page : 10;
  const total =
    typeof source.total === "number"
      ? source.total
      : Array.isArray(source.data)
        ? source.data.length
        : 0;

  return {
    currentPage,
    lastPage,
    perPage,
    total,
  };
}

function normalizeTeams(response: unknown): Team[] {
  return extractArrayFromUnknown<Team>(response);
}

function normalizeGames(response: unknown): Game[] {
  return extractArrayFromUnknown<Game>(response);
}

function formatDateTimeForLaravel(value: string) {
  if (!value) return "";
  return `${value.replace("T", " ")}:00`;
}

function formatGameDate(value?: string) {
  if (!value) return "-";

  const normalized = value.replace("T", " ").replace(".000000Z", "");

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  }

  return normalized;
}

function getHomeTeamName(game: Game) {
  return (
    game.home_team?.name ?? game.homeTeam?.name ?? `Time ${game.home_team_id}`
  );
}

function getAwayTeamName(game: Game) {
  return (
    game.away_team?.name ?? game.awayTeam?.name ?? `Time ${game.away_team_id}`
  );
}

function getStatusLabel(status?: string) {
  if (status === "finished") return "Finalizado";
  if (status === "scheduled") return "Agendado";
  return status ?? "-";
}

function getStatusClasses(status?: string) {
  if (status === "finished") {
    return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
  }

  if (status === "scheduled") {
    return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
  }

  return "bg-zinc-800 text-zinc-300 border border-zinc-700";
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function canDeleteGame(game: Game) {
  if (game.status !== "finished" || !game.match_date) {
    return false;
  }

  const gameDate = new Date(game.match_date);
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - 3);

  return gameDate >= limitDate;
}

export default function AdminPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<AlertType>("info");

  const [isAuthorizing, setIsAuthorizing] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTeamsLoading, setIsTeamsLoading] = useState(false);
  const [isGamesLoading, setIsGamesLoading] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isUpdatingScore, setIsUpdatingScore] = useState(false);
  const [deletingGameId, setDeletingGameId] = useState<number | null>(null);

  const [teamName, setTeamName] = useState("");

  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [matchDate, setMatchDate] = useState("");

  const [scoreGameId, setScoreGameId] = useState("");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");

  const [gameTeamFilter, setGameTeamFilter] = useState("");
  const [gameStartDateFilter, setGameStartDateFilter] = useState("");
  const [gameEndDateFilter, setGameEndDateFilter] = useState("");
  const [currentGamesPage, setCurrentGamesPage] = useState(1);

  const [gamesPagination, setGamesPagination] = useState<PaginationMeta>({
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });

  const isSubmitting = isCreatingTeam || isCreatingGame || isUpdatingScore;

  function showMessage(text: string, type: AlertType = "info") {
    setMessage(text);
    setMessageType(type);
  }

  function clearMessage() {
    setMessage("");
    setMessageType("info");
  }

  function buildGamesQuery(page = 1) {
    const params = new URLSearchParams();

    params.set("page", String(page));

    if (gameTeamFilter.trim()) {
      params.set("team", gameTeamFilter.trim());
    }

    if (gameStartDateFilter) {
      params.set("start_date", gameStartDateFilter);
    }

    if (gameEndDateFilter) {
      params.set("end_date", gameEndDateFilter);
    }

    return `/games?${params.toString()}`;
  }

  async function loadTeams(options?: { preserveMessage?: boolean }) {
    const token = getToken();

    if (!token) {
      throw new Error("Sessão inválida. Faça login novamente.");
    }

    setIsTeamsLoading(true);

    try {
      const teamsResponse = await apiRequest<unknown>("/teams", { token });
      const normalizedTeams = normalizeTeams(teamsResponse);
      setTeams(normalizedTeams);

      if (!options?.preserveMessage) {
        clearMessage();
      }
    } finally {
      setIsTeamsLoading(false);
    }
  }

  async function loadGames(
    page = 1,
    options?: { preserveMessage?: boolean; silent?: boolean }
  ) {
    const token = getToken();

    if (!token) {
      throw new Error("Sessão inválida. Faça login novamente.");
    }

    setIsGamesLoading(true);

    try {
      const gamesResponse = await apiRequest<unknown>(buildGamesQuery(page), {
        token,
      });

      const normalizedGames = normalizeGames(gamesResponse);
      const pagination = extractPaginationMeta(gamesResponse);

      setGames(normalizedGames);
      setGamesPagination(pagination);
      setCurrentGamesPage(pagination.currentPage || page);

      if (!options?.preserveMessage && !options?.silent) {
        clearMessage();
      }
    } finally {
      setIsGamesLoading(false);
    }
  }

  async function loadData(options?: { preserveMessage?: boolean }) {
    setIsInitialLoading(true);

    try {
      await Promise.all([
        loadTeams({ preserveMessage: true }),
        loadGames(currentGamesPage, { preserveMessage: true, silent: true }),
      ]);

      if (!options?.preserveMessage) {
        clearMessage();
      }
    } finally {
      setIsInitialLoading(false);
    }
  }

  useEffect(() => {
    async function authorizeAndLoadAdmin() {
      const token = getToken();

      if (!token) {
        removeAuth();
        router.replace("/login");
        return;
      }

      try {
        const meResponse = await apiRequest<MeResponse>("/me", {
          token,
          retryOnAuthFail: true,
        });

        const resolvedUser = extractUserFromMe(meResponse) ?? getUser();

        if (!resolvedUser) {
          throw new Error("Não foi possível identificar o usuário autenticado.");
        }

        saveUser(resolvedUser);
        setCurrentUser(resolvedUser);

        if (resolvedUser.role !== "admin") {
          router.replace("/standings");
          return;
        }

        await loadData({ preserveMessage: true });
      } catch {
        removeAuth();
        router.replace("/login");
        return;
      } finally {
        setIsAuthorizing(false);
      }
    }

    void authorizeAndLoadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessage();
    setIsCreatingTeam(true);

    try {
      const token = getToken();

      if (!token) {
        throw new Error("Faça login antes de criar um time.");
      }

      await apiRequest("/teams", {
        method: "POST",
        token,
        body: {
          name: teamName,
        },
      });

      setTeamName("");
      await loadTeams({ preserveMessage: true });
      showMessage("Time criado com sucesso.", "success");
    } catch (error) {
      showMessage(extractErrorMessage(error, "Erro ao criar time."), "error");
    } finally {
      setIsCreatingTeam(false);
    }
  }

  async function handleCreateGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessage();
    setIsCreatingGame(true);

    try {
      const token = getToken();

      if (!token) {
        throw new Error("Faça login antes de criar um jogo.");
      }

      if (!homeTeamId || !awayTeamId || !matchDate) {
        throw new Error("Preencha mandante, visitante e data do jogo.");
      }

      if (homeTeamId === awayTeamId) {
        throw new Error("Mandante e visitante não podem ser o mesmo time.");
      }

      await apiRequest("/games", {
        method: "POST",
        token,
        body: {
          home_team_id: Number(homeTeamId),
          away_team_id: Number(awayTeamId),
          match_date: formatDateTimeForLaravel(matchDate),
        },
      });

      setHomeTeamId("");
      setAwayTeamId("");
      setMatchDate("");

      await loadGames(1, { preserveMessage: true, silent: true });
      showMessage("Jogo criado com sucesso.", "success");
    } catch (error) {
      showMessage(extractErrorMessage(error, "Erro ao criar jogo."), "error");
    } finally {
      setIsCreatingGame(false);
    }
  }

  async function handleSetScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessage();
    setIsUpdatingScore(true);

    try {
      const token = getToken();

      if (!token) {
        throw new Error("Faça login antes de lançar placar.");
      }

      if (!scoreGameId) {
        throw new Error("Selecione um jogo para lançar o placar.");
      }

      if (homeScore === "" || awayScore === "") {
        throw new Error("Preencha os gols do mandante e do visitante.");
      }

      await apiRequest(`/games/${scoreGameId}/score`, {
        method: "PUT",
        token,
        body: {
          home_score: Number(homeScore),
          away_score: Number(awayScore),
        },
      });

      setScoreGameId("");
      setHomeScore("");
      setAwayScore("");

      await loadGames(currentGamesPage, { preserveMessage: true, silent: true });
      showMessage("Placar lançado com sucesso.", "success");
    } catch (error) {
      showMessage(
        extractErrorMessage(error, "Erro ao lançar placar."),
        "error"
      );
    } finally {
      setIsUpdatingScore(false);
    }
  }

  async function handleDeleteGame(gameId: number) {
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir este jogo? Apenas jogos finalizados dos últimos 3 dias podem ser removidos."
    );

    if (!confirmed) {
      return;
    }

    clearMessage();
    setDeletingGameId(gameId);

    try {
      const token = getToken();

      if (!token) {
        throw new Error("Faça login antes de excluir um jogo.");
      }

      await apiRequest(`/games/${gameId}`, {
        method: "DELETE",
        token,
      });

      const nextPage =
        games.length === 1 && currentGamesPage > 1
          ? currentGamesPage - 1
          : currentGamesPage;

      await loadGames(nextPage, { preserveMessage: true, silent: true });
      showMessage("Jogo removido com sucesso.", "success");
    } catch (error) {
      showMessage(extractErrorMessage(error, "Erro ao excluir jogo."), "error");
    } finally {
      setDeletingGameId(null);
    }
  }

  async function handleApplyGameFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessage();

    try {
      await loadGames(1, { preserveMessage: true, silent: true });
      showMessage("Filtros aplicados com sucesso.", "success");
    } catch (error) {
      showMessage(
        extractErrorMessage(error, "Erro ao aplicar filtros."),
        "error"
      );
    }
  }

  async function handleClearGameFilters() {
    setGameTeamFilter("");
    setGameStartDateFilter("");
    setGameEndDateFilter("");
    clearMessage();

    const token = getToken();

    if (!token) {
      showMessage("Faça login antes de acessar a área admin.", "error");
      return;
    }

    setIsGamesLoading(true);

    try {
      const gamesResponse = await apiRequest<unknown>("/games?page=1", {
        token,
      });

      const normalizedGames = normalizeGames(gamesResponse);
      const pagination = extractPaginationMeta(gamesResponse);

      setGames(normalizedGames);
      setGamesPagination(pagination);
      setCurrentGamesPage(1);

      showMessage("Filtros removidos com sucesso.", "success");
    } catch (error) {
      showMessage(
        extractErrorMessage(error, "Erro ao limpar filtros."),
        "error"
      );
    } finally {
      setIsGamesLoading(false);
    }
  }

  async function handleChangePage(page: number) {
    if (page < 1 || page > gamesPagination.lastPage || page === currentGamesPage) {
      return;
    }

    clearMessage();

    try {
      await loadGames(page, { preserveMessage: true, silent: true });
    } catch (error) {
      showMessage(
        extractErrorMessage(error, "Erro ao trocar de página."),
        "error"
      );
    }
  }

  function handleLogout() {
    removeAuth();
    setCurrentUser(null);
    setTeams([]);
    setGames([]);
    setGamesPagination({
      currentPage: 1,
      lastPage: 1,
      perPage: 10,
      total: 0,
    });
    router.replace("/login");
  }

  const scoreableGames = useMemo(() => {
    return games.filter((game) => game.status !== "finished");
  }, [games]);

  const alertClasses = useMemo(() => {
    if (messageType === "success") {
      return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    }

    if (messageType === "error") {
      return "border border-red-500/30 bg-red-500/10 text-red-200";
    }

    return "border border-blue-500/30 bg-blue-500/10 text-blue-200";
  }, [messageType]);

  if (isAuthorizing) {
    return (
      <main className="min-h-screen bg-zinc-950 p-4 text-white md:p-8">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-xl bg-zinc-900 p-8 text-center text-zinc-300 shadow-lg">
            Validando acesso ao painel administrativo...
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.2em] text-zinc-400">
              Painel administrativo
            </p>
            <h1 className="text-3xl font-bold md:text-4xl">Área Admin</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {currentUser?.name
                ? `Logado como ${currentUser.name}${currentUser.email ? ` (${currentUser.email})` : ""}.`
                : "Gerencie times, jogos e placares."}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/standings"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 font-semibold transition hover:bg-blue-500"
            >
              Ver classificação
            </Link>

            <button
              onClick={handleLogout}
              className="rounded-lg bg-red-600 px-4 py-2 font-semibold transition hover:bg-red-500"
            >
              Remover token e sair
            </button>
          </div>
        </div>

        {message && (
          <div className={`rounded-xl p-4 text-sm ${alertClasses}`}>{message}</div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-zinc-900 p-4 text-sm text-zinc-300">
            Total de times:{" "}
            <span className="font-bold text-white">{teams.length}</span>
          </div>

          <div className="rounded-xl bg-zinc-900 p-4 text-sm text-zinc-300">
            Jogos nesta página:{" "}
            <span className="font-bold text-white">{games.length}</span>
          </div>

          <div className="rounded-xl bg-zinc-900 p-4 text-sm text-zinc-300">
            Total de jogos:{" "}
            <span className="font-bold text-white">{gamesPagination.total}</span>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
            Acesso rápido:{" "}
            <Link href="/standings" className="font-bold underline underline-offset-4">
              abrir classificação
            </Link>
          </div>
        </div>

        {isInitialLoading ? (
          <section className="rounded-xl bg-zinc-900 p-8 text-center text-zinc-300 shadow-lg">
            Carregando dados do admin...
          </section>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-3">
              <form
                onSubmit={handleCreateTeam}
                className="rounded-xl bg-zinc-900 p-6 shadow-lg"
              >
                <h2 className="mb-4 text-xl font-semibold">Criar time</h2>

                <div className="space-y-3">
                  <input
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none transition focus:border-blue-500"
                    placeholder="Nome do time"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                  />

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreatingTeam ? "Criando..." : "Criar time"}
                  </button>
                </div>
              </form>

              <form
                onSubmit={handleCreateGame}
                className="rounded-xl bg-zinc-900 p-6 shadow-lg"
              >
                <h2 className="mb-4 text-xl font-semibold">Criar jogo</h2>

                <div className="space-y-3">
                  <select
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none transition focus:border-green-500"
                    value={homeTeamId}
                    onChange={(e) => setHomeTeamId(e.target.value)}
                    required
                  >
                    <option value="">Selecione o time da casa</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none transition focus:border-green-500"
                    value={awayTeamId}
                    onChange={(e) => setAwayTeamId(e.target.value)}
                    required
                  >
                    <option value="">Selecione o time visitante</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none transition focus:border-green-500"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                    required
                  />

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-lg bg-green-600 px-4 py-2 font-semibold transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreatingGame ? "Criando..." : "Criar jogo"}
                  </button>
                </div>
              </form>

              <form
                onSubmit={handleSetScore}
                className="rounded-xl bg-zinc-900 p-6 shadow-lg"
              >
                <h2 className="mb-4 text-xl font-semibold">Lançar placar</h2>

                <div className="space-y-3">
                  <select
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none transition focus:border-amber-500"
                    value={scoreGameId}
                    onChange={(e) => setScoreGameId(e.target.value)}
                    required
                  >
                    <option value="">Selecione o jogo</option>
                    {scoreableGames.map((game) => (
                      <option key={game.id} value={game.id}>
                        {getHomeTeamName(game)} x {getAwayTeamName(game)}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none transition focus:border-amber-500"
                    placeholder="Gols mandante"
                    value={homeScore}
                    onChange={(e) => setHomeScore(e.target.value)}
                    required
                  />

                  <input
                    type="number"
                    min="0"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none transition focus:border-amber-500"
                    placeholder="Gols visitante"
                    value={awayScore}
                    onChange={(e) => setAwayScore(e.target.value)}
                    required
                  />

                  <button
                    type="submit"
                    disabled={isSubmitting || scoreableGames.length === 0}
                    className="w-full rounded-lg bg-amber-600 px-4 py-2 font-semibold transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUpdatingScore ? "Lançando..." : "Lançar placar"}
                  </button>

                  {scoreableGames.length === 0 && (
                    <p className="text-xs text-zinc-400">
                      Não há jogos agendados disponíveis nesta página para lançar
                      placar.
                    </p>
                  )}
                </div>
              </form>
            </section>

            <section className="rounded-xl bg-zinc-900 p-6 shadow-lg">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Times cadastrados</h2>
                  <p className="text-sm text-zinc-400">
                    Lista simples dos times disponíveis no sistema.
                  </p>
                </div>

                {isTeamsLoading && (
                  <span className="text-sm text-zinc-400">Atualizando times...</span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="text-left text-sm text-zinc-300">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Nome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.length > 0 ? (
                      teams.map((team) => (
                        <tr key={team.id} className="border-t border-zinc-800">
                          <td className="px-3 py-2 text-zinc-400">{team.id}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {team.logo_url ? (
                                <img
                                  src={team.logo_url}
                                  alt={team.name}
                                  className="h-7 w-7 shrink-0 object-contain"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
                                  {team.name.charAt(0)}
                                </div>
                              )}
                              {team.name}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-3 py-4 text-zinc-400">
                          Nenhum time cadastrado ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl bg-zinc-900 p-6 shadow-lg">
              <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Jogos cadastrados</h2>
                  <p className="text-sm text-zinc-400">
                    Lista paginada com filtros por time e período.
                  </p>
                </div>

                {isGamesLoading && (
                  <span className="text-sm text-zinc-400">Atualizando jogos...</span>
                )}
              </div>

              <form
                onSubmit={handleApplyGameFilters}
                className="mb-6 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 md:grid-cols-2 xl:grid-cols-5"
              >
                <input
                  type="text"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none transition focus:border-blue-500"
                  placeholder="Filtrar por nome do time"
                  value={gameTeamFilter}
                  onChange={(e) => setGameTeamFilter(e.target.value)}
                />

                <input
                  type="date"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none transition focus:border-blue-500"
                  value={gameStartDateFilter}
                  onChange={(e) => setGameStartDateFilter(e.target.value)}
                />

                <input
                  type="date"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none transition focus:border-blue-500"
                  value={gameEndDateFilter}
                  onChange={(e) => setGameEndDateFilter(e.target.value)}
                />

                <button
                  type="submit"
                  disabled={isGamesLoading}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Aplicar filtros
                </button>

                <button
                  type="button"
                  onClick={handleClearGameFilters}
                  disabled={isGamesLoading}
                  className="rounded-lg bg-zinc-700 px-4 py-2 font-semibold transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Limpar filtros
                </button>
              </form>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="text-left text-sm text-zinc-300">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Mandante</th>
                      <th className="px-3 py-2">Visitante</th>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Placar</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.length > 0 ? (
                      games.map((game) => (
                        <tr key={game.id} className="border-t border-zinc-800">
                          <td className="px-3 py-2">{game.id}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {(game.home_team ?? game.homeTeam)?.logo_url ? (
                                <img
                                  src={(game.home_team ?? game.homeTeam)!.logo_url!}
                                  alt={getHomeTeamName(game)}
                                  className="h-6 w-6 shrink-0 object-contain"
                                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                              ) : (
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
                                  {getHomeTeamName(game).charAt(0)}
                                </div>
                              )}
                              {getHomeTeamName(game)}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {(game.away_team ?? game.awayTeam)?.logo_url ? (
                                <img
                                  src={(game.away_team ?? game.awayTeam)!.logo_url!}
                                  alt={getAwayTeamName(game)}
                                  className="h-6 w-6 shrink-0 object-contain"
                                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                              ) : (
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
                                  {getAwayTeamName(game).charAt(0)}
                                </div>
                              )}
                              {getAwayTeamName(game)}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {formatGameDate(game.match_date)}
                          </td>
                          <td className="px-3 py-2">
                            {game.home_score ?? "-"} x {game.away_score ?? "-"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(game.status)}`}
                            >
                              {getStatusLabel(game.status)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {canDeleteGame(game) ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteGame(game.id)}
                                disabled={deletingGameId === game.id}
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingGameId === game.id ? "Excluindo..." : "Excluir"}
                              </button>
                            ) : (
                              <span className="text-xs text-zinc-500">
                                Disponível apenas para jogos finalizados dos últimos 3 dias
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-zinc-400">
                          Nenhum jogo encontrado para os filtros informados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-zinc-800 pt-4 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-zinc-400">
                  Página{" "}
                  <span className="font-semibold text-white">
                    {gamesPagination.currentPage}
                  </span>{" "}
                  de{" "}
                  <span className="font-semibold text-white">
                    {gamesPagination.lastPage}
                  </span>{" "}
                  — Total de{" "}
                  <span className="font-semibold text-white">
                    {gamesPagination.total}
                  </span>{" "}
                  jogos
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleChangePage(currentGamesPage - 1)}
                    disabled={isGamesLoading || currentGamesPage <= 1}
                    className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChangePage(currentGamesPage + 1)}
                    disabled={
                      isGamesLoading ||
                      currentGamesPage >= gamesPagination.lastPage
                    }
                    className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}