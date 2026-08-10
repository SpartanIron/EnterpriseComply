---
name: SWC decorator pattern for NestJS test scripts
description: How to safely import NestJS-decorated classes in test scripts that run under Node's native TS stripper
---

## Rule
Node.js native TypeScript stripping (v22+) **cannot parse legacy experimental decorators** (`@Injectable()`, `@Cron()`, `@Module()`, etc.). Any test script run with plain `node` that tries to `import()` a NestJS-decorated `.ts` file will crash with `SyntaxError: Invalid or unexpected token`.

## Pattern
Move unit tests that need to instantiate NestJS classes into a dedicated `.ts` script that runs under SWC via subprocess:

```javascript
// In test-suite.mjs (main test runner — plain node)
const { spawnSync } = await import("child_process");
const path = await import("path");
const scriptPath = path.resolve(new URL(".", import.meta.url).pathname, "my-unit-test.ts");
const apiServerDir = path.resolve(new URL(".", import.meta.url).pathname, "..");

const result = spawnSync(
  "node",
  ["--import", "@swc-node/register/esm-register", scriptPath],
  {
    stdio: "inherit",
    cwd: apiServerDir,   // ← CRITICAL: must be the api-server dir so SWC finds .swcrc
    env: { ...process.env },
    timeout: 30_000,
  },
);
check("unit tests pass", result.status ?? 1, 0);
```

**Why:**
- `@swc-node/register` reads `.swcrc` from **cwd**, not from the script file's directory
- The api-server's `.swcrc` has `"decorators": true, "legacyDecorator": true`
- Without `cwd: apiServerDir`, SWC runs from the workspace root and finds no `.swcrc`, causing the same parse failure

**How to apply:**
- Whenever a new test section needs to `import()` a service/controller with NestJS decorators, create a separate `scripts/test-<name>.ts` file and run it as a subprocess with the pattern above
- The subprocess script itself can freely use SWC-compiled NestJS classes
