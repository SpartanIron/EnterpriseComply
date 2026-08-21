# STRIDE threat model: tenant isolation at the database boundary

Phase 2 gate. The execution methodology makes a lightweight STRIDE model
mandatory before the RLS cutover, and this is it. Written before any change to
the connection role or to enforcement.

## Measured starting position

Measured on 2026-08-21 against the repository and the live schema, not assumed:

- 44 of 53 tables carry an `org_id` column. Those are the tenant-scoped tables.
- `tenant-rls.migration.ts` runs at boot and enables row level security on
  **2** of them: `org_evidence` and `organizations`. Two policies exist.
- One table has `FORCE ROW LEVEL SECURITY`.
- There is **no dedicated database role**. The application connects with the
  role that owns the tables. A table owner bypasses RLS unless the table is
  forced, so on 43 of 44 tables the policies that exist would not apply even if
  they were written.
- Isolation today is therefore enforced in application code: every query filters
  on `orgId`, and `test-suite.mjs` plus `test-isolation.mjs` attempt every
  cross-org read and write combination in CI and expect 403.

That last point matters for honesty: cross-tenant isolation is tested and
currently passing. What is missing is defence in depth - a second mechanism that
holds when application code is wrong.

## Assets

1. Tenant compliance data across 44 tables: control results, evidence, POA&M
   items, risks, policies, assessments, audit log.
2. The audit log specifically, which has a WORM trigger and is the record an
   assessor reads.
3. Integration credentials, encrypted at rest in `org_integrations`.
4. The connection string itself.

## Trust boundaries

- Browser to API: authenticated session, org resolved by `OrgContextGuard`.
- API to Postgres: **one connection, one role, full table ownership**. This is
  the boundary with no second mechanism behind it.
- Postgres to backup/restore: out of scope for this model.

## STRIDE

### Spoofing

*A caller presents itself as another tenant.* The org id comes from the session
via the guard, not from the request body, and the isolation suite tests exactly
this. Residual risk: a route that reads `:orgId` from the path and forgets the
guard. That is a code defect a database policy would catch and application
filtering would not.

### Tampering

*A caller writes into another tenant's rows.* Same control, same residual risk.
The WORM trigger protects audit rows specifically. Nothing at the database layer
protects the other 43 tables from a mis-scoped `UPDATE`.

### Repudiation

*An action cannot be attributed.* The audit log is append-only and stamped with
the actor. A privileged operator connecting directly with the owner role could
still write rows attributable to nobody. RLS does not fix this; the owner role
does not fix this. Named as accepted.

### Information disclosure

*The highest-value threat here.* A missing `WHERE org_id` on a read is one typo
and it discloses another tenant's compliance posture. Phase 1c already found and
fixed a related case - the monitoring endpoint serialising integration
credentials - which is evidence that response-shaping mistakes do happen in this
codebase. RLS with a non-owner role turns that class of typo into an empty
result instead of a breach.

### Denial of service

*Enforcement breaks the application.* This is the threat the rollout plan below
exists to manage, and it is the reason this change is staged. If
`FORCE ROW LEVEL SECURITY` is enabled while the application still connects as
owner and never sets the tenant variable, every query returns zero rows. The
platform would not error - it would quietly report that every organisation has
no data, which on a compliance product is worse than an outage because it looks
like an answer.

### Elevation of privilege

*A tenant reaches platform scope.* Platform staff access is a separate mechanism
(`platform-admin`) with its own reconcile at boot. RLS policies must not be
written so that platform-scope reads break, which is why the policy below admits
a null tenant setting rather than failing closed on it - a deliberate trade,
recorded here rather than discovered later.

## What ships in this change

One migration that, for every table carrying `org_id`:

- enables row level security,
- creates a tenant policy if one does not already exist, keyed on
  `current_setting('app.current_org', true)`.

It does **not**:

- force row level security,
- create a database role,
- change the connection string,
- set the tenant variable per request.

Which means it changes no behaviour at all today: the application still connects
as the table owner, and an owner bypasses unforced RLS. The policies are
infrastructure placed in advance, and the coverage figure the admin database
posture endpoint already reports moves from 2 of 44 to the full set, so the gap
stops being invisible.

## Why enforcement is not flipped here

Flipping it requires two things this change cannot safely do on its own:

1. **A non-owner role.** `CREATE ROLE app_tenant ... NOBYPASSRLS`, granted only
   DML on the tenant tables.
2. **A new connection string.** The service must connect as that role, which
   means editing `DATABASE_URL` in Railway - an infrastructure credential
   change that belongs to the owner, not to an automated change.

And one thing that must come first in code: binding
`SET LOCAL app.current_org` on every request transaction. Until that binding
exists and is tested, a forced policy is the denial-of-service threat above.

## Rollout plan, in order

1. **Now.** Policies exist on all 44 tables, unforced. No behaviour change.
   Coverage is reported.
2. **Next.** Per-request tenant binding behind an environment flag, defaulting
   off. Tested by asserting that a bound connection sees one org and an unbound
   one sees everything, which is still true under owner bypass.
3. **Then.** Create the non-owner role in staging, point staging at it, run the
   existing cross-org isolation suite unchanged. It must pass without
   modification - if it needs weakening, enforcement is wrong.
4. **Then.** Force RLS on the tenant tables in staging and re-run.
5. **Finally.** Production: role, connection string, force. Rollback is the
   previous connection string, which is why this order puts the credential
   change last and reversible.

No step is skippable. Step 5 before step 2 is the outage described under denial
of service.
