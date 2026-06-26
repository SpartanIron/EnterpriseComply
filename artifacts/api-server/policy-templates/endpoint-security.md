ENDPOINT SECURITY POLICY
Version: 1.0 | Review Cycle: Annual | Classification: Internal

1. PURPOSE
This policy establishes security requirements for all endpoint devices - workstations, laptops, mobile devices, and servers - used by [Organization Name] to prevent malware infection, data loss, and unauthorized access. This policy satisfies CMMC MP.2.120/SI.1.210, FedRAMP SC-28/SI-3, and SOC 2 CC6.8.

2. SCOPE
This policy applies to all endpoints used to access organizational systems or data: corporate-owned desktops, laptops, mobile devices, servers (physical and virtual), and approved BYOD devices.

3. ENDPOINT DETECTION AND RESPONSE (EDR)
3.1 All corporate-managed endpoints (workstations, laptops, servers) must have an approved EDR solution installed and actively running.
3.2 EDR must provide: real-time malware detection, behavioral monitoring, threat hunting capability, automated response to known threats, and forensic logging.
3.3 EDR agents must not be disabled or tampered with. Requests to temporarily disable EDR require written approval from the CISO and must be time-limited.
3.4 EDR alerts at High or Critical severity must be reviewed within 2 hours and investigated within 4 hours.

4. FULL DISK ENCRYPTION
4.1 Full disk encryption must be enabled on all portable endpoints (laptops, mobile devices) and on workstations that store Confidential or Restricted data.
4.2 Approved disk encryption technologies:
- Windows: BitLocker with TPM (minimum AES-128; AES-256 preferred)
- macOS: FileVault 2
- Linux: LUKS (AES-256)
- Mobile: iOS and Android enforce device encryption by default; MDM must verify this is enabled
4.3 Encryption must be managed and verified via MDM or endpoint management platform.
4.4 Encryption recovery keys must be stored in an approved escrow (MDM or secrets manager), not on the device itself.

5. MOBILE DEVICE MANAGEMENT (MDM)
5.1 All mobile devices and laptops used to access organizational resources must be enrolled in [Organization Name]'s MDM solution before access is permitted.
5.2 MDM must enforce: screen lock PIN/biometric, automatic screen lock after 5 minutes, full device encryption, EDR enrollment where applicable, and approved software catalog.
5.3 Non-compliant devices (MDM violations, missing encryption, unapproved OS version) must be automatically blocked from accessing organizational resources until compliant.

6. MALWARE PREVENTION
6.1 In addition to EDR, traditional anti-malware protection must be maintained on Windows endpoints.
6.2 Email security gateway with attachment sandboxing and URL filtering must be configured to scan all inbound email.
6.3 Web proxy or DNS filtering must block access to known malicious domains from all endpoints.
6.4 Macro execution in Office documents must be disabled by default.

7. PATCH MANAGEMENT
7.1 OS and software patches must be applied per the Patch Management Policy SLAs.
7.2 MDM must enforce OS update requirements; endpoints running end-of-life OS versions must be blocked from accessing organizational resources.

8. APPLICATION CONTROL
8.1 Only approved applications may be installed on corporate-managed endpoints.
8.2 Application whitelisting must be implemented on servers; servers must run only approved, necessary applications.

9. INCIDENT RESPONSE FOR ENDPOINT COMPROMISE
9.1 Any endpoint suspected of compromise must be immediately isolated from the network.
9.2 Compromised endpoints must not be returned to production use until forensic investigation is complete and the device is verified clean or reimaged from a trusted baseline.

10. ROLES AND RESPONSIBILITIES
- IT: Deploy and manage EDR, encryption, and MDM; apply patches; respond to endpoint alerts.
- Security Team: Define requirements; monitor EDR alerts; investigate incidents.
- All Employees: Not disable security software; report unusual device behavior; return devices promptly upon request.

Policy Owner: [IT Manager / CISO]
Effective Date: [DATE]
Next Review: [DATE]