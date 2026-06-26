THIRD-PARTY ACCESS POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy governs the granting, management, and revocation of access to [Organization Name] systems, networks, and data by third-party entities including vendors, contractors, consultants, managed service providers, and business partners. Third-party access represents elevated risk due to reduced organizational control over third-party security practices.

2. SCOPE
This policy applies to all external entities that are granted any form of access to organizational systems, applications, networks, or data - including remote access, VPN access, API access, and physical access to facilities.

3. PRE-ACCESS REQUIREMENTS
3.1 Before any access is provisioned, the following must be completed:
- A signed Non-Disclosure Agreement (NDA) / Confidentiality Agreement
- A signed Third-Party Security Addendum or Data Processing Agreement (if third party will process personal data)
- A completed Third-Party Risk Assessment (see Risk Assessment Policy)
- Manager and IT approval of the access request
3.2 Third parties handling Restricted or CUI data must provide evidence of equivalent security controls (SOC 2 report, ISO 27001 certification, or completed security questionnaire within the last 12 months).
3.3 Third-party staff who will access Restricted data must complete [Organization Name]'s security awareness training or provide evidence of equivalent training at their organization.

4. ACCESS PROVISIONING
4.1 Third-party access must be provisioned on a least-privilege basis - access to the minimum data and systems necessary for the contracted purpose only.
4.2 Shared accounts for third-party access are prohibited. Each individual third-party user must have a unique account.
4.3 All third-party access must be time-bound: access expiration dates must be set at provisioning, aligned to contract duration but not to exceed 12 months without re-approval.
4.4 Third-party access must be documented in the access register, including: vendor name, individual name, access type, systems accessed, business justification, approver, and expiration date.

5. TECHNICAL CONTROLS FOR THIRD-PARTY ACCESS
5.1 Third-party remote access must occur via the organization's VPN or a dedicated secure remote access solution (e.g., jump server, identity-aware proxy).
5.2 Third-party access to production systems must use MFA.
5.3 Where technically feasible, third-party sessions accessing sensitive systems must be recorded and logs retained for 1 year.
5.4 Third parties must not be granted persistent privileged access. Just-in-time (JIT) or time-limited elevated access is preferred for privileged operations.
5.5 API access granted to third parties must use scoped API keys or OAuth tokens; credentials must be rotated quarterly or upon contract termination.

6. MONITORING
6.1 Third-party access activity must be included in the organization's access log monitoring.
6.2 Unusual access patterns (off-hours access, large data transfers, access to unexpected systems) must generate alerts.
6.3 A quarterly review of all active third-party access must be performed; unused access must be revoked.

7. REVOCATION
7.1 Access must be revoked within 24 hours of: contract termination, completion of the contracted work, or any security incident involving the third party.
7.2 IT must maintain an offboarding process for third parties equivalent to the employee offboarding process.

8. ROLES AND RESPONSIBILITIES
- Business Owner: Initiate third-party access requests; own the business relationship.
- IT/Security: Provision and monitor access; conduct quarterly access reviews.
- Procurement/Legal: Ensure contractual security requirements are in place.
- Third-Party Manager: Notify IT promptly when third-party individuals leave the vendor organization.

9. ENFORCEMENT
Granting third-party access without completing pre-access requirements is a policy violation. Third parties who violate access terms will have access immediately revoked and may face contractual penalties.

Policy Owner: [CISO / Procurement Manager]
Effective Date: [DATE]
Next Review: [DATE]