import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

export function apiUrl(path: string) {
  return `/api${path}`;
}

export async function apiFetch(path: string, options?: RequestInit) {
  const headers: Record<string, string> = options?.body ? { "Content-Type": "application/json" } : {};
  const res = await fetch(apiUrl(path), { credentials: "include", ...options, headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) } });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.message ?? error.error ?? "Request failed");
  }
  return res.json();
}
