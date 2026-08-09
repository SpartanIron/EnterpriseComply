/**
 * plan-gate-federal-routes.spec.ts
 *
 * Regression suite for task #66: PlanGate access control on Federal-tier routes (P1-07).
 *
 * Verifies that:
 * (A) A starter-plan org sees the "Federal Plan Required" upgrade overlay on each
 *     federal-gated route and cannot see the protected page content.
 * (B) A federal-plan org reaches the same routes without the overlay.
 *
 * No real auth or DB access is needed — the test intercepts the BetterAuth session
 * and org API endpoints and returns deterministic mock responses.
 *
 * Relevant source files:
 *   artifacts/c2s-ciop/src/App.tsx             — route definitions / PlanGate wrappers
 *   artifacts/c2s-ciop/src/components/PlanGate.tsx — upgrade overlay component
 */

import { test, expect, type Page } from "@playwright/test";

// ── Mock payloads ─────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  user: {
    id: "test-plangate-user",
    email: "plangate@test.invalid",
    name: "PlanGate Tester",
    emailVerified: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  session: {
    id: "test-plangate-session",
    userId: "test-plangate-user",
    expiresAt: "2099-01-01T00:00:00.000Z",
    token: "test-plangate-token",
  },
};

function mockOrg(plan: "starter" | "professional" | "enterprise" | "federal") {
  return {
    org: {
      id: 9999,
      name: "PlanGate Test Org",
      slug: "plangate-test-org",
      plan,
      onboardingComplete: true,
      onboardingStep: 5,
    },
    member: {
      id: 1,
      orgId: 9999,
      clerkUserId: "test-plangate-user",
      role: "owner",
    },
  };
}

// ── Helper: wire route mocks for session + org ─────────────────────────────────

async function mockAuthAndOrg(page: Page, plan: "starter" | "federal") {
  // Playwright checks routes in reverse-registration order (last registered = highest priority).
  // Register the catch-all FIRST so the specific mocks below override it.

  // Swallow any other /api/* calls so they don't fail loudly during route render
  await page.route("**/api/**", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  // Org context — useOrg() hook fetches /api/orgs/me; PlanGate reads org.plan
  await page.route("**/api/orgs/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockOrg(plan)),
    })
  );

  // BetterAuth session endpoint — useSession() in auth-client.ts
  // Must be registered LAST to take priority over the **/api/** catch-all above.
  await page.route("**/api/auth/get-session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SESSION),
    })
  );
}

// ── Federal-gated routes under test ───────────────────────────────────────────

const FEDERAL_ROUTES: { path: string; featureName: string }[] = [
  { path: "/poam",           featureName: "POA&M Management" },
  { path: "/sprs",           featureName: "SPRS Score Tracker" },
  { path: "/ssp",            featureName: "SSP Generator" },
  { path: "/stigs",          featureName: "STIG Checklists" },
  { path: "/zero-trust",     featureName: "Zero Trust Assessment" },
  { path: "/system-boundary",featureName: "System Boundary" },
  { path: "/nist-800-171",   featureName: "NIST SP 800-171 Compliance" },
  { path: "/conmon",         featureName: "Continuous Monitoring (ConMon)" },
  { path: "/fisma-reporting",featureName: "FISMA Reporting" },
];

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe("PlanGate — Federal route access control (P1-07)", () => {
  /**
   * Part A: starter-plan users must see the upgrade overlay on every federal route.
   *
   * The PlanGate component (PlanGate.tsx) renders:
   *   - A badge: "{Plan} Plan Required"  (e.g. "Federal Plan Required")
   *   - A button: "Upgrade to {Plan}"    (e.g. "Upgrade to Federal")
   * …instead of the protected page content.
   */
  test("starter-plan user sees upgrade overlay on all 9 federal routes", async ({ page }) => {
    await mockAuthAndOrg(page, "starter");

    for (const route of FEDERAL_ROUTES) {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      // PlanGate badge must be visible
      await expect(
        page.getByText("Federal Plan Required"),
        `route ${route.path}: expected "Federal Plan Required" badge`,
      ).toBeVisible();

      // Upgrade CTA must be visible
      await expect(
        page.getByRole("button", { name: "Upgrade to Federal" }),
        `route ${route.path}: expected "Upgrade to Federal" button`,
      ).toBeVisible();

      // The lock icon container (rounded square) must be present
      // PlanGate renders: <div class="...rounded-2xl..."> with a lock SVG inside
      await expect(
        page.locator(".rounded-2xl svg"),
        `route ${route.path}: expected lock icon`,
      ).toBeVisible();
    }
  });

  /**
   * Part B: federal-plan users must NOT see the upgrade overlay on any federal route.
   * The route content should render (overlay absent).
   */
  test("federal-plan user reaches all 9 federal routes without the overlay", async ({ page }) => {
    await mockAuthAndOrg(page, "federal");

    for (const route of FEDERAL_ROUTES) {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      // Upgrade overlay must be absent
      await expect(
        page.getByText("Federal Plan Required"),
        `route ${route.path}: "Federal Plan Required" badge should be gone for federal user`,
      ).not.toBeVisible();

      await expect(
        page.getByRole("button", { name: "Upgrade to Federal" }),
        `route ${route.path}: upgrade button should be gone for federal user`,
      ).not.toBeVisible();
    }
  });
});
