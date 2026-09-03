/**
 * frameworks-catalog-add-all.spec.ts
 *
 * Regression test for Task 1.1 of the CMMC L1 blueprint: the "Available to add"
 * grid on the Frameworks page called available.slice(0, 9).map(...), so any
 * catalog entry beyond the 9th (including cmmc-l1) was silently dropped from
 * the rendered cards even though the heading above the grid showed the
 * correct full count (e.g. "Available to add (19)" with only 9 cards visible).
 *
 * Verifies that:
 * (A) When the framework catalog has more than 9 "available to add" entries,
 *     every one of them renders a card, not just the first 9.
 * (B) CMMC Level 1 specifically renders as one of those cards.
 *
 * No real network access is needed. All endpoints are intercepted and return
 * deterministic mock responses, following the same pattern as
 * plan-gate-federal-routes.spec.ts in this directory.
 *
 * Relevant source file:
 *   artifacts/c2s-ciop/src/pages/Frameworks.tsx
 */

import { test, expect, type Page } from "@playwright/test";

const ORG_ID = 9999;

const MOCK_SESSION = {
  user: {
    id: "test-frameworks-user",
    email: "frameworks@test.invalid",
    name: "Frameworks Tester",
    emailVerified: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  session: {
    id: "test-frameworks-session",
    userId: "test-frameworks-user",
    expiresAt: "2099-01-01T00:00:00.000Z",
    token: "test-frameworks-token",
  },
};

function mockOrg() {
  return {
    org: {
      id: ORG_ID,
      name: "Frameworks Test Org",
      slug: "frameworks-test-org",
      plan: "federal",
      onboardingComplete: true,
      onboardingStep: 5,
    },
  };
}

// Deliberately small so the catalog fixture below leaves well over 9 entries
// in available to add -- the exact condition that exposed the slice(0,9) bug.
const ACTIVE_FRAMEWORKS = [
  {
    id: 1,
    orgId: ORG_ID,
    frameworkKey: "soc2",
    name: "SOC 2 Type II",
    category: "commercial",
    active: true,
    complianceScore: 50,
    passingControls: 2,
    failingControls: 1,
    notTestedControls: 3,
    totalControls: 6,
  },
];

// 23 catalog entries, matching the order of magnitude of the real catalog.
// A hardcoded slice(0,9) passes with a 9-entry catalog and only fails once
// it grows past that -- exactly what happened in production.
const CATALOG_KEYS = [
  "soc2", "fedramp", "fedramp-high", "fedramp-low", "cmmc-l2", "cmmc-l1",
  "nist-800-171", "stateramp", "iso27001", "pci-dss", "sox", "nycrr-500",
  "hipaa", "hitrust", "gdpr", "dora", "ccpa", "iso27701", "cis-controls",
  "nist-csf", "nist-ai-rmf", "cyber-essentials", "nist-800-53",
];

const CATALOG = CATALOG_KEYS.map((key, i) => ({
  key,
  name: key === "cmmc-l1" ? "CMMC Level 1" : `Mock Framework ${i}`,
  category: "commercial",
  controlCount: key === "cmmc-l1" ? 17 : 10,
  description: `Mock description for ${key}`,
}));

async function mockFrameworksPage(page: Page) {
  await page.route("**/api/**", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

await page.route("**/api/orgs/me", (route) => {
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockOrg()) });
});

await page.route(`**/api/orgs/${ORG_ID}/frameworks`, (route) => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ frameworks: ACTIVE_FRAMEWORKS }),
  });
});

await page.route("**/api/frameworks/catalog", (route) => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ frameworks: CATALOG }),
  });
});

await page.route("**/api/auth/get-session", (route) => {
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SESSION) });
});
}

test.describe("Frameworks page - Available to add grid (Task 1.1)", () => {
  test("renders one card per available catalog entry, not just the first 9", async ({ page }) => {
    await mockFrameworksPage(page);
    await page.goto("/frameworks");
    await page.waitForLoadState("networkidle");

       const expectedAvailable = CATALOG.filter(
         (f) => !ACTIVE_FRAMEWORKS.some((af) => af.frameworkKey === f.key)
);
    expect(expectedAvailable.length).toBeGreaterThan(9);

       await expect(page.getByText(`Available to add (${expectedAvailable.length})`)).toBeVisible();

       for (const fw of expectedAvailable) {
         await expect(page.getByText(fw.name, { exact: true })).toBeVisible();
       }
  });

              test("CMMC Level 1 renders as an addable card", async ({ page }) => {
                await mockFrameworksPage(page);
                await page.goto("/frameworks");
                await page.waitForLoadState("networkidle");

                   await expect(page.getByText("CMMC Level 1", { exact: true })).toBeVisible();
              });
});
