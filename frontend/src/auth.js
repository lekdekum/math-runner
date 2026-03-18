export const ADMIN_TOKEN_STORAGE_KEY = "math-runner-admin-token";

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export function getAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";
}

export function setAdminToken(token) {
  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

export function clearAdminToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

export function isAuthenticated() {
  return Boolean(getAdminToken());
}

export function isAuthError(error) {
  return error instanceof AuthError;
}

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || "http://localhost:7878").replace(/\/$/, "");
}

export function buildApiUrl(path) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export async function authFetch(input, init = {}) {
  const token = getAdminToken();
  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildApiUrl(input), {
    ...init,
    headers
  });

  if (response.status === 401 || response.status === 403) {
    clearAdminToken();
    throw new AuthError();
  }

  return response;
}
