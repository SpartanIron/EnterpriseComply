# Definition of Ready: the warning bucket and the score basis (Phase 1c, items 3 and 4)

Written before the change shipped. Rollback plan and blast radius below.

## What was wrong, as measured

Measured against production on 2026-08-21, after the Phase 1c exposure deploy.

**The warning bucket was invisible.** The API reported
`controlSummary: { passing: 2, warning: 5, failing: 3, notTested: 61, total: 71 }`.
The dashboard KPI row rendered three of those four. The controls page rendered a
Warning badge on individual rows, but tallied its header counts in the browser
across three buckets and offered no Warning filter tab. Five controls therefore
existed in the list, appeared in no header figure anywhere in the product, and
could not be listed on their own.

**The score basis was never displayed.** `scoreBasis` has been in the dashboard
response since the Phase 1 cutover, with the denominator, the previous
denominator, the assessed-only percentage and a written note. The score moved
from 20 to 3 at the cutover because the denominator changed from assessed
objectives to all assigned objectives. On screen it simply looked like the score
collapsed.

**Two data limitations were JSON-only.** `coverageWarnings` reports 23 of 110
mapped for 800-171 and 44 of 389 for 800-53. `catalogInconsistencies` reports the
Rev 3 label against the Rev 2 requirement set. Both are things an assessor asks
about immediately. Neither was on screen.

## Acceptance criteria

Re-runnable, and all of them failed before this branch.

1. `getOrgControls` serves a `summary` whose `source` is `posture-ssot` and whose
   `degraded` is false.
2. `summary.counts.warning` equals `computePosture(org).counts.warning`.
3. passing + warning + failing + notTested equals total. The buckets partition
   the set.
4. The dashboard endpoint and the controls endpoint report the same warning
   count. Two readers of one source of truth cannot disagree.
5. The dashboard response still carries a `scoreBasis` with a note and a
   denominator.
6. `Controls.tsx` has a `warning` filter case, a Warning filter tab and a
   Warning stat card, and reads `data?.summary` rather than tallying.
7. `Dashboard.tsx` renders a Warning KPI tile from `cs.warning`.
8. `Dashboard.tsx` renders `ScoreBasisPanel` including `basis.note`.
9. `Dashboard.tsx` renders `coverageWarnings` and `catalogInconsistencies`.
10. The guard creates a control in warning before asserting, because a blank
    database has none - which is precisely how the bucket went missing while
    every test stayed green.

## Blast radius

- `GET /orgs/:orgId/controls`: additive. Gains `summary`. Existing consumers of
  `controls` are unaffected.
- One extra `computePosture` call per controls page load. It already runs for the
  dashboard and is not expensive; on failure the endpoint degrades to a local
  four-bucket tally rather than erroring.
- `KpiCard` gains an `amber` colour. Additive to a union type; existing call
  sites keep their values.
- Dashboard KPI row goes from four tiles to five, so the grid changes from
  `md:grid-cols-4` to `md:grid-cols-3 lg:grid-cols-5`. This is the only visual
  regression risk in the change, and it is a layout change on one row.
- The dashboard makes one additional request, to `/orgs/:orgId/posture`.
- No schema change. No migration. No destructive SQL.

## Rollback plan

1. Revert the commits on `phase1c/warning-and-basis-ui`. The API stops serving
   `summary`, the pages return to three buckets, and nothing else changes.
2. No database state is written by this change, so there is nothing to undo.
3. The guard's warning fixture writes one `org_control_results` row on a CI
   database only. It is not created against production.

## Out of scope, deliberately

- Reconciling the Rev 3 label with the Rev 2 requirement set. Surfacing it is
  this change; deciding it is a control-content decision for the owner.
- Closing the coverage gap. Mapping the remaining 87 and 345 controls is content
  work, not a rendering change.
- The frameworks page, which shows per-framework percentages against declared
  control counts. It is consistent with the SSOT but would read better with the
  coverage figure beside it. Noted, not done here.
