# Control Status — SOC 2, CMMC Level 2, FedRAMP Moderate

Last reviewed: 2026-08-10.

Status vocabulary, used strictly:

- **Enforced** — the control is implemented and a test proves it on every push.
- **Implemented** — implemented, but not yet covered by an automated test.
- **Partial** — implemented but with a stated limitation.
- **Planned** — not implemented. A date or a dependency is given.

EnterpriseComply has **not** completed a SOC 2 Type II audit and is **not**
FedRAMP authorised. This document describes engineering readiness, which is a
prerequisite for those, not a substitute.

## 1. Access control

| Control | SOC 2 | NIST 800-53 | CMMC L2 | Status | Evidence |
|---|---|---|---|---|---|
| Unique identity per user, no shared accounts | CC6.1 | IA-2 | IA.L2-3.5.1 | Enforced | better-auth user table; invite-only |
| Passwordless authentication, no password storage | CC6.1 | IA-5 | IA.L2-3.5.7 | Enforced | Magic link only; password provider disabled |
| Multi-factor authentication available | CC6.1 | IA-2(1) | IA.L2-3.5.3 | Enforced | TOTP + 10 backup codes |
| MFA enforceable per organisation | CC6.1 | IA-2(1) | IA.L2-3.5.3 | Enforced | `PATCH /orgs/:id/mfa-policy`; suite §36 |
| MFA enrolled by all privileged users | CC6.1 | IA-2(1) | IA.L2-3.5.3 | **Planned** | 0 users enrolled as of 2026-08-10 |
| Role-based authorisation, least privilege | CC6.3 | AC-6 | AC.L2-3.1.5 | Enforced | 6 roles; suite §4–§5, 19 assertions |
| Session timeout | CC6.1 | AC-12 | AC.L2-3.1.11 | Enforced | 8 h absolute, 30 min idle |
| Tenant isolation, application layer | CC6.1 | AC-3 | AC.L2-3.1.2 | Enforced | suite §1–§3, 48 assertions |
| Tenant isolation, database layer (RLS policies present) | CC6.1 | AC-3 | AC.L2-3.1.2 | Enforced | suite §35.2–35.5, 51 tables |
| Tenant isolation, database layer (actually enforcing) | CC6.1 | AC-3 | AC.L2-3.1.2 | **Partial** | App connects as superuser; `scripts/provision-app-role.cjs` prepared, cutover pending |
| SSO / SAML federation | CC6.1 | IA-8 | IA.L2-3.5.1 | Implemented | Enterprise plan; suite §14 |
| Access review workflow | CC6.2 | AC-2(3) | AC.L2-3.1.1 | Implemented | Access review module |
| Automatic role assignment from IdP groups | CC6.2 | AC-2 | AC.L2-3.1.1 | Planned | Backlog item |

## 2. Change management and secure development

| Control | SOC 2 | NIST 800-53 | Status | Evidence |
|---|---|---|---|---|
| All changes via version control | CC8.1 | CM-3 | Enforced | GitHub, single `main` |
| Peer review required | CC8.1 | CM-3 | **Partial** | Rule requires 1 approval + CODEOWNERS, but "Do not allow bypassing" is off, so administrators are exempt |
| Signed commits required | CC8.1 | CM-5 | **Partial** | Rule enabled but bypassable by administrators |
| CI must pass before merge | CC8.1 | CM-3 | **Planned** | "Require status checks" is not enabled on the branch rule |
| Static analysis on every push | CC7.1 | RA-5 | Enforced | CodeQL (actions, JS/TS, Python, Rust) + Semgrep SAST |
| Secret scanning with push protection | CC6.1 | IA-5 | Enforced | GitHub Secret Protection; gitleaks in CI |
| Dependency vulnerability alerts | CC7.1 | RA-5 | Enforced | Dependabot alerts + security updates |
| Scheduled dependency updates | CC7.1 | SI-2 | Enforced | `.github/dependabot.yml`, weekly, grouped |
| Destructive-SQL migration scan | CC8.1 | CM-3 | Enforced | `Migration Safety / Destructive SQL scan` |
| Schema rebuild proven from empty | A1.2 | CP-10 | Enforced | `Migration Safety / Fresh-database migration test` |
| Isolation and RBAC regression suite | CC6.1 | CA-2 | Enforced | 442 assertions, 37 sections, every push |

## 3. Data protection

| Control | SOC 2 | NIST 800-53 | CMMC L2 | Status | Evidence |
|---|---|---|---|---|---|
| TLS in transit, HSTS | CC6.7 | SC-8 | SC.L2-3.13.8 | Enforced | TLS 1.2+, HSTS 1 year + includeSubDomains |
| Encryption at rest | CC6.7 | SC-28 | SC.L2-3.13.16 | Implemented | Railway volume encryption |
| Application-layer credential encryption | CC6.7 | SC-28 | SC.L2-3.13.16 | Enforced | AES-256-GCM, suite §7, 8 assertions |
| Key rotation without downtime | CC6.7 | SC-12 | SC.L2-3.13.10 | Enforced | Transactional re-encryption endpoint, audited |
| Audit log immutability | CC7.2 | AU-9 | AU.L2-3.3.8 | Enforced | WORM trigger; suite §8, §35.10–35.11 |
| Evidence immutability | CC7.2 | AU-9 | AU.L2-3.3.8 | Enforced | WORM trigger + hash chain; suite §35.12–35.15 |
| Evidence retention with legal hold | CC7.2 | AU-11 | AU.L2-3.3.1 | Enforced | Soft delete + `legal_hold`; suite §35.18–35.21 |
| Independently verifiable evidence chain | CC7.2 | AU-9 | AU.L2-3.3.8 | Enforced | `verify_evidence_chain()` SQL function |
| Secure file upload and malware scanning | CC6.8 | SI-3 | SI.L2-3.14.2 | **Not applicable today** | No upload path exists; evidence is URL + metadata. Becomes required with object storage |
| Evidence URL scheme allow-list | CC6.8 | SI-10 | SI.L2-3.14.2 | Enforced | http/https only; suite §34 |

## 4. Application security

| Control | OWASP | Status | Evidence |
|---|---|---|---|
| Injection | A03:2021 | Enforced | All raw SQL parameterised; suite §32 round-trips hostile strings byte-for-byte to prove binding rather than filtering |
| Broken access control / IDOR / BOLA | A01:2021 | Enforced | suite §1–§5; strict integer id parsing after the `parseInt("1 OR 1=1")` finding |
| SSRF | A10:2021 | Enforced | All 22 connectors on `guardedFetch`; suite §10, §33 |
| XSS | A03:2021 | Enforced | React escaping; 2 audited `dangerouslySetInnerHTML` uses, both static; evidence URLs allow-listed |
| CSRF | A01:2021 | Enforced | SameSite=Lax + explicit CORS origin allow-list + credentialed requests only from allowed origins |
| Security misconfiguration | A05:2021 | Partial | helmet CSP at origin is strict; the Cloudflare edge policy is looser and takes precedence |
| Vulnerable components | A06:2021 | Enforced | Dependabot + `pnpm audit` gate |
| Identification and authentication failures | A07:2021 | Enforced | Magic link only, per-IP and per-email rate limits, IP blocking |
| Logging and monitoring failures | A09:2021 | Enforced | Global audit interceptor + immutable trail |

## 5. Logging and monitoring

| Control | SOC 2 | NIST 800-53 | Status |
|---|---|---|---|
| All state-changing API calls audited | CC7.2 | AU-2, AU-12 | Enforced — global interceptor |
| Audit content: who, what, when, where, outcome | CC7.2 | AU-3 | Enforced — actor, org, method, path, status, duration, source IP |
| Authorisation failures recorded as security events | CC7.2 | AU-6 | Enforced — `security.authorization_denied` |
| Admin and super-admin actions audited | CC7.2 | AU-2 | Enforced |
| Uptime and component health monitoring | A1.1 | SI-4 | Enforced — 5 probes, public status page, 90-day history |
| Alerting on job failure | CC7.3 | SI-4 | Enforced — Slack alert, `/healthz/scheduler` returns 503 |
| Centralised log retention off-platform | CC7.2 | AU-11 | **Planned** — logs currently only in Railway |
| Anomaly detection on authentication | CC7.3 | SI-4 | Partial — IP failure tracking and blocking; no behavioural baseline |

## 6. FedRAMP / DoD path

Being technically ready is roughly a quarter of FedRAMP. The rest is boundary,
personnel and process.

1. **Boundary.** Today the system runs on Railway (commercial) behind
   Cloudflare (commercial). FedRAMP Moderate requires a FedRAMP-authorised
   IaaS. This means a migration to AWS GovCloud, Azure Government or an
   equivalent, and it is the single largest item on the path. Nothing else
   should start before this decision is made.
2. **FIPS 140-3 validated cryptography.** AES-256-GCM is the right algorithm,
   but FedRAMP requires a validated module. Node's default OpenSSL build is
   not validated; a FIPS-mode runtime is required.
3. **Personnel.** US persons, screening, and for DoD/ITAR workloads
   citizenship requirements on anyone with production access.
4. **Documentation.** SSP against the NIST 800-53 Rev 5 Moderate baseline
   (~325 controls), plus a POA&M — the platform already generates both for
   customers, which is a meaningful head start on doing it for itself.
5. **Continuous monitoring.** Monthly authenticated vulnerability scans,
   annual penetration test, ConMon reporting to the authorising official.
6. **Third-party assessment.** 3PAO assessment and an agency sponsor.

**Realistic sequencing:** SOC 2 Type II first (6–12 months of evidence),
CMMC Level 2 self-assessment next since the control overlap is high, then
FedRAMP once a government customer is committed to sponsoring. Do not start
FedRAMP speculatively.
