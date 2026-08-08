---
name: Frontend data-binding patterns
description: How the API response shapes map to frontend reads in the GRC pages — key mismatches found and fixed.
---

## Controls response shape
`GET /api/orgs/:orgId/controls` returns enriched controls:
```
{ controls: [ { ...ucoControlFields, result: { status, ownerName, failureReason, dueDate, ... } } ] }
```
**Status is NESTED at `c.result.status`, NOT at `c.status`.**
Top-level UCO fields: `controlId`, `domain`, `name`, `description`, `objective`, `testable`, `automationLevel`, `remediationGuidance`.

## Frameworks response shape
`GET /api/orgs/:orgId/frameworks` returns:
```
{ frameworks: [ { id, orgId, frameworkKey, name, shortName, category, active, complianceScore, passingControls, failingControls, notTestedControls, totalControls, ... } ] }
```
Compliance metric columns (`complianceScore` etc.) are stored directly on `org_frameworks` table and updated by `updateFrameworkScores()` in ControlsService when a control result is patched.

## FRAMEWORK_INFO key alignment
Backend framework keys (from FRAMEWORK_CATALOG / DB): `fedramp`, `fedramp-high`, `fedramp-low`, `cmmc-l2`, `cmmc-l1`, `soc2`, `iso27001`, `sox`, `hitrust`, `iso27701`, `dora`, plus `pci-dss`, `gdpr`, `ccpa`, `hipaa`, `stateramp`, `nycrr-500`, `nist-800-53`, `nist-800-171`, `nist-csf`, `nist-ai-rmf`, `cis-controls`, `cyber-essentials`.
Frontend `FRAMEWORK_INFO` keys have been aligned to match these exactly.

## isLoading guard pattern
Pages that first fetch `/orgs/me` (to get orgId) before enabling a dependent query must combine both loading states:
```typescript
const { data: orgData, isLoading: orgLoading } = useQuery({ queryKey: ["orgs","me"], ... })
const orgId = orgData?.org?.id
const { data: fwData, isLoading: fwLoading, isError } = useQuery({ ..., enabled: !!orgId })
const isLoading = orgLoading || fwLoading
```
Without this, the page flashes EmptyState while `/orgs/me` is in-flight.

## queryFn error handling
All queryFns should check `res.ok` and throw on non-2xx, so React Query correctly sets `isError` instead of silently treating error JSON as data.

**Why:** Without `res.ok` check, a 401 response body like `{statusCode:401, message:"Unauthorized"}` becomes `data`, `data?.frameworks` is undefined, and the page silently shows EmptyState with no indication of the real error.
