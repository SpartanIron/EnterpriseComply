/**
 * crosswalk-status-update.spec.ts
 *
 * Regression suite for task #68: Crosswalk status updates immediately after a
 * control gap is resolved.
 *
 * Verifies that:
 * (A) A control row showing "Failing" flips its badge to "Passing" and the
 *     "Failing / Gaps" summary stat decrements by 1 once the controls cache
 *     expires and the window regains focus (React Query's native stale-on-focus
 *     refetch path — no dev-only hooks required).
 * (B) Filtering by "Failing" correctly hides the resolved control after the
 *     cache refresh.
 *
 * Mechanism under test:
 *   ControlCrosswalk.tsx fetches GET /orgs/:orgId/controls with staleTime: 60000.
 *   React Query refetches on window focus when data is stale. The test advances
 *   the browser clock past the 60 s staleTime, then fires a window focus event
 *   to trigger the native refetch path — no modifications to app code are needed.
 *
 * No real auth, DB, or network access is needed — all endpoints are intercepted
 * and return deterministic mock responses.
 *
 * Relevant source files:
 *   artifacts/c2s-ciop/src/pages/ControlCrosswalk.tsx  — controlMap / stats memos
 *   artifacts/c2s-ciop/src/lib/queryClient.ts          — default staleTime (30s);
 *                                                         crosswalk overrides to 60s
 */

import { test, expect, type Page } from "@playwright/test";

// ── Constants ──────────────────────────────────────────────────────────────────

const ORG_ID = 9999;

// UCO-AC-001 has static status "passing" in crosswalk-data.ts, so the live API
// mock (which returns "failing") is what drives the displayed badge — no
// static-fallback interference.
const TEST_CONTROL_ID = "UCO-AC-001";
const TEST_CONTROL_NAME = "Multi-Factor Authentication";

// The crosswalk query's explicit staleTime in ControlCrosswalk.tsx is 60 000 ms.
// Advance the clock just past it so React Query marks the cached data as stale.
const STALE_TIME_MS = 60_000;

// ── Mock payloads ─────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  user: {
    id: "test-crosswalk-user",
    email: "crosswalk@test.invalid",
    name: "Crosswalk Tester",
    emailVerified: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  session: {
    id: "test-crosswalk-session",
    userId: "test-crosswalk-user",
    expiresAt: "2099-01-01T00:00:00.000Z",
    token: "test-crosswalk-token",
  },
};

const MOCK_ORG = {
  org: {
    id: ORG_ID,
    name: "Crosswalk Test Org",
    slug: "crosswalk-test-org",
    // "enterprise" to satisfy the PlanGate wrapper on /control-crosswalk
    plan: "enterprise",
    onboardingComplete: true,
    onboardingStep: 5,
  },
  member: {
    id: 1,
    orgId: ORG_ID,
    clerkUserId: "test-crosswalk-user",
    role: "owner",
  },
};

/** Build the controls API payload with a single test control at the given status. */
function makeControlsPayload(status: "failing" | "passing") {
  return {
    controls: [
      {
        controlId: TEST_CONTROL_ID,
        name: TEST_CONTROL_NAME,
        domain: "Access Control",
        remediationGuidance: "Enforce MFA for all privileged accounts.",
        result: {
          status,
          ucoControlId: TEST_CONTROL_ID,
          failureReason: status === "failing"
            ? "MFA not enforced for service accounts"
            : null,
          remediationNotes: null,
        },
      },
    ],
  };
}

// ── Route-mock helpers ─────────────────────────────────────────────────────────

/**
 * Register all route intercepts used by the Crosswalk page.
 *
 * The controls route is registered as a handler that reads `currentPayload`
 * by reference, so swapping that variable changes what the next fetch returns
 * without needing to re-register the route.
 *
 * Returns `setStatus`, which swaps the controls payload so the next fetch
 * returns the new status.
 */
async function setupMocks(page: Page) {
  // Mutable state shared with the route handler closure
  const state = { payload: makeControlsPayload("failing") };

  // Catch-all — silences any other /api/* calls
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );

  // Org context — useOrg() hook
  await page.route("**/api/orgs/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_ORG),
    }),
  );

  // Controls endpoint — ControlCrosswalk.tsx fetches /api/orgs/:orgId/controls.
  // The handler reads state.payload at request time, so updating state.payload
  // before the next refetch is sufficient to change the response.
  await page.route(`**/api/orgs/${ORG_ID}/controls`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(state.payload),
    }),
  );

  // BetterAuth session — must be last to win priority over the catch-all
  await page.route("**/api/auth/get-session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SESSION),
    }),
  );

  return {
    /** Swap the controls response so the next fetch returns "passing". */
    setStatusPassing: () => { state.payload = makeControlsPayload("passing"); },
  };
}

// ── Trigger React Query's stale-on-focus refetch ──────────────────────────────

/**
 * Advance the browser clock past the crosswalk's staleTime, then fire a
 * window focus event.  React Query's FocusManager listens for this event and
 * refetches any query whose data has gone stale.
 *
 * React Query uses Date.now() (via its own scheduler) to compare updatedAt
 * against staleTime.  Playwright's page.clock intercepts Date.now() inside the
 * browser, so ticking 61 s makes React Query believe the cached fetch is stale.
 */
async function triggerStaleRefetch(page: Page) {
  // Advance browser-side Date.now() past the 60 s staleTime.
  // fastForward moves the mocked clock without firing intermediate timers,
  // so React Query's next staleness check sees Date.now() as 61 s later.
  await page.clock.fastForward(STALE_TIME_MS + 1_000);
  // React Query v5's FocusManager subscribes to window "visibilitychange"
  // (not "focus"). Dispatching it causes the FocusManager to call isFocused()
  // → document.visibilityState !== "hidden" → true → triggers a refetch of
  // any query whose data has gone stale.
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
}

// ── Read the "Failing / Gaps" stat card ───────────────────────────────────────

async function getFailingCount(page: Page): Promise<number> {
  // Stat cards render as:
  //   <p class="text-xs ...">Failing / Gaps</p>   ← label
  //   <p class="text-3xl font-bold ...">N</p>      ← value  (sibling)
  const card = page.locator("div.bg-white.rounded-xl", { hasText: "Failing / Gaps" });
  const valueText = await card.locator("p.text-3xl").textContent();
  return parseInt(valueText?.trim() ?? "0", 10);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe("Crosswalk — control status updates after gap resolution (T68)", () => {
  /**
   * Part A: After the crosswalk cache expires and the window is focused, a
   * previously Failing row must flip its badge to Passing and the summary stat
   * must decrement by 1.
   */
  test(
    "badge flips to Passing and Failing/Gaps decrements once stale cache is refreshed",
    async ({ page }) => {
      // Install fake clock BEFORE navigation so React Query records updatedAt
      // using our controlled time base.
      await page.clock.install();

      const { setStatusPassing } = await setupMocks(page);

      await page.goto("/control-crosswalk");
      await page.waitForLoadState("networkidle");

      // ── Before: verify Failing badge and stat ──────────────────────────────
      const controlRow = page.locator("tr", { hasText: TEST_CONTROL_ID }).first();
      await expect(controlRow).toBeVisible();

      await expect(
        controlRow.getByText("Failing"),
        "row badge must be Failing before resolution",
      ).toBeVisible();

      const failingBefore = await getFailingCount(page);
      expect(
        failingBefore,
        "Failing/Gaps stat must be ≥ 1 before resolution",
      ).toBeGreaterThanOrEqual(1);

      // ── Resolve: swap API response, then let cache expire and focus window ─
      setStatusPassing();
      await triggerStaleRefetch(page);

      // ── After: badge must flip to Passing ─────────────────────────────────
      await expect(
        controlRow.getByText("Passing"),
        "badge must flip to Passing after stale cache refreshes",
      ).toBeVisible({ timeout: 10_000 });

      await expect(
        controlRow.getByText("Failing"),
        "Failing badge must be gone from the row after resolution",
      ).not.toBeVisible();

      // Failing/Gaps stat must have decremented
      const failingAfter = await getFailingCount(page);
      expect(
        failingAfter,
        "Failing/Gaps stat must decrement by 1 after resolution",
      ).toBe(failingBefore - 1);
    },
  );

  /**
   * Part B: The "Failing" status filter must hide the resolved control once
   * the cache refreshes and the row's live status becomes "passing".
   */
  test(
    "Failing status filter hides resolved control after cache refresh",
    async ({ page }) => {
      await page.clock.install();

      const { setStatusPassing } = await setupMocks(page);

      await page.goto("/control-crosswalk");
      await page.waitForLoadState("networkidle");

      // Apply the Failing filter
      await page.getByRole("combobox").last().selectOption("failing");

      // Test control must appear under the Failing filter
      await expect(
        page.locator("tr", { hasText: TEST_CONTROL_ID }).first(),
        "control must appear in Failing filter before resolution",
      ).toBeVisible();

      // Resolve and trigger cache refresh
      setStatusPassing();
      await triggerStaleRefetch(page);

      // Resolved control must disappear from the Failing filter view
      await expect(
        page.locator("tr", { hasText: TEST_CONTROL_ID }),
        "resolved control must not appear under Failing filter after refresh",
      ).not.toBeVisible({ timeout: 10_000 });
    },
  );
});
