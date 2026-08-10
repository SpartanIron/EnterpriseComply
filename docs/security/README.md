# EnterpriseComply Security Documentation

The package a customer security team asks for, kept in the repository so it
changes in the same pull request as the code it describes.

| Document | Answers |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How the system is built, where the trust boundaries are, what the diagram actually looks like |
| [CONTROLS.md](./CONTROLS.md) | Control-by-control status against SOC 2, CMMC Level 2 and FedRAMP Moderate, with the evidence for each |
| [DR_BCP.md](./DR_BCP.md) | RTO and RPO per scenario, what is backed up, how to restore, what has actually been tested |
| [VULNERABILITY_MANAGEMENT.md](./VULNERABILITY_MANAGEMENT.md) | What scans run, remediation SLAs, patching, open items |
| [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) | Severity model, phases, containment playbooks, notification timelines |
| [QUESTIONNAIRE.md](./QUESTIONNAIRE.md) | Pre-answered responses to standard enterprise security questionnaires |

## House rules for these documents

1. **Never claim a control the tests do not prove.** Every "Enforced" status
   points at a specific assertion in `artifacts/api-server/scripts/test-suite.mjs`.
2. **State gaps in the document, not in a follow-up email.** A reviewer who
   finds an undisclosed gap stops trusting the whole package.
3. **Update in the same pull request as the change.** A security document that
   lags the code is worse than no document.

## Live posture endpoints

These return the real state of the running system rather than a description
of it, and are the fastest way to answer an auditor:

| Endpoint | Shows |
|---|---|
| `GET /api/admin/db-security` | Connected role, whether RLS is actually enforcing, tenant policy coverage, WORM triggers, TLS, open findings |
| `GET /api/admin/audit-retention` | Audit volume, oldest and newest entry, retention against the 90/365-day requirements |
| `GET /api/orgs/:orgId/mfa-policy` | MFA policy and live enrolment coverage for a tenant |
| `GET /api/orgs/:orgId/evidence/ledger/verify` | Cryptographic verification of the evidence hash chain |
| `GET /api/orgs/:orgId/evidence/ledger/worm-status` | Confirms the immutability triggers survived the last restart |
| `GET /api/public/status` | Component health and 90 days of uptime history |
