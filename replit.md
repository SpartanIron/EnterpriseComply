# C2S Cyber Assurance Operating System (C2S-CIOP)

Production-grade cyber intelligence command dashboard for CISOs — real-time posture, compliance, risk, asset, findings, telemetry, and graph intelligence built by ColorCode Solutions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied via `/api`)
- `pnpm --filter @workspace/c2s-ciop run dev` — run the frontend (port 19222, proxied via `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec (then fix `lib/api-zod/src/index.ts` to only export `./generated/api`)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (port 19222), Tailwind CSS v4, Recharts, Wouter routing
- API: Express 5 (port 8080, path `/api`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Fonts: JetBrains Mono (metrics/data), Inter (labels)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec, source of truth for all endpoints
- `lib/api-spec/orval.config.ts` — codegen config (schemas section must NOT have `type` key)
- `lib/api-zod/src/index.ts` — must only export `./generated/api` (orval overwrites this)
- `lib/api-client-react/src/generated/api.ts` — all React Query hooks
- `lib/db/src/schema/` — Drizzle table definitions (controls, frameworks, assets, risks, findings, telemetry, evidence, graph)
- `artifacts/api-server/src/routes/` — Express route handlers per domain
- `artifacts/c2s-ciop/src/pages/` — Dashboard, Controls, Risks, Frameworks, Assets, Findings, Telemetry, Graph
- `artifacts/c2s-ciop/src/components/layout/` — Sidebar, Header, Layout

## Architecture decisions

- **Contract-first API**: OpenAPI spec drives code generation for both server Zod schemas and React Query client hooks — never hand-write these
- **Numeric DB IDs → string API IDs**: All route handlers convert `r.id` to `String(r.id)` before Zod parse, since OpenAPI schema uses string IDs
- **0 border-radius throughout**: CSS `--radius: 0px` enforces financial terminal / sharp borders aesthetic site-wide
- **Dark mode default**: ThemeProvider defaults to `dark`, stored in `c2s-ciop-theme` localStorage key
- **Bento tile grid**: Dashboard uses `grid-cols-12 gap-px bg-border` for seamless bento layout with 1px dividers

## Product

- **Command Dashboard**: Executive posture score (0-100), trend chart, critical findings, attack paths, control effectiveness, framework overview, risk exposure, telemetry feed
- **Control Validation**: UCO (Universal Control Ontology) with 12 controls; filter by status, maturity dots, drift detection, evidence freshness
- **Risk & Attack Paths**: Risk registry ordered by score with exploitability bars and threat intel; attack path chains with likelihood/impact
- **Compliance Frameworks**: 12 frameworks (NIST 800-53, FedRAMP, CMMC, ISO 27001, SOC 2, PCI DSS, etc.) with bar chart and cards
- **Asset Intelligence**: 12 assets with risk score, exposure, CVE count, control coverage, crown jewel / internet exposed flags
- **Security Findings**: 10 findings with SLA breach detection (highlights in red when overdue)
- **Telemetry & Evidence**: 8 live sources with events/min and latency; scrollable event stream; evidence registry with freshness
- **Cyber Graph**: Interactive SVG graph (pan/drag/zoom) showing 17 nodes + 16 edges with node type shapes, risk color coding, and click-to-highlight attack paths

## User preferences

- Financial terminal + cyber ops aesthetic — no generic SaaS
- High-contrast dark mode default (near-black #0a0a0a background)
- JetBrains Mono for all metrics and data, Inter for labels
- 60-90px hero metric typography (responsive: text-5xl → text-7xl)
- Sharp 0px border radius throughout
- Executive-focused — every screen readable at a glance

## Gotchas

- After running codegen, manually fix `lib/api-zod/src/index.ts` to only: `export * from "./generated/api";`
- All numeric DB IDs must be `String(r.id)` before Zod parsing in route handlers
- The Google Fonts `@import url(...)` must be the very first line in `index.css` (before tailwindcss imports)
- Do NOT call services directly by port — always use `localhost:80/<path>` through the proxy

## Pointers

- See `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- API routes: `artifacts/api-server/src/routes/index.ts`
- DB schema: `lib/db/src/schema/index.ts`
