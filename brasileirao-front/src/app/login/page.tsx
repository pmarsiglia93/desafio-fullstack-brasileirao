"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { saveSession, saveUser, type AuthUser } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

type AuthResponse = {
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
  data?: {
    id?: number;
    name?: string;
    email?: string;
    role?: string;
    user?: { id?: number; name?: string; email?: string; role?: string };
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

async function authenticate(
  endpoint: string,
  body: Record<string, string>,
  router: ReturnType<typeof useRouter>,
  setMessage: (m: string) => void,
  setMessageType: (t: "success" | "error") => void,
  setLoading: (v: boolean) => void
) {
  setMessage("");
  setLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data: AuthResponse = await response.json();

    if (!response.ok) {
      throw new Error(data?.message ?? "Erro ao processar a requisição.");
    }

    const accessToken = data?.data?.access_token;
    const refreshToken = data?.data?.refresh_token;
    let user = data?.data?.user ?? null;

    if (!accessToken || !refreshToken) {
      throw new Error("Tokens não encontrados na resposta.");
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

    setMessage(endpoint === "/register" ? "Conta criada com sucesso!" : "Login realizado com sucesso.");
    setMessageType("success");

    setTimeout(() => {
      router.push(role === "admin" ? "/admin" : "/standings");
    }, 400);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Ocorreu um erro inesperado.");
    setMessageType("error");
  } finally {
    setLoading(false);
  }
}

type Tab = "login" | "register";

export default function LoginPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("login");

  // login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // register
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");

  function clearMessage() {
    setMessage("");
  }

  function handleTabChange(next: Tab) {
    setTab(next);
    clearMessage();
  }

  async function handleLogin() {
    if (!loginEmail.trim()) {
      setMessage("O e-mail é obrigatório.");
      setMessageType("error");
      return;
    }

    if (!loginPassword.trim()) {
      setMessage("A senha é obrigatória.");
      setMessageType("error");
      return;
    }

    await authenticate(
      "/login",
      { email: loginEmail.trim(), password: loginPassword.trim() },
      router,
      setMessage,
      setMessageType,
      setLoading
    );
  }

  async function handleRegister() {
    if (!registerName.trim()) {
      setMessage("O nome é obrigatório.");
      setMessageType("error");
      return;
    }

    if (!registerEmail.trim()) {
      setMessage("O e-mail é obrigatório.");
      setMessageType("error");
      return;
    }

    if (registerPassword.length < 8) {
      setMessage("A senha deve ter pelo menos 8 caracteres.");
      setMessageType("error");
      return;
    }

    if (registerPassword !== registerPasswordConfirm) {
      setMessage("As senhas não coincidem.");
      setMessageType("error");
      return;
    }

    await authenticate(
      "/register",
      {
        name: registerName.trim(),
        email: registerEmail.trim(),
        password: registerPassword,
      },
      router,
      setMessage,
      setMessageType,
      setLoading
    );
  }

  const inputClass =
    "flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500/60";

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900 shadow-lg overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            <button
              type="button"
              onClick={() => handleTabChange("login")}
              className={`flex-1 py-4 text-sm font-semibold transition ${
                tab === "login"
                  ? "border-b-2 border-blue-500 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("register")}
              className={`flex-1 py-4 text-sm font-semibold transition ${
                tab === "register"
                  ? "border-b-2 border-blue-500 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Criar conta
            </button>
          </div>

          <div className="p-6">
            {/* ── LOGIN ── */}
            {tab === "login" && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-bold">Bem-vindo de volta</h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    Acesse com sua conta de administrador ou usuário.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="login-email" className="block text-sm font-medium text-zinc-300">
                      E-mail
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleLogin(); }}
                      className={inputClass}
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="login-password" className="block text-sm font-medium text-zinc-300">
                      Senha
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleLogin(); }}
                      className={inputClass}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleLogin()}
                  disabled={loading}
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-500 disabled:pointer-events-none disabled:opacity-50"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>

                <p className="text-center text-xs text-zinc-500">
                  Admin?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail("admin@brasileirao.com");
                      setLoginPassword("12345678");
                      clearMessage();
                    }}
                    className="text-blue-400 underline-offset-2 hover:underline"
                  >
                    Preencher credenciais de teste
                  </button>
                </p>
              </div>
            )}

            {/* ── REGISTER ── */}
            {tab === "register" && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-bold">Crie sua conta</h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    Cadastre-se para acompanhar a classificação do campeonato.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="register-name" className="block text-sm font-medium text-zinc-300">
                      Nome
                    </label>
                    <input
                      id="register-name"
                      type="text"
                      autoComplete="name"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleRegister(); }}
                      className={inputClass}
                      placeholder="Seu nome"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="register-email" className="block text-sm font-medium text-zinc-300">
                      E-mail
                    </label>
                    <input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleRegister(); }}
                      className={inputClass}
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="register-password" className="block text-sm font-medium text-zinc-300">
                      Senha
                    </label>
                    <input
                      id="register-password"
                      type="password"
                      autoComplete="new-password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleRegister(); }}
                      className={inputClass}
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="register-password-confirm" className="block text-sm font-medium text-zinc-300">
                      Confirmar senha
                    </label>
                    <input
                      id="register-password-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={registerPasswordConfirm}
                      onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleRegister(); }}
                      className={inputClass}
                      placeholder="Repita a senha"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleRegister()}
                  disabled={loading}
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-500 disabled:pointer-events-none disabled:opacity-50"
                >
                  {loading ? "Criando conta..." : "Criar conta"}
                </button>
              </div>
            )}

            {/* Feedback message */}
            {message && (
              <div
                className={`mt-4 rounded-md border px-4 py-3 text-sm ${
                  messageType === "success"
                    ? "border-emerald-700 bg-emerald-950 text-emerald-300"
                    : "border-red-700 bg-red-950 text-red-300"
                }`}
              >
                {message}
              </div>
            )}

            {/* Footer links */}
            <div className="mt-5 flex items-center justify-between text-sm text-zinc-500">
              <Link href="/standings" className="transition hover:text-zinc-300">
                Ver classificação
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
