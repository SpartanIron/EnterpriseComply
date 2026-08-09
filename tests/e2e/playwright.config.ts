import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for EnterpriseComply E2E tests.
 *
 * The tests do NOT require a real auth session — they intercept the BetterAuth
 * session and org endpoints and return deterministic mock responses so the
 * React app renders predictably without external dependencies.
 *
 * Run with:
 *   npx playwright test --config tests/e2e/playwright.config.ts
 */

const APP_URL = process.env.APP_URL ?? "http://localhost:19222";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "tests/e2e/playwright-report" }]],
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
    // Headed off — CI / Replit headless shell
    headless: true,
    // Accept all TLS; not relevant for localhost but avoids surprises
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // When PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is set (e.g. by run-tests.sh
        // on Replit/NixOS), override the default browser path. Otherwise let
        // Playwright use its own downloaded headless shell.
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
              },
            }
          : {}),
      },
    },
  ],
});
