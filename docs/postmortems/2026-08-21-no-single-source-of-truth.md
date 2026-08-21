# Postmortem: no single source of truth for computed compliance data

- Date: 2026-08-21
- Severity: high. Customer-facing compliance figures were wrong in a direction
  that a customer could not detect and an assessor could.
- Detection: manual audit during Phase 0 of the remediation plan. Not by an
  alert, not by a test, not by a user report.
- Status: causes fixed or in shadow mode; the systemic fix is Phase 1.

This is deliberately one postmortem covering two findings that were first
reported separately:

1. The risk register held 560 rows built from a 20-row seed.
2. Five surfaces reported five different compliance postures for one org.

Treating them as two bugs would produce two point fixes and a third instance
later. They are the same failure: **a value with more than one producer, and
nothing that checks the producers against each other.**

## Timeline

- 2026-08-09 - org 1 created.
- 2026-08-10 onwards - each service restart appends 20 rows to `org_risks`.
  Nothing logs it, nothing alerts, the UI simply gets longer.
- 2026-08-21 - audit. `GET /orgs/1/risks` returns 560 rows, 20 distinct titles,
  each exactly 28 times. Ids arrive in blocks of 20, one block per boot, the last
  at 17:20 - the deploy from an hour earlier. All 560 have `review_date` null.
- 2026-08-21 - the same audit finds five disagreeing posture figures and reads
  the code behind each.

## What went wrong

### Finding 1: the risk seed

`StartupService.seedCommonRisks()` reads a `COUNT(*)` into `riskCnt` and
never uses it. Its per-row `try/catch` is commented `/* skip duplicates */`,
and a trailing comment states "count check above prevents re-seeding". Both are
false: there was no unique constraint, so the insert never raised, and the count
was never compared to anything.

The decisive detail is what sits next to it. `seedSubProcessors()` and
`seedComplianceCalendar()`, the two functions immediately following, perform an
identical count check and both end it with `if (cnt > 0) continue;`. One line.
Its absence in the risk seeder is the entire defect.

Also present and unused: `org_risks_seeded`, a table with `org_id` UNIQUE,
created by the migration SQL and never read from or written to. Somebody designed
the idempotency guard and shipped the table without the code.

### Finding 2: five postures

Four causes, all in the ADR: the dashboard counted result rows rather than
control objectives, so 61 untested objectives were invisible and the score's
denominator collapsed from 71 to 10; every consumer derived `notTested` by
subtraction, which absorbed all five warnings; framework published-control counts
were divided against mapped-objective counts; and three independent mapping
sources existed, one of them empty.

The only writer of the stored framework scores is called from one place and its
body is `catch (_) {}`.

## Five whys

1. **Why did the risk register hold 560 rows?** Because the seeder inserted 20
   per boot and nothing stopped it.
2. **Why did nothing stop it?** Because the guard was computed and then not
   written, and the constraint that would have caught the omission did not exist.
3. **Why did nobody notice for 28 boots?** Because no code compared the number of
   risks that should exist with the number that did. The comment asserting
   correctness was treated as evidence of it - and the same shape appears in the
   posture finding, where five surfaces each asserted a number and none compared
   it with the others.
4. **Why was there no comparison?** Because in both cases the value had no owner.
   `org_risks` content was owned by whoever last edited the seeder;
   "compliance posture" was owned by whichever page needed it. A value with no
   single producer has no place to put a check.
5. **Why was there no single producer?** Because these numbers were treated as
   presentation - something a page computes on the way to rendering - rather than
   as domain state with an invariant. Presentation gets duplicated per view
   without anyone feeling they have done something wrong.

Root cause: **computed compliance data had no single producer and therefore no
enforceable invariant.** The duplicated risks and the five-way discrepancy are
the same root cause reaching two different tables.

## Contributing factors

- **Comments used as verification.** Three separate comments asserted behaviour
  the code did not have. Each one made the defect less likely to be spotted on
  review, not more.
- **Silent catches.** `catch (_) {}` around the framework score writer and
  `catch (_e) { /* skip duplicates */ }` around the risk insert. Both turned a
  detectable failure into a quiet wrong answer.
- **Derive-by-subtraction.** `total - passing - failing` is correct only while
  the status set has exactly three members. It silently stopped being correct the
  day `warning` was added, and no test encoded the assumption.
- **A designed guard shipped half-built.** `org_risks_seeded` existed with the
  right shape and no code. A migration that creates an unused table is a signal
  worth catching in review.
- **No drift detection anywhere.** Every one of these was discoverable by a query
  a monitoring job could have run daily.

## What we changed

| Change | Addresses |
| --- | --- |
| `if (alreadySeeded \|\| riskCnt > 0) continue;` plus the marker table | why 1, 2 |
| Unique index on `(org_id, lower(btrim(title)))` | why 2 - the invariant is now enforced by the database, not by a comment |
| Expand-contract repair with JSONB quarantine and a rollback script written first | the 560 existing rows, non-destructively |
| `review_date` backfilled and given a default | the 560 null review dates |
| The risk insert catch now logs | contributing: silent catches |
| `computePosture()` as the one producer, classify-once and never subtract | why 3, 4, 5 |
| `warning` first class; unknown statuses reported, not absorbed | contributing: derive-by-subtraction |
| Coverage and three named ratios on the object | the framework denominator mismatch |
| `POSTURE_DRIFT` log key and `/posture/drift` | contributing: no drift detection |
| CI: three-boot idempotency proof; posture guard rebuilding the measured defect | why 3 - the assumption is now encoded in a test |

## What we did not change, and why

`sprs.service.ts` keeps its own hardcoded `UCO_TO_NIST_MAP`, so a third
mapping source still exists and SPRS is still outside the SSOT. `control_crosswalk`
is still empty. `updateFrameworkScores()` still writes stored columns from one
call site inside a swallowed catch - the SSOT reads those columns only to report
drift on them. All three are cutover work, and doing them before shadow mode has
produced evidence would be guessing with more code.

## The prediction this postmortem makes

If the root cause is right, no third instance of "two pages disagree about a
computed compliance number" should appear after the Phase 1 cutover.

**If a third instance does appear, this analysis was wrong** - the cause would
then be something upstream of ownership, and this document should be reopened
rather than extended. That is the falsifiable claim, and it is written down here
so it cannot be quietly retired.

## Action items

| # | Action | Status |
| --- | --- | --- |
| 1 | Seed guard, marker table, unique index, repair, rollback script | done, this PR |
| 2 | `computePosture()` and drift detection in shadow mode | done, this PR |
| 3 | CI guards for both | done, this PR |
| 4 | Confirm zero or fully explained divergence, then cut every surface over | open, gates the rest of Phase 1 |
| 5 | Fold SPRS and `control_crosswalk` into the one mapping source | open |
| 6 | `review_date` NOT NULL once the create-risk API sends it | open, contract step |
| 7 | Audit the remaining `catch (_) {}` sites on compliance-data paths | open |
| 8 | Standing daily drift query, not just per-request observation | open |
