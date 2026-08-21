# ADR-0002: one mapping source, with revision modelled as data

Status: accepted
Date: 2026-08-21
Supersedes nothing. Extends ADR-0001 (posture single source of truth).

## Context

ADR-0001 made one object the authority on how compliant an organisation is. It
did not make anything the authority on which framework requirements an objective
satisfies, and there were three answers to that:

- `uco_framework_mappings`, 10 objectives mapped to 800-171, identifiers in
  zero-padded Rev 3 notation such as `03.05.03`
- `UCO_TO_NIST_MAP`, hardcoded in `sprs.service.ts`, 24 objectives, unpadded
  Rev 2 notation such as `3.5.3`
- `control_crosswalk`, a table with no rows, read by an endpoint that therefore
  returned `[]` on every call

Overlap between the first two was 9 objectives; the union was 25. The Frameworks
page and the SPRS page disagreed about the same organisation on the same day.

## Decision

`uco_framework_mappings` is the only mapping source. Three consequences follow.

**Revision is data, not a naming convention.** The DoD Assessment Methodology
that produces an SPRS score is defined against Rev 2's 110 requirements. The
catalog labels the framework Rev 3. Both are true, so the row carries
`framework_revision` and a `scoring_control_id` that scoring joins on, and
neither notation rewrites the other.

**The bridge between notations is one function, and its safety is asserted rather
than assumed.** For all 9 overlapping objectives the two sources named the same
requirement and differed only by zero padding, so `normaliseScoringId` is a
segment-wise integer parse. That was verified mechanically before any code was
written: all 48 identifiers the hardcoded map referenced, and all 10 already in
the table, resolve into the 110-entry weighted set, with zero misses. Because
that is a property of today's data and not a law, `findUnresolvableMappings` runs
in CI and fails the build on the first row that breaks it.

**Presence is decided on the normalised identifier, never on the stored string.**
This is the difference between consolidating and duplicating. Nine pairs existed
in both sources in different notations; keying on the string would have inserted
them a second time and recreated the exact defect being retired.

**The crosswalk view is derived, not copied.** `control_crosswalk` is no longer
read for the member-facing endpoint. A copy needs reconciling and will eventually
be wrong; a projection cannot be.

## What was deliberately not decided here

**The SPRS score formula.** The score accumulates upward from the -203 floor and
the configured weights total 252, so a perfect assessment reaches 49 and is then
clamped against a ceiling of 110 it can never touch. The published methodology
starts at 110 and subtracts. That is a real defect, and it is reported through a
new `scoringBasis` block rather than corrected here, because changing the formula
or the weights of a compliance score is a control-content decision and does not
belong inside a refactor.

**The Rev 3 declared control count.** The catalog says Rev 3 and declares 110
controls, which is Rev 2's count. That is reported by
`catalogInconsistencies`, a group of its own rather than a coverage warning,
because thin mappings and a mislabelled catalog are different problems with
different owners. The finding is derived: it reads the revision out of the
catalog label, compares it with the revision of the weighted set actually
scored, and disappears on its own if either side changes. Which of the two is
wrong is a control-content decision, so it is surfaced and left.

## What changed about the drift metric, and why that is not moving the goalposts

Shadow mode reported 13 divergences. Two of the three groups can never reach
zero: the legacy dashboard arithmetic, which nothing serves after the cutover,
and partial framework coverage, which is a true and important fact about the data
rather than a fault. A metric that includes them is red forever and therefore
ignored.

So `diffPosture` now returns only SSOT-versus-stored-column disagreement, which
must be zero, and the other three groups are reported separately as
`legacyArithmeticNotes`, `coverageWarnings` and `catalogInconsistencies`.

Reported means served, not merely computable. `GET /orgs/:orgId/posture/drift`
carries all four groups under `separatelyReported`, alongside a `headline` block
that states in the payload itself that a divergence count of zero is nine
defects fixed plus four items that were never defects. `GET /orgs/:orgId/posture`
carries `coverageWarnings` and `catalogInconsistencies` for ordinary callers, so
a small score cannot be read as poor compliance when it partly means thin
mappings. The first cut of this phase exported the two functions and called
neither, which for a consumer is indistinguishable from not having them. The headline number got smaller
because its definition got narrower, and that is stated here explicitly so nobody
later reads "drift went from 13 to 0" as thirteen bugs fixed. Nine were.

The nine were only able to reach zero because of a second change:
`syncStoredFrameworkPosture` now runs at boot as well as on a control patch.
Those columns had never been written on the measured organisation, so every page
reading them was told there were no passing controls and the compliance score was
zero.

## Consequences

Good: one place to add a mapping; the crosswalk page has content for the first
time; the SPRS page states what it is scoring and how much of the framework is
mapped; a reintroduced local mapping table fails CI.

Costs: 39 relocated rows now carry a generated requirement name rather than the
official Rev 2 title, because the hardcoded map never had titles and inventing
them would be authoring content. The stored columns have no `warning` field, so
a consumer that needs the warning count must read the posture object.

Accepted risk: the notation bridge is empirically total, not provably so. The CI
guard converts that from a silent scoring error into a failed build.
