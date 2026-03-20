import {
  getAccessToken,
  getRefreshToken,
  removeAuth,
  saveAuth,
} from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

type RequestMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

type RequestOptions = {
  method?: RequestMethod;
  body?: unknown;
  token?: string | null;
  retryOnAuthFail?: boolean;
};

type ApiErrorResponse = {
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  status?: string;
  data?: {
    access_token?: string;
    refresh_token?: string;
  };
};

type RefreshResponse = {
  data?: {
    access_token?: string;
    refresh_token?: string;
  };
};

function extractLaravelValidationMessage(data: ApiErrorResponse | null): string | null {
  if (!data?.errors || typeof data.errors !== "object") {
    return null;
  }

  const firstFieldErrors = Object.values(data.errors).find(
    (fieldErrors) => Array.isArray(fieldErrors) && fieldErrors.length > 0
  );

  if (firstFieldErrors && firstFieldErrors.length > 0) {
    return firstFieldErrors[0];
  }

  return null;
}

function extractErrorMessage(data: ApiErrorResponse | null, status: number): string {
  const validationMessage = extractLaravelValidationMessage(data);

  if (validationMessage) {
    return validationMessage;
  }

  if (data?.message) {
    return data.message;
  }

  if (data?.error) {
    return data.error;
  }

  if (status === 401) {
    return "Sua sessão expirou ou o token é inválido. Faça login novamente.";
  }

  if (status === 403) {
    return "Você não tem permissão para executar esta ação.";
  }

  if (status === 404) {
    return "Recurso não encontrado.";
  }

  if (status === 422) {
    return "Os dados enviados são inválidos.";
  }

  if (status >= 500) {
    return "Erro interno no servidor. Tente novamente em instantes.";
  }

  return "Erro ao comunicar com a API.";
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    removeAuth();
    return null;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/refresh`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });
  } catch {
    removeAuth();
    return null;
  }

  let data: RefreshResponse | null = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    removeAuth();
    return null;
  }

  const newAccessToken = data?.data?.access_token ?? null;
  const newRefreshToken = data?.data?.refresh_token ?? null;

  if (!newAccessToken || !newRefreshToken) {
    removeAuth();
    return null;
  }

  saveAuth(newAccessToken, newRefreshToken);

  return newAccessToken;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    token,
    retryOnAuthFail = true,
  } = options;

  const resolvedToken = token ?? getAccessToken();

  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (resolvedToken) {
    headers.Authorization = `Bearer ${resolvedToken}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Não foi possível conectar com a API. Verifique se o backend está rodando.");
  }

  let data: ApiErrorResponse | T | null = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.status === 401 && retryOnAuthFail && resolvedToken) {
    const refreshedToken = await refreshAccessToken();

    if (refreshedToken) {
      return apiRequest<T>(endpoint, {
        ...options,
        token: refreshedToken,
        retryOnAuthFail: false,
      });
    }
  }

  if (!response.ok) {
    const errorMessage = extractErrorMessage(
      (data as ApiErrorResponse | null) ?? null,
      response.status
    );

    throw new Error(errorMessage);
  }

  return data as T;
}