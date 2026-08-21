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

/**
 * Error that carries the machine-readable code, not only the sentence.
 *
 * Extends Error, so every existing call site that reads err.message keeps working
 * unchanged. The code is needed because some failures are not failures: an
 * invitation link belonging to somebody who is already a member should produce a
 * "sign in" button rather than a red banner, and the code the API already sends is
 * the only honest way to tell those cases apart. Matching on message text would
 * break the first time somebody reworded a sentence.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string | null,
    public readonly status: number,
    public readonly body: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
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

  if (res.status === 403) {
    // Step-up required: the session is authenticated but has not presented a code since
    // the user enrolled an authenticator app. Broadcast it so the challenge overlay can
    // appear over whatever page the user is on, instead of every call site having to
    // know that MFA exists. Cloned so the generic handler below can still read the body.
    const body = await res.clone().json().catch(() => ({}) as any);
    if (body?.error === "mfa_challenge_required") {
      window.dispatchEvent(new CustomEvent("ec:mfa-challenge"));
      throw new Error(body.message ?? "Enter the code from your authenticator app to continue.");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(
      body.message ?? body.error ?? "Request failed",
      typeof body.error === "string" ? body.error : null,
      res.status,
      body,
    );
  }
  return res.json();
}
