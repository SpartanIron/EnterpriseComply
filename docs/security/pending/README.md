# Pending change: CI workflow hardening

`workflow-hardening.patch` is a ready-to-apply diff against `.github/workflows/`.
It could not be pushed from the development environment: the git credential
available there is a GitHub OAuth App token without the `workflow` scope, and the
remote refuses workflow-file writes over such a token
(`refusing to allow an OAuth App to create or update workflow`). The change is
kept here so it is reviewable and not lost.

## What it does

1. **Least-privilege `GITHUB_TOKEN`.** Adds `permissions: contents: read` at both
   workflow and job level in `isolation-rbac.yml`, `migration-safety.yml` and
   `security-scan.yml`. Nothing in CI writes to the repository. This closes the
   six CodeQL `actions/missing-workflow-permissions` alerts.
2. **Pins every action to a full-length commit SHA.** All 16 `uses:` references
   move from floating `@v4` tags to the exact commit those tags currently point
   at, with the tag retained as a trailing comment:

   | action | commit |
   | --- | --- |
   | `actions/checkout` | `11d5960a326750d5838078e36cf38b85af677262` |
   | `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
   | `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` |
   | `pnpm/action-setup` | `b906affcce14559ad1aafd4ab0e942779e9f58b1` |

   These were resolved with `git ls-remote <repo> refs/tags/v4` (and the peeled
   `refs/tags/v4^{}` for `pnpm/action-setup`, whose `v4` is an annotated tag), so
   pinning is behaviour-preserving: it is the same code `@v4` resolves to today.
   Once this lands, **Settings -> Actions -> General -> "Require actions to be
   pinned to a full-length commit SHA"** can be enabled without breaking CI.
3. **Proves origin-trust enforcement in CI.** Starts the API server in the
   isolation job with `ORIGIN_TRUST_MODE=enforce` and
   `TRUSTED_HOSTS=localhost,127.0.0.1`, so test-suite SECTION 38 exercises the
   real `421 Misdirected Request` refusal path rather than the report-only
   branch. The suite passes either way, so CI stays green before this is applied.

## How to apply

From the repository root, with a credential that carries the `workflow` scope
(a personal access token with `repo` + `workflow`, or a re-authorised GitHub
connection):

```
git apply docs/security/pending/workflow-hardening.patch
git add .github/workflows
git commit -m "ci(security): least-privilege token, SHA-pinned actions, enforce origin trust in tests"
git push
```

Then delete this directory.

If `git apply` reports the patch does not apply, the workflows have moved on since
it was generated; re-derive it rather than forcing it.
