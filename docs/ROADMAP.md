# Roadmap

This roadmap is re-baselined against the code, not against memory.

Work was repeatedly proposed here for capabilities that had already shipped.
The cause was structural: the roadmap lived in prose while the repository moved,
and nothing forced the two to agree. This file fixes that by making every open
item carry a claim that a machine can check.

## The rule

Every open item must carry at least one evidence claim in backticks:

- `absent:module:<name>` - no directory of that name under `artifacts/api-server/src/modules`
- `absent:file:<repo-relative-path>` - that file does not exist
- `absent:symbol:<Identifier>` - that identifier appears nowhere in the API or db source trees
- `absent:table:<table_name>` - that table is neither declared in the Drizzle schema nor created by any statement
- `absent:route:<substring>` - no controller route matches that substring

The `present:` forms assert the opposite and are used for items that deepen
something that already exists, and for the corrections section below.

`node artifacts/api-server/scripts/capability-baseline.mjs --check` evaluates every
claim in this file against the repository and fails CI on any claim that is false.
An item asserting that something is absent when it already exists cannot be merged.
That is the whole point: it is the specific failure this roadmap kept producing.

Two further invariants run in the same check, both of which have already cost a
production outage: every table declared in the schema must be created by a boot
path that something actually executes, and every file in `src/migrations` must be
referenced by something. `org_audit_shares` and `org_remediation_tasks` were both
declared, queried, and never created, so both endpoints returned 500 instead of an
empty list.

Regenerate the inventory with `--report` or `--json`. Do not hand-maintain counts.

## Corrections: this already exists, do not rebuild it

Each line below was previously described, by me, as missing or thin. Each is
present in the repository and the claim is verified by CI.

- [x] Row level security on tenant tables - `present:file:artifacts/api-server/src/migrations/tenant-rls.migration.ts` and `present:file:artifacts/api-server/src/migrations/rls-coverage.migration.ts`
- [x] Cross-tenant isolation and RBAC integration tests against a real Postgres - `present:file:artifacts/api-server/scripts/test-suite.mjs`
- [x] Field-level credential encryption with key rotation - `present:file:artifacts/api-server/src/lib/credential-crypto.ts`
- [x] SSRF guard and a guarded outbound fetch - `present:file:artifacts/api-server/src/lib/ssrf-guard.ts` and `present:file:artifacts/api-server/src/lib/guarded-fetch.ts`
- [x] Integration secret redaction on the way out - `present:file:artifacts/api-server/src/lib/integration-redaction.ts`
- [x] SAML service provider utilities - `present:file:artifacts/api-server/src/lib/saml-sp.ts`
- [x] RS256 service-account assertion signing for Google - `present:file:artifacts/api-server/src/lib/google-jwt.ts`
- [x] Write-once evidence ledger - `present:file:artifacts/api-server/src/migrations/worm-evidence-ledger.migration.ts`
- [x] Posture drift ledger - `present:file:artifacts/api-server/src/migrations/posture-drift-ledger.migration.ts`
- [x] Risk register - `present:module:risks`
- [x] Vendor register - `present:module:vendors`
- [x] Access reviews - `present:module:access-reviews`
- [x] Auditor share links - `present:module:audit-shares`
- [x] POA&M - `present:module:poam`
- [x] eMASS - `present:module:emass`
- [x] Security questionnaires - `present:module:questionnaires`
- [x] Zero trust assessment - `present:module:zero-trust`
- [x] Outbound webhooks - `present:module:webhooks`
- [x] SSO configuration - `present:module:sso`
- [x] Trust centre and public status page - `present:module:trust-center` and `present:module:public-status`
- [x] Notifications - `present:module:notifications`
- [x] Scheduled continuous monitoring jobs - `present:module:scheduler`
- [x] Google Workspace connector module - `present:module:google-workspace`
- [x] Platform admin with time-boxed elevation - `present:module:platform`
- [x] Remediation task persistence - `present:table:org_remediation_tasks` and `present:route:orgs/:orgId/remediation`
- [ ] - [x] The frontend served at the production hostname is in this repository, at artifacts/c2s-ciop, and railway.toml's buildCommand builds it (`pnpm --filter @workspace/c2s-ciop run build`) before building the API. This contradicts the "Out of scope for this repository" section directly below and CAPABILITY-BASELINE.md's claim that "the Railway build command builds only the API." Flagging rather than deleting that section, since I can't tell from this pass whether it's simply stale or whether it is protecting against a different, more subtle distinction (e.g. a separate production bundle that supersedes this directory) -- a maintainer should reconcile this before the next UI item is scoped. `present:file:artifacts/c2s-ciop/src/pages/Frameworks.tsx` `present:file:railway.toml`

## Out of scope for this repository

The web client served at the production hostname is not in this repository.
There is no committed frontend entry point and the Railway build only builds the
API. Any user-interface item belongs in whichever repository owns those assets,
and putting UI work on this roadmap will produce another round of work that
cannot be executed here. Confirm the owning repository before planning UI change.

## Open work

### A. Key management and tenancy

- [ ] **R-01** Per-organisation data encryption keys under a key management service, using envelope encryption: a per-org data key wrapped by a customer master key the application never holds in plaintext, with the organisation bound into the wrap as authenticated context so one tenant's wrapped key cannot be unwrapped in another tenant's context. `absent:table:org_data_keys` `absent:file:artifacts/api-server/src/lib/kms/kms-provider.ts` `absent:symbol:KmsProvider`
- [ ] **R-02** A pluggable key provider so the master key can live in a real service rather than an environment variable, starting with HashiCorp Vault Transit over HTTP because it needs no new dependency. `absent:symbol:wrapDataKey` `absent:symbol:unwrapDataKey`
- [ ] **R-03** AWS KMS provider. Deferred until a request signer exists, because the deployment installs dependencies with a frozen lockfile and cannot gain the AWS KMS SDK without a lockfile change. `absent:symbol:AwsKmsProvider`
- [ ] **R-04** Google Cloud KMS provider. Deferred: the REST contract could not be read from an authoritative source, and guessing a key management API is not acceptable. `absent:symbol:GcpKmsProvider`
- [ ] **R-05** Per-organisation key rotation, exposed as an operation rather than a script, with the old version retained until every ciphertext has moved. `absent:symbol:rotateOrgDataKey` `absent:route:data-keys`
- [ ] **R-06** Org-scoped encrypt and decrypt helpers, so a call site cannot write a credential without saying which tenant it belongs to. `absent:symbol:encryptOrgCredential`

- [ ] **R-20** The running deployment still derives the credential key from `BETTER_AUTH_SECRET` rather than holding a dedicated one, so rotating the session signing secret would destroy every stored credential and every authenticator secret at once. Adoption is now a documented, verifiable procedure rather than a variable to be set hopefully: re-encrypt while the old key is live, then set `INTEGRATION_CREDENTIAL_KEY`, then confirm the mode changed and nothing became unreadable. Closes only when key-status reports `dedicated` in production. `present:symbol:credentialKeyMode` `present:symbol:getCredentialKeyStatus` `present:file:docs/security/KEY-ROTATION.md`

### B. Connector platform

- [ ] **R-07** Decompose the single connector catalogue file into one descriptor per connector, so two connectors can be changed at once without conflicting. `absent:file:artifacts/api-server/src/modules/integrations/connectors/index.ts`
- [ ] **R-08** A normalised intermediate resource model, so N vendors by M controls becomes N adapters plus M evaluators instead of N times M bespoke mappings. `absent:symbol:IntegrationResource` `absent:file:artifacts/api-server/src/modules/integrations/resource-model.ts`
- [ ] **R-09** Declared connector maturity levels, so a customer can tell a proved live connector from one that only stores credentials. `absent:symbol:connectorMaturity`
- [ ] **R-10** Recorded-contract fixtures for every connector plus a nightly job against live vendors, so a vendor breaking their API is discovered by us rather than by a customer. `absent:file:artifacts/api-server/scripts/connector-contract.test.ts`

### C. Authentication strategies that currently block connectors

- [ ] **R-11** AWS SigV4 request signing. Unblocks the four AWS connectors that are marked unavailable for exactly this reason. Verify against the published worked example rather than a live call. `absent:file:artifacts/api-server/src/lib/aws-sigv4.ts` `absent:symbol:signAwsRequest`
- [ ] **R-12** HMAC request signing. Unblocks Duo and Veracode. `absent:file:artifacts/api-server/src/lib/hmac-signing.ts` `absent:symbol:signHmacRequest`
- [ ] **R-13** OAuth 1.0a with HMAC-SHA256. Unblocks NetSuite. `absent:file:artifacts/api-server/src/lib/oauth1.ts` `absent:symbol:signOauth1Request`
- [ ] **R-14** A hosted authorization-code OAuth broker with server-side state, so flows that need a user to consent can be completed. Unblocks Gusto. `absent:table:org_oauth_states` `absent:symbol:hostedOauthBroker`
- [ ] **R-15** Mutual TLS client certificate transport. Unblocks ADP. `absent:file:artifacts/api-server/src/lib/mtls-agent.ts` `absent:symbol:mtlsAgent`

### D. Breadth, and the decision not to build it

- [ ] **R-16** Reach the human resources and payroll long tail through one unified provider rather than hand-building roughly thirty low-signal connectors. Buying the tail is the correct call when each connector carries the same maintenance cost as a strategic one but a fraction of the control coverage. `absent:symbol:UnifiedHrisProvider`

Connectors that remain unavailable on purpose, and will stay that way until the
vendor documents a credential-verification endpoint, are not roadmap items. A
guessed endpoint fails in a way the customer reads as their own mistake, which is
worse than an honest refusal.

### E. Wiring, which is where this platform actually loses capability

The pattern is now measured three times over: something is written, nothing
imports it, and the platform reports the capability as missing. It is cheaper to
find these than to build replacements for them, so they are listed before any new
vendor work.

- [ ] **R-17** Register the fifteen provider classes that nothing imports, one at a time, each with its own decrypt call and its own proof. They were written against real vendor APIs and are dead: POST orgs/:orgId/integrations/:key/sync still answers connection-only for every one of them. The baseline now fails if a provider file is neither imported under src nor listed with a reason, so this list can only shrink. `absent:file:artifacts/api-server/src/modules/integrations/providers/registry.ts` `absent:symbol:providerRegistry`
- [ ] **R-18** Make the Google Workspace sync write evidence rows. The module authenticates, calls the Admin SDK for users and groups, and stores nothing in org_evidence, so connecting it moves no control result. The dead provider file it superseded did write evidence, which is where the shape should come from. `absent:symbol:recordGoogleWorkspaceEvidence`
- [ ] **R-19** Promote Duo out of unavailable. Its spec says HMAC request signing cannot be done by the engine, while providers/duo.provider.ts already does HMAC request signing. Either the reason is wrong or the provider is wrong, and both readings are a defect. `absent:route:integrations/duo`

## Closed by measurement

- The Google Workspace connector was declared unavailable in connector-specs.ts, with a reason saying the engine cannot build an RS256 service-account assertion, while modules/google-workspace had already shipped connect, sync, status and disconnect routes and built that assertion itself. This roadmap had already recorded `present:module:google-workspace`; the catalogue had not. Customers were shown a disabled button on a connector that worked. The spec now declares it native, and an invariant fails the build if any connector is declared unavailable while a module of that name exists.
- Credential key rotation covered `org_integrations` and stopped there, while the MFA service seals authenticator secrets with the same key. Adopting a dedicated key by setting the variable would have re-keyed integrations and locked out every enrolled member, with organisation-wide enforcement making that a sign-in failure rather than a degradation. Rotation now re-keys `two_factor` and `mfa_enrollment` in the same transaction, refuses to report success when any authenticator secret fails, and the live key is reportable rather than assumed. `present:symbol:getCredentialKeyStatus`
- The catalogue and the connector specs answered availability separately and disagreed: all sixty-five catalogue entries said available while twenty-two specs said unavailable. Availability is now derived from the spec, because the spec is what the connect path enforces. `present:symbol:withConnectorState`
- The baseline check had only ever been observed passing. It now has a negative control that requires it to reject a false absent claim, a false present claim, and an open item carrying no claim at all. `present:file:artifacts/api-server/scripts/capability-baseline-negative.test.mjs`
- Auditor share links returned 500 because `org_audit_shares` was never created. Fixed, and the table is now expected by the fresh-database check.
- The Google Workspace connector built its assertion with the literal word "signature". Replaced with real RS256 signing.
- Remediation returned 500 because `org_remediation_tasks` was never created. Fixed in the same change that added this file, which is also the change that made the defect class visible.



- The Frameworks page rendered available.slice(0,9).map(...) in the "Available to add" grid, so any catalog entry past the 9th (including cmmc-l1, already present in the catalog) never rendered a card even though the heading above the grid showed the correct full count. Fixed by removing the slice; regression coverage added in tests/e2e/frameworks-catalog-add-all.spec.ts. `present:file:artifacts/c2s-ciop/src/pages/Frameworks.tsx` `present:file:tests/e2e/frameworks-catalog-add-all.spec.ts`
- - SSP.tsx and Onboarding.tsx enumerated cmmc-l2 as a hardcoded framework key but omitted cmmc-l1, even though cmmc-l1 is a real catalog key (frameworks.service.ts) and Frameworks.tsx's own FRAMEWORK_INFO already had a cmmc-l1 entry. Added cmmc-l1 to both hardcoded lists. Other hardcoded framework-key lists in artifacts/c2s-ciop were not exhaustively audited in this pass; see PR description. `present:symbol:cmmc-l1`
