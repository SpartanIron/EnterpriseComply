# Fabricated control results on the live tenant, 2026-08-22

Status: closed for the code path, partially closed for the data.
Severity: data integrity, single tenant (org 1), no confidentiality impact.

## What happened

While checking whether the build containing the removal of the fabricating
connect path had reached production, a POST was sent to
`/api/orgs/1/integrations/slack/demo-connect` against the live tenant. The old
build was still serving traffic, so the route was still there, and it did what
it had always done: it invented compliance data.

Measured effect, taken from `/api/orgs/1/posture` and `/api/orgs/1/evidence`
before and after:

| Figure | Before | After |
| --- | --- | --- |
| passing | 2 | 4 |
| warning | 5 | 4 |
| failing | 3 | 2 |
| assessed | 10 | 10 |
| score (assessed) | 3 | 6 |
| evidence rows | 114 | 116 |

The two control results affected were UCO-AC-001 (row id 2) and UCO-DP-003
(row id 5). Both were updated in place: status became `passing`, `result`
became the sentence "Slack: control verified via automated scan", and
`integrationKey` became `slack`. The two evidence rows created were id 258
"Slack -- Workspace SSO Configuration" and id 259 "Slack -- Message Retention
Policy Export", both describing collections that never took place.

No scan ran. No Slack workspace was ever connected. The status was chosen by
`Math.random()`.

## Why it mattered

This is the failure mode a GRC platform cannot have. A control marked passing
with an evidence artefact attached is what an assessor relies on. Two of them
were sitting in the tenant with nothing behind them, and the compliance score
on the dashboard had doubled.

## Five whys

1. Why did fabricated results appear in the live tenant? Because a request was
   sent to the demo-connect route in production.
2. Why was that request sent? Because the route was being used as a probe to
   detect whether the new build had rolled out, on the assumption that it
   would 404 once deployed. The assumption was correct about the new build and
   irrelevant to the old one, which was still running and still wrote data.
3. Why was a data-writing route used as a deployment probe? Because there was
   no read-only way to identify the running build. There is now:
   `GET /api/integrations/connector-specs` answers 200 only on the new build,
   and it writes nothing.
4. Why did a route that fabricated compliance data exist in a production
   deployment at all? Because the demo path was built for sales
   demonstrations and was never separated from the customer surface - same
   auth, same tenant, same tables, no marker on the rows it produced.
5. Why was it not caught earlier? Because the test suite asserted that
   demo-connect returned 200/201. The fabrication was pinned in place by a
   passing test, so it read as a working feature rather than a defect.

## What was changed

Before this incident, in the same sequence of work:

- `connectDemo()` and the `demo-connect` route were deleted. Connecting now
  requires a credential that a vendor endpoint confirms, and a successful
  connection writes no control results and no evidence at all.
- The suite assertions that were pinning the fabrication were replaced with
  stronger ones rather than deleted: the route must 404, an unverifiable
  credential must be refused, an unavailable connector must answer 501.

After it, in this change:

- Retraction of a connector-written control result is a first-class,
  audited operation. `POST /orgs/:orgId/controls/:controlId/clear-automated-result`,
  owner only.
- The decision lives in `src/lib/control-result-clear.ts` as a pure function:
  a manually set result is refused, a row with no integration recorded is
  refused, and the write it produces deliberately contains no
  `manualOverride` field. Replacing a fabricated machine assertion with a
  fabricated human one would have been worse than leaving it.
- Both the retraction and any refusal are written to the audit log, with the
  previous values in the entry.

## What was not restored, and why

The statuses those two rows held before the probe overwrote them are gone.
The connector updated the rows in place, and the audit log of that day
recorded the HTTP call, not the values it replaced. From the before/after
counts it is known that one of the two was `failing` and the other `warning`,
but not which was which.

Guessing would have been a second fabrication, so retraction lands on
`not_tested` - the honest statement that nothing has tested the control. The
visible consequence is that org 1 shows 8 assessed controls where it showed 10
before, and both controls now appear in the not-tested bucket. That is a
truthful reading of the tenant's actual evidence.

The two evidence rows were retired rather than deleted. Evidence is WORM at
the database layer: `enforce_evidence_worm()` rejects DELETE, so retirement
sets `deletedAt`, `deletedBy` and `deletionReason`, the row leaves the
evidence list, and both the artefact and its ledger entry survive for the
retention window. The hash chain was verified intact afterwards: 106 entries,
106 valid, 0 tampered.

## Definition of done for this change

- The pure decision is unit tested without a database, including the negative
  property that no `manualOverride` key appears in the write.
- The route is owner-guarded and the guard is asserted in CI.
- The refusal path is audit logged, not only the success path.
- CI green on every required check before merge.
- The two rows in org 1 retracted, and the posture counts re-measured
  afterwards rather than assumed.

## Deliberately out of scope

- No UI affordance. Retraction is reachable by an owner through the API only.
  Adding a button to the controls page is a larger change to a page this work
  has not otherwise touched, and shipping the honest data path first was the
  priority. Stated as a decision, not an oversight.
- No restoration of the pre-incident statuses, for the reason above.
- No schema change, so no migration and no rollback script. Rollback is
  reverting the merge commit; the audit entries it wrote are retained by
  design.
