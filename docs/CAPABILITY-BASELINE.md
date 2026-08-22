# Capability baseline

Measured on 21 August 2026 against `main` at the commit that preceded the
branch adding this file. Counts here are a snapshot for humans. The machine
version is authoritative and is regenerated with:

    node artifacts/api-server/scripts/capability-baseline.mjs --report
    node artifacts/api-server/scripts/capability-baseline.mjs --json

Do not hand-edit the numbers. If they are stale, regenerate them.

## What this repository contains

- 44 API modules under `artifacts/api-server/src/modules`
- 246 distinct controller routes
- 54 tables declared across 33 Drizzle schema files
- 13 boot migrations under `artifacts/api-server/src/migrations`, every one of them referenced
- 26 shared libraries under `artifacts/api-server/src/lib`
- 7 rollback scripts, one per destructive-capable migration
- 65 connector specifications: 7 native, 36 live, 22 deliberately unavailable

## What this repository does not contain

The web client. There is no committed HTML entry point for the production
hostname, and the Railway build command builds only the API. The bundle served
at the production origin is produced elsewhere. This matters for planning: a
user-interface item placed on this roadmap cannot be executed from this
checkout, and several previous plans assumed otherwise.

## Cryptographic state of integration credentials

Credentials are encrypted at the field level with AES-256-GCM. The key is
derived from a single process-wide secret, with a documented fallback chain and
a hard failure outside development if no usable material is present. Rotation
exists as a platform-admin operation that re-encrypts under a new key.

Two facts that shape the next change:

- Every exported function in `src/lib/credential-crypto.ts` is synchronous and none of
  them takes an organisation. There is one key for the whole platform, so the
  blast radius of that key is every tenant at once. Moving to per-organisation
  keys held in a key management service necessarily makes these calls
  asynchronous, because a wrap or unwrap is a network round trip. That is the
  real cost of the change and the reason it is staged rather than swept in.
- The production service defines 19 variables. `INTEGRATION_CREDENTIAL_KEY` is not
  among them, so the running deployment is using the documented fallback rather
  than a dedicated credential key, and no key management service is reachable
  from the service today. Any claim that this platform encrypts customer
  secrets under a KMS-held key would be false until that is provisioned.

## Live endpoint sweep

Every controller route with no unresolvable path parameter, excluding those with
side effects such as OAuth redirects, exports and syncs, was called against the
production API as an authenticated owner of organisation 1.

- 66 endpoints called
- 63 returned 200
- 2 returned 403 by design: platform administration behind time-boxed elevation
- 1 returned 500: `GET /api/orgs/1/remediation`

The single failure was not a thin feature or an empty list. It was a missing
table, and the discriminator is that both the collection and the single-item
route failed identically rather than one returning an empty list and the other a
404.

## The defect class worth naming

Three tables have now been found declared in the schema and queried by a live
service while the only `CREATE TABLE` statement for them sat in
`lib/db/src/migrate-new-tables.ts`, which no runtime path executes:

- `org_audit_shares`, fixed previously
- `org_remediation_tasks`, fixed in the change that adds this file

Two of three is enough to stop fixing instances and start failing the build on
the class. `capability-baseline.mjs --check` now refuses any schema table that no
reachable boot path creates, so the next one is caught before it ships rather
than by a customer opening a page.

## Corrections to earlier assessments

Earlier planning in this project described a number of capabilities as missing
or thin. Measured against the repository, that was wrong in the following ways,
and the roadmap now carries a machine-checked claim for each so the error cannot
be repeated.

- Row level security exists, with tenant policies applied across the tenant tables and a separate coverage migration.
- Cross-tenant isolation and role-based access control are covered by integration tests that run against a real Postgres with two isolated organisations.
- Credential encryption, an SSRF guard, a guarded outbound fetch, secret redaction on responses, SAML service provider utilities and a rate-limit guard all exist.
- Modules described as absent are present, including risks, vendors, access reviews, auditor shares, POA&M, eMASS, questionnaires, zero trust, webhooks, SSO, trust centre, public status, notifications and the scheduler.
- The frontend page count previously quoted for this repository was wrong, because the frontend is not in this repository at all.

What remains true is narrower and more useful: some modules are shallow rather
than absent, encryption uses one platform key rather than per-tenant keys in a
managed service, and connector breadth is limited by missing request-signing
strategies rather than by missing connector definitions.

