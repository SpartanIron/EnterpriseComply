# ADR-0001: One server-computed posture object

- Status: Accepted, in shadow mode
- Date: 2026-08-21
- Phase: 1 (data integrity)
- Supersedes: nothing
- Related: docs/postmortems/2026-08-21-no-single-source-of-truth.md

## Context

Five surfaces answered "how compliant is this organization?" and no two agreed.
Measured against org 1 before any code was written:

| Surface | What it reported |
| --- | --- |
| `GET /orgs/1/controls` | 71 objectives: 2 passing, 5 warning, 3 failing, 61 not tested |
| `GET /orgs/1/dashboard` | total 10, passing 2, failing 3, notTested 5, overallScore 20 |
| `GET /orgs/1/frameworks` | 800-171 total 110, score 0, passing 0, failing 0, notTested 0 |
| `GET /orgs/1/sprs` | met 4, notMet 6, notReviewed 100, of 110, score -187 |
| Frameworks page | 23 catalog entries, 9 rendered |

None of those numbers was wrong in isolation. Each was a correct answer to a
question nobody had written down. Reading the code produced four distinct causes.

**The dashboard counts rows, not objectives.** `OrgsService.getDashboard()`
reads `org_control_results` and sets `total = controls.length`. An objective
that has never been tested has no row, so it is not reported as untested - it is
absent. Sixty-one of seventy-one objectives were invisible, and the score's
denominator shrank to the ten that happened to have a row. That is the whole of
"2 of 71 reads as 20 percent".

**Everyone derives `notTested` by subtraction.** `total - passing - failing`.
`warning` is a real status in `org_control_results` and appears in neither
subtrahend, so every warning is silently relabelled as untested. The dashboard's
notTested of 5 was not five untested controls; it was the five warnings.

**Framework totals and framework coverage are different quantities.**
`org_frameworks.total_controls` is the framework's published control count from
`FRAMEWORK_CATALOG` - 110 for 800-171, 389 for 800-53. The mapping table maps
10 and 44 UCO objectives to them respectively. Dividing one by the other in
either direction yields a number with no meaning, and nothing on the page told a
reader that 100 of 110 requirements were unmapped.

**There were three independent mapping sources.**
`uco_framework_mappings` (used by the frameworks rollup),
`UCO_TO_NIST_MAP` hardcoded in `sprs.service.ts` (25 entries), and
`control_crosswalk`, which drives the Control Crosswalk page and is empty. Any
two of them could disagree and nothing would notice.

Compounding all of it: `ControlsService.updateFrameworkScores()`, the only
writer of the stored framework scores, is called from exactly one place - a
manual control-result patch - and its body is wrapped in `catch (_) {}`. An org
where nobody has hand-edited a control has stored zeros forever, and a failure
while writing them is discarded without a log line.

For a compliance product this is not a cosmetic defect. A customer showing an
assessor a 20 percent score computed over 14 percent of the control set, with
warnings presented as untested and 100 unmapped 800-171 requirements silently
excluded, is making a misstatement they cannot detect.

## Decision

One read-only function, `computePosture(orgId)` in
`artifacts/api-server/src/lib/posture.ts`, is the single source of truth for
computed compliance posture. Four rules define it.

**1. Classify once, count once. Never subtract.** Every objective is assigned
exactly one status and incremented into exactly one bucket. The four buckets sum
to the total by construction rather than by arithmetic that happens to balance,
which is what makes it structurally impossible for `warning` to disappear
again.

**2. `warning` is a first-class status.** It appears in the type, in the
counts, in every per-framework rollup, and in the drift report. A status string
found in the database that is not in the vocabulary is counted separately under
`unrecognisedStatuses` and surfaced, not folded into `not_tested`.

**3. Coverage is part of the object.** Each framework reports
`declaredControlCount`, `mappedControlCount`, `coveragePercent` and a
`partialCoverage` flag. A page cannot present a framework as fully scored
without stepping over the field that says it is not. This is a correctness
requirement, not a nicety: the alternative is a compliance misstatement.

**4. Every ratio is named after its denominator.** `scorePercent` divides by
the published control count, `mappedScorePercent` by what is mapped,
`assessedScorePercent` by what has been tested. Three explicit numbers, so no
caller has to guess which one it is holding. Guessing is how the original
discrepancy started.

The object also computes the legacy dashboard figures from the same read, so old
and new can be compared without two HTTP calls that could straddle a write.

## Rollout

Shadow mode first. `getDashboard()` computes the SSOT alongside its existing
arithmetic and records the comparison; `controlSummary` and `overallScore`
are unchanged, so no consumer's behaviour moves. The shadow path issues its own
reads deliberately - a computation cannot demonstrate it reaches the same answer
independently by sharing intermediate state with the thing it is checking - and
a rejection resolves to `null` and is logged, because an observation must never
be able to take the dashboard down.

Cut over only when divergence is zero or every remaining difference is explained.
Because the additive `posture` field already carries the totals, the cutover is
a deletion rather than a rewrite.

## Consequences

Accepted costs. The dashboard issues a second set of reads while shadow mode
runs; this is the price of an independent check and it ends at cutover. The
response carries a small additional field. The drift counters are per process, so
with more than one replica the endpoint reports the replica that answered - which
is why the `POSTURE_DRIFT` log key exists alongside it, since logs aggregate
across replicas and memory does not.

Deliberately not done in this change. The SSOT is not yet read by Controls,
Crosswalk, SPRS, Frameworks, the dashboard header or Monitoring - that is the
cutover, and it waits on shadow-mode evidence. `updateFrameworkScores()` still
writes the stored columns from its single call site; the SSOT reads them only to
report drift. The three mapping sources are not yet consolidated, and `sprs.service.ts`
keeps its own hardcoded map, so SPRS remains outside the SSOT for now. FISMA as a
labelled pass-through of the 800-53 mappings, with a FIPS 199 impact tag, is
queued behind the cutover, because building it before the SSOT is authoritative
would be throwaway work.

## Alternatives considered

**Fix each page in place.** Rejected. It is what produced five answers. Any fix
that leaves five computations leaves the sixth disagreement to be discovered by a
customer.

**Materialise posture into a table on write.** Rejected for now. It adds a
correctness problem - cache invalidation across every writer of
`org_control_results` - to a change whose entire purpose is correctness. The
computation is a bounded read over a control set in the low hundreds. If it ever
becomes a cost, caching a value everyone already agrees on is a much easier
change than agreeing on the value.

**Weight `warning` as partial credit in the score.** Rejected. It invents a
weighting the frameworks do not define. CMMC and FedRAMP treat partially
implemented as not met, so `warning` counts as not passing for scoring and is
displayed distinctly. That is defensible to an assessor; a half-mark is not.
