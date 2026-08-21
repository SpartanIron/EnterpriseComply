# Phase 1b Definition of Ready - mapping consolidation and posture cutover

Written before any forward change, per the Phase 1 execution methodology. Nothing
in this document is aspirational: every number in the "measured now" column was
read from production on 2026-08-21 after the Phase 1a deploy (commit 949b6d8).

## 1. The defect, measured

Three independent sources claim to know which Unified Control Objective maps to
which framework requirement. They disagree, and none of them is labelled as the
authority.

| Source | Where it lives | UCO objectives mapped to 800-171 | Identifier style |
| --- | --- | --- | --- |
| `uco_framework_mappings` | database table | 10 | Rev 3 zero-padded, e.g. `03.05.03` |
| `UCO_TO_NIST_MAP` | hardcoded in `sprs.service.ts` | 24 | Rev 2 unpadded, e.g. `3.5.3` |
| `control_crosswalk` | database table | 0 rows, table is empty | n/a |

Set arithmetic on the first two, measured:

- overlap: 9 objectives
- only in the table: `UCO-RM-001`
- only in the SPRS map: 15 objectives (AI-002, AI-003, AI-004, AC-003, AC-004,
  AC-005, CM-002, CM-003, DP-001, DP-003, AL-002, VM-002, IR-002, CP-001, CP-002)
- union: 25 objectives

Consequence: the Frameworks page believes 800-171 has 10 mapped objectives while
the SPRS page scores against 24 of them. Both numbers are shown to the same user
on the same day and the product never reconciles them.

## 2. Is the identifier difference a Rev 2 / Rev 3 renumbering?

No, and this was verified mechanically rather than assumed, because the answer
determines whether consolidation is a data move or a content-authoring exercise.

For all 9 overlapping objectives the two sources name the same requirement and
differ only by zero padding: `03.05.03` against `3.5.3`, `03.01.01` against
`3.1.1`, and so on. So a deterministic transform - strip leading zeros from each
dot-separated segment - bridges the two vocabularies without inventing anything.

Proof that the transform is total over the data we actually hold:

- `NIST_800_171_WEIGHTS` contains exactly 110 requirement identifiers, total
  weight 252. That is the Rev 2 requirement set, which is the set the DoD
  Assessment Methodology scores.
- All 48 distinct requirement identifiers referenced by `UCO_TO_NIST_MAP`
  resolve into that set. Misses: 0.
- All 10 identifiers in `uco_framework_mappings`, after de-padding, resolve into
  that set. Misses: 0.

This is a property of today's data, not a law. It is therefore enforced going
forward by a CI guard rather than trusted (see acceptance criteria 6).

## 3. Acceptance criteria - measurable and re-testable

Each criterion is re-measured by re-running the original measurement, not by
inspection.

1. `GET /api/orgs/:id/posture/drift` reports `divergenceCount` of 0. Measured
   now: 13.
2. `GET /api/crosswalk/controls` returns a non-empty pivot derived from
   `uco_framework_mappings`. Measured now: `[]`.
3. `sprs.service.ts` contains no hardcoded objective-to-requirement map. Measured
   now: 24 entries in source.
4. The dashboard control summary carries a `warning` bucket and derives no field
   by subtraction. Measured now: no warning bucket, `notTested` derived by
   subtraction, absorbing all 5 warnings.
5. `org_frameworks` stored columns for 800-171 and 800-53 agree with the SSOT.
   Measured now: 9 of the 13 divergences are in these columns.
6. A CI guard fails the build if any `uco_framework_mappings` row for a
   scored framework carries an identifier that does not resolve into that
   framework's scoring set. Does not exist now.
7. The drift ledger survives a process restart. Measured now: it does not; the
   ring is in-process memory and a redeploy erases the evidence.

## 4. Blast radius

Everything that reads objective-to-framework mappings or computes a posture
number. Enumerated by reading the source, not guessed:

| Surface | Reads | Changes in this phase |
| --- | --- | --- |
| `GET /orgs/:id/dashboard` | `org_control_results` directly | cuts over to SSOT |
| `GET /orgs/:id/controls` | `org_control_results` | unchanged; already correct |
| `PATCH` control result | `updateFrameworkScores()` | cuts over to SSOT |
| `GET /orgs/:id/frameworks` | `org_frameworks` stored columns | cuts over to SSOT |
| `GET /orgs/:id/frameworks/:key/controls` | `uco_framework_mappings` | gains 15 objectives for 800-171 |
| `GET /orgs/:id/sprs` | hardcoded map | cuts over to the table |
| `GET /crosswalk/controls` | `control_crosswalk` (empty) | derived from the table |
| `GET /admin/crosswalk`, `PUT /admin/crosswalk/:id` | `control_crosswalk` | behaviour unchanged, marked deprecated |
| Monitoring | notifications and jobs only | no posture arithmetic; out of scope |

Not in the blast radius, confirmed by reading: monitoring computes no posture
figure at all, so the sixth surface named in the Phase 1 scope does not need a
cutover. That is a scope reduction, and it is recorded here so it is a decision
rather than an omission.

Two numbers users will see move, and they are not regressions:

- dashboard score 20 to 3, because the denominator changes from "objectives with
  a result row" (10) to "objectives" (71)
- dashboard "not tested" 5 to 61, for the same reason, and because 5 warnings
  stop being mislabelled

Both need a UI explanation shipped in the same change or they read as a fault.

## 5. Rollback plan

Written and committed before the forward migration, and exercised in CI.

`scripts/rollback-mapping-consolidation.cjs` reverses the migration in the
opposite order to which it applied:

1. delete `uco_framework_mappings` rows where `mapping_source` is
   `dod-sprs-methodology` - these are the relocated rows and nothing else
   created them
2. drop the unique index `uco_framework_mappings_triple_idx`
3. drop the three added columns

It does not touch the 10 pre-existing rows, which is the property that makes it
safe: the forward migration only ever adds rows and columns, so the reverse only
ever removes what it added. The expand-contract contract is that the contract
step - deleting `UCO_TO_NIST_MAP` from source - ships in the same commit as code
that no longer reads it, and reverting the deploy restores it, so no data
migration is needed to go back.

Code rollback is a Railway redeploy of the previous image. The migration is
additive, so the previous image runs correctly against the migrated schema. That
is the reason for doing it in this order.

## 6. Threat model note

Section 1 of the execution prompt makes the STRIDE gate mandatory for the Phase 2
RLS cutover and the Phase 5 elevation flow, not for this item. This change adds
no new endpoint, no new authentication path and no new authorisation decision;
the two admin crosswalk routes keep the platform-admin assertion they already
had. Tampering is the only category with any surface here, and it is addressed by
the unique index making the seed idempotent rather than append-only.

## 7. Residual checks carried into the report

- The catalog labels `nist-800-171` as "NIST SP 800-171 Rev 3" but declares 110
  controls, which is the Rev 2 count, while its 10 mapping rows use Rev 3
  identifiers and its scoring uses the Rev 2 110-requirement weighted set. This
  is surfaced as a data-quality flag rather than silently corrected, because
  changing the declared count is a content decision and needs confirmation.
- Whether the 800-53 mappings target the intended FedRAMP Moderate baseline is
  still unverified, and remains a precondition for the FISMA pass-through.
