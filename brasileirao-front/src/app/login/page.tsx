"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { saveSession, saveUser, type AuthUser } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

type LoginResponse = {
  status?: string;
  message?: string;
  data?: {
    user?: {
      id?: number;
      name?: string;
      email?: string;
      role?: string;
    };
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
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

function resolveUserFromMe(response: MeResponse): AuthUser | null {
  const directUser = response?.data?.user;
  const data = response?.data;

  if (directUser) {
    return {
      id: directUser.id,
      name: directUser.name,
      email: directUser.email,
      role: directUser.role,
    };
  }

  if (data) {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
    };
  }

  return null;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("admin@brasileirao.com");
  const [password, setPassword] = useState("12345678");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "default">("default");

  async function handleLogin() {
    setMessage("");
    setMessageType("default");

    if (!email.trim()) {
      setMessage("O e-mail é obrigatório.");
      setMessageType("error");
      return;
    }

    if (!password.trim()) {
      setMessage("A senha é obrigatória.");
      setMessageType("error");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Erro ao fazer login.");
      }

      const accessToken = data?.data?.access_token;
      const refreshToken = data?.data?.refresh_token;
      let user = data?.data?.user ?? null;

      if (!accessToken || !refreshToken) {
        throw new Error("Tokens não encontrados na resposta do login.");
      }

      saveSession(accessToken, refreshToken, user ?? undefined);

      if (!user) {
        const meResponse = await apiRequest<MeResponse>("/me", {
          token: accessToken,
          retryOnAuthFail: false,
        });

        const meUser = resolveUserFromMe(meResponse);

        if (meUser) {
          user = meUser;
          saveUser(meUser);
        }
      }

      const role = user?.role;

      if (!role) {
        throw new Error("Não foi possível identificar o perfil do usuário.");
      }

      setMessage("Login realizado com sucesso.");
      setMessageType("success");

      setTimeout(() => {
        if (role === "admin") {
          router.push("/admin");
          return;
        }

        router.push("/standings");
      }, 400);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro ao fazer login.";
      setMessage(errorMessage);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
          <h1 className="text-3xl font-bold">Login</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Faça login para acessar o painel administrativo ou acompanhar a classificação.
          </p>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleLogin();
                  }
                }}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500/60"
                placeholder="admin@brasileirao.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleLogin();
                  }
                }}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500/60"
                placeholder="12345678"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            {message && (
              <div
                className={`rounded-md border px-4 py-3 text-sm ${
                  messageType === "success"
                    ? "border-emerald-700 bg-emerald-950 text-emerald-300"
                    : messageType === "error"
                      ? "border-red-700 bg-red-950 text-red-300"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300"
                }`}
              >
                {message}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1 text-sm text-zinc-400">
              <Link href="/" className="transition hover:text-white">
                Voltar para início
              </Link>
              <Link href="/standings" className="transition hover:text-white">
                Ver classificação
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}