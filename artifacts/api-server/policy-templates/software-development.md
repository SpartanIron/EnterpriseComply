SECURE SOFTWARE DEVELOPMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes security requirements for the software development lifecycle (SDLC) to ensure that security is built into [Organization Name]'s software from design through deployment.

2. SCOPE
This policy applies to all software developed, maintained, or customized by [Organization Name] employees or contractors, whether for internal use or delivery to clients.

3. SECURITY BY DESIGN
3.1 Threat modeling must be performed for all new significant features, integrations, or system components before development begins. Threat models must identify: what data is being handled, trust boundaries, potential adversary goals, and mitigating controls.
3.2 Security requirements must be defined alongside functional requirements and included in the definition of "done" for each feature.
3.3 Security architecture decisions must be reviewed by the Security team for systems handling Confidential or Restricted data before implementation.

4. SECURE CODING STANDARDS
4.1 All developers must be trained in secure coding practices relevant to their technology stack.
4.2 Code must follow OWASP guidelines for the relevant environment (OWASP Top 10 for web, OWASP Mobile Top 10 for mobile, OWASP API Security Top 10 for APIs).
4.3 The following vulnerabilities are unacceptable in production code and must be remediated before release: SQL injection, command injection, cross-site scripting (XSS), cross-site request forgery (CSRF), insecure deserialization, hard-coded credentials, and use of cryptographically weak algorithms.

5. CODE REVIEW
5.1 All code must be reviewed by at least one developer other than the author before merging to the main branch.
5.2 Code review must include a security review checklist appropriate to the change being made.

6. AUTOMATED SECURITY SCANNING
6.1 The following automated scanning must be integrated into the CI/CD pipeline:
- SAST (Static Application Security Testing): Run on every pull request and merge to main.
- SCA (Software Composition Analysis / dependency scanning): Run on every build. Dependencies with known Critical or High CVEs must block production deployment until updated or risk-accepted.
- Secrets scanning: Run on every commit. Commit containing detected secrets must be blocked; detected secrets must be treated as compromised and rotated immediately.
- Container image scanning (if applicable): Run before image publication.
6.2 Critical SAST findings must be reviewed within 24 hours; High findings within 5 business days.

7. SECRETS MANAGEMENT
7.1 No credentials, API keys, secrets, private keys, or passwords may be committed to version control under any circumstances.
7.2 All secrets must be stored in an approved secrets management service and accessed at runtime via environment variables or SDK.
7.3 Development and test credentials must be separate from production credentials.

8. ENVIRONMENTS
8.1 Production, staging, and development must be distinct environments with separate credentials and access controls.
8.2 Real customer data must not be used in development or staging environments. Test data must be synthetic or anonymized.
8.3 Production deployment access must be limited; all production deployments must occur via the CI/CD pipeline.

9. DEPENDENCY MANAGEMENT
9.1 All third-party dependencies must be tracked in a dependency manifest.
9.2 Dependencies must be regularly updated; end-of-life or abandoned dependencies must be replaced.
9.3 The organization must maintain a Software Bill of Materials (SBOM) for production systems.

10. ROLES AND RESPONSIBILITIES
- Security Team: Define scanning tools; review findings; conduct pre-release reviews.
- Engineering Leads: Enforce code review standards; ensure developers are trained.
- Developers: Follow secure coding practices; remediate security findings; never commit secrets.

Policy Owner: [CISO / Head of Engineering]
Effective Date: [DATE]
Next Review: [DATE]