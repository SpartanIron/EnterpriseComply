# Definition of Ready: FISMA pass-through and FIPS 199 (Phase 1c, item 7a)

Written before the change shipped. This item was deliberately deferred out of
Phase 1, with a CI assertion that it stayed out, so that the completion record
could not quietly claim it. That assertion has now been replaced rather than
deleted.

## The decision this rests on

FISMA publishes no control set. Agencies implement it through NIST SP 800-53,
with the applicable baseline selected by the FIPS 199 categorisation of the
system. Two implementations were therefore possible:

1. Author a FISMA control set and map it. This creates a second source of truth
   for the same requirements - exactly what Phase 1b existed to remove - and
   invents content nobody asked for.
2. Declare FISMA as a pass-through of the 800-53 mappings, resolve the alias at
   read time, and label it everywhere it appears.

This change does the second. The instruction was explicit that a FISMA entry
must be a labelled pass-through and must not re-author 71 controls, and that it
had to be built through the Phase 1 SSOT or it would be throwaway work.

## What shipped

- `FRAMEWORK_PASS_THROUGHS` in lib/framework-mappings.ts, declaring
  fisma -> nist-800-53 with a written basis and a written caveat.
- `resolveMappingSource` and `passThroughFor`, used by the SSOT and by the
  frameworks service. Identity for every framework that is not a pass-through.
- A catalog entry named "FISMA (via NIST SP 800-53 Rev 5)" whose description
  says it is not an independent assessment.
- One additive nullable column, `organizations.fips_199_impact`, plus validation
  restricting it to low, moderate, high or null.
- `posture.fips199`, reported on the SSOT and on the dashboard, stating either
  the recorded level or that none was recorded.

## What did not ship, and why

- **The impact level does not filter controls.** A real baseline selection would
  serve a different control subset for low, moderate and high. That is control
  content, it changes what the product claims to assess, and it is not something
  to infer. The caveat text says so in the API response rather than in a comment
  nobody reads.
- **No default impact level.** An uncategorised system reports "not set".
  Defaulting to low would invent the scope of somebody else's assessment.
- **No UI for recording the level.** The API accepts it; the settings page does
  not offer it yet. Named here rather than left to be discovered.

## Acceptance criteria

All re-runnable, all failing before this branch.

1. `passThroughFor("fisma")` resolves to nist-800-53 with a basis and a caveat.
2. `resolveMappingSource` is identity for non-pass-through keys.
3. The catalog entry names the pass-through and denies independence.
4. Zero mapping rows exist under the `fisma` key. This is the assertion that
   catches the wrong implementation.
5. `getFrameworkControls(org, "fisma")` returns the same non-empty control set as
   `nist-800-53`.
6. That response names `mappingSourceKey` and `passThroughOf`; 800-53's own
   response reports `passThroughOf: null`.
7. `computePosture` reports a `fips199` block with a note.
8. An uncategorised org reports source "not set" and says the level was not
   recorded.
9. A recorded level reaches the posture with source "recorded on the
   organisation".
10. Recording a level does not change control counts - proving the caveat is
    accurate rather than decorative.
11. Posture resolves FISMA's mappings to the same mapped count as 800-53.
12. The rollback script is dry-run unless `--confirm` is passed.

## Blast radius

- `organizations` gains one nullable column. Nothing reads it before the
  migration runs, and the posture reports "not categorised" whether the column
  is missing or null, so an unmigrated database behaves identically.
- `Posture` gains `fips199`; `FrameworkPosture` gains `mappingSourceKey` and
  three pass-through fields. Additive.
- `GET /orgs/:orgId/dashboard` gains `fips199`. Additive.
- `GET /orgs/:orgId/frameworks/:key/controls` gains four fields. Additive.
- `PATCH /orgs/:orgId` accepts `fips199Impact` and now rejects an invalid value
  with a conflict rather than ignoring it. That is a behaviour change on an
  input that previously did not exist.
- FISMA appears in the catalog. No organisation gets it automatically; it is
  added the same way any framework is.

## Rollback plan

Committed before the forward migration and exercised in CI on every build.

1. `node artifacts/api-server/scripts/rollback-fisma-fips199.cjs --dry-run`
   reports the column and the number of recorded values, changing nothing.
2. `--confirm` prints every value it is about to discard, then drops the column.
3. Revert the commits. FISMA disappears from the catalog. Any organisation that
   had added it keeps an org_frameworks row for a key the catalog no longer
   knows, which reads as an inactive framework rather than an error - the same
   behaviour as any other removed key.

Nothing else needs undoing, because a pass-through writes nothing.
