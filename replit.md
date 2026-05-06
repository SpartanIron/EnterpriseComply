# C2S Cyber Assurance Operating System (C2S-CIOP)

Production-grade Cyber Assurance OS for CISOs — real-time posture, compliance achievement, risk intelligence, and AI executive briefings built by ColorCode Solutions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied via `/api`)
- `pnpm --filter @workspace/c2s-ciop run dev` — run the frontend (port 19222, proxied via `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec (then fix `lib/api-zod/src/index.ts` to only export `./generated/api`)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `npx tsx lib/db/src/seed-intelligence.ts` — re-seed intelligence data (mappings, POA&M, journeys, briefing)
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
- `lib/db/src/schema/` — Drizzle table definitions (controls, frameworks, assets, risks, findings, telemetry, evidence, graph, controlMappings)
- `lib/db/src/schema/controlMappings.ts` — NEW: control_framework_mappings, poam_items, compliance_journeys, remediation_tasks, executive_briefings
- `lib/db/src/seed-intelligence.ts` — seeds all new intelligence tables
- `artifacts/api-server/src/routes/` — Express route handlers per domain
- `artifacts/api-server/src/routes/intelligence.ts` — NEW: gap analysis, POA&M, journeys, briefing, financial exposure
- `artifacts/c2s-ciop/src/pages/` — Dashboard, Controls, Risks, Frameworks, Assets, Findings, Telemetry, Graph, GapAnalysis, POAM, ComplianceJourney, ExecutiveBrief
- `artifacts/c2s-ciop/src/components/layout/` — Sidebar (OBSERVE/ACHIEVE/INTELLIGENCE sections), Header, Layout

## Architecture decisions

- **Contract-first API**: OpenAPI spec drives code generation for both server Zod schemas and React Query client hooks — never hand-write these
- **Numeric DB IDs → string API IDs**: All route handlers convert `r.id` to `String(r.id)` before Zod parse, since OpenAPI schema uses string IDs
- **0 border-radius throughout**: CSS `--radius: 0px` enforces financial terminal / sharp borders aesthetic site-wide
- **Universal Control Graph (the moat)**: `control_framework_mappings` table maps one UCO canonical control to N framework control IDs simultaneously — implement once, validate once, output evidence for all frameworks
- **FAIR-lite financial exposure**: `baseLoss(severity) × exploitability × blastRadius` gives defensible $ range without actuarial data. criticalAsset=$2M, high=$800K, medium=$250K, low=$50K
- **Executive briefing is deterministic**: No external AI API — computed from live DB state (control failures, open findings, risk scores, framework gaps). Cached 5 min, refresh on demand

## Product

**OBSERVE** (existing)
- Command Dashboard: Executive posture arc gauge (0-100), sparkline tiles, action-required panel, zone-banded trend chart
- Control Validation: UCO 12 controls, drift detection, maturity dots, evidence freshness
- Risk & Attack Paths: Exploitability bars, blast radius, attack chain visualization
- Compliance Frameworks: 12 frameworks, bar chart, compliance scores
- Asset Intelligence: Crown jewel flags, CVE counts, control coverage
- Security Findings: SLA breach detection, dual filters
- Telemetry & Evidence: 8 live sources, event stream, evidence registry
- Cyber Graph: Interactive SVG, 17 nodes + 16 edges, click-to-highlight attack paths

**ACHIEVE** (new — the moat)
- Gap Analysis: One UCO control → all framework control IDs it satisfies; donut score, blocker panel, control-level table with expand-for-rationale; 7 frameworks supported
- POA&M: FedRAMP-compliant Plan of Action & Milestones; milestone tracking, status updates, owner/team, original→residual risk, overdue highlighting
- Compliance Journey: 6-phase ATO workflow (Scope→Gap→Roadmap→Validate→Package→Authorized); readiness gauge, remediation task board with inline status updates

**INTELLIGENCE** (new)
- Executive Brief: AI-derived board-ready narrative; financial exposure ($3.7M–$22M range), active threat vectors, recommended board actions, briefing confidence scores

## User preferences

- Financial terminal + cyber ops aesthetic — no generic SaaS
- Light mode default (white/slate-200/blue-600)
- JetBrains Mono for all metrics and data, Inter for labels
- Sharp 0px border radius throughout
- Executive-focused — every screen readable at a glance
- 3px left-border severity accents on all table rows

## Gotchas

- After running codegen, manually fix `lib/api-zod/src/index.ts` to only: `export * from "./generated/api";`
- All numeric DB IDs must be `String(r.id)` before Zod parsing in route handlers
- The Google Fonts `@import url(...)` must be the very first line in `index.css` (before tailwindcss imports)
- Do NOT call services directly by port — always use `localhost:80/<path>` through the proxy
- intelligence.ts routes bypass OpenAPI codegen — they call the DB directly and return plain JSON (new routes added post-codegen-setup)
- React table rows with expandable detail: use `React.Fragment key={id}` not `<>` — tbody children need keys

## Pointers

- See `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- API routes: `artifacts/api-server/src/routes/index.ts`
- DB schema: `lib/db/src/schema/index.ts`
- Architecture blueprint: `.local/architecture.md`
