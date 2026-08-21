# Definition of Ready: API exposure and trend integrity (Phase 1c, item 1 and 2)

Written before the change shipped, as the methodology requires. Rollback plan
and blast radius are below, not appended afterwards.

## The two defects, as measured

Both were measured against production on 2026-08-21, after the Phase 1b
deployment, not inferred from reading code.

**1. Credential material in an API response.**
`GET /api/orgs/1/monitoring` returned `org_integrations` rows with
`accessToken`, `refreshToken`, `tokenExpiresAt` and `config` intact. One
`accessToken` was populated. The value is AES-256-GCM ciphertext, which is why
this survived review: it looks redacted and is not. Ciphertext in a response
body still lands in browser caches, corporate proxy logs, HAR files and support
screenshots, and it identifies which accounts hold a token worth stealing.

The integrations endpoint had redacted these fields since it was written.
`MonitoringService.getMonitoringJobs` read the same table and spread the rows
with the object spread operator, so one table was serialised two different ways
and the safe version was not the one the dashboard called.

**2. A generated compliance trend.**
`GET /api/orgs/1/score-history` returned 31 points, 30 of them with negative
ids. Scores ranged 17 to 23. The point dated today read 22 while the posture
single source of truth read 3. The generator eased a curve from
`Math.max(currentScore - 35, 20)` to a score it computed itself with
`passing / total`, added `Math.random()` noise, and fabricated per-day passing
and failing counts by multiplying the score back out.

This is the fifth surface that disagreed with the SSOT, and it was missed in
Phase 1 because the endpoint was reviewed for arithmetic rather than for whether
the numbers existed at all. Invented trend data in a tool whose output supports a
CMMC or FedRAMP assessment is worse than absent trend data, so the generator is
deleted rather than corrected.

## Acceptance criteria

Each is a measurement that can be re-run, and each failed before this phase.

1. `findCredentialLeaks` returns at least two findings for an unredacted
   integration row, and none for `tokenExpiresAt`. Asserted first, so the
   detector cannot make the rest of the file green by being broken.
2. `getMonitoringJobs` returns no credential material, measured by deep scan of
   the whole response, with a connected integration deliberately holding
   credentials present in the database.
3. The same response still reports `hasStoredCredentials: true` and retains
   non-credential config. Redaction must not gut the payload.
4. `monitoring.service.ts` contains no raw spread of an integration row.
5. Neither the score-history service nor its library calls `Math.random`, and
   neither contains the `currentScore - 35` floor.
6. `readScoreHistory` reports `synthetic: false` and
   `source: compliance_score_history`.
7. Every returned point has a positive id. The generator used negative ids.
8. The latest recorded point equals `posture.scorePercent` exactly - the same
   value the dashboard header shows. This is the assertion that failed at 22
   against 3.
9. Three snapshots taken on one UTC day leave exactly one point.
10. An organisation with no history gets `[]`, `points: 0` and a note saying so.
11. The dashboard renders an explanation when there is no trend, and no longer
    labels the window as ninety days.

## Blast radius

- `GET /orgs/:orgId/monitoring`: response fields removed. Any consumer reading
  `accessToken` breaks. Nothing should be, and the integrations list has never
  provided them, but this is the one breaking change in the phase.
- `GET /orgs/:orgId/score-history`: response gains `basis`; `history` becomes
  empty until points accumulate. The dashboard chart is the only consumer.
- `POST /orgs/:orgId/score-history/snapshot`: return shape changes from a row to
  a `SnapshotOutcome`.
- Startup: one extra pass over organisations at boot. On failure it warns and
  continues; it cannot prevent the service from serving traffic.
- No schema change. No migration. No destructive SQL.

## Rollback plan

Written before the forward change, and simpler than usual because there is no
migration to reverse.

1. Revert the commits on `phase1c/exposure-and-trend-integrity`. The monitoring
   endpoint returns to spreading rows and the generator returns with it.
2. Nothing to undo in the database. The only rows written are real
   `compliance_score_history` points, each recorded from the SSOT at the time
   shown. They remain accurate after a revert; the reverted code simply ignores
   them in favour of generated ones when the table is empty, and the table will
   not be empty.
3. If the trend must be emptied for a specific organisation, delete its rows in
   `compliance_score_history`. That is a data deletion and needs the same
   approval as any other, so it is not part of this rollback.

Rollback does not restore the credential exposure risk to zero - a token that has
been served to a browser should be rotated regardless of what the code does next.

## Out of scope, deliberately

- Item 3 and 4 of the outstanding list: rendering the Warning bucket and the
  `scoreBasis` block. Separate change, front end only.
- Historic warning and not-tested counts. `compliance_score_history` carries
  `passingControls` and `failingControls` only, and adding columns needs a
  migration this phase does not include. The basis block says so rather than
  implying the breakdown is complete.
- Back-filling history. There is no honest source for what the score was last
  month, and manufacturing one is the defect this phase removes.
