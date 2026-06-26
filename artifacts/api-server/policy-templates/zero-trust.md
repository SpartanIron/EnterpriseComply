ZERO TRUST ARCHITECTURE POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes [Organization Name]'s commitment to and requirements for implementing Zero Trust Architecture (ZTA) principles. Zero Trust rejects the assumption of implicit trust based on network location and replaces it with continuous, context-aware verification of every access request. ZTA aligns with NIST SP 800-207, CISA Zero Trust Maturity Model, and FedRAMP requirements for modern authorization.

2. SCOPE
This policy applies to all systems, users, devices, and data flows within [Organization Name]'s IT environment.

3. ZERO TRUST PRINCIPLES
3.1 Verify Explicitly: Every access request must be authenticated and authorized using all available data points: user identity, device health, location, service/workload, data classification, and anomaly signals. No user or device is implicitly trusted based on network location.

3.2 Least Privilege Access: Access is granted with the minimum permissions necessary for the specific task, for the minimum duration necessary. Just-in-time and just-enough-access approaches are preferred for privileged operations.

3.3 Assume Breach: Design and operate systems assuming that attackers are already present in the environment. Segment access, minimize blast radius, implement end-to-end encryption, and use monitoring to detect lateral movement.

4. IDENTITY VERIFICATION
4.1 Multi-factor authentication (MFA) is mandatory for all user access; see the MFA Policy. MFA must be phishing-resistant (TOTP minimum; FIDO2/passkeys strongly preferred for privileged access).
4.2 User accounts must be continuously evaluated against risk signals: unusual location, impossible travel, unusual access patterns, or device anomalies must trigger step-up authentication or session termination.
4.3 Service and machine identities must be managed using short-lived certificates or workload identity federation, not long-lived shared secrets.

5. DEVICE HEALTH VERIFICATION
5.1 Access to organizational resources must evaluate device health before granting access: OS patch level, antivirus/EDR status, disk encryption status, and MDM enrollment.
5.2 Non-compliant devices must be blocked from accessing Confidential or Restricted data.

6. NETWORK MICRO-SEGMENTATION
6.1 Network access must be granted to specific resources, not network segments.
6.2 Network micro-segmentation must be implemented using software-defined networking, security groups, or equivalent controls.
6.3 East-west traffic (internal service-to-service) must be encrypted and authenticated.

7. APPLICATION ACCESS
7.1 Applications must authenticate and authorize every request independently, not rely on network location as a trust signal.
7.2 Zero Trust Network Access (ZTNA) or an Identity-Aware Proxy must be used in preference to traditional VPN for accessing internal applications where technically feasible.

8. DATA PROTECTION
8.1 Data must be classified and protected based on its classification, not based on the network it traverses.
8.2 Data Loss Prevention (DLP) controls must be applied at the application and endpoint layer, independent of network perimeter.

9. CONTINUOUS MONITORING
9.1 Access patterns, anomalies, and policy violations must be monitored continuously.
9.2 Security analytics must aggregate signals from identity, device, network, and application layers to detect anomalous behavior.

10. ROLES AND RESPONSIBILITIES
- CISO: Own the Zero Trust strategy; maintain the maturity roadmap.
- IT/Security: Implement technical ZTA controls; operate ZTA tools.
- Engineering: Build applications to ZTA principles (verify explicitly, least privilege).

Policy Owner: [CISO]
Effective Date: [DATE]
Next Review: [DATE]