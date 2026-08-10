# Disaster Recovery and Business Continuity

Last reviewed: 2026-08-10. Owner: Platform Engineering.

## 1. Objectives

| Scenario | RTO (target) | RPO (target) | Currently achievable |
|---|---|---|---|
| Bad deploy / application regression | 15 min | 0 | Yes — redeploy previous Railway image |
| Data corruption caused by application bug | 2 h | 1 min | Yes — PostgreSQL point-in-time recovery |
| Accidental destructive change to audit or evidence | n/a | n/a | Not possible — WORM triggers reject UPDATE and DELETE |
| Loss of the database volume | 4 h | 24 h | Yes — daily volume snapshot restore |
| Loss of the Railway region (US West) | 24 h | 24 h | **Not yet** — no cross-region standby |
| Loss of the Railway platform / account | 72 h | 24 h | **Not yet** — backups are not held outside Railway |

The last two rows are the honest gaps. They are tracked in section 6.

## 2. What is backed up, and how

**PostgreSQL point-in-time recovery.** Enabled on the managed Postgres
service. Write-ahead log archiving allows restore to any minute inside the
retention window; the window observed on 2026-08-10 was approximately two
days. This is the primary control for logical corruption, because it can
recover to the minute *before* a bad migration or a bad bulk update.

**Daily volume snapshots.** Scheduled daily, roughly five days retained.
This is the control for physical volume loss.

**Application state.** The application is stateless. Everything durable is in
PostgreSQL. There is no local disk state to restore, which is why the
application RTO is a redeploy rather than a restore.

**Configuration.** Infrastructure and application configuration live in Git
(`railway.toml`, `nixpacks.toml`, workflow definitions, migrations). Secrets
live only in the Railway environment and are not in Git; they must be
re-supplied by an operator during a platform-loss rebuild.

## 3. Recovery procedures

### 3.1 Roll back a bad deploy
1. Railway → EnterpriseComply service → Deployments.
2. Select the last known-good deployment → Redeploy.
3. Confirm `GET /api/healthz` returns 200 and the public status page reports
   all five components healthy.
4. If the bad deploy included a migration, treat it as 3.2 instead — code
   rollback alone does not undo DDL.

### 3.2 Point-in-time database recovery
1. Identify the target timestamp: the last audit-log entry before the
   damaging action. The audit log is immutable, so it is trustworthy for this
   even if application data was tampered with.
2. Railway → Postgres → Backups → restore to that timestamp. Restore into a
   **new** service; never restore in place over a live database.
3. Point a staging deployment at the restored database and verify: row counts
   for the affected tenant, `GET /evidence/ledger/verify` reports
   `chainIntact: true`, and the isolation suite passes.
4. Cut `DATABASE_URL` over during a declared maintenance window.

### 3.3 Full rebuild after platform loss
1. Provision a new Railway project, PostgreSQL service and application
   service from `railway.toml`.
2. Restore the most recent snapshot.
3. Re-supply secrets from the password manager: `DATABASE_URL`,
   `BETTER_AUTH_SECRET`, `INTEGRATION_CREDENTIAL_KEY`, `RESEND_API_KEY`,
   `WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`.
   **`INTEGRATION_CREDENTIAL_KEY` is the one that cannot be regenerated** —
   without it, every stored integration credential is unrecoverable
   ciphertext and every customer must reconnect their integrations.
4. Update Cloudflare DNS to the new origin.
5. Run the isolation suite against the restored environment before removing
   the maintenance page.

## 4. Restore testing

Restore capability that has never been exercised is a claim, not a control.

| Test | Frequency | Evidence |
|---|---|---|
| Fresh-database migration test | Every push | `Migration Safety / Fresh-database migration test` in GitHub Actions builds the entire schema from empty and runs the full suite against it |
| Full isolation suite against a brand-new database | Every push | `Isolation & RBAC Tests` — 442 assertions |
| PITR restore into a scratch service | Quarterly | **Not yet performed — see section 6** |
| Full rebuild rehearsal | Annually | **Not yet performed — see section 6** |

The per-push fresh-database test is genuinely meaningful: it proves the
schema can be rebuilt from nothing and that the application works against it,
which is the hardest part of any rebuild.

## 5. Continuity of operations

- **Communications.** The public status page (`/status`) is served by the
  same application, so it shares its fate. Subscribers receive email alerts.
  A total outage requires an out-of-band channel; use the Cloudflare-hosted
  static page described in the incident response runbook.
- **On-call.** Scheduler failures page on-call through the Slack alert
  integration after two consecutive nightly failures, and
  `/healthz/scheduler` returns 503 so external monitoring can act on it.
- **Dependencies.** Cloudflare (edge), Railway (compute and database), Resend
  (transactional email), Stripe (billing). Loss of Resend blocks new sign-ins,
  because sign-in is magic-link only — this is the single most important
  third-party dependency to monitor.

## 6. Known gaps and remediation plan

| Gap | Impact | Remediation | Priority |
|---|---|---|---|
| Backups live in the same platform and region as production | A platform-level or account-level failure loses both | Nightly `pg_dump` to an independent object store in a second provider, encrypted with a separate key | High |
| Single region, single replica | Regional outage is a full outage; a deploy is a brief outage | Raise replica count to 2 (the service already has 24 vCPU / 24 GB of headroom), then evaluate a warm standby region | High |
| PITR window is ~2 days | Corruption discovered on day 3 is unrecoverable to the minute | Extend WAL retention to 14 days | Medium |
| No rehearsed restore | RTO figures are estimates, not measurements | Quarterly restore drill into a scratch service, recorded as evidence | High |
| Sign-in depends on a single email provider | Email outage prevents all authentication | Secondary email provider with automatic failover, or offer SSO to every plan | Medium |
| `INTEGRATION_CREDENTIAL_KEY` has no documented escrow | Key loss is unrecoverable customer data | Escrow in the password manager with two-person retrieval, documented in the runbook | High |

## Backup independence (off-platform copy)

Railway point-in-time recovery and volume snapshots both live inside the same
Railway account as production. A compromised, suspended or mis-operated account
takes every copy with it, which does not satisfy the backup-independence
expectation behind SOC 2 availability commitments or FedRAMP CP-9.

`scripts/offsite-backup.cjs` produces an encrypted `pg_dump` and stores it under a
different provider with a different credential (Cloudflare R2 by default, or any
S3-compatible endpoint).

- Cipher: AES-256-GCM. Key derived with `scrypt` (N=2^15, r=8, p=1) from
  `BACKUP_ENCRYPTION_PASSPHRASE`, which must be at least 32 characters. Per-file
  random salt and IV. File layout is `ECBK1 | salt(16) | iv(12) | ciphertext | tag(16)`,
  so tampering fails authentication rather than silently producing garbage.
- Upload is a hand-rolled AWS SigV4 `PutObject` — no SDK, so the backup path adds
  no transitive dependencies to the supply chain.
- A JSON manifest is written alongside each object recording the SHA-256 of the
  ciphertext, plaintext and ciphertext sizes, the cipher and the KDF parameters.
- The script never logs a secret. `--dry-run` prints the plan with the database
  credential redacted to `user:***@host`.

### Proving a backup is restorable

An unverified backup is a hypothesis. `--verify` decrypts a file and runs
`pg_restore --list` against it, then fails if the dump contains zero `TABLE DATA`
entries:

```
node scripts/offsite-backup.cjs --dry-run
node scripts/offsite-backup.cjs --local-only --out /tmp/db.enc
node scripts/offsite-backup.cjs --verify --in /tmp/db.enc
```

Last executed against the development database on 2026-08-10: dumped and
re-encrypted 642,906 bytes, decrypted cleanly, and `pg_restore --list` enumerated
73 `TABLE DATA` entries.

### Still outstanding (requires an operator, not the application)

- Create the R2 bucket and a bucket-scoped API token, and set
  `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`,
  `BACKUP_S3_SECRET_ACCESS_KEY` and `BACKUP_ENCRYPTION_PASSPHRASE` in Railway.
  Credential creation is deliberately not automated.
- Railway PITR retention is currently about two days of archive window. Extend it.
- A restore of the production database into a scratch service has not yet been
  timed, so the RTO figure in this document remains a target rather than an
  evidenced measurement.
