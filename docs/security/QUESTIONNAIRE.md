# Security Questionnaire — Standard Responses

Last reviewed: 2026-08-10.

Pre-answered responses to the questions that appear in almost every enterprise
security review (SIG Lite, CAIQ, and most bespoke vendor questionnaires).
Answers marked **No** or **Partial** are accurate on purpose. A questionnaire
that claims everything is green does not survive a follow-up call.

## Company and product

**What does the product do?** Multi-tenant SaaS governance, risk and
compliance automation: control monitoring, evidence collection, framework
crosswalks, vendor risk, policy management, and audit package generation.

**Where is data hosted?** Railway, US West region. Cloudflare is the edge.
All data stays in the United States.

**Do you use subprocessors?** Yes. The current list is published in-product
under Sub-processors and includes Railway, Cloudflare, Resend, Stripe and the
integrations a customer chooses to connect. Customers are notified of changes.

**Is customer data used to train models?** No.

## Multi-tenancy and data segregation

**How is tenant data separated?** Logically, in a shared database, with three
independent layers: application-level org scoping on every query, PostgreSQL
row level security policies on all 51 tenant tables, and a least-privilege
database role. Layer three is in progress; see the caveat below.

**How do you prove separation?** A 442-assertion regression suite runs on
every push against a brand-new database. Forty-eight of those assertions do
nothing but attempt cross-tenant reads and writes across every module in both
directions and require each one to be refused.

**Has a cross-tenant exposure ever occurred?** No confirmed exposure. The
suite exists to keep that true.

**Caveat we disclose proactively:** the application currently connects to
PostgreSQL with a superuser role, which bypasses row level security. The
policies are installed and correct, but until the least-privilege role
cutover completes, the enforcing control is the application layer. We report
this state through an internal endpoint rather than assuming it.

## Access control

**Is MFA supported?** Yes — TOTP with backup codes.

**Can MFA be required?** Yes, per organisation, with a configurable enrolment
grace window.

**Is SSO supported?** Yes, SAML 2.0 per organisation, on the Enterprise plan.

**How are passwords stored?** They are not. Authentication is passwordless
magic link; there is no password to store, reuse or stuff.

**Role model?** Six roles: viewer, analyst, compliance manager, admin, owner,
and a platform super-admin. Enforced server-side on every request, not in the
UI.

**Session policy?** 8-hour absolute lifetime, 30-minute idle timeout, secure
+ httpOnly + SameSite cookies with the `__Secure-` prefix.

**How is privileged access to production controlled?** Deploys come only from
the `main` branch through CI. Super-admin actions in the product are audited.
Direct database access is restricted to platform engineers.

## Encryption

**In transit?** TLS 1.2+, HSTS one year with includeSubDomains, HTTP/2 and
HTTP/3, permanent redirect from HTTP.

**At rest?** Provider-managed volume encryption, plus AES-256-GCM encryption
of integration credentials at the application layer under a separate key.

**Key management?** Application keys are held as environment secrets, never in
source control. Rotation is supported through a transactional, idempotent
re-encryption endpoint and every rotation is audited.

**FIPS 140-3 validated?** Not currently. The algorithms are FIPS-approved but
the runtime module is not validated. Required only for FedRAMP.

## Logging and monitoring

**What is logged?** Every state-changing API call and every security-relevant
read: actor, organisation, action, resource, HTTP method and status, duration
and source IP. Request bodies are never logged.

**Is the audit trail tamper-proof?** Yes. Database triggers reject UPDATE and
DELETE on audit records. Evidence records are equally immutable and are
additionally chained with SHA-256 so tampering is detectable, not just
prevented.

**Retention?** Configurable per organisation. Default targets 365 days, with
90 days online, matching FedRAMP AU-11.

**Can a customer export their audit log?** Yes, and the export is itself
audited.

## Availability

**Uptime commitment?** Availability is published on the status page with 90
days of history. A contractual SLA is negotiated per Enterprise agreement.

**RTO/RPO?** 15 minutes / 0 for a bad deploy; 2 hours / 1 minute for logical
data corruption via point-in-time recovery; 4 hours / 24 hours for volume
loss. Regional and platform-loss scenarios are not yet covered — see
DR_BCP.md.

**Backups?** Point-in-time recovery plus daily volume snapshots.

**Are backups tested?** The schema rebuild path is tested on every single
push against an empty database. Full PITR restore drills are scheduled but
have not yet been performed. We say so rather than implying otherwise.

**Is there redundancy?** Not yet. One replica, one region.

## Secure development

**Code review required?** Pull requests require an approval and a CODEOWNERS
review. Administrators can currently bypass; closing that is an open item.

**Automated security testing?** CodeQL, Semgrep, gitleaks, GitHub secret
scanning with push protection, `pnpm audit`, a destructive-SQL migration
scan, a fresh-database migration test, and the full isolation/RBAC suite —
all on every push.

**Dependency management?** Dependabot alerts, automatic security updates, and
weekly grouped version updates.

**Penetration test?** Not yet performed. Scope is drafted in
VULNERABILITY_MANAGEMENT.md §5.

**Vulnerability disclosure?** security@colorcodesolutions.com, plus GitHub
private vulnerability reporting. 48-hour acknowledgement, 7-business-day
substantive response, 30-day patch target.

## Compliance

**SOC 2?** Not yet audited. Control readiness is documented in CONTROLS.md.

**ISO 27001?** No.

**FedRAMP?** Not authorised. The path and its blockers are documented; the
principal blocker is that the current hosting is commercial, not a
FedRAMP-authorised IaaS.

**CMMC?** Not assessed. Control overlap with the implemented set is high;
Level 2 self-assessment is the realistic next step after SOC 2.

**GDPR / data residency?** All data is stored in the United States. There is
no EU region today.

## Incident response

**Do you have a documented plan?** Yes — INCIDENT_RESPONSE.md.

**Notification timelines?** 24 hours from confirmation for a confirmed
cross-tenant exposure or unauthorised production access; 72 hours for
incidents where customer data may be implicated. Contractual terms override.

**Tabletop exercises?** Not yet performed. Quarterly cadence is planned.
