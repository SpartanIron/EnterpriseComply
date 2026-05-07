# ColorComply

Full-stack compliance automation SaaS platform by ColorCode Solutions — Vanta-competitor with federal layer, covering 12 frameworks from SOC 2 to FedRAMP.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied via `/api`)
- `pnpm --filter @workspace/c2s-ciop run dev` — run the frontend (port 19222, proxied via `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `npx tsx lib/db/src/seed-colorcomply.ts` — re-seed UCO controls, framework mappings, automated tests
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- Optional: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` for GitHub OAuth integration

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (port 19222), Tailwind CSS v4, Wouter routing, @clerk/react
- API: Express 5 (port 8080, path `/api`), @clerk/express
- DB: PostgreSQL + Drizzle ORM (multi-tenant schema)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle for API server)
- Fonts: Inter (all text)

## Where things live

- `lib/db/src/schema/` — all Drizzle table definitions (organizations, ucoControls, orgCompliance, orgWorkforce, orgIntegrations, orgPoam)
- `lib/db/src/seed-colorcomply.ts` — seeds UCO controls + framework mappings + automated tests
- `artifacts/api-server/src/routes/` — orgs, frameworks, controls, integrations, evidence, people, vendors, poam, policies
- `artifacts/c2s-ciop/src/pages/` — Landing, Onboarding, Dashboard, Frameworks, Controls, Integrations, Evidence, Policies, People, Vendors, POAM, Settings
- `artifacts/c2s-ciop/src/components/layout/AppShell.tsx` — sidebar + layout shell

## Architecture decisions

- **Multi-tenant by orgId**: every table has `org_id`; all routes scoped to `/orgs/:orgId/...` with Clerk auth middleware
- **UCO (Universal Control Objectives)**: 41 canonical controls mapped to 12 frameworks — implement once, satisfy all frameworks simultaneously
- **Clerk proxy only in production**: `proxyUrl` on ClerkProvider is only set when `import.meta.env.PROD`; dev mode loads Clerk JS directly from CDN
- **No OpenAPI codegen for new routes**: ColorComply routes call DB directly and return plain JSON — added post-codegen-setup, no spec file
- **GitHub OAuth connector**: `GET /api/integrations/github/connect` → GitHub OAuth → callback stores token + syncs repos/members/MFA

## Product

**Unauthenticated**
- Landing page: hero, framework list, feature cards, CTA

**Onboarding** (post-signup)
- 4-step wizard: company info → framework selection (12 frameworks) → GitHub connect → done

**App (authenticated)**
- Dashboard: overall score ring, passing/failing/untested stats, per-framework cards
- Frameworks: compliance scores per active framework, add from catalog modal
- Controls: UCO control list grouped by domain, manual override, expand for remediation guidance
- Integrations: connected/available/coming-soon integration catalog, sync button
- Evidence Vault: auto-collected + manual evidence items
- Policies: template library, activate to org, track publication status
- People: workforce MFA/training/access-review compliance table
- Vendors: third-party vendor risk table with DPA tracking
- POA&M: FedRAMP-compliant Plan of Action & Milestones with inline status updates
- Settings: org name/industry/size edit, plan info

## User preferences

- Clean enterprise SaaS aesthetic: white/blue-600/slate palette, Inter font, rounded-lg borders
- Blue CTA buttons throughout
- No old C2S/CIOP patterns — this is a fresh product
- Sharp, information-dense tables and cards

## Gotchas

- Clerk proxy middleware (`/api/__clerk`) only activates in `NODE_ENV=production`; never set `proxyUrl` unconditionally
- All DB tables use `org_id` for tenant isolation — never query across orgs
- `lib/db/src/migrate-fresh.ts` drops and recreates all tables — only run in dev
- `artifacts/c2s-ciop/src/lib/queryClient.ts` exports `apiUrl()` and `apiFetch()` helpers — use these for all API calls
- Old C2S pages (Assets, Risks, GapAnalysis, etc.) remain in `pages/` but are not imported — safe to delete

## Pointers

- DB schema: `lib/db/src/schema/index.ts`
- API routes: `artifacts/api-server/src/routes/index.ts`
- Clerk setup: `.local/skills/clerk-auth/SKILL.md`
