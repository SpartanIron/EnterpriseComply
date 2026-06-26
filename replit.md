# EnterpriseComply

Full-stack compliance automation SaaS platform by ColorCode Solutions - offered under colorcodesolutions.com. Vanta-competitor with federal layer, covering 12 frameworks from SOC 2 to FedRAMP.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` - run the API server (port 8080, proxied via `/api`)
- `pnpm --filter @workspace/c2s-ciop run dev` - run the frontend (port 19222, proxied via `/`)
- `pnpm run typecheck` - full typecheck across all packages (all 4 packages pass clean)
- `pnpm run build` - typecheck + build all packages
- `psql "$DATABASE_URL" -f <sql-file>` - push schema changes (drizzle-kit push blocks interactively; use psql directly)
- `cd lib/db && /home/runner/workspace/artifacts/c2s-ciop/node_modules/.bin/tsx src/seed-colorcomply.ts` - re-seed UCO controls, 147 framework mappings, automated tests
- Required env: `DATABASE_URL`, `SESSION_SECRET`
- Optional: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` for GitHub OAuth integration

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (port 19222), Tailwind CSS v4, Wouter routing, better-auth/react
- API: NestJS 11 (port 8080, path `/api`), better-auth, modular controller/service/module pattern
- DB: PostgreSQL + Drizzle ORM (multi-tenant schema, 28 tables)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (ESM bundle for API server production); SWC (`@swc-node/register`) for dev runner
- Fonts: Inter (all text)

## Where things live

- `lib/db/src/schema/` - all Drizzle table definitions (13 schema files, 28 tables)
- `lib/db/src/seed-colorcomply.ts` - seeds 41 UCO controls + 147 framework mappings + 6 automated tests
- `lib/db/src/seed-intelligence.ts` - stub/no-op (superseded by seed-colorcomply.ts)
- `artifacts/api-server/src/modules/` - 19 NestJS modules
- `artifacts/api-server/src/guards/` - ClerkAuthGuard, OrgContextGuard, param decorators
- `artifacts/api-server/src/middlewares/` - ClerkProxyMiddleware (production only)
- `artifacts/c2s-ciop/src/pages/` - 23 pages
- `artifacts/c2s-ciop/src/components/layout/AppShell.tsx` - sidebar + layout shell
- `artifacts/c2s-ciop/src/hooks/useOrg.ts` - shared org hook

## Architecture decisions

- **Multi-tenant by orgId**: every table has `org_id`; all routes scoped to `/orgs/:orgId/...` with better-auth session middleware
- **UCO (Universal Control Objectives)**: 41 canonical controls mapped to 147 framework entries across 12 frameworks - implement once, satisfy all simultaneously
- **better-auth**: `authClient` from `better-auth/react` in frontend (`src/lib/auth-client.ts`); backend config at `artifacts/api-server/src/lib/better-auth.ts`; auth routes at `/api/auth`
- **NestJS modular architecture**: each domain is a self-contained module (controller + service + module); guards in `src/guards/`
- **DB migrations via psql**: `drizzle-kit push` blocks interactively on existing constraints; use `psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS..."` for new tables
- **GitHub OAuth connector**: `GET /api/integrations/github/connect` - GitHub OAuth - callback stores token + syncs repos/members/MFA
- **Demo connect**: non-GitHub integrations (GWS, AWS, Okta, Azure AD, Slack) use `POST /api/orgs/:orgId/integrations/:key/demo-connect` to simulate a connection and collect sample evidence
- **Drizzle insert typing**: service methods accept `Record<string, unknown>` and spread with `as any` into Drizzle `.values()` - type-safe at the schema level but bypasses strict TS overload resolution

## Product

**Unauthenticated**: Landing page with hero, framework list, feature cards, CTA

**Onboarding**: 4-step wizard: company info - framework selection (12 frameworks) - GitHub connect - done

**App (authenticated) - 23 pages across 7 nav sections:**
- Overview: Dashboard (score ring, per-framework cards, stats, getting-started checklist)
- Compliance: Frameworks, Controls (UCO grouped by domain), Risk Register (heat map + UCO control linkage)
- Evidence: Integrations (25-item catalog, 6 connectable), Evidence Vault (staleness badges + DELETE), Monitoring (drift detection, notifications)
- Workforce: Policies (30 templates, lifecycle, acknowledgment tracking), People (edit/delete modals, MFA/training table), Access Reviews (attestation campaigns), Vendors (edit/delete modals)
- Audit & Sales: Auditor Portal (engagement management, evidence requests, copy-token modal), Questionnaires (honest AI labeling + keyword matching), Trust Center (public-facing page)
- Federal: POA&M (create-from-failing button, PATCH/DELETE), SPRS Score (CMMC/NIST 800-171 scoring), SSP Generator, Custom Frameworks
- Settings + Audit Log

## User preferences

- Clean enterprise SaaS aesthetic: white/blue-600/slate palette, Inter font, rounded-lg borders
- Blue CTA buttons throughout
- No old C2S/CIOP patterns - this is a fresh product
- Sharp, information-dense tables and cards
- No em dashes anywhere in the codebase (use hyphens instead)
- Corporate email: jude.annan@colorcodesolutions.com

## Railway Deployment

- **`railway.toml`** in repo root defines build + start commands for Railway
- **Build**: `pnpm install && BASE_PATH=/ pnpm --filter @workspace/c2s-ciop run build && pnpm --filter @workspace/api-server run build`
- **Start**: `node --enable-source-maps artifacts/api-server/dist/main.mjs`
- **API serves frontend**: In production, NestJS uses `@nestjs/serve-static` to serve `artifacts/c2s-ciop/dist/public/` with SPA fallback, excluding `/api/*`
- **Auto-migration on boot**: `StartupService` (`artifacts/api-server/src/startup/`) runs `CREATE TABLE IF NOT EXISTS` for all 32 tables and seeds UCO controls if empty - zero manual steps on first deploy
- **Required Railway env vars**:
  - `DATABASE_URL` - PostgreSQL connection string (Railway provides this automatically)
  - `SESSION_SECRET` - random secret for sessions
  - `CLERK_SECRET_KEY` - from Clerk production dashboard
  - `VITE_CLERK_PUBLISHABLE_KEY` - from Clerk production dashboard (build-time)
  - `NODE_ENV=production`
- **Optional Railway env vars**:
  - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - GitHub OAuth app (callback URL: `https://<your-domain>/api/integrations/github/callback`)
  - `OPENAI_API_KEY` - standard OpenAI key for AI gap analysis (Replit proxy env vars also work if set)
  - `ALLOWED_ORIGIN` - restrict CORS to specific origin (e.g. `https://myapp.railway.app`); if unset, same-origin works fine
- **Clerk setup for Railway**: Create a production Clerk application, set the domain to your Railway URL, enable Clerk proxy at `https://<your-domain>/api/__clerk`
- **GitHub OAuth setup**: In GitHub Developer Settings, set callback URL to `https://<your-domain>/api/integrations/github/callback`
- **BASE_PATH**: Always `/` on Railway (not path-routed like Replit)

## Gotchas

- Clerk proxy middleware (`/api/__clerk`) only activates in `NODE_ENV=production`; never set `proxyUrl` unconditionally
- All DB tables use `org_id` for tenant isolation - never query across orgs
- `lib/db/src/migrate-fresh.ts` drops and recreates all tables - only run in dev
- `artifacts/c2s-ciop/src/lib/queryClient.ts` exports `apiUrl()` and `apiFetch()` helpers - use these for all API calls
- NestJS esbuild: externalize `@nestjs/websockets`, `@nestjs/microservices`, `class-transformer`, `class-validator`
- **NestJS dev runner must use SWC, not tsx**: `tsx` uses esbuild and does NOT emit decorator metadata; NestJS DI silently fails. Dev script: `node --import @swc-node/register/esm-register src/main.ts`
- `npx tsx` (global) doesn't have access to `pg` - use absolute path: `/home/runner/workspace/artifacts/c2s-ciop/node_modules/.bin/tsx` from `lib/db/`
- `drizzle-kit push` blocks on `organizations_slug_unique` constraint prompt in dev - use psql for new table additions
- `lib/db/src/seed-colorcomply.ts` exports `seedColorComply()` - importable via `@workspace/db/seed`; `StartupService` calls it on first deploy if UCO table is empty
- `BASE_PATH` and `PORT` are optional in `vite.config.ts` - both default gracefully (PORT to 5173, BASE_PATH to `/`) so Railway builds work without injecting Replit env vars

## Pointers

- DB schema: `lib/db/src/schema/index.ts`
- API modules: `artifacts/api-server/src/modules/`
- App entrypoint: `artifacts/api-server/src/main.ts`, `artifacts/api-server/src/app.module.ts`
- Clerk setup: `.local/skills/clerk-auth/SKILL.md`
