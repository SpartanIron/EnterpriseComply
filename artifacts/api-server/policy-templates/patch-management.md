PATCH MANAGEMENT POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes requirements for the timely identification and remediation of security patches and vulnerabilities across all organizational systems. Timely patching is one of the most effective defenses against cyberattacks. This policy satisfies CMMC SI.2.214, FedRAMP SI-2, and SOC 2 CC7.1.

2. SCOPE
This policy applies to all [Organization Name] systems subject to security patching: servers (physical and virtual), workstations, laptops, mobile devices, network devices, cloud instances, containers, and managed applications.

3. VULNERABILITY SCANNING
3.1 All in-scope systems must be scanned for missing patches and vulnerabilities at minimum:
- Production servers and critical infrastructure: Weekly
- Developer workstations and internal systems: Monthly
- Internet-facing systems: Weekly, plus after any significant software update or configuration change
- Container base images: On every build (CI/CD integration)
3.2 Scanning must use authenticated agents or credentials where possible.
3.3 Scan results must be made available to system owners and the Security team within 24 hours of scan completion.

4. PATCH PRIORITIZATION AND SLA
Patches must be applied within the following timeframes from the date the patch is made available:

CRITICAL patches (CVSS 9.0-10.0 or patches for actively exploited zero-days):
- 15 calendar days in standard cases
- 72 hours for patches addressing confirmed active exploitation in the wild (CISA KEV listed)

HIGH patches (CVSS 7.0-8.9):
- 30 calendar days

MEDIUM patches (CVSS 4.0-6.9):
- 90 calendar days

LOW patches (CVSS 0.1-3.9):
- 180 calendar days

5. PATCH TESTING
5.1 Critical and High patches for production servers must be tested in staging/non-production before production deployment where time permits.
5.2 All patch deployments must have a documented rollback plan.

6. PATCH DEPLOYMENT
6.1 Patches must be deployed via an approved patch management tool or automated pipeline.
6.2 Patch deployments to production systems during business hours require a change request per the Change Management Policy, except emergency patches for Critical/actively exploited vulnerabilities.
6.3 Systems that cannot be patched within SLA must have a formal risk acceptance approved by the CISO, with compensating controls documented.

7. END-OF-LIFE SOFTWARE
7.1 Software that no longer receives security patches from the vendor must not be used in production without a documented exception and compensating controls.
7.2 End-of-life software in production must be added to the risk register and tracked to replacement.

8. TRACKING AND REPORTING
Monthly patch compliance metrics must be reported to the CISO:
- Percentage of Critical/High patches applied within SLA (target: 100%)
- Number of systems with overdue patches (target: 0)
- Average time to patch by severity

9. ENFORCEMENT
Systems with overdue Critical or High patches that do not have an approved exception may be isolated from the production network until patched.

Policy Owner: [IT Manager / CISO]
Effective Date: [DATE]
Next Review: [DATE]