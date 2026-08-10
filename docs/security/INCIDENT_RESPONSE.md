# Security Incident Response

Last reviewed: 2026-08-10. Owner: Security Engineering.

## 1. Severity

| Sev | Definition | Page? | Customer notice |
|---|---|---|---|
| SEV-1 | Confirmed cross-tenant data exposure, confirmed unauthorised access to production data, ransomware, or full outage | Immediately, 24/7 | Within 24 h of confirmation, then daily |
| SEV-2 | Exploitable vulnerability in production, credential exposure, partial outage affecting a tenant | Within 1 h, business hours | Within 72 h if customer data is implicated |
| SEV-3 | Vulnerability with no confirmed exploitation, degraded component | Next business day | Status page only |
| SEV-4 | Informational, hardening opportunity | Backlog | None |

Contractual and regulatory clocks may be shorter than the table above. FedRAMP
requires US-CERT notification within one hour for confirmed incidents. Check
the customer agreement before relying on these defaults.

## 2. Phases

**Detect.** Sources: the immutable audit log (`security.*` events, especially
`security.authorization_denied` on another tenant's URL), the blocked-IP and
throttle views, Slack alerts from the scheduler, `/healthz/scheduler`
returning 503, the public status page, Dependabot and CodeQL, and
`security@colorcodesolutions.com` for external reports.

**Triage.** Assign an incident commander. Open a private channel. Start a
timestamped log immediately — the audit trail is immutable, so timestamps
from it are authoritative and can be cited later.

**Contain.**
- Compromised user: revoke sessions, block the source IP through the
  super-admin blocked-IP view, enable MFA enforcement on the organisation
  with `graceDays: 0`.
- Compromised integration credential: rotate through
  `POST /api/admin/credentials/rotate-key`. It is transactional and
  idempotent, so an interrupted rotation cannot leave the database half
  re-encrypted.
- Exploitable code path: revert on `main` and redeploy. Railway waits for CI,
  so a revert that fails CI will not ship.
- Suspected data exposure: do **not** delete anything. Evidence and audit
  records are WORM by design and deletion attempts will fail; that property is
  what makes the investigation defensible.

**Eradicate and recover.** Fix, add a regression test to the isolation suite
in the same change, redeploy, verify with `GET /api/admin/db-security` and
`GET /orgs/:id/evidence/ledger/verify`.

**Learn.** Blameless post-incident review within five business days. Every
review produces at least one automated test. The 442-assertion suite exists
because of this rule.

## 3. Evidence handling

- Preserve first, then remediate. Snapshot the database with PITR to the time
  of detection before changing anything.
- The audit log cannot be altered, so it needs no separate chain of custody
  beyond recording who exported it and when — and that export is itself
  audited.
- Evidence chain integrity can be proven to a third party at any time with
  `verify_evidence_chain()`.

## 4. Communications

- Internal: private incident channel, incident commander owns all updates.
- Customers: status page first, then direct email to affected tenants. Never
  speculate on cause or scope before containment.
- Regulators and authorities: as required by contract and jurisdiction.
- Public: security@colorcodesolutions.com is the published intake. Private
  vulnerability reporting is enabled on the GitHub repository. Acknowledge
  within 48 hours, substantive response within 7 business days, patch target
  30 days.

## 5. Roles

| Role | Responsibility |
|---|---|
| Incident commander | Owns the incident, makes the call on severity and customer notice |
| Technical lead | Containment and remediation |
| Communications lead | Status page, customer email, internal updates |
| Scribe | Timeline. Every action, with a timestamp |

In a small team one person may hold several roles, but the incident commander
must never also be the person writing the fix — the two jobs compete.

## 6. Readiness gaps

- No tabletop exercise has been run. Schedule one per quarter; the first
  should use the scenario "an authenticated customer reports seeing another
  tenant's control results".
- No off-platform log retention, so a platform-level incident could take the
  investigation trail with it.
- No formal on-call rotation outside the scheduler alerting.
