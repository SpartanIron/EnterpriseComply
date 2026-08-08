---
name: Dashboard control count distinction
description: cs.total in the dashboard is org-assigned controls (org_control_results rows), NOT the 71-control UCO catalog — these are different numbers and easy to confuse.
---

# Dashboard Control Count Distinction

## The rule
`controlSummary.total` (aliased `cs.total` in `Dashboard.tsx`) = the number of rows in `org_control_results` for the org — i.e. controls that have been explicitly assigned/tested for that specific org.

The UCO catalog has 71 controls in `uco_controls` and is a platform-wide reference; org_control_results is the org-specific working set.

**Why:** A new org may have 9 org_control_results rows even though the platform has 71 UCO controls. These represent different things. Both numbers are correct; they just measure different things. The UI must label them differently to avoid auditor confusion.

## How to apply
- Any KpiCard or progress bar using `cs.total` must be labeled "assigned" or "tracked controls" — NOT just "controls" (which implies the full catalog)
- The full catalog count (71) comes from the Frameworks page / UCO catalog query, never from `controlSummary`
- The Dashboard comment at line ~238-242 in `Dashboard.tsx` explains this inline
- `TrustCenter.tsx` uses the same `orgControlResultsTable` count for its `overallScore`; same distinction applies there
