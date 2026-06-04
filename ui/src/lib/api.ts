export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

type RequestOptions = RequestInit & { auth?: boolean };

function redirectToLogin() {
  localStorage.clear();
  window.dispatchEvent(new Event("auth-expired"));
}

function isAuthFailure(response: Response, payload?: unknown) {
  const message = typeof payload === "object" && payload !== null && "msg" in payload
    ? String((payload as { msg?: unknown }).msg)
    : "";
  return response.status === 401 || (response.status === 422 && /token|jwt/i.test(message));
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.auth !== false && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    if (options.auth !== false && isAuthFailure(response, payload)) {
      redirectToLogin();
    }
    throw new Error(typeof payload === "string" ? payload : payload.error || "Request failed");
  }
  return payload as T;
}

export async function apiBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const token = localStorage.getItem("token");
  const headers = new Headers(options.headers);
  if (options.auth !== false && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    if (options.auth !== false && isAuthFailure(response)) {
      redirectToLogin();
    }
    throw new Error("Download failed");
  }
  return response.blob();
}

export function toQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}
