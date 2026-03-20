const ACCESS_TOKEN_KEY = "brasileirao_access_token";
const REFRESH_TOKEN_KEY = "brasileirao_refresh_token";
const USER_KEY = "brasileirao_user";

export type AuthUser = {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function saveAuth(accessToken: string, refreshToken: string) {
  if (!isBrowser()) return;

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function saveToken(token: string) {
  if (!isBrowser()) return;

  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function saveUser(user: AuthUser) {
  if (!isBrowser()) return;

  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function saveSession(
  accessToken: string,
  refreshToken: string,
  user?: AuthUser | null
) {
  saveAuth(accessToken, refreshToken);

  if (user) {
    saveUser(user);
  }
}

export function getToken() {
  if (!isBrowser()) return null;

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getAccessToken() {
  if (!isBrowser()) return null;

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  if (!isBrowser()) return null;

  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (!isBrowser()) return null;

  const rawUser = localStorage.getItem(USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function removeUser() {
  if (!isBrowser()) return;

  localStorage.removeItem(USER_KEY);
}

export function removeToken() {
  if (!isBrowser()) return;

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function removeAuth() {
  if (!isBrowser()) return;

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}