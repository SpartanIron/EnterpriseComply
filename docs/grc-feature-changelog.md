# GRC Feature Changelog

Record of product-layer feature additions to the EnterpriseComply GRC platform.
Infrastructure and identity changes are tracked in `artifacts/PLATFORM_CHANGELOG.md`.

---

## 2026-08-09

### Added: Audit retention period configurable from Settings (Task #34)

Enterprise-plan admins can now set how long audit logs are retained directly from
**Settings > Security** without a database query. The retention selector (90 days
to 7 years) is wrapped in a `<PlanGate requiredPlan="enterprise">` component so
Starter and Professional users see an upgrade prompt instead.

- Controls: SOC 2 CC7.2, NIST 800-53 AU-11
- Frontend: `artifacts/c2s-ciop/src/pages/Settings.tsx` (SecurityTab, lines 569-613)
- API: `PATCH /api/orgs/:orgId/audit-retention` — requires `owner` role + `enterprise` plan
- DB column: `organizations.audit_retention_days` (INTEGER, default 1095 / 3 years)
- Enforcement: `StartupService` reads `auditRetentionDays` on the nightly sweep

---

### Added: Federal section hidden for non-enterprise plans (Task #36)

The "Federal" sidebar section (POA&M, SPRS Score, SSP Generator, Custom Frameworks,
NIST 800-171, FISMA Reporting, STIGs, Zero Trust, System Boundary, ConMon) is now
hidden for orgs on Starter or Professional plans. The gate is plan-AND-role: the
section is visible only when `org.plan` is `enterprise` or `federal` AND the user
has at least `compliance_manager` role. `super_admin` always bypasses both checks.

- Frontend: `artifacts/c2s-ciop/src/components/layout/AppShell.tsx`
  - `SECTION_PLAN_REQUIRED` map at module level
  - Plan check runs inside `NAV.map()` alongside the existing `canSeeSection()` call
- Note: route-level protection is tracked as a separate follow-up (Task #59); this
  change covers sidebar visibility only.

---

### Added: Remediation guidance in control crosswalk expanded rows (Task #50)

Expanding any row in the **Control Crosswalk** page now shows three live data panels
fetched from `GET /orgs/:orgId/controls`:

| Panel | Condition | Source |
|-------|-----------|--------|
| Failure Reason | Result status is `failing` or `partial` | `result.failureReason` from `orgControlResultsTable` |
| Remediation Guidance | Always (when available) | `remediationGuidance` from `ucoControlsTable` |
| Team Notes | When `remediationNotes` is set | `result.remediationNotes` from `orgControlResultsTable` |

Passing controls without any guidance show a green confirmation card instead of an
empty panel. Failing/partial controls without guidance link to the Remediation Board
and AI Gap Analysis pages.

- Controls: SOC 2 CC4.1, NIST 800-53 CA-7
- Frontend: `artifacts/c2s-ciop/src/pages/ControlCrosswalk.tsx`
  - `useQuery` for `/orgs/:orgId/controls`; `controlMap` useMemo keyed by `controlId`
  - Expanded row renders three conditional panels in the right column

---

### Added: PDF export for control crosswalk (Task #48)

A **Download PDF** button now sits alongside the existing CSV export on the
Control Crosswalk page. It generates a print-ready landscape HTML report in a
new browser tab containing:

- Summary stats (total, passing, partial, failing, average coverage)
- Full control table with all currently-active framework columns, color-coded by
  framework, and a visual coverage bar per row
- One-click "Print / Save PDF" button in the corner of the generated page
- Report respects the active framework toggles and search/filter state at the time
  of export

Approach matches existing print-to-PDF flows in ZeroTrustAssessmentReport,
ComplianceReport, and SSP pages — no server-side PDF library required.

- Frontend: `artifacts/c2s-ciop/src/pages/ControlCrosswalk.tsx` (`exportCrosswalkPdf` function)

---

## Earlier

See `artifacts/PLATFORM_CHANGELOG.md` for infrastructure, identity, and DNS changes
predating this feature log.
