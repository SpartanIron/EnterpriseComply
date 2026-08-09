#!/usr/bin/env bash
# run-tests.sh — E2E test runner for the plan-gate-federal-routes Playwright spec.
#
# Uses nix-shell to provide the system libraries required by the Playwright
# Chromium headless shell in the Replit/NixOS environment.
#
# Usage (from workspace root):
#   APP_URL=http://localhost:19222 bash tests/e2e/run-tests.sh
#
# Environment variables:
#   APP_URL  — Base URL of the running c2s-ciop web app (default: http://localhost:19222)
#
# Exit codes:  0 = all tests passed, 1 = test failures, 2 = setup error

set -euo pipefail

APP_URL="${APP_URL:-http://localhost:19222}"
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SHELL_NIX="$WORKSPACE_ROOT/tests/e2e/shell.nix"

echo "▶  Plan-gate E2E tests  (APP_URL=$APP_URL)"

# Ensure playwright browsers are installed
(cd "$WORKSPACE_ROOT" && npx playwright install chromium 2>&1 | grep -v "^npm warn" || true)

# Run via nix-shell which provides the required system libraries
exec nix-shell "$SHELL_NIX" --run "
  LIB_PATH=\$(echo \"\$NIX_LDFLAGS\" | tr ' ' '\n' | grep '^-L' | sed 's/^-L//' | tr '\n' ':')
  export LD_LIBRARY_PATH=\"\$LIB_PATH\"
  export APP_URL='$APP_URL'
  cd '$WORKSPACE_ROOT'
  npx playwright test --config tests/e2e/playwright.config.ts
"
