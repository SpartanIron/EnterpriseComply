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

/** Structured error thrown when a 402 plan-gated endpoint is hit. */
export class PlanRequiredError extends Error {
  constructor(
    public readonly requiredPlan: string,
    public readonly currentPlan: string,
  ) {
    super(`plan_required:${requiredPlan}`);
    this.name = "PlanRequiredError";
  }
}

export async function apiFetch(path: string, options?: RequestInit) {
  const headers: Record<string, string> = options?.body ? { "Content-Type": "application/json" } : {};
  const res = await fetch(apiUrl(path), { credentials: "include", ...options, headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) } });

  if (res.status === 402) {
    // Plan-gated endpoint — redirect to /pricing?required=<plan> so the user
    // sees the upgrade prompt.  This is a safety net for cases where the
    // PlanGate component didn't catch it first (e.g. direct URL navigation).
    const body = await res.json().catch(() => ({ requiredPlan: "professional", currentPlan: "starter" }));
    const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    window.location.href = `${basePath}/pricing?required=${body.requiredPlan ?? "professional"}`;
    throw new PlanRequiredError(body.requiredPlan ?? "professional", body.currentPlan ?? "starter");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.message ?? error.error ?? "Request failed");
  }
  return res.json();
}
